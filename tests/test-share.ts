// Pruebas de codificación y decodificación compartible por URL (share.ts).
import { decodeShare, encodeShare, type SharedState } from '../src/share'

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

const sample: SharedState = {
  functions: [
    { expr: 'sin(x)', color: '#80001E', showDerivative: true },
    { expr: 'exp(-x^2)', color: '#CCA757' },
  ],
  xmin: -5,
  xmax: 5,
  ymin: -1.5,
  ymax: 1.5,
  grid: false,
  scale: 'semilogy',
  showLegend: true,
  title: 'Gráfica comparativa: senos y gaussiana',
  xlabel: 'Posición (m)',
  ylabel: 'Energía (J)',
}

const encoded = encodeShare(sample)
check('encodeShare no empieza con #', !encoded.startsWith('#'))

const decoded = decodeShare(`#${encoded}`)
check('round-trip devuelve objeto válido', decoded !== null)
check(
  'conserva funciones y colores',
  decoded !== null &&
    decoded.functions.length === 2 &&
    decoded.functions[0].expr === 'sin(x)' &&
    decoded.functions[0].color === '#80001E' &&
    decoded.functions[1].expr === 'exp(-x^2)' &&
    decoded.functions[1].color === '#CCA757',
)
check(
  'conserva rango y opciones',
  decoded !== null &&
    decoded.xmin === -5 &&
    decoded.xmax === 5 &&
    decoded.ymin === -1.5 &&
    decoded.ymax === 1.5 &&
    decoded.grid === false &&
    decoded.scale === 'semilogy' &&
    decoded.showLegend === true &&
    decoded.title === sample.title &&
    decoded.xlabel === sample.xlabel &&
    decoded.ylabel === sample.ylabel,
)
check(
  'conserva showDerivative por función',
  decoded !== null &&
    decoded.functions[0].showDerivative === true &&
    decoded.functions[1].showDerivative === false,
)

check('hash vacío → null', decodeShare('') === null)
check('hash solo # → null', decodeShare('#') === null)
check('hash inválido → null', decodeShare('#no-es-base64-valido!!!') === null)
check('JSON con estructura inválida → null', decodeShare(btoa('{"foo":1}')) === null)

// Enlace de la v1.0 inicial (sin ymin/ymax): se acepta, Y se recalcula.
const legacy = {
  functions: [{ expr: 'sin(x)', color: '#80001E' }],
  xmin: -5,
  xmax: 5,
  grid: true,
  scale: 'linear',
  showLegend: true,
  title: 't',
  xlabel: 'x',
  ylabel: 'y',
}
const legacyDecoded = decodeShare(btoa(JSON.stringify(legacy)))
check(
  'enlace sin ymin/ymax se acepta (compatibilidad v1.0)',
  legacyDecoded !== null && legacyDecoded.ymin === undefined,
)

// Color inválido o expresión larguísima → null (M8).
const badColor = { ...sample, functions: [{ expr: 'sin(x)', color: 'red' }] }
check('color no hexadecimal → null', decodeShare(btoa(JSON.stringify(badColor))) === null)
const longExpr = {
  ...sample,
  functions: [{ expr: 'x'.repeat(201), color: '#80001E' }],
}
check('expresión de más de 200 caracteres → null', decodeShare(btoa(JSON.stringify(longExpr))) === null)
const badY = { ...sample, ymin: 2, ymax: 1 }
check('ymin >= ymax → null', decodeShare(btoa(JSON.stringify(badY))) === null)

if (failed > 0) process.exit(1)
console.log(`\nshare: ${passed} comprobaciones pasaron.`)
