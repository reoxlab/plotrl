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

// PlotX — motor de dibujo compartido para Canvas (HiDPI) y exportación SVG.
// Ambos renderizadores usan exactamente los mismos márgenes, marcas, colores y
// transformaciones de coordenadas.

export interface ViewState {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
}

export interface Curve {
  label: string
  color: string
  xs: number[]
  ys: (number | null)[]
  dashed?: boolean
}

export interface Scatter {
  name: string
  color: string
  points: { x: number; y: number }[]
}

export interface TangentInfo {
  x0: number
  y0: number
  slope: number
  color: string
}

export interface PlotData {
  curves: Curve[]
  points: Scatter[]
  roots: { x: number; color: string }[]
  tangent?: TangentInfo | null
}

export type PlotScale = 'linear' | 'semilogx' | 'semilogy' | 'loglog'

export interface PlotOptions {
  grid: boolean
  scale: PlotScale
  showLegend: boolean
  title: string
  xlabel: string
  ylabel: string
}

interface PlotMargins {
  top: number
  right: number
  bottom: number
  left: number
}

interface PlotPalette {
  bg: string
  plotBg: string
  border: string
  grid: string
  axisZero: string
  text: string
  textMuted: string
  legendBg: string
  legendBorder: string
}

interface PlotGeometry {
  width: number
  height: number
  margins: PlotMargins
  plotX: number
  plotY: number
  plotW: number
  plotH: number
  logX: boolean
  logY: boolean
  domXmin: number
  domXmax: number
  domYmin: number
  domYmax: number
  xTicks: number[]
  yTicks: number[]
  emptyLogMessage: boolean
  toPxX: (x: number) => number | null
  toPxY: (y: number) => number | null
}

const MARGINS: PlotMargins = { top: 44, right: 24, bottom: 52, left: 66 }

const LIGHT_PALETTE: PlotPalette = {
  bg: '#ffffff',
  plotBg: '#ffffff',
  border: '#b8a4a8',
  grid: '#e6dce0',
  axisZero: '#7f777b',
  text: '#131315',
  textMuted: '#5b5560',
  legendBg: 'rgba(255, 255, 255, 0.92)',
  legendBorder: '#d3adb4',
}

const DARK_PALETTE: PlotPalette = {
  bg: '#1d1d21',
  plotBg: '#161619',
  border: '#574044',
  grid: '#2d2629',
  axisZero: '#8c8185',
  text: '#f0ebe6',
  textMuted: '#b3a8ab',
  legendBg: 'rgba(29, 29, 33, 0.92)',
  legendBorder: '#574044',
}

function activePalette(): PlotPalette {
  if (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.theme === 'dark'
  ) {
    return DARK_PALETTE
  }
  return LIGHT_PALETTE
}

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range))
  const frac = range / Math.pow(10, exp)
  let niceFrac: number
  if (round) {
    if (frac < 1.5) niceFrac = 1
    else if (frac < 3) niceFrac = 2
    else if (frac < 7) niceFrac = 5
    else niceFrac = 10
  } else {
    if (frac <= 1) niceFrac = 1
    else if (frac <= 2) niceFrac = 2
    else if (frac <= 5) niceFrac = 5
    else niceFrac = 10
  }
  return niceFrac * Math.pow(10, exp)
}

