// Copyright (C) 2026 Francisco Peña Gallardo (Reox Lab)
//
// This file is part of PlotX.
//
// PlotX is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// PlotX is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with PlotX. If not, see <https://www.gnu.org/licenses/>.

// PlotX — punto de entrada: construye la interfaz en `#app`, gestiona el estado
// global y conecta parser, muestreo, gráfica Canvas/SVG, código Python, presets,
// importación de datos, temas y enlaces compartibles.

import 'katex/dist/katex.min.css'
import './style.css'
import katex from 'katex'
import { compileFunction, toLatex, type CompiledFunction } from './parser'
import {
  derivativeSamples,
  findRoots,
  numericDerivative,
  sampleFunction,
} from './sampler'
import {
  buildSvg,
  pixelToData,
  renderPlot,
  type Curve,
  type PlotData,
  type PlotOptions,
  type PlotScale,
  type ViewState,
} from './plot'
import { generatePython } from './codegen'
import { PRESETS, type Preset } from './presets'
import {
  loadSpreadsheet,
  parseDelimitedText,
  type DataSeries,
  type SpreadsheetBook,
} from './dataimport'
import {
  readShareFromLocation,
  writeShareToLocation,
  type SharedState,
} from './share'
import {
  loadThemeChoice,
  resolveTheme,
  saveThemeChoice,
  type ThemeChoice,
} from './theme'
import { canvasToPngBlob, copyText, downloadBlob } from './ui'

interface PlotxWindow extends Window {
  PLOTX_CONFIG?: { brandLink?: number }
  umami?: { track: (name: string, data?: Record<string, string>) => void }
}

interface FunctionItem {
  id: number
  expr: string
  color: string
  showDerivative: boolean
}

interface DatasetItem extends DataSeries {
  id: number
  color: string
}

interface ActiveTangent {
  fnIndex: number
  x0: number
  y0: number
  slope: number
  color: string
}

const DEFAULT_COLORS = [
  '#80001E',
  '#CCA757',
  '#131315',
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
]

const MAX_FUNCTIONS = 4

function defaultColorFor(index: number): string {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length]
}

function defaultTitleFor(firstExpr: string): string {
  const clean = firstExpr.trim()
  return clean ? `Gráfica de f(x) = ${clean}` : 'Gráfica de f(x)'
}

function track(eventName: string, data?: Record<string, string>): void {
  const w = window as PlotxWindow
  try {
    w.umami?.track(eventName, data)
  } catch {
    // Umami no disponible en local o bloqueado: ignorar sin afectar la app.
  }
}

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Falta #app en index.html')

