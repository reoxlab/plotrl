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

// PlotX — muestreo de funciones, búsqueda de raíces y derivada numérica.

export interface SampleResult {
  xs: number[]
  ys: (number | null)[]
}

function safeEval(fn: (x: number) => number, x: number): number | null {
  try {
    const y = fn(x)
    return typeof y === 'number' && Number.isFinite(y) ? y : null
  } catch {
    return null
  }
}

/**
 * Muestrea una función en [xmin, xmax] en `n` puntos.
 * Devuelve `null` en los puntos no finitos o donde se detecta una asíntota
 * vertical entre muestras consecutivas para evitar unir ramas disjuntas.
 */
export function sampleFunction(
  fn: (x: number) => number,
  xmin: number,
  xmax: number,
  n = 400,
): SampleResult {
  const count = Math.max(2, Math.floor(n))
  const xs: number[] = new Array<number>(count)
  const ys: (number | null)[] = new Array<number | null>(count)

  if (!Number.isFinite(xmin) || !Number.isFinite(xmax) || xmin >= xmax) {
    return { xs: [], ys: [] }
  }

  const step = (xmax - xmin) / (count - 1)
  for (let i = 0; i < count; i++) {
    const x = i === count - 1 ? xmax : xmin + i * step
    xs[i] = x
    ys[i] = safeEval(fn, x)
  }

  // Detección de asíntotas verticales entre muestras con cambio de signo:
  // si al muestrear puntos intermedios la función diverge o deja de ser finita,
  // rompemos el segmento con `null` para no trazar líneas falsas. El sondeo
  // decide en cada cambio de signo (sin umbral absoluto: un polo de amplitud
  // pequeña como tan(x)/1000 también debe romperse).
  // Criterio: en un paso con un solo cero (función continua), los valores
  // intermedios quedan dentro del rango entre los extremos; en un polo,
  // algún punto intermedio sale de ese rango (la función diverge hacia un
  // lado y vuelve por el otro). Un umbral sobre |yMid| no sirve: si una
  // muestra ya está muy cerca del polo, su propio valor eleva el umbral.
  for (let i = 1; i < count; i++) {
    const yPrev = ys[i - 1]
    const yCurr = ys[i]
    if (yPrev === null || yCurr === null) continue
    if (yPrev * yCurr < 0) {
      const x1 = xs[i - 1]
      const x2 = xs[i]
      const lo = Math.min(yPrev, yCurr)
      const hi = Math.max(yPrev, yCurr)
      const jump = Math.abs(yCurr - yPrev)
      let hasAsymptote = false
      for (const frac of [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) {
        const yMid = safeEval(fn, x1 + (x2 - x1) * frac)
        if (yMid === null) {
          hasAsymptote = true
          break
        }
        const excursion = yMid < lo ? lo - yMid : yMid > hi ? yMid - hi : 0
        if (excursion > 0.1 * jump) {
          hasAsymptote = true
          break
        }
      }
      if (hasAsymptote) {
        if (Math.abs(yCurr) >= Math.abs(yPrev)) {
          ys[i] = null
        } else {
          ys[i - 1] = null
        }
      }
    }
  }

  return { xs, ys }
}

/**
 * Busca raíces reales de `fn` en [xmin, xmax] mediante barrido uniforme con
 * cambio de signo y refinamiento por bisección (tolerancia 1e-7), más la
 * detección de raíces dobles (mínimo local de |f| próximo a cero, sin cambio
 * de signo, p. ej. (x-1.234567)^2) con refinamiento parabólico.
 * Deduplica raíces a distancia menor de 1e-6 y descarta polos/asíntotas.
 */
export function findRoots(
  fn: (x: number) => number,
  xmin: number,
  xmax: number,
  n = 2000,
): number[] {
  if (!Number.isFinite(xmin) || !Number.isFinite(xmax) || xmin >= xmax) {
    return []
  }
  const steps = Math.max(10, Math.floor(n))
  const dx = (xmax - xmin) / steps
  const xs: number[] = new Array<number>(steps + 1)
  const ys: (number | null)[] = new Array<number | null>(steps + 1)
  for (let i = 0; i <= steps; i++) {
    const x = i === steps ? xmax : xmin + i * dx
    xs[i] = x
    ys[i] = safeEval(fn, x)
  }

  const rawRoots: number[] = []

  // Ceros exactos sobre la malla.
  for (let i = 0; i <= steps; i++) {
    const y = ys[i]
    if (y !== null && Math.abs(y) < 1e-12) {
      rawRoots.push(xs[i])
    }
  }

  // Cambio de signo con bisección.
  for (let i = 1; i <= steps; i++) {
    const yPrev = ys[i - 1]
    const yCurr = ys[i]
    if (yPrev === null || yCurr === null || yPrev * yCurr >= 0) continue
    // Bisección en [a, b]
    let a = xs[i - 1]
    let b = xs[i]
    let fa = yPrev
    let valid = true
    for (let iter = 0; iter < 60 && b - a > 1e-7; iter++) {
      const m = 0.5 * (a + b)
      const fm = safeEval(fn, m)
      if (fm === null) {
        valid = false
        break
      }
      if (Math.abs(fm) < 1e-12) {
        a = m
        b = m
        break
      }
      if (fa * fm <= 0) {
        b = m
      } else {
        a = m
        fa = fm
      }
    }
    if (valid) {
      const root = 0.5 * (a + b)
      const fRoot = safeEval(fn, root)
      // Verificación de continuidad: en un polo (como 1/x) |f(root)| diverge.
      if (fRoot !== null && Math.abs(fRoot) < 1e-3) {
        rawRoots.push(root)
      }
    }
  }

  // Raíces dobles: mínimo local estricto de |f| próximo a cero, sin cambio
  // de signo. El umbral es relativo a la escala de |f| en el rango, para no
  // marcar como raíz una función que solo roza cero (p. ej. x^2 + 0.001).
  let maxAbs = 0
  for (const y of ys) {
    if (y !== null) maxAbs = Math.max(maxAbs, Math.abs(y))
  }
  if (maxAbs > 1e-9) {
    const threshold = Math.max(1e-9, maxAbs * 1e-6)
    for (let i = 1; i < steps; i++) {
      const y = ys[i]
      if (y === null || Math.abs(y) > threshold) continue
      const aPrev = ys[i - 1] === null ? Infinity : Math.abs(ys[i - 1] as number)
      const aNext = ys[i + 1] === null ? Infinity : Math.abs(ys[i + 1] as number)
      const a = Math.abs(y)
      if (a >= aPrev || a >= aNext) continue
      // Refinamiento parabólico con los tres puntos de |f|.
      let root = xs[i]
      const denom = aPrev - 2 * a + aNext
      if (denom > 0) {
        const offset = (dx * (aPrev - aNext)) / (2 * denom)
        if (Number.isFinite(offset) && Math.abs(offset) <= dx) {
          root = xs[i] + offset
        }
      }
      const fRoot = safeEval(fn, root)
      if (fRoot !== null && Math.abs(fRoot) <= threshold * 10) {
        rawRoots.push(root)
      }
    }
  }

  rawRoots.sort((a, b) => a - b)
  const deduped: number[] = []
  for (const r of rawRoots) {
    const normalized = Math.abs(r) < 1e-9 ? 0 : r
    if (
      deduped.length === 0 ||
      Math.abs(normalized - deduped[deduped.length - 1]) >= 1e-6
    ) {
      deduped.push(normalized)
    }
  }
  return deduped
}

/**
 * Derivada numérica por diferencia central: (f(x+h) - f(x-h)) / (2h).
 */
export function numericDerivative(
  fn: (x: number) => number,
  x: number,
  h = 1e-5,
): number {
  const yPlus = safeEval(fn, x + h)
  const yMinus = safeEval(fn, x - h)
  if (yPlus === null || yMinus === null) return NaN
  const d = (yPlus - yMinus) / (2 * h)
  return Number.isFinite(d) ? d : NaN
}

/**
 * Muestrea la derivada numérica de `fn` en [xmin, xmax].
 */
export function derivativeSamples(
  fn: (x: number) => number,
  xmin: number,
  xmax: number,
  n = 400,
): SampleResult {
  return sampleFunction((x) => numericDerivative(fn, x), xmin, xmax, n)
}