/**
 * Calcula marcas «bonitas» (pasos 1, 2 o 5 × 10^k) dentro de [min, max].
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return []
  const target = Math.max(2, count)
  const range = niceNum(max - min, false)
  const step = niceNum(range / (target - 1), true)
  if (!Number.isFinite(step) || step <= 0) return []

  const first = Math.ceil(min / step - 1e-9) * step
  const ticks: number[] = []
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 2)
  const factor = Math.pow(10, Math.min(decimals, 10))

  for (let i = 0; i < 60; i++) {
    const raw = first + i * step
    if (raw > max + step * 1e-6) break
    const rounded = Math.round(raw * factor) / factor
    const clean = Math.abs(rounded) < step * 1e-9 ? 0 : rounded
    if (clean >= min - step * 1e-6 && clean <= max + step * 1e-6) {
      ticks.push(clean)
    }
  }
  return ticks
}

function logTicks(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= min) {
    return []
  }
  const eMin = Math.floor(Math.log10(min))
  const eMax = Math.ceil(Math.log10(max))
  const decades = eMax - eMin
  const ticks: number[] = []

  const mults = decades <= 2 ? [1, 2, 5] : [1]
  for (let e = eMin; e <= eMax; e++) {
    const base = Math.pow(10, e)
    for (const m of mults) {
      const val = m * base
      if (val >= min * (1 - 1e-9) && val <= max * (1 + 1e-9)) {
        ticks.push(val)
      }
    }
  }
  if (ticks.length < 2) {
    return niceTicks(min, max, 5).filter((t) => t > 0)
  }
  return ticks
}

function formatTick(val: number, isLog: boolean): string {
  if (val === 0) return '0'
  const abs = Math.abs(val)
  if (isLog) {
    const log10 = Math.log10(abs)
    if (Math.abs(log10 - Math.round(log10)) < 1e-6) {
      const exp = Math.round(log10)
      if (exp >= -2 && exp <= 3) return String(Number(val.toPrecision(4)))
      return `1e${exp}`
    }
  }
  if (abs >= 1e5 || abs < 1e-3) {
    return val.toExponential(1).replace('+', '')
  }
  return String(Number(val.toPrecision(5)))
}

function computeGeometry(
  data: PlotData,
  view: ViewState,
  opts: PlotOptions,
  width: number,
  height: number,
): PlotGeometry {
  const plotX = MARGINS.left
  const plotY = MARGINS.top
  const plotW = Math.max(10, width - MARGINS.left - MARGINS.right)
  const plotH = Math.max(10, height - MARGINS.top - MARGINS.bottom)
  const logX = opts.scale === 'semilogx' || opts.scale === 'loglog'
  const logY = opts.scale === 'semilogy' || opts.scale === 'loglog'

  let hasAnyData = false
  let minPosX = Infinity
  let minPosY = Infinity
  let hasPosXInView = false
  let hasPosYInView = false

  for (const c of data.curves) {
    for (let i = 0; i < c.xs.length; i++) {
      const x = c.xs[i]
      const y = c.ys[i]
      if (y === null || !Number.isFinite(x) || !Number.isFinite(y)) continue
      hasAnyData = true
      if (x > 0 && x <= view.xmax && x >= Math.max(view.xmin, 0)) {
        hasPosXInView = true
        if (x < minPosX) minPosX = x
      }
      if (y > 0 && y <= view.ymax && y >= Math.max(view.ymin, 0)) {
        hasPosYInView = true
        if (y < minPosY) minPosY = y
      }
    }
  }

  for (const s of data.points) {
    for (const p of s.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      hasAnyData = true
      if (p.x > 0 && p.x <= view.xmax && p.x >= Math.max(view.xmin, 0)) {
        hasPosXInView = true
        if (p.x < minPosX) minPosX = p.x
      }
      if (p.y > 0 && p.y <= view.ymax && p.y >= Math.max(view.ymin, 0)) {
        hasPosYInView = true
        if (p.y < minPosY) minPosY = p.y
      }
    }
  }

  const invalidLogX = logX && (view.xmax <= 0 || (hasAnyData && !hasPosXInView))
  const invalidLogY = logY && (view.ymax <= 0 || (hasAnyData && !hasPosYInView))
  const emptyLogMessage = invalidLogX || invalidLogY

  const domXmax = view.xmax
  const domXmin = logX
    ? view.xmin > 0
      ? view.xmin
      : Number.isFinite(minPosX)
        ? Math.max(1e-9, Math.min(minPosX, domXmax / 10))
        : Math.max(1e-4, domXmax / 1000)
    : view.xmin

  const domYmax = view.ymax
  const domYmin = logY
    ? view.ymin > 0
      ? view.ymin
      : Number.isFinite(minPosY)
        ? Math.max(1e-9, Math.min(minPosY, domYmax / 10))
        : Math.max(1e-4, domYmax / 1000)
    : view.ymin

  const logXmin = logX && domXmin > 0 ? Math.log10(domXmin) : 0
  const logXmax = logX && domXmax > 0 ? Math.log10(domXmax) : 1
  const logYmin = logY && domYmin > 0 ? Math.log10(domYmin) : 0
  const logYmax = logY && domYmax > 0 ? Math.log10(domYmax) : 1

  const toPxX = (x: number): number | null => {
    if (!Number.isFinite(x)) return null
    if (logX) {
      if (x <= 0 || emptyLogMessage || logXmax <= logXmin) return null
      return plotX + ((Math.log10(x) - logXmin) / (logXmax - logXmin)) * plotW
    }
    if (domXmax <= domXmin) return null
    return plotX + ((x - domXmin) / (domXmax - domXmin)) * plotW
  }

  const toPxY = (y: number): number | null => {
    if (!Number.isFinite(y)) return null
    if (logY) {
      if (y <= 0 || emptyLogMessage || logYmax <= logYmin) return null
      return plotY + (1 - (Math.log10(y) - logYmin) / (logYmax - logYmin)) * plotH
    }
    if (domYmax <= domYmin) return null
    return plotY + (1 - (y - domYmin) / (domYmax - domYmin)) * plotH
  }

  const xTicks = emptyLogMessage
    ? []
    : logX
      ? logTicks(domXmin, domXmax)
      : niceTicks(domXmin, domXmax, 6)
  const yTicks = emptyLogMessage
    ? []
    : logY
      ? logTicks(domYmin, domYmax)
      : niceTicks(domYmin, domYmax, 5)

  return {
    width,
    height,
    margins: MARGINS,
    plotX,
    plotY,
    plotW,
    plotH,
    logX,
    logY,
    domXmin,
    domXmax,
    domYmin,
    domYmax,
    xTicks,
    yTicks,
    emptyLogMessage,
    toPxX,
    toPxY,
  }
}

/**
 * Convierte coordenadas de píxel CSS en el Canvas a coordenadas matemáticas (x, y).
 * Usa los mismos márgenes y transformación que `renderPlot`.
 */
