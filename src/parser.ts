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

// PlotX — compilador de expresiones matemáticas con mathjs y traductores
// hacia Python (NumPy) y LaTeX (KaTeX / Matplotlib).

import { parse, type MathNode } from 'mathjs'

export interface CompiledFunction {
  expr: string
  evaluate(x: number): number
}

const ALLOWED_FUNCTIONS: ReadonlySet<string> = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'exp',
  'log',
  'ln',
  'log10',
  'sqrt',
  'abs',
])

const ALLOWED_SYMBOLS: ReadonlySet<string> = new Set(['x', 'pi', 'e', 'PI', 'E'])

const PYTHON_FUNCTIONS: Record<string, string> = {
  sin: 'np.sin',
  cos: 'np.cos',
  tan: 'np.tan',
  asin: 'np.arcsin',
  acos: 'np.arccos',
  atan: 'np.arctan',
  sinh: 'np.sinh',
  cosh: 'np.cosh',
  tanh: 'np.tanh',
  exp: 'np.exp',
  log: 'np.log',
  ln: 'np.log',
  log10: 'np.log10',
  sqrt: 'np.sqrt',
  abs: 'np.abs',
}

const LATEX_FUNCTIONS: Record<string, string> = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  asin: '\\arcsin',
  acos: '\\arccos',
  atan: '\\arctan',
  sinh: '\\sinh',
  cosh: '\\cosh',
  tanh: '\\tanh',
  log: '\\ln',
  ln: '\\ln',
  log10: '\\log_{10}',
}

interface SymbolLike {
  type: 'SymbolNode'
  name: string
}

interface ConstantLike {
  type: 'ConstantNode'
  value: unknown
}

interface ParenthesisLike {
  type: 'ParenthesisNode'
  content: MathNode
}

interface OperatorLike {
  type: 'OperatorNode'
  op: string
  fn: string
  args: MathNode[]
  implicit?: boolean
  isUnary(): boolean
}

interface FunctionLike {
  type: 'FunctionNode'
  fn: { name?: string }
  args: MathNode[]
}

function validateAst(root: MathNode): void {
  root.traverse((node, path, parent) => {
    const t = node.type
    if (
      t === 'AssignmentNode' ||
      t === 'FunctionAssignmentNode' ||
      t === 'BlockNode' ||
      t === 'ArrayNode' ||
      t === 'ObjectNode' ||
      t === 'AccessorNode' ||
      t === 'RangeNode' ||
      t === 'ConditionalNode'
    ) {
      throw new Error(
        'Solo se permiten expresiones matemáticas de una variable f(x).',
      )
    }

    if (t === 'SymbolNode') {
      const sym = node as unknown as SymbolLike
      const isFunctionCallee =
        parent !== null && parent.type === 'FunctionNode' && path === 'fn'
      if (isFunctionCallee) {
        if (!ALLOWED_FUNCTIONS.has(sym.name)) {
          throw new Error(`Función no admitida: «${sym.name}».`)
        }
      } else if (!ALLOWED_SYMBOLS.has(sym.name)) {
        throw new Error(
          `Variable no permitida: «${sym.name}». Usa solo la variable «x».`,
        )
      }
    }

    if (t === 'ConstantNode') {
      const constNode = node as unknown as ConstantLike
      if (typeof constNode.value !== 'number') {
        throw new Error(
          'Solo se permiten números y la variable «x» (no valores como true o false).',
        )
      }
    }

    if (t === 'OperatorNode') {
      const opNode = node as unknown as OperatorLike
      if (opNode.isUnary()) {
        if (opNode.op !== '+' && opNode.op !== '-') {
          throw new Error(
            `Operador no admitido: «${opNode.op}». Usa solo +, -, *, / y ^.`,
          )
        }
      } else if (
        opNode.op !== '+' &&
        opNode.op !== '-' &&
        opNode.op !== '*' &&
        opNode.op !== '/' &&
        opNode.op !== '^'
      ) {
        throw new Error(
          `Operador no admitido: «${opNode.op}». Usa solo +, -, *, / y ^.`,
        )
      }
    }

    if (t === 'FunctionNode') {
      const fnNode = node as unknown as FunctionLike
      const fnName = fnNode.fn?.name ?? ''
      if (!ALLOWED_FUNCTIONS.has(fnName)) {
        throw new Error(`Función no admitida: «${fnName || 'desconocida'}».`)
      }
      if (fnNode.args.length !== 1) {
        throw new Error(`La función «${fnName}» requiere exactamente un argumento.`)
      }
    }
  })
}

/**
 * Compila una expresión en la variable `x` con mathjs.
 * Lanza `Error` en español si la expresión está vacía, tiene sintaxis inválida
 * o utiliza variables/funciones no permitidas.
 */
export function compileFunction(expr: string): CompiledFunction {
  const trimmed = expr.trim()
  if (trimmed === '') {
    throw new Error('Escribe una expresión matemática (por ejemplo, sin(x)).')
  }

  let ast: MathNode
  try {
    ast = parse(trimmed)
  } catch {
    throw new Error('Error de sintaxis: revisa paréntesis y operadores.')
  }

  validateAst(ast)

  const compiled = ast.compile()
  const baseScope = {
    pi: Math.PI,
    PI: Math.PI,
    e: Math.E,
    E: Math.E,
    ln: Math.log,
  }

  // Comprobación rápida de evaluación para detectar llamadas mal formadas.
  try {
    compiled.evaluate({ ...baseScope, x: 1 })
  } catch {
    throw new Error('No se pudo evaluar la expresión: revisa su sintaxis.')
  }

  return {
    expr: trimmed,
    evaluate(x: number): number {
      if (!Number.isFinite(x)) return NaN
      try {
        const result: unknown = compiled.evaluate({ ...baseScope, x })
        if (typeof result === 'number') {
          return Number.isFinite(result) ? result : NaN
        }
        return NaN
      } catch {
        return NaN
      }
    },
  }
}

