// Pruebas del importador de texto delimitado / CSV (dataimport.ts).
import { parseDelimitedText } from '../src/dataimport'

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

const csvSemi = `
tiempo;voltaje

0,5;1,25
1,0;2,50
texto;invalido
2,5;-0,75
`
const s1 = parseDelimitedText(csvSemi, 'experimento')
check('CSV con ; + encabezado + líneas vacías + coma decimal: 3 puntos', s1.points.length === 3, `got ${s1.points.length}`)
check('primer punto (0.5, 1.25)', s1.points[0].x === 0.5 && s1.points[0].y === 1.25)
check('tercer punto (2.5, -0.75)', s1.points[2].x === 2.5 && s1.points[2].y === -0.75)

const csvComma = `x,y
-1.5, 3.2
0, 0
2.25, -4.5
`
const s2 = parseDelimitedText(csvComma, 'coma')
check('CSV con coma: 3 puntos', s2.points.length === 3)
check('CSV con coma punto 1 (-1.5, 3.2)', s2.points[0].x === -1.5 && s2.points[0].y === 3.2)

const wsText = `x   y
1   2
2   4.5
3   9
`
const s3 = parseDelimitedText(wsText, 'espacios')
check('texto con espacios: 3 puntos', s3.points.length === 3)
check('texto con espacios punto 2 (2, 4.5)', s3.points[1].x === 2 && s3.points[1].y === 4.5)

let threwInvalid = false
try {
  parseDelimitedText('solo;encabezado\na;b\n', 'vacio')
} catch {
  threwInvalid = true
}
check('sin puntos válidos lanza error', threwInvalid)

// Tope de filas (I9): 10.001 filas → 10.000 puntos + marca de truncado.
const bigLines: string[] = []
for (let i = 0; i < 10001; i++) bigLines.push(`${i},${i * 2}`)
const big = parseDelimitedText(bigLines.join('\n'), 'grande')
check('archivo grande se limita a 10.000 puntos', big.points.length === 10000, `got ${big.points.length}`)
check('archivo grande marca truncated y totalPoints', big.truncated === true && big.totalPoints === 10001, `got truncated=${big.truncated} total=${big.totalPoints}`)
const small = parseDelimitedText('0,0\n1,1\n', 'pequeño')
check('archivo pequeño no se marca truncado', small.truncated !== true && small.totalPoints === undefined)

if (failed > 0) process.exit(1)
console.log(`\ndataimport: ${passed} comprobaciones pasaron.`)