app.innerHTML = `
  <header class="px-header">
    <div class="px-header-inner">
      <div class="px-header-text">
        <a id="brand-link" class="px-brand" href="https://reoxlab.com" hidden>← Reox Lab</a>
        <h1>PlotX</h1>
        <p class="px-tagline">Graficador de funciones matemáticas con código Python (Matplotlib) listo para copiar</p>
      </div>
      <label class="px-theme-label">Tema
        <select class="px-theme-select" id="theme-select" aria-label="Tema de la aplicación">
          <option value="system">Sistema</option>
          <option value="light">Claro</option>
          <option value="dark">Oscuro</option>
        </select>
      </label>
    </div>
  </header>

  <main class="px-main">
    <div class="px-col">
      <section class="px-panel" aria-label="Gráfica interactiva">
        <div class="px-panel-head">
          <h2 class="px-panel-title">Gráfica</h2>
          <span class="px-panel-meta" id="view-summary">[-10, 10] × [-1.5, 1.5]</span>
        </div>
        <div class="px-toolbar" id="presets-bar" aria-label="Ejemplos rápidos">
          <span class="px-presets-label">Presets:</span>
        </div>
        <div class="px-canvas-wrap">
          <canvas id="plot-canvas" class="px-canvas" aria-label="Lienzo de la gráfica"></canvas>
          <div class="px-canvas-hint">
            <span>Rueda: zoom · Arrastre: desplazar · Clic en la gráfica: recta tangente</span>
            <span class="px-tangent-readout" id="tangent-readout" hidden></span>
          </div>
        </div>
        <div class="px-toolbar px-toolbar--bottom">
          <button class="px-btn px-btn--sm" id="btn-zoom-in" type="button" title="Acercar">Zoom +</button>
          <button class="px-btn px-btn--sm" id="btn-zoom-out" type="button" title="Alejar">Zoom −</button>
          <button class="px-btn px-btn--sm" id="btn-reset-view" type="button">Restablecer</button>
          <button class="px-btn px-btn--sm" id="btn-clear-tangent" type="button" hidden>Quitar tangente</button>
          <span class="px-spacer"></span>
          <button class="px-btn px-btn--sm" id="btn-download-png" type="button">PNG</button>
          <button class="px-btn px-btn--sm" id="btn-download-svg" type="button">SVG</button>
        </div>
      </section>

      <section class="px-panel" aria-label="Funciones a graficar">
        <div class="px-panel-head">
          <h2 class="px-panel-title">Funciones</h2>
          <button class="px-btn px-btn--sm px-btn--primary" id="btn-add-fn" type="button">+ Añadir función</button>
        </div>
        <div class="px-fn-list" id="fn-list"></div>
      </section>

      <section class="px-panel" aria-label="Importar datos">
        <div class="px-panel-head">
          <h2 class="px-panel-title">Datos importados (x, y)</h2>
          <div>
            <button class="px-btn px-btn--sm" id="btn-import-data" type="button">Importar CSV / XLSX / ODS</button>
            <input type="file" id="file-data" accept=".csv,.txt,.tsv,.xlsx,.xls,.ods" hidden />
          </div>
        </div>
        <div class="px-sheet-picker" id="sheet-picker" hidden>
          <label>Hoja
            <select class="px-select" id="sheet-select" aria-label="Hoja de cálculo a importar"></select>
          </label>
          <button class="px-btn px-btn--sm px-btn--primary" id="btn-sheet-import" type="button">Importar hoja</button>
          <button class="px-btn px-btn--sm" id="btn-sheet-cancel" type="button">Cancelar</button>
        </div>
        <p class="px-empty-note" id="import-status">
          Carga un archivo CSV, TSV, texto plano, XLSX, XLS u ODS con dos columnas (x, y) para graficar puntos junto a tus funciones.
        </p>
        <ul class="px-dataset-list" id="dataset-list" hidden></ul>
      </section>
    </div>

    <div class="px-col">
      <section class="px-panel" aria-label="Código Python Matplotlib">
        <div class="px-panel-head">
          <h2 class="px-panel-title">Código Python (Matplotlib)</h2>
          <span class="px-panel-meta">En vivo</span>
        </div>
        <pre class="px-code"><code id="code-output"></code></pre>
        <div class="px-actions">
          <button class="px-btn px-btn--primary" id="btn-copy-code" type="button">Copiar código</button>
          <button class="px-btn" id="btn-download-py" type="button">Descargar .py</button>
          <button class="px-btn px-btn--gold" id="btn-share-link" type="button">Copiar enlace</button>
          <span class="px-status" id="action-feedback" hidden></span>
        </div>
      </section>

      <section class="px-panel" aria-label="Opciones de vista y etiquetas">
        <div class="px-panel-head">
          <h2 class="px-panel-title">Opciones de vista</h2>
        </div>
        <div class="px-view-body">
          <div class="px-range-grid">
            <label class="px-field">x mín.
              <input class="px-input" type="number" step="any" id="opt-xmin" />
            </label>
            <label class="px-field">x máx.
              <input class="px-input" type="number" step="any" id="opt-xmax" />
            </label>
            <label class="px-field">y mín.
              <input class="px-input" type="number" step="any" id="opt-ymin" />
            </label>
            <label class="px-field">y máx.
              <input class="px-input" type="number" step="any" id="opt-ymax" />
            </label>
          </div>

          <div class="px-field-row">
            <label class="px-field">Escala
              <select class="px-select" id="opt-scale">
                <option value="linear">Lineal</option>
                <option value="semilogx">Log en X (semilogx)</option>
                <option value="semilogy">Log en Y (semilogy)</option>
                <option value="loglog">Log en ambos (loglog)</option>
              </select>
            </label>
            <label class="px-check">
              <input type="checkbox" id="opt-grid" checked /> Rejilla
            </label>
            <label class="px-check">
              <input type="checkbox" id="opt-legend" checked /> Leyenda
            </label>
          </div>

          <div class="px-labels-grid">
            <label class="px-field px-field--full">Título
              <input class="px-input px-input--text" type="text" id="opt-title" />
            </label>
            <label class="px-field">Eje X
              <input class="px-input px-input--text" type="text" id="opt-xlabel" />
            </label>
            <label class="px-field">Eje Y
              <input class="px-input px-input--text" type="text" id="opt-ylabel" />
            </label>
          </div>
        </div>
      </section>
    </div>
  </main>

  <footer class="px-footer">
    PlotX es software libre (GPL v3): puedes usarlo, estudiarlo, modificarlo y
    compartirlo. Código en
    <a href="https://github.com/reoxlab/plotx">github.com/reoxlab/plotx</a>.
    Tus datos no salen de tu navegador: todo se calcula y grafica aquí mismo, sin servidor.
  </footer>
`

// -- Enlace de marca controlado por config.js (oculto por defecto) ------------
const brandLink = document.querySelector<HTMLAnchorElement>('#brand-link')!
if ((window as PlotxWindow).PLOTX_CONFIG?.brandLink === 1) {
  brandLink.hidden = false
}

// -- Referencias del DOM ------------------------------------------------------
const canvas = document.querySelector<HTMLCanvasElement>('#plot-canvas')!
const viewSummaryEl = document.querySelector<HTMLSpanElement>('#view-summary')!
const tangentReadoutEl = document.querySelector<HTMLSpanElement>('#tangent-readout')!
const clearTangentBtn = document.querySelector<HTMLButtonElement>('#btn-clear-tangent')!
const presetsBar = document.querySelector<HTMLDivElement>('#presets-bar')!
const fnListEl = document.querySelector<HTMLDivElement>('#fn-list')!
const addFnBtn = document.querySelector<HTMLButtonElement>('#btn-add-fn')!
const codeOutputEl = document.querySelector<HTMLElement>('#code-output')!
const feedbackEl = document.querySelector<HTMLSpanElement>('#action-feedback')!

