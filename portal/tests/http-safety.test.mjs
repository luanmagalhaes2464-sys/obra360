import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { parseCookies, responseHeaders } from '../lib/http-safety.mjs'

test('empty and unrelated cookies do not create a session', () => {
  assert.equal(parseCookies().obra360_session, undefined)
  assert.equal(parseCookies('invalid; theme=dark').obra360_session, undefined)
})

test('preserves session encoding, spaces and equals in values', () => {
  const cookies = parseCookies('theme=dark; obra360_session=abc%3Ddef; label=Jo%C3%A3o')
  assert.equal(cookies.obra360_session, 'abc=def')
  assert.equal(cookies.label, 'João')
})

test('malformed cookies never throw or reuse an earlier session', () => {
  assert.equal(parseCookies('broken=%ZZ; obra360_session=valid').obra360_session, 'valid')
  assert.equal(parseCookies('obra360_session=valid; obra360_session=%ZZ').obra360_session, undefined)
  assert.equal(parseCookies('obra360_session=%E0%A4%A').obra360_session, undefined)
})

test('cookie names cannot change object prototypes', () => {
  const cookies = parseCookies('__proto__=bad; constructor=bad; =empty')
  assert.equal(Object.getPrototypeOf(cookies), null)
  assert.equal(Object.hasOwn(cookies, ''), false)
})

test('API headers prevent caching while preserving cookies and content type', () => {
  const headers = responseHeaders({ 'cache-control': 'public', 'set-cookie': ['session=x'], 'content-type': 'application/json' }, '/api/me')
  assert.equal(headers['cache-control'], 'no-store')
  assert.deepEqual(headers['set-cookie'], ['session=x'])
  assert.equal(headers['content-type'], 'application/json')
  assert.equal(headers['x-content-type-options'], 'nosniff')
})

test('static cache and audio compatibility are preserved', () => {
  const original = { 'cache-control': 'public, max-age=3600', 'content-type': 'audio/wav' }
  assert.equal(responseHeaders(original, '/assets/app.js')['cache-control'], original['cache-control'])
  assert.equal(responseHeaders(original, '/api/voice/speak')['content-type'], 'audio/wav')
  assert.equal(original['cache-control'], 'public, max-age=3600')
})

test('headers work on a real HTTP response', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(401, responseHeaders({ 'content-type': 'application/json' }, req.url))
    res.end(JSON.stringify({ error: 'Não autenticado' }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/me`)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal((await response.json()).error, 'Não autenticado')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