export function pixelToData(
  px: number,
  py: number,
  width: number,
  height: number,
  view: ViewState,
  scale: PlotScale,
): { x: number; y: number } | null {
  const plotX = MARGINS.left
  const plotY = MARGINS.top
  const plotW = Math.max(10, width - MARGINS.left - MARGINS.right)
  const plotH = Math.max(10, height - MARGINS.top - MARGINS.bottom)
  if (px < plotX || px > plotX + plotW || py < plotY || py > plotY + plotH) {
    return null
  }
  const tx = (px - plotX) / plotW
  const ty = 1 - (py - plotY) / plotH
  const logX = scale === 'semilogx' || scale === 'loglog'
  const logY = scale === 'semilogy' || scale === 'loglog'

  let x: number
  if (logX) {
    if (view.xmax <= 0) return null
    const dmin = view.xmin > 0 ? view.xmin : Math.max(1e-4, view.xmax / 1000)
    const lmin = Math.log10(dmin)
    const lmax = Math.log10(view.xmax)
    x = Math.pow(10, lmin + tx * (lmax - lmin))
  } else {
    x = view.xmin + tx * (view.xmax - view.xmin)
  }

  let y: number
  if (logY) {
    if (view.ymax <= 0) return null
    const dmin = view.ymin > 0 ? view.ymin : Math.max(1e-4, view.ymax / 1000)
    const lmin = Math.log10(dmin)
    const lmax = Math.log10(view.ymax)
    y = Math.pow(10, lmin + ty * (lmax - lmin))
  } else {
    y = view.ymin + ty * (view.ymax - view.ymin)
  }

  return { x, y }
}

interface LegendItem {
  label: string
  color: string
  kind: 'line' | 'dashed' | 'dot'
}

function collectLegendItems(data: PlotData): LegendItem[] {
  const items: LegendItem[] = []
  for (const c of data.curves) {
    if (c.label) {
      items.push({
        label: c.label,
        color: c.color,
        kind: c.dashed ? 'dashed' : 'line',
      })
    }
  }
  for (const s of data.points) {
    items.push({ label: s.name, color: s.color, kind: 'dot' })
  }
  if (data.tangent) {
    items.push({
      label: `Tangente (m = ${data.tangent.slope.toFixed(2)})`,
      color: data.tangent.color,
      kind: 'dashed',
    })
  }
  return items
}