const xminInput = document.querySelector<HTMLInputElement>('#opt-xmin')!
const xmaxInput = document.querySelector<HTMLInputElement>('#opt-xmax')!
const yminInput = document.querySelector<HTMLInputElement>('#opt-ymin')!
const ymaxInput = document.querySelector<HTMLInputElement>('#opt-ymax')!
const scaleSelect = document.querySelector<HTMLSelectElement>('#opt-scale')!
const gridInput = document.querySelector<HTMLInputElement>('#opt-grid')!
const legendInput = document.querySelector<HTMLInputElement>('#opt-legend')!
const titleInput = document.querySelector<HTMLInputElement>('#opt-title')!
const xlabelInput = document.querySelector<HTMLInputElement>('#opt-xlabel')!
const ylabelInput = document.querySelector<HTMLInputElement>('#opt-ylabel')!

const importDataBtn = document.querySelector<HTMLButtonElement>('#btn-import-data')!
const fileDataInput = document.querySelector<HTMLInputElement>('#file-data')!
const sheetPickerEl = document.querySelector<HTMLDivElement>('#sheet-picker')!
const sheetSelectEl = document.querySelector<HTMLSelectElement>('#sheet-select')!
const sheetImportBtn = document.querySelector<HTMLButtonElement>('#btn-sheet-import')!
const sheetCancelBtn = document.querySelector<HTMLButtonElement>('#btn-sheet-cancel')!
const importStatusEl = document.querySelector<HTMLParagraphElement>('#import-status')!
const datasetListEl = document.querySelector<HTMLUListElement>('#dataset-list')!

// -- Estado global ------------------------------------------------------------
let nextId = 1
let functions: FunctionItem[] = [
  { id: nextId++, expr: 'sin(x)', color: defaultColorFor(0), showDerivative: false },
]
let datasets: DatasetItem[] = []
let view: ViewState = { xmin: -10, xmax: 10, ymin: -1.5, ymax: 1.5 }
let defaultResetRange = { xmin: -10, xmax: 10 }
let grid = true
let scale: PlotScale = 'linear'
let showLegend = true
let title = defaultTitleFor(functions[0].expr)
let titleManuallyEdited = false
let xlabel = 'x'
let ylabel = 'f(x)'
let tangent: ActiveTangent | null = null
let pendingBook: SpreadsheetBook | null = null
let feedbackTimer: number | null = null

let lastPlotData: PlotData = { curves: [], points: [], roots: [], tangent: null }
let compiledCache: (CompiledFunction | null)[] = []

function showFeedback(message: string): void {
  feedbackEl.textContent = message
  feedbackEl.hidden = false
  if (feedbackTimer !== null) window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => {
    feedbackEl.hidden = true
  }, 2000)
}

function fmtCompact(v: number): string {
  if (!Number.isFinite(v)) return '0'
  const clean = Math.abs(v) < 1e-12 ? 0 : v
  return String(Number(clean.toPrecision(4)))
}

function syncViewInputs(): void {
  xminInput.value = fmtCompact(view.xmin)
  xmaxInput.value = fmtCompact(view.xmax)
  yminInput.value = fmtCompact(view.ymin)
  ymaxInput.value = fmtCompact(view.ymax)
  scaleSelect.value = scale
  gridInput.checked = grid
  legendInput.checked = showLegend
  titleInput.value = title
  xlabelInput.value = xlabel
  ylabelInput.value = ylabel
  viewSummaryEl.textContent = `[${fmtCompact(view.xmin)}, ${fmtCompact(view.xmax)}] × [${fmtCompact(view.ymin)}, ${fmtCompact(view.ymax)}]`
}

function autoFitY(): void {
  const ys: number[] = []
  for (const item of functions) {
    if (!item.expr.trim()) continue
    try {
      const fn = compileFunction(item.expr)
      const sampled = sampleFunction(fn.evaluate, view.xmin, view.xmax, 300)
      for (const y of sampled.ys) {
        if (y !== null && Number.isFinite(y)) ys.push(y)
      }
    } catch {
      // Ignorar funciones con error al autoajustar.
    }
  }
  for (const ds of datasets) {
    for (const p of ds.points) {
      if (Number.isFinite(p.y)) ys.push(p.y)
    }
  }

  if (ys.length === 0) {
    view.ymin = -5
    view.ymax = 5
    return
  }

  ys.sort((a, b) => a - b)
  const rawMin = ys[0]
  const rawMax = ys[ys.length - 1]
  // Si hay picos extremos tipo asíntota o Lennard-Jones, recortamos por percentiles
  // para mantener visible la zona de interés.
  let lo = rawMin
  let hi = rawMax
  if (rawMax - rawMin > 30 && ys.length >= 20) {
    const p05 = ys[Math.floor(ys.length * 0.05)]
    const p92 = ys[Math.floor(ys.length * 0.92)]
    if (p92 > p05) {
      lo = Math.max(rawMin, p05 - (p92 - p05) * 0.25)
      hi = Math.min(rawMax, p92 + (p92 - p05) * 0.45)
    }
  }

  if (Math.abs(hi - lo) < 1e-6) {
    lo -= 1
    hi += 1
  } else {
    const pad = (hi - lo) * 0.15
    lo -= pad
    hi += pad
  }
  view.ymin = Number(lo.toPrecision(4))
  view.ymax = Number(hi.toPrecision(4))
}

function currentPlotOptions(): PlotOptions {
  return {
    grid,
    scale,
    showLegend,
    title,
    xlabel,
    ylabel,
  }
}