function serializePython(node: MathNode): string {
  switch (node.type) {
    case 'ConstantNode': {
      const c = node as unknown as ConstantLike
      return String(c.value)
    }
    case 'SymbolNode': {
      const s = node as unknown as SymbolLike
      if (s.name === 'pi' || s.name === 'PI') return 'np.pi'
      if (s.name === 'e' || s.name === 'E') return 'np.e'
      return s.name
    }
    case 'ParenthesisNode': {
      const p = node as unknown as ParenthesisLike
      return `(${serializePython(p.content)})`
    }
    case 'FunctionNode': {
      const f = node as unknown as FunctionLike
      const name = f.fn?.name ?? ''
      const pyName = PYTHON_FUNCTIONS[name] ?? `np.${name}`
      const args = f.args.map(serializePython).join(', ')
      return `${pyName}(${args})`
    }
    case 'OperatorNode': {
      const o = node as unknown as OperatorLike
      if (o.isUnary()) {
        const argStr = serializePython(o.args[0])
        if (o.op === '-') return `-${argStr}`
        if (o.op === '+') return `+${argStr}`
        return `${o.op}${argStr}`
      }
      const left = serializePython(o.args[0])
      const right = serializePython(o.args[1])
      if (o.op === '^') {
        return `${left}**${right}`
      }
      return `${left} ${o.op} ${right}`
    }
    default:
      return node.toString()
  }
}

/**
 * Convierte una expresión estilo mathjs a expresión Python/NumPy.
 */
export function toPython(expr: string): string {
  const trimmed = expr.trim()
  if (trimmed === '') return '0'
  let ast: MathNode
  try {
    ast = parse(trimmed)
  } catch {
    return trimmed
      .replace(/\^/g, '**')
      .replace(/\b(sin|cos|tan|sinh|cosh|tanh|exp|sqrt|abs)\b/g, 'np.$1')
      .replace(/\b(log|ln)\b/g, 'np.log')
      .replace(/\bpi\b/gi, 'np.pi')
      .replace(/\be\b/g, 'np.e')
  }
  // Si la expresión parsea pero usa operadores no admitidos (p. ej. `x!`
  // o `x > 0`), no hay traducción Python válida: se lanza el error en
  // español en lugar de generar código roto.
  validateAst(ast)
  return serializePython(ast)
}

function unwrapParens(node: MathNode): MathNode {
  if (node.type === 'ParenthesisNode') {
    return unwrapParens((node as unknown as ParenthesisLike).content)
  }
  return node
}

function serializeLatex(node: MathNode): string {
  switch (node.type) {
    case 'ConstantNode': {
      const c = node as unknown as ConstantLike
      return String(c.value)
    }
    case 'SymbolNode': {
      const s = node as unknown as SymbolLike
      if (s.name === 'pi' || s.name === 'PI') return '\\pi'
      if (s.name === 'E') return 'e'
      return s.name
    }
    case 'ParenthesisNode': {
      const p = node as unknown as ParenthesisLike
      return `\\left(${serializeLatex(p.content)}\\right)`
    }
    case 'FunctionNode': {
      const f = node as unknown as FunctionLike
      const name = f.fn?.name ?? ''
      const inner = f.args[0] ? serializeLatex(unwrapParens(f.args[0])) : ''
      if (name === 'sqrt') return `\\sqrt{${inner}}`
      if (name === 'abs') return `\\left|${inner}\\right|`
      if (name === 'exp') return `e^{${inner}}`
      const texFn = LATEX_FUNCTIONS[name] ?? `\\operatorname{${name}}`
      return `${texFn}\\left(${inner}\\right)`
    }
    case 'OperatorNode': {
      const o = node as unknown as OperatorLike
      if (o.isUnary()) {
        const arg = serializeLatex(o.args[0])
        return `${o.op}${arg}`
      }
      const leftNode = o.args[0]
      const rightNode = o.args[1]
      if (o.op === '^') {
        const base = serializeLatex(leftNode)
        const exp = serializeLatex(unwrapParens(rightNode))
        return `${base}^{${exp}}`
      }
      if (o.op === '/') {
        const num = serializeLatex(unwrapParens(leftNode))
        const den = serializeLatex(unwrapParens(rightNode))
        return `\\frac{${num}}{${den}}`
      }
      if (o.op === '*') {
        const left = serializeLatex(leftNode)
        const right = serializeLatex(rightNode)
        // Multiplicación implícita o coeficiente por símbolo/paréntesis queda más limpia sin \cdot.
        const simpleLeft =
          leftNode.type === 'ConstantNode' || leftNode.type === 'SymbolNode'
        const nonNumericRight = rightNode.type !== 'ConstantNode'
        if (simpleLeft && nonNumericRight) {
          return `${left} ${right}`
        }
        return `${left} \\cdot ${right}`
      }
      const left = serializeLatex(leftNode)
      const right = serializeLatex(rightNode)
      return `${left} ${o.op} ${right}`
    }
    default:
      return node.toString()
  }
}

/**
 * Convierte una expresión estilo mathjs a LaTeX compatible con KaTeX y Matplotlib.
 */
export function toLatex(expr: string): string {
  const trimmed = expr.trim()
  if (trimmed === '') return ''
  let ast: MathNode
  try {
    ast = parse(trimmed)
  } catch {
    return trimmed
  }
  validateAst(ast)
  return serializeLatex(ast)
}