function buildCurveSegments(
  curve: Curve,
  geom: PlotGeometry,
): { x: number; y: number }[][] {
  const segments: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  const yLimit = geom.height * 6

  for (let i = 0; i < curve.xs.length; i++) {
    const xv = curve.xs[i]
    const yv = curve.ys[i]
    if (yv === null) {
      if (current.length >= 2) segments.push(current)
      current = []
      continue
    }
    const px = geom.toPxX(xv)
    const py = geom.toPxY(yv)
    if (
      px === null ||
      py === null ||
      !Number.isFinite(px) ||
      !Number.isFinite(py) ||
      Math.abs(py) > yLimit
    ) {
      if (current.length >= 2) segments.push(current)
      current = []
      continue
    }
    current.push({ x: px, y: py })
  }
  if (current.length >= 2) segments.push(current)
  return segments
}

function buildTangentPoints(
  tangent: TangentInfo,
  geom: PlotGeometry,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  const samples = geom.logX || geom.logY ? 80 : 2
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    const x = geom.logX
      ? Math.pow(
          10,
          Math.log10(geom.domXmin) +
            t * (Math.log10(geom.domXmax) - Math.log10(geom.domXmin)),
        )
      : geom.domXmin + t * (geom.domXmax - geom.domXmin)
    const y = tangent.y0 + tangent.slope * (x - tangent.x0)
    const px = geom.toPxX(x)
    const py = geom.toPxY(y)
    if (px !== null && py !== null && Math.abs(py) < geom.height * 8) {
      pts.push({ x: px, y: py })
    }
  }
  return pts
}

/**
 * Dibuja la gráfica en un `<canvas>` con soporte HiDPI (`devicePixelRatio`).
 */
