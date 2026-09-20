import http from 'http'
import { spawn } from 'child_process'
import jwt from 'jsonwebtoken'
import { parseCookies, responseHeaders } from './lib/http-safety.mjs'

const PORT = Number(process.env.PORT || 10000)
const GATEWAY_PORT = Number(process.env.TECNOMATA_GATEWAY_PORT || 10001)
const CORE_PORT = Number(process.env.TECNOMATA_CORE_PORT_V5 || 10002)
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const COOKIE = 'obra360_session'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

function authenticated(req) {
  const token = parseCookies(req.headers.cookie || '')[COOKIE]
  if (!token) return false
  try { jwt.verify(token, JWT_SECRET); return true } catch { return false }
}

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(data.length),
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 64 * 1024) return null
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return null }
}

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44)
  const byteRate = sampleRate * channels * bitsPerSample / 8
  const blockAlign = channels * bitsPerSample / 8
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

async function generateVoice(text, voice) {
  if (!GEMINI_API_KEY) return { ok: false, status: 503, error: 'Voz Gemini não configurada' }

  // 2.5 Flash TTS está no Free Tier e tem sido mais estável; 3.1 fica como segunda tentativa.
  const models = [...new Set([
    process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts',
    'gemini-3.1-flash-tts-preview',
  ])]
  const style = [
    'Fale em português brasileiro.',
    'Você é Matinho, assistente da TecnoMata Engenharia.',
    'Use uma voz adulta, segura, calma, simpática e profissional.',
    'Fale com ritmo de conversa normal, articulação clara e pausas naturais.',
    'Mantenha a voz estável e confiante: sem tremor, sem tom de medo, sem sussurro e sem teatralidade.',
    'Não acelere o final das frases e não exagere na entonação.',
    'Leia somente a fala abaixo, sem mencionar estas instruções.',
    '',
    'FALA: ' + text,
  ].join('\n')

  let lastStatus = 502
  let lastDetail = ''
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: style }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      })
      if (!r.ok) {
        lastStatus = r.status
        lastDetail = await r.text().catch(() => String(r.status))
        console.warn('matinho-tts', model, r.status, lastDetail.slice(0, 260))
        // Erros transitórios/limite do modelo atual: tenta o outro modelo antes de desistir.
        if (r.status === 429 || r.status >= 500) continue
        return { ok: false, status: r.status, error: 'Falha ao gerar voz natural' }
      }
      const d = await r.json()
      const part = d?.candidates?.[0]?.content?.parts?.find(p => p?.inlineData?.data)
      const data = part?.inlineData?.data
      if (!data) {
        lastStatus = 502
        lastDetail = 'Gemini não retornou áudio'
        console.warn('matinho-tts', model, lastDetail)
        continue
      }
      return { ok: true, model, wav: pcmToWav(Buffer.from(data, 'base64')) }
    } catch (e) {
      lastStatus = 502
      lastDetail = String(e?.message || e)
      console.warn('matinho-tts', model, lastDetail)
    }
  }
  return { ok: false, status: lastStatus === 429 ? 429 : 502, error: lastStatus === 429 ? 'Limite gratuito de voz atingido' : 'Voz natural temporariamente indisponível' }
}

async function handleVoice(req, res, pathname) {
  if (!authenticated(req)) return json(res, 401, { error: 'Não autenticado' })
  if (pathname === '/api/voice/status' && req.method === 'GET') {
    return json(res, 200, {
      naturalVoice: Boolean(GEMINI_API_KEY),
      provider: GEMINI_API_KEY ? 'gemini' : 'browser',
      model: process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts',
      fallbackModel: 'gemini-3.1-flash-tts-preview',
      voice: process.env.GEMINI_TTS_VOICE || 'Kore',
      freeTier: true,
    })
  }
  if (pathname !== '/api/voice/speak' || req.method !== 'POST') return false
  const body = await readJson(req)
  if (!body) return json(res, 400, { error: 'Dados inválidos' })
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 2200)
  if (!text) return json(res, 400, { error: 'Texto vazio' })
  const allowed = new Set(['Kore','Orus','Alnilam','Achird','Sulafat','Callirrhoe','Aoede','Schedar','Gacrux','Vindemiatrix'])
  const requested = String(body.voice || process.env.GEMINI_TTS_VOICE || 'Kore')
  const voice = allowed.has(requested) ? requested : 'Kore'
  const result = await generateVoice(text, voice)
  if (!result.ok) return json(res, result.status, { error: result.error })
  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': String(result.wav.length),
    'Cache-Control': 'no-store',
    'X-Voice-Provider': 'gemini',
    'X-Voice-Model': result.model,
    'X-Voice-Name': voice,
  })
  res.end(result.wav)
  return true
}

const child = spawn(process.execPath, ['server-proxy-v4.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(GATEWAY_PORT),
    TECNOMATA_CORE_PORT: String(CORE_PORT),
  },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  console.error('Gateway TecnoMata encerrado', { code, signal })
  process.exit(code || 1)
})

const server = http.createServer(async (req, res) => {
  for (const [name, value] of Object.entries(responseHeaders({}, req.url || '/'))) {
    res.setHeader(name, value)
  }
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname === '/api/voice/speak' || url.pathname === '/api/voice/status') {
      const handled = await handleVoice(req, res, url.pathname)
      if (handled !== false) return
    }
  } catch (e) {
    console.error('voice-gateway', e)
    if (!res.headersSent) return json(res, 500, { error: 'Falha ao processar a voz do Matinho.' })
  }

  const headers = { ...req.headers, host: `127.0.0.1:${GATEWAY_PORT}` }
  const proxy = http.request({
    hostname: '127.0.0.1',
    port: GATEWAY_PORT,
    path: req.url,
    method: req.method,
    headers,
  }, upstream => {
    res.writeHead(upstream.statusCode || 502, responseHeaders(upstream.headers, req.url || '/'))
    upstream.pipe(res)
  })
  proxy.on('error', err => {
    console.error('proxy-gateway', err.message)
    if (!res.headersSent) json(res, 502, { error: 'Portal ainda está iniciando. Tente novamente em alguns segundos.' })
    else res.end()
  })
  req.pipe(proxy)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TecnoMata Voice Gateway ativo na porta ${PORT}; gateway na ${GATEWAY_PORT}; núcleo na ${CORE_PORT}`)
})

async function shutdown() {
  try { child.kill('SIGTERM') } catch {}
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
