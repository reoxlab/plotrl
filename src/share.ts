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

// PlotX — codificación y decodificación del estado compartible en el hash URL.

export type ShareScale = 'linear' | 'semilogx' | 'semilogy' | 'loglog'

export interface SharedFunction {
  expr: string
  color: string
  showDerivative?: boolean
}

export interface SharedState {
  functions: SharedFunction[]
  xmin: number
  xmax: number
  // Rango Y y derivadas: opcionales para aceptar enlaces de la v1.0 inicial;
  // si faltan, el arranque recalcula Y con autoFitY().
  ymin?: number
  ymax?: number
  grid: boolean
  scale: ShareScale
  showLegend: boolean
  title: string
  xlabel: string
  ylabel: string
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const MAX_TEXT_LEN = 200

const VALID_SCALES: ReadonlySet<string> = new Set<ShareScale>([
  'linear',
  'semilogx',
  'semilogy',
  'loglog',
])

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
  const binary = atob(base64 + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Codifica el estado en base64url (sin `#` inicial).
 */
export function encodeShare(state: SharedState): string {
  return toBase64Url(JSON.stringify(state))
}

/**
 * Decodifica un hash (con o sin `#` inicial). Devuelve `null` si está vacío o
 * no corresponde a un estado válido, sin lanzar excepciones.
 */
export function decodeShare(hash: string): SharedState | null {
  const raw = hash.trim().replace(/^#/, '').trim()
  if (raw === '') return null
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw))
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>

    if (!Array.isArray(obj.functions) || obj.functions.length === 0 || obj.functions.length > 4) {
      return null
    }
    const functions: SharedFunction[] = []
    for (const item of obj.functions) {
      if (!item || typeof item !== 'object') return null
      const f = item as Record<string, unknown>
      if (
        typeof f.expr !== 'string' ||
        f.expr.length === 0 ||
        f.expr.length > MAX_TEXT_LEN ||
        typeof f.color !== 'string' ||
        !COLOR_RE.test(f.color)
      ) {
        return null
      }
      if (
        f.showDerivative !== undefined &&
        typeof f.showDerivative !== 'boolean'
      ) {
        return null
      }
      functions.push({
        expr: f.expr,
        color: f.color,
        showDerivative: f.showDerivative === true,
      })
    }

    if (
      typeof obj.xmin !== 'number' ||
      typeof obj.xmax !== 'number' ||
      !Number.isFinite(obj.xmin) ||
      !Number.isFinite(obj.xmax) ||
      obj.xmin >= obj.xmax
    ) {
      return null
    }

    let ymin: number | undefined
    let ymax: number | undefined
    if (obj.ymin !== undefined || obj.ymax !== undefined) {
      if (
        typeof obj.ymin !== 'number' ||
        typeof obj.ymax !== 'number' ||
        !Number.isFinite(obj.ymin) ||
        !Number.isFinite(obj.ymax) ||
        obj.ymin >= obj.ymax
      ) {
        return null
      }
      ymin = obj.ymin
      ymax = obj.ymax
    }

    if (typeof obj.grid !== 'boolean' || typeof obj.showLegend !== 'boolean') {
      return null
    }
    if (typeof obj.scale !== 'string' || !VALID_SCALES.has(obj.scale)) {
      return null
    }
    if (
      typeof obj.title !== 'string' ||
      typeof obj.xlabel !== 'string' ||
      typeof obj.ylabel !== 'string' ||
      obj.title.length > MAX_TEXT_LEN ||
      obj.xlabel.length > MAX_TEXT_LEN ||
      obj.ylabel.length > MAX_TEXT_LEN
    ) {
      return null
    }

    return {
      functions,
      xmin: obj.xmin,
      xmax: obj.xmax,
      ymin,
      ymax,
      grid: obj.grid,
      scale: obj.scale as ShareScale,
      showLegend: obj.showLegend,
      title: obj.title,
      xlabel: obj.xlabel,
      ylabel: obj.ylabel,
    }
  } catch {
    return null
  }
}

export function readShareFromLocation(): SharedState | null {
  if (typeof window === 'undefined' || !window.location) return null
  return decodeShare(window.location.hash)
}

export function writeShareToLocation(state: SharedState): void {
  if (typeof window === 'undefined' || !window.history) return
  const encoded = encodeShare(state)
  window.history.replaceState(null, '', `#${encoded}`)
}
