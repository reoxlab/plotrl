// Pruebas de muestreo, raíces y derivada numérica (sampler.ts).
import {
  derivativeSamples,
  findRoots,
  numericDerivative,
  sampleFunction,
} from '../src/sampler'

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

const rootsSin = findRoots(Math.sin, -10, 10)
const expected = [-3, -2, -1, 0, 1, 2, 3].map((k) => k * Math.PI)
check('sin(x) en [-10, 10] tiene 7 raíces', rootsSin.length === 7, `got ${rootsSin.length}: ${rootsSin}`)
check(
  'las 7 raíces coinciden con k*pi (tol 1e-4)',
  rootsSin.length === expected.length &&
    rootsSin.every((r, i) => Math.abs(r - expected[i]) < 1e-4),
  `got ${rootsSin}`,
)

const dSqAt3 = numericDerivative((x) => x * x, 3)
check('derivada de x^2 en x=3 ≈ 6 (tol 1e-4)', Math.abs(dSqAt3 - 6) < 1e-4, `got ${dSqAt3}`)

const dSinAt0 = numericDerivative(Math.sin, 0)
check('derivada de sin(x) en x=0 ≈ 1 (tol 1e-4)', Math.abs(dSinAt0 - 1) < 1e-4, `got ${dSinAt0}`)

const invSample = sampleFunction((x) => 1 / x, -10, 10, 400)
check('sampleFunction marca null en 1/x cerca de 0', invSample.ys.includes(null))

const sqrtSample = sampleFunction((x) => Math.sqrt(x), -5, 5, 200)
check(
  'sampleFunction marca null en sqrt(x) para x < 0',
  sqrtSample.ys[0] === null && sqrtSample.ys[sqrtSample.ys.length - 1] !== null,
)

const dSample = derivativeSamples(Math.sin, -3, 3, 100)
check('derivativeSamples devuelve 100 muestras', dSample.xs.length === 100 && dSample.ys.length === 100)

// Raíces dobles sin cambio de signo (I5): (x-a)^2 con a fuera de la malla.
const double1 = findRoots((x) => (x - 1.234567) ** 2, 0, 2)
check('raíz doble (x-1.234567)^2 encontrada', double1.length === 1 && Math.abs(double1[0] - 1.234567) < 1e-3, `got ${double1}`)
const double2 = findRoots((x) => (x - 0.3333) ** 2, 0, 2)
check('raíz doble (x-0.3333)^2 encontrada', double2.length === 1 && Math.abs(double2[0] - 0.3333) < 1e-3, `got ${double2}`)
const doubleOnGrid = findRoots((x) => (x - 1) ** 2, 0, 2)
check('raíz doble sobre la malla (x-1)^2 sigue dando [1]', doubleOnGrid.length === 1 && Math.abs(doubleOnGrid[0] - 1) < 1e-6, `got ${doubleOnGrid}`)
const noRootNear = findRoots((x) => x * x + 0.001, -2, 2)
check('x^2 + 0.001 no tiene raíces (sin falsos positivos)', noRootNear.length === 0, `got ${noRootNear}`)
const poleRoots = findRoots((x) => 1 / x, -5, 5)
check('1/x no tiene raíces (polo descartado)', poleRoots.length === 0, `got ${poleRoots}`)

// Asíntotas de amplitud pequeña (I6): el polo debe romper el segmento.
const tanSmall = sampleFunction((x) => Math.tan(x) / 1000, 0, 3, 400)
check('tan(x)/1000 rompe el segmento en el polo', tanSmall.ys.includes(null), `nulls: ${tanSmall.ys.filter((y) => y === null).length}`)
const invSmall = sampleFunction((x) => 1 / (100 * x), -1, 1, 400)
check('1/(100x) rompe el segmento en x=0', invSmall.ys.includes(null))
const sinSample = sampleFunction(Math.sin, -10, 10, 400)
check('sin(x) no genera nulls espurios', !sinSample.ys.includes(null))

if (failed > 0) process.exit(1)
console.log(`\nsampler: ${passed} comprobaciones pasaron.`)