function buildSharedState(): SharedState {
  return {
    functions: functions.map((f) => ({
      expr: f.expr,
      color: f.color,
      showDerivative: f.showDerivative,
    })),
    xmin: view.xmin,
    xmax: view.xmax,
    ymin: view.ymin,
    ymax: view.ymax,
    grid,
    scale,
    showLegend,
    title,
    xlabel,
    ylabel,
  }
}

// -- Renderizado de filas de función (con KaTeX, errores y conteo de raíces) --
function renderFunctionRows(): void {
  fnListEl.innerHTML = ''
  addFnBtn.disabled = functions.length >= MAX_FUNCTIONS

  functions.forEach((item, idx) => {
    const row = document.createElement('div')
    row.className = 'px-fn-row'
    row.dataset.fnId = String(item.id)

    const top = document.createElement('div')
    top.className = 'px-fn-top'

    const tag = document.createElement('span')
    tag.className = 'px-fn-tag'
    tag.textContent = functions.length === 1 ? 'f(x) =' : `f${idx + 1}(x) =`

    const colorInput = document.createElement('input')
    colorInput.type = 'color'
    colorInput.className = 'px-color-input'
    colorInput.value = item.color
    colorInput.title = 'Color de la curva'
    colorInput.ariaLabel = `Color de la función ${idx + 1}`
    colorInput.addEventListener('input', () => {
      item.color = colorInput.value
      if (tangent && tangent.fnIndex === idx) {
        tangent.color = item.color
      }
      updatePlotAndCode()
    })

    const exprInput = document.createElement('input')
    exprInput.type = 'text'
    exprInput.className = 'px-input px-input--expr'
    exprInput.value = item.expr
    exprInput.placeholder = 'Ej. sin(x), exp(-x^2), x^3-3*x'
    exprInput.spellcheck = false
    exprInput.ariaLabel = `Expresión de la función ${idx + 1}`
    exprInput.addEventListener('input', () => {
      item.expr = exprInput.value
      if (idx === 0 && !titleManuallyEdited) {
        title = defaultTitleFor(item.expr)
        titleInput.value = title
      }
      if (tangent && tangent.fnIndex === idx) {
        tangent = null
      }
      updateFunctionRowMeta(row, item, idx)
      updatePlotAndCode()
    })

    const derivLabel = document.createElement('label')
    derivLabel.className = 'px-check'
    const derivCheck = document.createElement('input')
    derivCheck.type = 'checkbox'
    derivCheck.checked = item.showDerivative
    derivCheck.addEventListener('change', () => {
      item.showDerivative = derivCheck.checked
      updatePlotAndCode()
    })
    derivLabel.append(derivCheck, document.createTextNode('Derivada'))

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'px-btn px-btn--icon'
    delBtn.textContent = '✕'
    delBtn.title = 'Eliminar función'
    delBtn.disabled = functions.length <= 1
    delBtn.addEventListener('click', () => {
      if (functions.length <= 1) return
      functions.splice(idx, 1)
      if (tangent) {
        if (tangent.fnIndex === idx) tangent = null
        else if (tangent.fnIndex > idx) tangent.fnIndex--
      }
      if (!titleManuallyEdited) {
        title = defaultTitleFor(functions[0]?.expr ?? '')
        titleInput.value = title
      }
      renderFunctionRows()
      updatePlotAndCode()
    })

    top.append(tag, colorInput, exprInput, derivLabel, delBtn)

    const bottom = document.createElement('div')
    bottom.className = 'px-fn-bottom'

    const katexEl = document.createElement('div')
    katexEl.className = 'px-katex'
    const errEl = document.createElement('span')
    errEl.className = 'px-error-msg'
    errEl.hidden = true
    const rootsEl = document.createElement('span')
    rootsEl.className = 'px-roots-badge'

    bottom.append(katexEl, errEl, rootsEl)
    row.append(top, bottom)
    fnListEl.appendChild(row)
  })

  refreshAllRowMeta()
}

function updateFunctionRowMeta(
  row: HTMLElement,
  item: FunctionItem,
  idx: number,
): { compiled: CompiledFunction | null; roots: number[] } {
  const katexEl = row.querySelector<HTMLDivElement>('.px-katex')!
  const errEl = row.querySelector<HTMLSpanElement>('.px-error-msg')!
  const rootsEl = row.querySelector<HTMLSpanElement>('.px-roots-badge')!

  try {
    const compiled = compileFunction(item.expr)
    const roots = findRoots(compiled.evaluate, view.xmin, view.xmax)
    row.classList.remove('px-fn-row--error')
    errEl.hidden = true
    errEl.textContent = ''
    katexEl.hidden = false
    const fnPrefix = functions.length === 1 ? 'f(x)' : `f_{${idx + 1}}(x)`
    const tex = `${fnPrefix} = ${toLatex(item.expr)}`
    try {
      katexEl.innerHTML = katex.renderToString(tex, {
        throwOnError: false,
        displayMode: false,
      })
    } catch {
      katexEl.textContent = `${fnPrefix} = ${item.expr}`
    }
    rootsEl.textContent = `raíces: ${roots.length}`
    return { compiled, roots }
  } catch (err) {
    row.classList.add('px-fn-row--error')
    katexEl.hidden = true
    katexEl.innerHTML = ''
    errEl.hidden = false
    errEl.textContent =
      err instanceof Error ? err.message : 'Expresión inválida.'
    rootsEl.textContent = ''
    return { compiled: null, roots: [] }
  }
}

