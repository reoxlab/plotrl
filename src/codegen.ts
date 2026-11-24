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

// PlotX — generador de scripts Python (NumPy + Matplotlib) reproducibles.

import { compileFunction, toLatex, toPython } from './parser'
import type { PlotScale, ViewState } from './plot'

export interface CodegenFunction {
  expr: string
  color: string
  showDerivative: boolean
}

export interface CodegenDataset {
  name: string
  color: string
  points: { x: number; y: number }[]
}

export interface CodegenTangent {
  fnIndex: number
  x0: number
  slope: number
  color: string
}

export interface CodegenInput {
  functions: CodegenFunction[]
  datasets: CodegenDataset[]
  view: ViewState
  grid: boolean
  scale: PlotScale
  showLegend: boolean
  title: string
  xlabel: string
  ylabel: string
  tangent?: CodegenTangent | null
}

function pyStr(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    // Matplotlib interpreta `$` como mathtext: emitir `\$` (doble barra en
    // el fuente, para no dejar una secuencia de escape inválida en Python).
    .replace(/\$/g, () => '\\\\$')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  return `"${escaped}"`
}

function pyRawStr(value: string): string {
  // Raw string: no puede terminar en barra invertida (cerraría el escape).
  let safe = value.replace(/"/g, '\\"')
  if (safe.endsWith('\\')) safe += ' '
  return `r"${safe}"`
}

// Una línea para interpolar texto de usuario en comentarios Python:
// un salto de línea en un nombre permitiría inyectar código ejecutable.
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Object.is(n, -0)) return '0'
  if (Number.isInteger(n)) return String(n)
  return String(Number(n.toPrecision(7)))
}

function formatNumList(values: number[]): string {
  // Precisión completa (toFixed(6) convertía 4e-7 en 0.000000).
  // String(n) da la representación más corta que redondea al mismo double,
  // válida como literal float en Python (incluida la notación 4e-7).
  return `[${values.map((v) => (Number.isFinite(v) ? String(v) : '0')).join(', ')}]`
}

/**
 * Genera un script Python completo y ejecutable con Matplotlib que reproduce
 * exactamente la gráfica visible (funciones, derivadas, datos, tangente,
 * colores, escalas, rejilla, leyenda y etiquetas).
 */
