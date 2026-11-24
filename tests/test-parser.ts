// Pruebas del compilador y traductores de expresiones (parser.ts).
import { compileFunction, toLatex, toPython } from '../src/parser'

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

function approx(a: number, b: number, tol = 1e-9): boolean {
  return Math.abs(a - b) <= tol
}

const fSin = compileFunction('sin(x)')
check('sin(0) = 0', approx(fSin.evaluate(0), 0))
check('sin(pi/2) = 1', approx(fSin.evaluate(Math.PI / 2), 1))

const fSq = compileFunction('x^2')
check('x^2 en x=-3 da 9', approx(fSq.evaluate(-3), 9))

const fGauss = compileFunction('exp(-x^2)')
check('exp(-x^2) en 0 da 1', approx(fGauss.evaluate(0), 1))
check('exp(-x^2) en 1 da 1/e', approx(fGauss.evaluate(1), Math.exp(-1)))

const fConst = compileFunction('pi * x + e')
check('pi y e se evalúan correctamente', approx(fConst.evaluate(1), Math.PI + Math.E))

const fLn = compileFunction('ln(x)')
check('ln(e) = 1', approx(fLn.evaluate(Math.E), 1))
check('ln(-1) devuelve NaN', Number.isNaN(fLn.evaluate(-1)))

let threwEmpty = false
try {
  compileFunction('   ')
} catch {
  threwEmpty = true
}
check('expresión vacía lanza error', threwEmpty)

let threwVarY = false
try {
  compileFunction('sin(y)')
} catch {
  threwVarY = true
}
check('variable y lanza error', threwVarY)

let threwBroken = false
try {
  compileFunction('sin(')
} catch {
  threwBroken = true
}
check('sintaxis rota sin( lanza error', threwBroken)

// Operadores fuera de la sintaxis documentada (+ - * / ^): la app los
// rechazaba en la UI pero el Python generado salía roto (C1). Deben lanzar.
for (const bad of ['x!', '5!', 'x>0', 'x<1', 'true', 'x%2', 'x and true']) {
  let threw = false
  try {
    compileFunction(bad)
  } catch {
    threw = true
  }
  check(`compileFunction rechaza «${bad}»`, threw)
}

let threwPy = false
try {
  toPython('x!')
} catch {
  threwPy = true
}
check('toPython("x!") lanza en lugar de devolver "!x"', threwPy)

let threwTex = false
try {
  toLatex('x>0')
} catch {
  threwTex = true
}
check('toLatex("x>0") lanza error', threwTex)

check('toPython x^2 → x**2', toPython('x^2') === 'x**2', `got: ${toPython('x^2')}`)
check('toPython sin(x) → np.sin(x)', toPython('sin(x)') === 'np.sin(x)', `got: ${toPython('sin(x)')}`)
check('toPython pi → np.pi', toPython('pi') === 'np.pi', `got: ${toPython('pi')}`)
check('toPython exp(-x^2)', toPython('exp(-x^2)') === 'np.exp(-x**2)', `got: ${toPython('exp(-x^2)')}`)

check('toLatex sin(x)', toLatex('sin(x)').includes('\\sin'))
check('toLatex sqrt(x)', toLatex('sqrt(x)') === '\\sqrt{x}', `got: ${toLatex('sqrt(x)')}`)
check('toLatex exp(-x^2)', toLatex('exp(-x^2)').startsWith('e^{'), `got: ${toLatex('exp(-x^2)')}`)

if (failed > 0) process.exit(1)
console.log(`\nparser: ${passed} comprobaciones pasaron.`)