function refreshAllRowMeta(): {
  compiledList: (CompiledFunction | null)[]
  allRoots: { x: number; color: string }[]
} {
  const rows = fnListEl.querySelectorAll<HTMLElement>('.px-fn-row')
  const compiledList: (CompiledFunction | null)[] = []
  const allRoots: { x: number; color: string }[] = []

  functions.forEach((item, idx) => {
    const row = rows[idx]
    if (!row) return
    const { compiled, roots } = updateFunctionRowMeta(row, item, idx)
    compiledList.push(compiled)
    for (const r of roots) {
      allRoots.push({ x: r, color: item.color })
    }
  })

  return { compiledList, allRoots }
}

// -- Renderizado de series importadas -----------------------------------------
function renderDatasets(): void {
  datasetListEl.innerHTML = ''
  datasetListEl.hidden = datasets.length === 0

  datasets.forEach((ds, idx) => {
    const li = document.createElement('li')
    li.className = 'px-dataset-item'

    const colorInput = document.createElement('input')
    colorInput.type = 'color'
    colorInput.className = 'px-color-input'
    colorInput.value = ds.color
    colorInput.title = 'Color de los puntos'
    colorInput.ariaLabel = `Color de la serie ${ds.name}`
    colorInput.addEventListener('input', () => {
      ds.color = colorInput.value
      updatePlotAndCode()
    })

    const nameEl = document.createElement('span')
    nameEl.className = 'px-dataset-name'
    nameEl.textContent = ds.name

    const countEl = document.createElement('span')
    countEl.className = 'px-dataset-count'
    countEl.textContent = `${ds.points.length} puntos`

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'px-btn px-btn--icon'
    delBtn.textContent = '✕'
    delBtn.title = 'Eliminar serie'
    delBtn.addEventListener('click', () => {
      datasets.splice(idx, 1)
      renderDatasets()
      updatePlotAndCode()
    })

    li.append(colorInput, nameEl, countEl, delBtn)
    datasetListEl.appendChild(li)
  })
}

// -- Actualización principal (gráfica + código Python) ------------------------
function updatePlotAndCode(): void {
  const { compiledList, allRoots } = refreshAllRowMeta()
  compiledCache = compiledList

  const curves: Curve[] = []
  functions.forEach((item, idx) => {
    const compiled = compiledList[idx]
    if (!compiled) return
    const sampled = sampleFunction(compiled.evaluate, view.xmin, view.xmax, 400)
    const label =
      functions.length === 1
        ? `f(x) = ${item.expr.trim()}`
        : `f${idx + 1}(x) = ${item.expr.trim()}`
    curves.push({
      label,
      color: item.color,
      xs: sampled.xs,
      ys: sampled.ys,
    })

    if (item.showDerivative) {
      const deriv = derivativeSamples(
        compiled.evaluate,
        view.xmin,
        view.xmax,
        400,
      )
      curves.push({
        label:
          functions.length === 1
            ? "f'(x) (derivada)"
            : `f${idx + 1}'(x) (derivada)`,
        color: item.color,
        xs: deriv.xs,
        ys: deriv.ys,
        dashed: true,
      })
    }
  })

  // Recalcular y0/pendiente de la tangente si sigue activa
  if (tangent) {
    const target = compiledList[tangent.fnIndex]
    const targetFn = functions[tangent.fnIndex]
    if (!target || !targetFn) {
      tangent = null
    } else {
      const y0 = target.evaluate(tangent.x0)
      const slope = numericDerivative(target.evaluate, tangent.x0)
      if (Number.isFinite(y0) && Number.isFinite(slope)) {
        tangent = {
          fnIndex: tangent.fnIndex,
          x0: tangent.x0,
          y0,
          slope,
          color: targetFn.color,
        }
      } else {
        tangent = null
      }
    }
  }

  if (tangent) {
    tangentReadoutEl.hidden = false
    tangentReadoutEl.textContent = `Tangente en x = ${tangent.x0.toFixed(3)}, y = ${tangent.y0.toFixed(3)} · pendiente m = ${tangent.slope.toFixed(3)}`
    clearTangentBtn.hidden = false
  } else {
    tangentReadoutEl.hidden = true
    tangentReadoutEl.textContent = ''
    clearTangentBtn.hidden = true
  }

  lastPlotData = {
    curves,
    points: datasets.map((d) => ({
      name: d.name,
      color: d.color,
      points: d.points,
    })),
    roots: allRoots,
    tangent: tangent
      ? {
          x0: tangent.x0,
          y0: tangent.y0,
          slope: tangent.slope,
          color: tangent.color,
        }
      : null,
  }

  renderPlot(canvas, lastPlotData, view, currentPlotOptions())

  // Solo pasamos al generador Python las funciones compilables
  const validCodegenFns: {
    expr: string
    color: string
    showDerivative: boolean
    origIdx: number
  }[] = []
  functions.forEach((item, idx) => {
    if (compiledList[idx]) {
      validCodegenFns.push({
        expr: item.expr,
        color: item.color,
        showDerivative: item.showDerivative,
        origIdx: idx,
      })
    }
  })

  let codegenTangent: {
    fnIndex: number
    x0: number
    slope: number
    color: string
  } | null = null
  if (tangent) {
    const mappedIdx = validCodegenFns.findIndex(
      (f) => f.origIdx === tangent!.fnIndex,
    )
    if (mappedIdx >= 0) {
      codegenTangent = {
        fnIndex: mappedIdx,
        x0: tangent.x0,
        slope: tangent.slope,
        color: tangent.color,
      }
    }
  }

  codeOutputEl.textContent = generatePython({
    functions: validCodegenFns.map(({ expr, color, showDerivative }) => ({
      expr,
      color,
      showDerivative,
    })),
    datasets: datasets.map((d) => ({
      name: d.name,
      color: d.color,
      points: d.points,
    })),
    view,
    grid,
    scale,
    showLegend,
    title,
    xlabel,
    ylabel,
    tangent: codegenTangent,
  })

  viewSummaryEl.textContent = `[${fmtCompact(view.xmin)}, ${fmtCompact(view.xmax)}] × [${fmtCompact(view.ymin)}, ${fmtCompact(view.ymax)}]`
}

