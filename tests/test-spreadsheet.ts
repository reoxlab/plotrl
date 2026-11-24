// Pruebas del importador de hojas de cálculo (dataimport.ts): libros ODS y
// XLSX generados en memoria con SheetJS, incluida la selección de hoja.
// Se corre con esbuild igual que los demás tests (xlsx queda externo).
import * as XLSX from 'xlsx'
import { loadSpreadsheet } from '../src/dataimport'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    passed++
    console.log(`ok ${passed + failed} - ${name}`)
  } else {
    failed++
    console.log(`FAIL ${passed + failed} - ${name} ${extra}`)
  }
}

function makeFile(bytes: Uint8Array, name: string): File {
  // File no existe en Node 18 sin flags: se pasa un objeto con el método
  // que usa el importador (arrayBuffer), con el tipo de File.
  return {
    name,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as File
}

function buildWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const datos = XLSX.utils.aoa_to_sheet([
    ['x', 'y'],
    [0, 0],
    [1, 1.5],
    [2, 4],
  ])
  const extra = XLSX.utils.aoa_to_sheet([
    ['a', 'b'],
    [10, 20],
    [30, 40],
  ])
  XLSX.utils.book_append_sheet(wb, datos, 'Datos')
  XLSX.utils.book_append_sheet(wb, extra, 'Extra')
  return wb
}

const odsBytes = new Uint8Array(
  XLSX.write(buildWorkbook(), { bookType: 'ods', type: 'array' }) as ArrayBuffer,
)
const odsBook = await loadSpreadsheet(makeFile(odsBytes, 'mediciones.ods'))
check(
  'ODS: lista las hojas en orden',
  JSON.stringify(odsBook.sheetNames) === JSON.stringify(['Datos', 'Extra']),
  odsBook.sheetNames.join(','),
)
const odsDatos = odsBook.importSheet('Datos')
check('ODS hoja Datos: 3 puntos', odsDatos.points.length === 3, `got ${odsDatos.points.length}`)
check(
  'ODS hoja Datos punto 2 (1, 1.5)',
  odsDatos.points[1].x === 1 && odsDatos.points[1].y === 1.5,
  JSON.stringify(odsDatos.points[1]),
)
check('ODS con varias hojas: nombre incluye la hoja', odsDatos.name === 'mediciones (Datos)', `got ${odsDatos.name}`)
const odsExtra = odsBook.importSheet('Extra')
check('ODS hoja Extra: 2 puntos', odsExtra.points.length === 2)
check('ODS hoja Extra punto 1 (10, 20)', odsExtra.points[0].x === 10 && odsExtra.points[0].y === 20)

const xlsxBytes = new Uint8Array(
  XLSX.write(buildWorkbook(), { bookType: 'xlsx', type: 'array' }) as ArrayBuffer,
)
const xlsxBook = await loadSpreadsheet(makeFile(xlsxBytes, 'mediciones.xlsx'))
check(
  'XLSX: lista las hojas en orden',
  JSON.stringify(xlsxBook.sheetNames) === JSON.stringify(['Datos', 'Extra']),
)
const xlsxDatos = xlsxBook.importSheet('Datos')
check('XLSX hoja Datos: 3 puntos', xlsxDatos.points.length === 3)
check(
  'XLSX hoja Datos punto 3 (2, 4)',
  xlsxDatos.points[2].x === 2 && xlsxDatos.points[2].y === 4,
)

let threwMissing = false
try {
  odsBook.importSheet('NoExiste')
} catch {
  threwMissing = true
}
check('hoja inexistente lanza error', threwMissing)

if (failed > 0) process.exit(1)
console.log(`\nspreadsheet: ${passed} comprobaciones pasaron.`)
