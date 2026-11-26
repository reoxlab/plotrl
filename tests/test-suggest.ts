// Pruebas de integración del buzón de sugerencias (rl-suggest).
import assert from 'node:assert/strict'
import {
  SUGGEST_STYLE,
  buildSuggestMailto,
  suggestSubject,
} from 'rl-suggest'

let passed = 0
function test(name: string, fn: () => void): void {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

test('suggestSubject devuelve [Sugerencia PlotRL]', () => {
  assert.equal(suggestSubject('PlotRL'), '[Sugerencia PlotRL]')
})

test('buildSuggestMailto genera prefijo mailto y cuerpo codificado', () => {
  const url = buildSuggestMailto('PlotRL', 'Mejora X')
  const expectedPrefix =
    'mailto:contacto@reoxlab.com?subject=%5BSugerencia%20PlotRL%5D&body='
  assert.ok(url.startsWith(expectedPrefix), `Prefijo inesperado: ${url}`)
  assert.equal(url, `${expectedPrefix}${encodeURIComponent('Mejora X')}`)
})

test('texto con &, acentos y salto de línea se codifica sin romper subject ni body', () => {
  const text = 'Más precisión en f(x) & g(x)\nSegunda línea con ñ y áéíóú'
  const url = buildSuggestMailto('PlotRL', text)
  const expectedPrefix =
    'mailto:contacto@reoxlab.com?subject=%5BSugerencia%20PlotRL%5D&body='
  assert.ok(url.startsWith(expectedPrefix))
  const query = url.slice('mailto:contacto@reoxlab.com?'.length)
  const parts = query.split('&')
  assert.equal(
    parts.length,
    2,
    'El carácter & en el texto no debe crear nuevos parámetros',
  )
  assert.equal(
    decodeURIComponent(parts[0].slice('subject='.length)),
    '[Sugerencia PlotRL]',
  )
  assert.equal(decodeURIComponent(parts[1].slice('body='.length)), text)
})

test('SUGGEST_STYLE contiene .rl-suggest y var(--borde', () => {
  assert.ok(SUGGEST_STYLE.includes('.rl-suggest'))
  assert.ok(SUGGEST_STYLE.includes('var(--borde'))
})

console.log(`\nsuggest: ${passed} comprobaciones pasaron.`)