// -- Presets docentes ---------------------------------------------------------
function applyPreset(preset: Preset): void {
  const exprs = (preset.exprs ?? [preset.expr]).slice(0, MAX_FUNCTIONS)
  functions = exprs.map((expr, i) => ({
    id: nextId++,
    expr,
    color: defaultColorFor(i),
    showDerivative: false,
  }))
  view.xmin = preset.xmin
  view.xmax = preset.xmax
  defaultResetRange = { xmin: preset.xmin, xmax: preset.xmax }
  tangent = null
  scale = 'linear'
  if (!titleManuallyEdited) {
    title = preset.title ?? defaultTitleFor(preset.expr)
  }
  autoFitY()
  syncViewInputs()
  renderFunctionRows()
  updatePlotAndCode()
  track('plot-preset', { preset: preset.id })
}

for (const preset of PRESETS) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'px-btn px-btn--sm'
  btn.textContent = preset.name
  btn.title = `${preset.description} (${preset.expr})`
  btn.addEventListener('click', () => applyPreset(preset))
  presetsBar.appendChild(btn)
}

// -- Añadir función -----------------------------------------------------------
addFnBtn.addEventListener('click', () => {
  if (functions.length >= MAX_FUNCTIONS) return
  const defaults = ['cos(x)', 'x^2/10', 'exp(-x^2)']
  const nextExpr = defaults[(functions.length - 1) % defaults.length]
  functions.push({
    id: nextId++,
    expr: nextExpr,
    color: defaultColorFor(functions.length),
    showDerivative: false,
  })
  renderFunctionRows()
  updatePlotAndCode()
})

// -- Controles de vista y etiquetas ------------------------------------------
function zoomBy(factor: number, centerX?: number, centerY?: number): void {
  const cx = centerX ?? 0.5 * (view.xmin + view.xmax)
  const cy = centerY ?? 0.5 * (view.ymin + view.ymax)
  const newXmin = cx - (cx - view.xmin) * factor
  const newXmax = cx + (view.xmax - cx) * factor
  const newYmin = cy - (cy - view.ymin) * factor
  const newYmax = cy + (view.ymax - cy) * factor
  if (
    Number.isFinite(newXmin) &&
    Number.isFinite(newXmax) &&
    newXmax - newXmin > 1e-8 &&
    newXmax - newXmin < 1e9 &&
    Number.isFinite(newYmin) &&
    Number.isFinite(newYmax) &&
    newYmax - newYmin > 1e-8 &&
    newYmax - newYmin < 1e9
  ) {
    view = { xmin: newXmin, xmax: newXmax, ymin: newYmin, ymax: newYmax }
    syncViewInputs()
    updatePlotAndCode()
  }
}

document.querySelector<HTMLButtonElement>('#btn-zoom-in')!.addEventListener('click', () => {
  zoomBy(0.7)
})
document.querySelector<HTMLButtonElement>('#btn-zoom-out')!.addEventListener('click', () => {
  zoomBy(1 / 0.7)
})
document.querySelector<HTMLButtonElement>('#btn-reset-view')!.addEventListener('click', () => {
  view.xmin = defaultResetRange.xmin
  view.xmax = defaultResetRange.xmax
  tangent = null
  autoFitY()
  syncViewInputs()
  updatePlotAndCode()
})

clearTangentBtn.addEventListener('click', () => {
  tangent = null
  updatePlotAndCode()
})

function onRangeInputChange(): void {
  const xmin = Number(xminInput.value)
  const xmax = Number(xmaxInput.value)
  const ymin = Number(yminInput.value)
  const ymax = Number(ymaxInput.value)
  if (Number.isFinite(xmin) && Number.isFinite(xmax) && xmin < xmax) {
    view.xmin = xmin
    view.xmax = xmax
  }
  if (Number.isFinite(ymin) && Number.isFinite(ymax) && ymin < ymax) {
    view.ymin = ymin
    view.ymax = ymax
  }
  updatePlotAndCode()
}

for (const el of [xminInput, xmaxInput, yminInput, ymaxInput]) {
  el.addEventListener('change', onRangeInputChange)
}

scaleSelect.addEventListener('change', () => {
  scale = scaleSelect.value as PlotScale
  updatePlotAndCode()
})

gridInput.addEventListener('change', () => {
  grid = gridInput.checked
  updatePlotAndCode()
})

legendInput.addEventListener('change', () => {
  showLegend = legendInput.checked
  updatePlotAndCode()
})

