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

// PlotX — importación de datos (x, y) desde CSV, texto plano, XLSX, XLS y ODS.
// SheetJS (`xlsx`) se importa de forma perezosa solo al abrir una hoja de
// cálculo, igual que en TableX, para no engordar el paquete inicial ni exigir
// la librería en pruebas unitarias de texto plano.

export interface DataSeries {
  name: string
  points: { x: number; y: number }[]
  // Si la importación superó el tope, `points` trae solo los primeros
  // MAX_IMPORT_POINTS y `truncated` lo indica con el total original.
  truncated?: boolean
  totalPoints?: number
}

// Tope de puntos por serie: sin límite, un CSV grande genera un script
// Python de megabytes y congela la pestaña al redibujar en cada tecla.
export const MAX_IMPORT_POINTS = 10000

function capPoints(
  points: { x: number; y: number }[],
): { points: { x: number; y: number }[]; truncated: boolean; totalPoints: number } {
  if (points.length <= MAX_IMPORT_POINTS) {
    return { points, truncated: false, totalPoints: points.length }
  }
  return {
    points: points.slice(0, MAX_IMPORT_POINTS),
    truncated: true,
    totalPoints: points.length,
  }
}

export interface SpreadsheetBook {
  sheetNames: string[]
  importSheet(name: string): DataSeries
}

const NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/

function parseNumberCell(raw: unknown, allowDecimalComma: boolean): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }
  if (typeof raw !== 'string') return null
  let cleaned = raw.trim().replace(/^["']|["']$/g, '').trim()
  if (cleaned === '') return null
  if (allowDecimalComma && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.')
  }
  if (!NUMBER_RE.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

function splitCsvRow(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (!inQuotes && ch === delimiter) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function detectDelimiter(lines: string[]): {
  delimiter: ';' | '\t' | ',' | 'ws'
  allowDecimalComma: boolean
} {
  // Prioridad: punto y coma > tabulador > coma vs espacios.
  const sample = lines.slice(0, 20)
  if (sample.some((l) => l.includes(';'))) {
    return { delimiter: ';', allowDecimalComma: true }
  }
  if (sample.some((l) => l.includes('\t'))) {
    return { delimiter: '\t', allowDecimalComma: true }
  }

  // Distinguimos entre CSV con coma (1.5, 2.3 o 1, 2) y texto separado por
  // espacios con coma decimal (1,5 2,3).
  let commaValidRows = 0
  let wsValidRows = 0
  for (const line of sample) {
    if (line.includes(',')) {
      const parts = splitCsvRow(line, ',')
      if (
        parts.length >= 2 &&
        parseNumberCell(parts[0], false) !== null &&
        parseNumberCell(parts[1], false) !== null
      ) {
        commaValidRows++
      }
    }
    const wsParts = line.trim().split(/\s+/)
    if (
      wsParts.length >= 2 &&
      parseNumberCell(wsParts[0], true) !== null &&
      parseNumberCell(wsParts[1], true) !== null
    ) {
      wsValidRows++
    }
  }

  if (commaValidRows >= wsValidRows && commaValidRows > 0) {
    return { delimiter: ',', allowDecimalComma: false }
  }
  if (wsValidRows > 0) {
    return { delimiter: 'ws', allowDecimalComma: true }
  }
  if (sample.some((l) => l.includes(','))) {
    return { delimiter: ',', allowDecimalComma: false }
  }
  return { delimiter: 'ws', allowDecimalComma: true }
}

/**
 * Parsea texto delimitado (CSV, TSV o columnas separadas por espacios) en una
 * serie de puntos (x, y). Salta encabezados, líneas vacías y filas no numéricas.
 */
export function parseDelimitedText(text: string, name: string): DataSeries {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  if (lines.length === 0) {
    throw new Error('El archivo está vacío: no se encontraron puntos (x, y).')
  }

  const { delimiter, allowDecimalComma } = detectDelimiter(lines)
  const points: { x: number; y: number }[] = []

  for (const line of lines) {
    const cells =
      delimiter === 'ws' ? line.split(/\s+/) : splitCsvRow(line, delimiter)
    if (cells.length < 2) continue
    const x = parseNumberCell(cells[0], allowDecimalComma)
    const y = parseNumberCell(cells[1], allowDecimalComma)
    if (x !== null && y !== null) {
      points.push({ x, y })
    }
  }

  if (points.length === 0) {
    throw new Error(
      'No se encontraron pares numéricos (x, y) válidos en el archivo.',
    )
  }

  const capped = capPoints(points)
  return {
    name,
    points: capped.points,
    truncated: capped.truncated || undefined,
    totalPoints: capped.truncated ? capped.totalPoints : undefined,
  }
}

/**
 * Carga un archivo XLSX, XLS u ODS de forma perezosa con SheetJS.
 */
export async function loadSpreadsheet(file: File): Promise<SpreadsheetBook> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  if (wb.SheetNames.length === 0) {
    throw new Error('El libro de cálculo no contiene hojas.')
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'Datos'

  return {
    sheetNames: [...wb.SheetNames],
    importSheet(sheetName: string): DataSeries {
      const sheet = wb.Sheets[sheetName]
      if (!sheet) {
        throw new Error(`No existe la hoja «${sheetName}».`)
      }
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: '',
      })
      const points: { x: number; y: number }[] = []
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 2) continue
        // Tomamos las dos primeras celdas numéricas de la fila. Nota: el
        // texto plano exige que sean las dos primeras columnas; aquí una
        // columna índice numérica se lee como x (caso borde documentado).
        const nums: number[] = []
        for (const cell of row) {
          const val = parseNumberCell(cell, true)
          if (val !== null) {
            nums.push(val)
            if (nums.length === 2) break
          }
        }
        if (nums.length === 2) {
          points.push({ x: nums[0], y: nums[1] })
        }
      }
      if (points.length === 0) {
        throw new Error(
          `La hoja «${sheetName}» no tiene dos columnas numéricas (x, y).`,
        )
      }
      const seriesName =
        wb.SheetNames.length > 1 ? `${baseName} (${sheetName})` : baseName
      const capped = capPoints(points)
      return {
        name: seriesName,
        points: capped.points,
        truncated: capped.truncated || undefined,
        totalPoints: capped.truncated ? capped.totalPoints : undefined,
      }
    },
  }
}
