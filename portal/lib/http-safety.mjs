// Shared by the existing gateways. No database access or startup side effects.
export function parseCookies(raw = '') {
  const cookies = Object.create(null)
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    if (!name) continue
    try {
      cookies[name] = decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      // A malformed cookie is invalid input, not a server failure. Remove any
      // earlier duplicate so an invalid session cookie cannot reuse its value.
      delete cookies[name]
    }
  }
  return cookies
}

export function responseHeaders(upstream = {}, requestPath = '/') {
  return {
    ...upstream,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    ...(requestPath.startsWith('/api/') ? { 'cache-control': 'no-store' } : {}),
  }
}