export function renderPlot(
  canvas: HTMLCanvasElement,
  data: PlotData,
  view: ViewState,
  opts: PlotOptions,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = Math.max(300, Math.round(canvas.clientWidth || 800))
  const height = Math.max(220, Math.round(canvas.clientHeight || 500))
  const dpr = Math.min(window.devicePixelRatio || 1, 3)

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const pal = activePalette()
  const geom = computeGeometry(data, view, opts, width, height)

  // Fondo total y fondo del área de trazado
  ctx.fillStyle = pal.bg
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = pal.plotBg
  ctx.fillRect(geom.plotX, geom.plotY, geom.plotW, geom.plotH)

  // Área recortada de dibujo
  ctx.save()
  ctx.beginPath()
  ctx.rect(geom.plotX, geom.plotY, geom.plotW, geom.plotH)
  ctx.clip()

  // Rejilla
  if (opts.grid && !geom.emptyLogMessage) {
    ctx.strokeStyle = pal.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const tx of geom.xTicks) {
      const px = geom.toPxX(tx)
      if (px === null) continue
      ctx.moveTo(Math.round(px) + 0.5, geom.plotY)
      ctx.lineTo(Math.round(px) + 0.5, geom.plotY + geom.plotH)
    }
    for (const ty of geom.yTicks) {
      const py = geom.toPxY(ty)
      if (py === null) continue
      ctx.moveTo(geom.plotX, Math.round(py) + 0.5)
      ctx.lineTo(geom.plotX + geom.plotW, Math.round(py) + 0.5)
    }
    ctx.stroke()
  }

  // Ejes x = 0 e y = 0 en gris (solo en ejes lineales)
  if (!geom.emptyLogMessage) {
    ctx.strokeStyle = pal.axisZero
    ctx.lineWidth = 1.1
    ctx.beginPath()
    if (!geom.logX && geom.domXmin <= 0 && geom.domXmax >= 0) {
      const px0 = geom.toPxX(0)
      if (px0 !== null) {
        ctx.moveTo(Math.round(px0) + 0.5, geom.plotY)
        ctx.lineTo(Math.round(px0) + 0.5, geom.plotY + geom.plotH)
      }
    }
    if (!geom.logY && geom.domYmin <= 0 && geom.domYmax >= 0) {
      const py0 = geom.toPxY(0)
      if (py0 !== null) {
        ctx.moveTo(geom.plotX, Math.round(py0) + 0.5)
        ctx.lineTo(geom.plotX + geom.plotW, Math.round(py0) + 0.5)
      }
    }
    ctx.stroke()
  }

  if (geom.emptyLogMessage) {
    ctx.fillStyle = pal.textMuted
    ctx.font = '600 14px Montserrat, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      'Sin valores positivos en este rango',
      geom.plotX + geom.plotW / 2,
      geom.plotY + geom.plotH / 2,
    )
  } else {
    // Curvas
    for (const curve of data.curves) {
      const segments = buildCurveSegments(curve, geom)
      ctx.strokeStyle = curve.color
      ctx.lineWidth = curve.dashed ? 1.8 : 2.3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.setLineDash(curve.dashed ? [6, 4] : [])
      for (const seg of segments) {
        ctx.beginPath()
        ctx.moveTo(seg[0].x, seg[0].y)
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(seg[i].x, seg[i].y)
        }
        ctx.stroke()
      }
    }
    ctx.setLineDash([])

    // Puntos scatter importados
    for (const scatter of data.points) {
      ctx.fillStyle = scatter.color
      ctx.strokeStyle = pal.plotBg
      ctx.lineWidth = 1.2
      for (const p of scatter.points) {
        const px = geom.toPxX(p.x)
        const py = geom.toPxY(p.y)
        if (px === null || py === null) continue
        ctx.beginPath()
        ctx.arc(px, py, 4.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }

    // Raíces sobre el eje X
    if (!geom.logY) {
      const py0 = geom.toPxY(0)
      if (py0 !== null && py0 >= geom.plotY - 6 && py0 <= geom.plotY + geom.plotH + 6) {
        for (const r of data.roots) {
          const px = geom.toPxX(r.x)
          if (px === null) continue
          ctx.fillStyle = pal.plotBg
          ctx.strokeStyle = r.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(px, py0, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    // Recta tangente + punto marcado
    if (data.tangent) {
      const tPts = buildTangentPoints(data.tangent, geom)
      if (tPts.length >= 2) {
        ctx.strokeStyle = data.tangent.color
        ctx.lineWidth = 1.8
        ctx.setLineDash([7, 5])
        ctx.beginPath()
        ctx.moveTo(tPts[0].x, tPts[0].y)
        for (let i = 1; i < tPts.length; i++) {
          ctx.lineTo(tPts[i].x, tPts[i].y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      const px0 = geom.toPxX(data.tangent.x0)
      const py0 = geom.toPxY(data.tangent.y0)
      if (px0 !== null && py0 !== null) {
        ctx.fillStyle = data.tangent.color
        ctx.strokeStyle = pal.plotBg
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(px0, py0, 5.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }

  // Leyenda arriba a la derecha dentro del lienzo
  if (opts.showLegend) {
    const legendItems = collectLegendItems(data)
    if (legendItems.length > 0) {
      ctx.font = '600 12px Montserrat, system-ui, sans-serif'
      const lineH = 20
      const padX = 10
      const padY = 8
      const swatchW = 20
      const maxTextW = Math.max(
        ...legendItems.map((it) => ctx.measureText(it.label).width),
      )
      const boxW = Math.min(geom.plotW - 16, padX * 2 + swatchW + 8 + maxTextW)
      const boxH = padY * 2 + legendItems.length * lineH
      const boxX = geom.plotX + geom.plotW - boxW - 10
      const boxY = geom.plotY + 10

      ctx.fillStyle = pal.legendBg
      ctx.strokeStyle = pal.legendBorder
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(boxX, boxY, boxW, boxH, 6)
      ctx.fill()
      ctx.stroke()

      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      for (let i = 0; i < legendItems.length; i++) {
        const item = legendItems[i]
        const cy = boxY + padY + i * lineH + lineH / 2
        if (item.kind === 'dot') {
          ctx.fillStyle = item.color
          ctx.beginPath()
          ctx.arc(boxX + padX + swatchW / 2, cy, 4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.strokeStyle = item.color
          ctx.lineWidth = 2.2
          ctx.setLineDash(item.kind === 'dashed' ? [5, 3] : [])
          ctx.beginPath()
          ctx.moveTo(boxX + padX, cy)
          ctx.lineTo(boxX + padX + swatchW, cy)
          ctx.stroke()
          ctx.setLineDash([])
        }
        ctx.fillStyle = pal.text
        ctx.fillText(
          item.label,
          boxX + padX + swatchW + 8,
          cy,
          boxW - padX * 2 - swatchW - 8,
        )
      }
    }
  }

  ctx.restore()

  // Marco del área de trazado
  ctx.strokeStyle = pal.border
  ctx.lineWidth = 1.2
  ctx.strokeRect(
    geom.plotX + 0.5,
    geom.plotY + 0.5,
    geom.plotW - 1,
    geom.plotH - 1,
  )

  // Marcas y números de ejes
  ctx.fillStyle = pal.textMuted
  ctx.strokeStyle = pal.border
  ctx.lineWidth = 1
  ctx.font = '11px Montserrat, system-ui, sans-serif'

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const tx of geom.xTicks) {
    const px = geom.toPxX(tx)
    if (px === null || px < geom.plotX - 1 || px > geom.plotX + geom.plotW + 1) continue
    ctx.beginPath()
    ctx.moveTo(Math.round(px) + 0.5, geom.plotY + geom.plotH)
    ctx.lineTo(Math.round(px) + 0.5, geom.plotY + geom.plotH + 5)
    ctx.stroke()
    ctx.fillText(formatTick(tx, geom.logX), px, geom.plotY + geom.plotH + 8)
  }

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const ty of geom.yTicks) {
    const py = geom.toPxY(ty)
    if (py === null || py < geom.plotY - 1 || py > geom.plotY + geom.plotH + 1) continue
    ctx.beginPath()
    ctx.moveTo(geom.plotX - 5, Math.round(py) + 0.5)
    ctx.lineTo(geom.plotX, Math.round(py) + 0.5)
    ctx.stroke()
    ctx.fillText(formatTick(ty, geom.logY), geom.plotX - 8, py)
  }

  // Título y etiquetas de ejes
  ctx.fillStyle = pal.text
  if (opts.title.trim()) {
    ctx.font = '700 15px Montserrat, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(opts.title, geom.plotX + geom.plotW / 2, geom.margins.top / 2, width - 32)
  }

  if (opts.xlabel.trim()) {
    ctx.font = '600 12px Montserrat, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(opts.xlabel, geom.plotX + geom.plotW / 2, height - 8)
  }

  if (opts.ylabel.trim()) {
    ctx.save()
    ctx.font = '600 12px Montserrat, system-ui, sans-serif'
    ctx.translate(16, geom.plotY + geom.plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(opts.ylabel, 0, 0)
    ctx.restore()
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function n2(v: number): string {
  return v.toFixed(2)
}

/**
 * Construye un documento SVG completo con exactamente la misma geometría,
 * marcas, colores y datos que `renderPlot`.
 */
export function buildSvg(
  data: PlotData,
  view: ViewState,
  opts: PlotOptions,
  width = 800,
  height = 500,
): string {
  // La descarga SVG reproduce la gráfica tal como se ve (clara u oscura).
  const pal = activePalette()
  const geom = computeGeometry(data, view, opts, width, height)
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  )
  parts.push(
    `  <defs><clipPath id="px-clip"><rect x="${geom.plotX}" y="${geom.plotY}" width="${geom.plotW}" height="${geom.plotH}" /></clipPath></defs>`,
  )
  parts.push(
    `  <rect width="${width}" height="${height}" fill="${pal.bg}" />`,
  )
  parts.push(
    `  <rect x="${geom.plotX}" y="${geom.plotY}" width="${geom.plotW}" height="${geom.plotH}" fill="${pal.plotBg}" />`,
  )

  // Grupo recortado al área de la gráfica
  parts.push('  <g clip-path="url(#px-clip)">')

  if (opts.grid && !geom.emptyLogMessage) {
    for (const tx of geom.xTicks) {
      const px = geom.toPxX(tx)
      if (px === null) continue
      parts.push(
        `    <line x1="${n2(px)}" y1="${geom.plotY}" x2="${n2(px)}" y2="${geom.plotY + geom.plotH}" stroke="${pal.grid}" stroke-width="1" />`,
      )
    }
    for (const ty of geom.yTicks) {
      const py = geom.toPxY(ty)
      if (py === null) continue
      parts.push(
        `    <line x1="${geom.plotX}" y1="${n2(py)}" x2="${geom.plotX + geom.plotW}" y2="${n2(py)}" stroke="${pal.grid}" stroke-width="1" />`,
      )
    }
  }

  if (!geom.emptyLogMessage) {
    if (!geom.logX && geom.domXmin <= 0 && geom.domXmax >= 0) {
      const px0 = geom.toPxX(0)
      if (px0 !== null) {
        parts.push(
          `    <line x1="${n2(px0)}" y1="${geom.plotY}" x2="${n2(px0)}" y2="${geom.plotY + geom.plotH}" stroke="${pal.axisZero}" stroke-width="1.1" />`,
        )
      }
    }
    if (!geom.logY && geom.domYmin <= 0 && geom.domYmax >= 0) {
      const py0 = geom.toPxY(0)
      if (py0 !== null) {
        parts.push(
          `    <line x1="${geom.plotX}" y1="${n2(py0)}" x2="${geom.plotX + geom.plotW}" y2="${n2(py0)}" stroke="${pal.axisZero}" stroke-width="1.1" />`,
        )
      }
    }
  }

  if (geom.emptyLogMessage) {
    parts.push(
      `    <text x="${n2(geom.plotX + geom.plotW / 2)}" y="${n2(geom.plotY + geom.plotH / 2)}" text-anchor="middle" dominant-baseline="middle" fill="${pal.textMuted}" font-family="Montserrat, system-ui, sans-serif" font-size="14" font-weight="600">Sin valores positivos en este rango</text>`,
    )
  } else {
    for (const curve of data.curves) {
      const segments = buildCurveSegments(curve, geom)
      const dash = curve.dashed ? ' stroke-dasharray="6 4"' : ''
      const sw = curve.dashed ? '1.8' : '2.3'
      for (const seg of segments) {
        const d = seg
          .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${n2(pt.x)} ${n2(pt.y)}`)
          .join(' ')
        parts.push(
          `    <path d="${d}" fill="none" stroke="${escapeXml(curve.color)}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${dash} />`,
        )
      }
    }

    for (const scatter of data.points) {
      for (const p of scatter.points) {
        const px = geom.toPxX(p.x)
        const py = geom.toPxY(p.y)
        if (px === null || py === null) continue
        parts.push(
          `    <circle cx="${n2(px)}" cy="${n2(py)}" r="4.2" fill="${escapeXml(scatter.color)}" stroke="${pal.plotBg}" stroke-width="1.2" />`,
        )
      }
    }

    if (!geom.logY) {
      const py0 = geom.toPxY(0)
      if (py0 !== null && py0 >= geom.plotY - 6 && py0 <= geom.plotY + geom.plotH + 6) {
        for (const r of data.roots) {
          const px = geom.toPxX(r.x)
          if (px === null) continue
          parts.push(
            `    <circle cx="${n2(px)}" cy="${n2(py0)}" r="4" fill="${pal.plotBg}" stroke="${escapeXml(r.color)}" stroke-width="2" />`,
          )
        }
      }
    }

    if (data.tangent) {
      const tPts = buildTangentPoints(data.tangent, geom)
      if (tPts.length >= 2) {
        const d = tPts
          .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${n2(pt.x)} ${n2(pt.y)}`)
          .join(' ')
        parts.push(
          `    <path d="${d}" fill="none" stroke="${escapeXml(data.tangent.color)}" stroke-width="1.8" stroke-dasharray="7 5" />`,
        )
      }
      const px0 = geom.toPxX(data.tangent.x0)
      const py0 = geom.toPxY(data.tangent.y0)
      if (px0 !== null && py0 !== null) {
        parts.push(
          `    <circle cx="${n2(px0)}" cy="${n2(py0)}" r="5.5" fill="${escapeXml(data.tangent.color)}" stroke="${pal.plotBg}" stroke-width="2" />`,
        )
      }
    }
  }

  if (opts.showLegend) {
    const legendItems = collectLegendItems(data)
    if (legendItems.length > 0) {
      const lineH = 20
      const padX = 10
      const padY = 8
      const swatchW = 20
      const maxChars = Math.max(...legendItems.map((it) => it.label.length))
      const boxW = Math.min(geom.plotW - 16, Math.max(120, padX * 2 + swatchW + 8 + maxChars * 7.2))
      const boxH = padY * 2 + legendItems.length * lineH
      const boxX = geom.plotX + geom.plotW - boxW - 10
      const boxY = geom.plotY + 10

      parts.push(
        `    <rect x="${n2(boxX)}" y="${n2(boxY)}" width="${n2(boxW)}" height="${n2(boxH)}" rx="6" fill="${pal.legendBg}" stroke="${pal.legendBorder}" stroke-width="1" />`,
      )
      for (let i = 0; i < legendItems.length; i++) {
        const item = legendItems[i]
        const cy = boxY + padY + i * lineH + lineH / 2
        if (item.kind === 'dot') {
          parts.push(
            `    <circle cx="${n2(boxX + padX + swatchW / 2)}" cy="${n2(cy)}" r="4" fill="${escapeXml(item.color)}" />`,
          )
        } else {
          const dash = item.kind === 'dashed' ? ' stroke-dasharray="5 3"' : ''
          parts.push(
            `    <line x1="${n2(boxX + padX)}" y1="${n2(cy)}" x2="${n2(boxX + padX + swatchW)}" y2="${n2(cy)}" stroke="${escapeXml(item.color)}" stroke-width="2.2"${dash} />`,
          )
        }
        parts.push(
          `    <text x="${n2(boxX + padX + swatchW + 8)}" y="${n2(cy)}" dominant-baseline="middle" fill="${pal.text}" font-family="Montserrat, system-ui, sans-serif" font-size="12" font-weight="600">${escapeXml(item.label)}</text>`,
        )
      }
    }
  }

  parts.push('  </g>')

  // Marco
  parts.push(
    `  <rect x="${geom.plotX}" y="${geom.plotY}" width="${geom.plotW}" height="${geom.plotH}" fill="none" stroke="${pal.border}" stroke-width="1.2" />`,
  )

  // Marcas y números
  for (const tx of geom.xTicks) {
    const px = geom.toPxX(tx)
    if (px === null || px < geom.plotX - 1 || px > geom.plotX + geom.plotW + 1) continue
    parts.push(
      `  <line x1="${n2(px)}" y1="${geom.plotY + geom.plotH}" x2="${n2(px)}" y2="${geom.plotY + geom.plotH + 5}" stroke="${pal.border}" stroke-width="1" />`,
    )
    parts.push(
      `  <text x="${n2(px)}" y="${geom.plotY + geom.plotH + 18}" text-anchor="middle" fill="${pal.textMuted}" font-family="Montserrat, system-ui, sans-serif" font-size="11">${escapeXml(formatTick(tx, geom.logX))}</text>`,
    )
  }

  for (const ty of geom.yTicks) {
    const py = geom.toPxY(ty)
    if (py === null || py < geom.plotY - 1 || py > geom.plotY + geom.plotH + 1) continue
    parts.push(
      `  <line x1="${geom.plotX - 5}" y1="${n2(py)}" x2="${geom.plotX}" y2="${n2(py)}" stroke="${pal.border}" stroke-width="1" />`,
    )
    parts.push(
      `  <text x="${geom.plotX - 8}" y="${n2(py)}" text-anchor="end" dominant-baseline="middle" fill="${pal.textMuted}" font-family="Montserrat, system-ui, sans-serif" font-size="11">${escapeXml(formatTick(ty, geom.logY))}</text>`,
    )
  }

  // Título y ejes
  if (opts.title.trim()) {
    parts.push(
      `  <text x="${n2(geom.plotX + geom.plotW / 2)}" y="${n2(geom.margins.top / 2)}" text-anchor="middle" dominant-baseline="middle" fill="${pal.text}" font-family="Montserrat, system-ui, sans-serif" font-size="15" font-weight="700">${escapeXml(opts.title)}</text>`,
    )
  }
  if (opts.xlabel.trim()) {
    parts.push(
      `  <text x="${n2(geom.plotX + geom.plotW / 2)}" y="${height - 10}" text-anchor="middle" fill="${pal.text}" font-family="Montserrat, system-ui, sans-serif" font-size="12" font-weight="600">${escapeXml(opts.xlabel)}</text>`,
    )
  }
  if (opts.ylabel.trim()) {
    const yMid = geom.plotY + geom.plotH / 2
    parts.push(
      `  <text x="16" y="${n2(yMid)}" text-anchor="middle" dominant-baseline="hanging" transform="rotate(-90 16 ${n2(yMid)})" fill="${pal.text}" font-family="Montserrat, system-ui, sans-serif" font-size="12" font-weight="600">${escapeXml(opts.ylabel)}</text>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}