titleInput.addEventListener('input', () => {
  title = titleInput.value
  titleManuallyEdited = true
  updatePlotAndCode()
})

xlabelInput.addEventListener('input', () => {
  xlabel = xlabelInput.value
  updatePlotAndCode()
})

ylabelInput.addEventListener('input', () => {
  ylabel = ylabelInput.value
  updatePlotAndCode()
})

// -- Interacción directa con el Canvas (zoom, arrastre y clic de tangente) ----
let dragStart: {
  clientX: number
  clientY: number
  view: ViewState
  moved: boolean
} | null = null

canvas.addEventListener(
  'wheel',
  (ev) => {
    ev.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const px = ev.clientX - rect.left
    const py = ev.clientY - rect.top
    const dataPt = pixelToData(px, py, rect.width, rect.height, view, scale)
    const factor = ev.deltaY < 0 ? 0.85 : 1 / 0.85
    zoomBy(factor, dataPt?.x, dataPt?.y)
  },
  { passive: false },
)

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return
  canvas.setPointerCapture(ev.pointerId)
  dragStart = {
    clientX: ev.clientX,
    clientY: ev.clientY,
    view: { ...view },
    moved: false,
  }
})

canvas.addEventListener('pointermove', (ev) => {
  if (!dragStart) return
  const dxPx = ev.clientX - dragStart.clientX
  const dyPx = ev.clientY - dragStart.clientY
  if (!dragStart.moved && Math.hypot(dxPx, dyPx) > 4) {
    dragStart.moved = true
    canvas.classList.add('is-dragging')
  }
  if (!dragStart.moved) return

  const rect = canvas.getBoundingClientRect()
  const plotW = Math.max(10, rect.width - 90)
  const plotH = Math.max(10, rect.height - 96)
  const dxData = -(dxPx / plotW) * (dragStart.view.xmax - dragStart.view.xmin)
  const dyData = (dyPx / plotH) * (dragStart.view.ymax - dragStart.view.ymin)

  view = {
    xmin: dragStart.view.xmin + dxData,
    xmax: dragStart.view.xmax + dxData,
    ymin: dragStart.view.ymin + dyData,
    ymax: dragStart.view.ymax + dyData,
  }
  syncViewInputs()
  updatePlotAndCode()
})

canvas.addEventListener('pointerup', (ev) => {
  if (!dragStart) return
  const wasMoved = dragStart.moved
  dragStart = null
  canvas.classList.remove('is-dragging')
  if (canvas.hasPointerCapture(ev.pointerId)) {
    canvas.releasePointerCapture(ev.pointerId)
  }

  if (wasMoved) return

  // Clic sin arrastre: calcular recta tangente de la función más cercana.
  const rect = canvas.getBoundingClientRect()
  const px = ev.clientX - rect.left
  const py = ev.clientY - rect.top
  const dataPt = pixelToData(px, py, rect.width, rect.height, view, scale)
  if (!dataPt) return

  let bestIdx = -1
  let bestDist = Infinity
  let bestY0 = NaN
  let bestSlope = NaN

  compiledCache.forEach((compiled, idx) => {
    if (!compiled) return
    const y0 = compiled.evaluate(dataPt.x)
    if (!Number.isFinite(y0)) return
    const slope = numericDerivative(compiled.evaluate, dataPt.x)
    if (!Number.isFinite(slope)) return
    const dist = Math.abs(y0 - dataPt.y)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = idx
      bestY0 = y0
      bestSlope = slope
    }
  })

  if (bestIdx >= 0) {
    tangent = {
      fnIndex: bestIdx,
      x0: dataPt.x,
      y0: bestY0,
      slope: bestSlope,
      color: functions[bestIdx].color,
    }
    updatePlotAndCode()
  }
})

canvas.addEventListener('pointercancel', () => {
  dragStart = null
  canvas.classList.remove('is-dragging')
})

// -- Importar datos (CSV / texto / XLSX / XLS / ODS) -------------------------
function addImportedSeries(series: DataSeries): void {
  const color = defaultColorFor(functions.length + datasets.length)
  datasets.push({
    id: nextId++,
    name: series.name,
    points: series.points,
    color,
  })
  importStatusEl.className = 'px-empty-note px-status'
  importStatusEl.textContent = series.truncated
    ? `Importados ${series.points.length} puntos de «${series.name}» (de ${series.totalPoints ?? series.points.length}; se limitaron a ${series.points.length} para no congelar la pestaña).`
    : `Importados ${series.points.length} puntos de «${series.name}».`
  renderDatasets()
  updatePlotAndCode()
  track('plot-import', { points: String(series.points.length) })
}

importDataBtn.addEventListener('click', () => {
  fileDataInput.value = ''
  fileDataInput.click()
})

