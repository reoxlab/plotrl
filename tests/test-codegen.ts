// Pruebas del generador de código Python Matplotlib (codegen.ts),
// incluyendo validación sintáctica real con `python3 -m py_compile`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generatePython } from '../src/codegen'

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

const baseCode = generatePython({
  functions: [{ expr: 'sin(x)', color: '#80001E', showDerivative: false }],
  datasets: [],
  view: { xmin: -10, xmax: 10, ymin: -2, ymax: 2 },
  grid: true,
  scale: 'linear',
  showLegend: true,
  title: 'Gráfica de f(x) = sin(x)',
  xlabel: 'x',
  ylabel: 'f(x)',
})

check('contiene np.linspace(-10, 10, 400)', baseCode.includes('np.linspace(-10, 10, 400)'))
check('contiene np.sin(x)', baseCode.includes('np.sin(x)'))
check('contiene el color #80001E', baseCode.includes('#80001E'))
check('contiene plt.savefig', baseCode.includes('plt.savefig'))
check('contiene plt.show()', baseCode.includes('plt.show()'))
check('contiene plt.grid(True)', baseCode.includes('plt.grid(True)'))
check('contiene plt.legend()', baseCode.includes('plt.legend()'))

const customCode = generatePython({
  functions: [{ expr: 'exp(-x)', color: '#CCA757', showDerivative: true }],
  datasets: [
    {
      name: 'Mediciones "lab"',
      color: '#1f77b4',
      points: [
        { x: 0, y: 1 },
        { x: 1, y: 0.367879 },
      ],
    },
  ],
  view: { xmin: 0, xmax: 5, ymin: 0.01, ymax: 2 },
  grid: false,
  scale: 'semilogy',
  showLegend: false,
  title: 'Decaimiento "térmico"',
  xlabel: 'Tiempo (s)',
  ylabel: 'Amplitud',
  tangent: { fnIndex: 0, x0: 1, slope: -0.367879, color: '#CCA757' },
})

check('rejilla apagada → plt.grid(False)', customCode.includes('plt.grid(False)'))
check('escala semilogy → plt.yscale(\'log\')', customCode.includes("plt.yscale('log')"))
check('dataset → plt.scatter', customCode.includes('plt.scatter'))
check('leyenda apagada no incluye plt.legend()', !customCode.includes('plt.legend()'))
check('título personalizado escapado incluido', customCode.includes('Decaimiento \\"térmico\\"'))
check('derivada incluida', customCode.includes('derivada'))

// Precisión de datos pequeños (I3): 4e-7 no debe salir como 0.000000.
const tinyCode = generatePython({
  functions: [],
  datasets: [
    {
      name: 'Señal pequeña',
      color: '#80001E',
      points: [
        { x: 0, y: 0.0000004 },
        { x: 1, y: 0.00000015 },
        { x: 2, y: 123456789.123456789 },
      ],
    },
  ],
  view: { xmin: 0, xmax: 2, ymin: 0, ymax: 1 },
  grid: false,
  scale: 'linear',
  showLegend: true,
  title: 'Datos pequeños',
  xlabel: 'x',
  ylabel: 'y',
})
check('datos 4e-7 conservan precisión (no 0.000000)', tinyCode.includes('4e-7'), tinyCode.split('\n').find((l) => l.includes('y_datos')) ?? '')
check('datos 1.5e-7 conservan precisión', tinyCode.includes('1.5e-7'))

// Título con $: Matplotlib no debe interpretarlo como mathtext (M2).
const dollarCode = generatePython({
  functions: [{ expr: 'x', color: '#80001E', showDerivative: false }],
  datasets: [],
  view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
  grid: false,
  scale: 'linear',
  showLegend: false,
  title: 'Costo $50 por unidad',
  xlabel: 'x',
  ylabel: 'y',
})
check('título con $ se escapa como \\\\$ (sin SyntaxWarning)', dollarCode.includes('Costo \\\\$50 por unidad'))

// Leyenda sin artistas etiquetados no emite plt.legend() (M14).
const emptyLegendCode = generatePython({
  functions: [],
  datasets: [],
  view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
  grid: false,
  scale: 'linear',
  showLegend: true,
  title: 'Vacía',
  xlabel: 'x',
  ylabel: 'y',
})
check('sin funciones ni datos, leyenda activada no emite plt.legend()', !emptyLegendCode.includes('plt.legend()'))

// Nombre de serie con salto de línea no inyecta código (I4).
const injectionCode = generatePython({
  functions: [],
  datasets: [
    {
      name: 'Datos\nimport os; os.system("echo pwned")',
      color: '#80001E',
      points: [{ x: 0, y: 0 }],
    },
  ],
  view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
  grid: false,
  scale: 'linear',
  showLegend: false,
  title: 't',
  xlabel: 'x',
  ylabel: 'y',
})
check(
  'nombre con salto de línea no crea una línea de código nueva',
  !injectionCode.split('\n').some((l) => l.trim().startsWith('import os')),
)

// Comprobación real con python3 -m py_compile sobre los scripts generados.
const dir = mkdtempSync(join(tmpdir(), 'plotx-py-'))
try {
  const f1 = join(dir, 'base.py')
  const f2 = join(dir, 'custom.py')
  const f3 = join(dir, 'tiny.py')
  const f4 = join(dir, 'injection.py')
  const f5 = join(dir, 'dollar.py')
  const f6 = join(dir, 'empty-legend.py')
  writeFileSync(f1, baseCode, 'utf8')
  writeFileSync(f2, customCode, 'utf8')
  writeFileSync(f3, tinyCode, 'utf8')
  writeFileSync(f4, injectionCode, 'utf8')
  writeFileSync(f5, dollarCode, 'utf8')
  writeFileSync(f6, emptyLegendCode, 'utf8')
  execFileSync('python3', ['-m', 'py_compile', f1, f2, f3, f4, f5, f6], { stdio: 'pipe' })
  check('python3 -m py_compile valida los scripts generados', true)
} catch (err) {
  check('python3 -m py_compile valida los scripts generados', false, String(err))
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (failed > 0) process.exit(1)
console.log(`\ncodegen: ${passed} comprobaciones pasaron.`)