export function generatePython(input: CodegenInput): string {
  const lines: string[] = []
  // Solo funciones con expresión válida: una expresión con error no se
  // grafica en la app, así que tampoco debe aparecer en el script.
  const validFunctions = input.functions.filter((f) => {
    if (f.expr.trim() === '') return false
    try {
      compileFunction(f.expr)
      return true
    } catch {
      return false
    }
  })
  const logX = input.scale === 'semilogx' || input.scale === 'loglog'
  const logY = input.scale === 'semilogy' || input.scale === 'loglog'

  lines.push('# Script generado por PlotX (Reox Lab)')
  lines.push('import numpy as np')
  lines.push('import matplotlib.pyplot as plt')
  lines.push('')

  // Dominio de muestreo
  lines.push('# Rango de valores en x')
  lines.push(
    `x = np.linspace(${fmtNum(input.view.xmin)}, ${fmtNum(input.view.xmax)}, 400)`,
  )
  lines.push('')

  lines.push('plt.figure(figsize=(8, 5))')
  lines.push('')

  // Evaluación y trazado de funciones
  const singleFn = validFunctions.length === 1
  validFunctions.forEach((fn, idx) => {
    const varName = singleFn ? 'y' : `y${idx + 1}`
    const fnLabel = singleFn ? 'f(x)' : `f_${idx + 1}(x)`
    const pyExpr = toPython(fn.expr)
    const latexExpr = toLatex(fn.expr)
    const usesX = /\bx\b/.test(pyExpr)

    lines.push(`# Función ${idx + 1}: ${oneLine(fn.expr)}`)
    lines.push('with np.errstate(divide="ignore", invalid="ignore", over="ignore"):')
    lines.push(`    ${varName} = ${pyExpr}`)
    if (!usesX) {
      lines.push(`    ${varName} = np.full_like(x, ${varName}, dtype=float)`)
    }
    lines.push(
      `    ${varName} = np.where(np.isfinite(${varName}), ${varName}, np.nan)`,
    )
    lines.push(
      `plt.plot(x, ${varName}, color=${pyStr(fn.color)}, linewidth=2, label=${pyRawStr(`$${fnLabel} = ${latexExpr}$`)})`,
    )

    if (fn.showDerivative) {
      const derivVar = singleFn ? 'dy' : `dy${idx + 1}`
      const derivLabel = singleFn
        ? "f'(x) (derivada)"
        : `f_${idx + 1}'(x) (derivada)`
      lines.push(`# Derivada numérica de la función ${idx + 1}`)
      lines.push('with np.errstate(divide="ignore", invalid="ignore", over="ignore"):')
      lines.push(`    ${derivVar} = np.gradient(${varName}, x)`)
      lines.push(
        `    ${derivVar} = np.where(np.isfinite(${derivVar}), ${derivVar}, np.nan)`,
      )
      lines.push(
        `plt.plot(x, ${derivVar}, color=${pyStr(fn.color)}, linestyle="--", linewidth=1.6, label=${pyStr(derivLabel)})`,
      )
    }
    lines.push('')
  })

  // Series de datos importados
  const singleData = input.datasets.length === 1
  input.datasets.forEach((ds, idx) => {
    if (ds.points.length === 0) return
    const suffix = singleData ? '' : `_${idx + 1}`
    const xs = ds.points.map((p) => p.x)
    const ys = ds.points.map((p) => p.y)
    lines.push(`# Datos importados: ${oneLine(ds.name)}`)
    lines.push(`x_datos${suffix} = ${formatNumList(xs)}`)
    lines.push(`y_datos${suffix} = ${formatNumList(ys)}`)
    lines.push(
      `plt.scatter(x_datos${suffix}, y_datos${suffix}, color=${pyStr(ds.color)}, label=${pyStr(ds.name)}, zorder=5)`,
    )
    lines.push('')
  })

  // Recta tangente (si el usuario marcó un punto)
  let tangentEmitted = false
  if (input.tangent) {
    const targetFn = input.functions[input.tangent.fnIndex]
    if (targetFn && targetFn.expr.trim() !== '') {
      let y0 = NaN
      try {
        y0 = compileFunction(targetFn.expr).evaluate(input.tangent.x0)
      } catch {
        y0 = NaN
      }
      if (Number.isFinite(y0) && Number.isFinite(input.tangent.slope)) {
        tangentEmitted = true
        lines.push(
          `# Recta tangente en x = ${fmtNum(input.tangent.x0)} (pendiente m = ${fmtNum(input.tangent.slope)})`,
        )
        lines.push(`x0 = ${fmtNum(input.tangent.x0)}`)
        lines.push(`y0 = ${fmtNum(y0)}`)
        lines.push(`pendiente = ${fmtNum(input.tangent.slope)}`)
        lines.push('y_tangente = y0 + pendiente * (x - x0)')
        lines.push(
          `plt.plot(x, y_tangente, color=${pyStr(input.tangent.color)}, linestyle="--", linewidth=1.6, label=f"Tangente en x={x0:.2f} (m={pendiente:.2f})")`,
        )
        lines.push(
          `plt.scatter([x0], [y0], color=${pyStr(input.tangent.color)}, zorder=6)`,
        )
        lines.push('')
      }
    }
  }

  // Ejes de referencia, rejilla y escalas
  lines.push('# Ejes de referencia y estilo')
  lines.push('plt.axhline(0, color="gray", linewidth=0.8)')
  lines.push('plt.axvline(0, color="gray", linewidth=0.8)')
  lines.push(`plt.grid(${input.grid ? 'True' : 'False'})`)

  if (logX) {
    lines.push("plt.xscale('log')")
  }
  if (logY) {
    lines.push("plt.yscale('log')")
  }

  // Límites de los ejes
  const xlimMin = logX && input.view.xmin <= 0
    ? Math.max(1e-4, input.view.xmax / 1000)
    : input.view.xmin
  const ylimMin = logY && input.view.ymin <= 0
    ? Math.max(1e-4, input.view.ymax / 1000)
    : input.view.ymin

  if (!logX || input.view.xmax > 0) {
    lines.push(`plt.xlim(${fmtNum(xlimMin)}, ${fmtNum(input.view.xmax)})`)
  }
  if (!logY || input.view.ymax > 0) {
    lines.push(`plt.ylim(${fmtNum(ylimMin)}, ${fmtNum(input.view.ymax)})`)
  }

  // Etiquetas, título y leyenda
  lines.push(`plt.xlabel(${pyStr(input.xlabel)})`)
  lines.push(`plt.ylabel(${pyStr(input.ylabel)})`)
  lines.push(`plt.title(${pyStr(input.title)})`)
  // plt.legend() sin artistas etiquetados emite un aviso en Matplotlib.
  const hasLabeledArtists =
    validFunctions.length > 0 ||
    input.datasets.some((ds) => ds.points.length > 0) ||
    tangentEmitted
  if (input.showLegend && hasLabeledArtists) {
    lines.push('plt.legend()')
  }

  lines.push('')
  lines.push('# Guardar imagen y mostrar la ventana interactiva')
  lines.push('plt.tight_layout()')
  lines.push('plt.savefig("grafica.png", dpi=150)')
  lines.push('plt.show()')

  return lines.join('\n') + '\n'
}