fileDataInput.addEventListener('change', async () => {
  const file = fileDataInput.files?.[0]
  if (!file) return
  sheetPickerEl.hidden = true
  pendingBook = null

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  try {
    if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      importStatusEl.className = 'px-empty-note'
      importStatusEl.textContent = 'Leyendo hoja de cálculo…'
      const book = await loadSpreadsheet(file)
      if (book.sheetNames.length === 1) {
        addImportedSeries(book.importSheet(book.sheetNames[0]))
      } else {
        pendingBook = book
        sheetSelectEl.innerHTML = ''
        for (const name of book.sheetNames) {
          const opt = document.createElement('option')
          opt.value = name
          opt.textContent = name
          sheetSelectEl.appendChild(opt)
        }
        sheetPickerEl.hidden = false
        importStatusEl.textContent = `El archivo tiene ${book.sheetNames.length} hojas. Elige cuál importar.`
      }
    } else {
      const text = await file.text()
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'Datos'
      const series = parseDelimitedText(text, baseName)
      addImportedSeries(series)
    }
  } catch (err) {
    importStatusEl.className = 'px-empty-note px-status--error'
    importStatusEl.textContent =
      err instanceof Error ? err.message : 'No se pudo leer el archivo.'
  }
})

sheetImportBtn.addEventListener('click', () => {
  if (!pendingBook) return
  try {
    const series = pendingBook.importSheet(sheetSelectEl.value)
    pendingBook = null
    sheetPickerEl.hidden = true
    addImportedSeries(series)
  } catch (err) {
    importStatusEl.className = 'px-empty-note px-status--error'
    importStatusEl.textContent =
      err instanceof Error ? err.message : 'No se pudo importar la hoja.'
  }
})

sheetCancelBtn.addEventListener('click', () => {
  pendingBook = null
  sheetPickerEl.hidden = true
  importStatusEl.className = 'px-empty-note'
  importStatusEl.textContent = 'Importación cancelada.'
})

// -- Acciones de código, descargas y enlace compartible -----------------------
document.querySelector<HTMLButtonElement>('#btn-copy-code')!.addEventListener('click', async () => {
  const ok = await copyText(codeOutputEl.textContent ?? '')
  showFeedback(ok ? 'Código copiado' : 'No se pudo copiar')
  track('plot-copy-code')
})

document.querySelector<HTMLButtonElement>('#btn-download-py')!.addEventListener('click', () => {
  const blob = new Blob([codeOutputEl.textContent ?? ''], {
    type: 'text/x-python;charset=utf-8',
  })
  downloadBlob('grafica.py', blob)
  showFeedback('Descargado grafica.py')
  track('plot-download-py')
})

document.querySelector<HTMLButtonElement>('#btn-download-png')!.addEventListener('click', async () => {
  const blob = await canvasToPngBlob(canvas)
  if (!blob) return
  downloadBlob('grafica.png', blob)
  showFeedback('Descargado grafica.png')
  track('plot-download-png')
})

document.querySelector<HTMLButtonElement>('#btn-download-svg')!.addEventListener('click', () => {
  const svg = buildSvg(lastPlotData, view, currentPlotOptions(), 800, 500)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  downloadBlob('grafica.svg', blob)
  showFeedback('Descargado grafica.svg')
  track('plot-download-svg')
})

document.querySelector<HTMLButtonElement>('#btn-share-link')!.addEventListener('click', async () => {
  writeShareToLocation(buildSharedState())
  const ok = await copyText(window.location.href)
  showFeedback(ok ? 'Enlace copiado' : 'Enlace actualizado en la barra')
  track('plot-share')
})

// -- Tema claro / oscuro / sistema -------------------------------------------
const themeSelect = document.querySelector<HTMLSelectElement>('#theme-select')!
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
let themeChoice: ThemeChoice = loadThemeChoice(window.localStorage)

function applyTheme(): void {
  document.documentElement.dataset.theme = resolveTheme(
    themeChoice,
    mediaQuery.matches,
  )
  renderPlot(canvas, lastPlotData, view, currentPlotOptions())
}

themeSelect.value = themeChoice
themeSelect.addEventListener('change', () => {
  themeChoice = themeSelect.value as ThemeChoice
  saveThemeChoice(window.localStorage, themeChoice)
  applyTheme()
})
mediaQuery.addEventListener('change', () => {
  if (themeChoice === 'system') applyTheme()
})

// -- Redimensionamiento del lienzo -------------------------------------------
if (typeof ResizeObserver !== 'undefined') {
  const observer = new ResizeObserver(() => {
    renderPlot(canvas, lastPlotData, view, currentPlotOptions())
  })
  observer.observe(canvas)
}

// -- Restaurar estado desde URL compartida si existe --------------------------
const shared = readShareFromLocation()
let sharedHasY = false
if (shared) {
  functions = shared.functions.map((f) => ({
    id: nextId++,
    expr: f.expr,
    color: f.color,
    showDerivative: f.showDerivative === true,
  }))
  view.xmin = shared.xmin
  view.xmax = shared.xmax
  if (
    shared.ymin !== undefined &&
    shared.ymax !== undefined &&
    Number.isFinite(shared.ymin) &&
    Number.isFinite(shared.ymax) &&
    shared.ymin < shared.ymax
  ) {
    view.ymin = shared.ymin
    view.ymax = shared.ymax
    sharedHasY = true
  }
  defaultResetRange = { xmin: shared.xmin, xmax: shared.xmax }
  grid = shared.grid
  scale = shared.scale
  showLegend = shared.showLegend
  title = shared.title
  titleManuallyEdited = shared.title !== defaultTitleFor(functions[0]?.expr ?? '')
  xlabel = shared.xlabel
  ylabel = shared.ylabel
}

// -- Arranque inicial ---------------------------------------------------------
if (!sharedHasY) {
  autoFitY()
}
syncViewInputs()
renderFunctionRows()
renderDatasets()
applyTheme()
updatePlotAndCode()
