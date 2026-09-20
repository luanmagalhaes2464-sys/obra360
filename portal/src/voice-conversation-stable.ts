const SILENCE_MS = 1300
const POLL_MS = 320

let sessionActive = false
let programmatic = false
let processing = false
let speaking = false
let monitor: number | null = null
let lastTranscript = ''
let lastTranscriptChange = 0
let lastAnswer = ''
let lastMessage = ''
let firstReply = true
let turn = 0
let currentUtterance = ''
let awaitingVoiceConfirmation = false
let pendingConfirmButton: HTMLButtonElement | null = null
let naturalVoiceAvailable: boolean | null = null
let audioContext: AudioContext | null = null
let audioSource: AudioBufferSourceNode | null = null

function getParts() {
  const agent = document.querySelector('.v4-agent-work') as HTMLElement | null
  const orb = agent?.querySelector('.v4-voice-orb') as HTMLElement | null
  const mic = orb?.querySelector('button') as HTMLButtonElement | null
  const textarea = agent?.querySelector('.v4-transcript textarea') as HTMLTextAreaElement | null
  const buttons = Array.from(agent?.querySelectorAll('.v4-agent-actions button') || []) as HTMLButtonElement[]
  const understand = buttons.find(b => /entender/i.test(b.textContent || '')) || null
  const clear = buttons.find(b => /limpar/i.test(b.textContent || '')) || null
  const result = agent?.querySelector('.v4-agent-result') as HTMLElement | null
  const message = agent?.querySelector('.v4-agent-message') as HTMLElement | null
  const confirm = result?.querySelector('.v4-primary') as HTMLButtonElement | null
  return { agent, orb, mic, textarea, understand, clear, result, message, confirm }
}

function firstName() {
  const name = document.querySelector('.v4-side-user b')?.textContent?.trim() || ''
  return name.split(/\s+/).filter(Boolean)[0] || 'Luan'
}

function normalize(text: string) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\bSST\b/gi, 'segurança do trabalho')
    .replace(/\bCNO\b/g, 'C N O')
    .replace(/\bRRT\b/g, 'R R T')
    .replace(/\bART\b/g, 'A R T')
    .replace(/;\s*/g, '. ')
    .replace(/^Orçamento registrado:/i, 'Pelo que está registrado na obra, o orçamento é de')
    .replace(/^Pendências de regularização:/i, 'Para a regularização, ainda faltam:')
    .replace(/^Pontos de segurança do trabalho ainda pendentes no roteiro:/i, 'Na segurança do trabalho, ainda estão pendentes:')
    .replace(/^Próximas ações de arquitetura\/cliente:/i, 'Na arquitetura, os próximos pontos são:')
    .replace(/^A próxima ação obrigatória sugerida pelo roteiro é:/i, 'Pelo roteiro atual, o próximo passo é')
    .trim()
}

function humanAnswer(raw: string) {
  const answer = normalize(raw)
  if (!answer) return ''
  const name = firstName()
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`\\b${escaped}\\b`, 'i').test(answer)) return answer
  turn += 1
  if (firstReply) {
    firstReply = false
    return `Oi, ${name}. ${answer}`
  }
  if (turn % 4 === 0) return `Entendi, ${name}. ${answer}`
  if (turn % 3 === 0) return `Certo, ${name}. ${answer}`
  return `${name}, ${answer}`
}

function actionMessage(raw: string) {
  const name = firstName()
  const text = String(raw || '').trim()
  const count = Number(text.match(/(\d+)\s+altera/i)?.[1] || 0)
  if (/comando executado/i.test(text)) return count === 1 ? `Pronto, ${name}. Atualizei esse item na obra.` : `Pronto, ${name}. Atualizei ${count || 'os'} itens na obra.`
  if (/registro salvo/i.test(text)) return `Pronto, ${name}. Registrei isso no histórico da obra.`
  if (/análise confirmada/i.test(text)) return `Pronto, ${name}. A análise foi confirmada.`
  return humanAnswer(text)
}

function greetingReply(text: string) {
  const low = text.toLowerCase().trim().replace(/[!.?]+$/g, '')
  const name = firstName()
  if (/^(oi|olá|ola|e aí|e ai)$/.test(low)) return `Oi, ${name}. Tudo bem? Pode falar comigo normalmente. O que você quer saber ou registrar sobre a obra?`
  if (/^bom dia$/.test(low)) return `Bom dia, ${name}. Pode falar. O que você precisa da obra agora?`
  if (/^boa tarde$/.test(low)) return `Boa tarde, ${name}. Pode falar. O que você quer verificar na obra?`
  if (/^boa noite$/.test(low)) return `Boa noite, ${name}. Pode falar. O que você quer saber ou registrar sobre a obra?`
  return ''
}

function portugueseVoices() {
  if (!('speechSynthesis' in window)) return [] as SpeechSynthesisVoice[]
  const voices = window.speechSynthesis.getVoices() || []
  const br = voices.filter(v => /^pt(-|_)?BR$/i.test(v.lang))
  return br.length ? br : voices.filter(v => /^pt/i.test(v.lang))
}

function voiceScore(v: SpeechSynthesisVoice) {
  const n = v.name.toLowerCase()
  let score = 0
  if (/natural|neural|premium|enhanced/.test(n)) score += 100
  if (/microsoft/.test(n)) score += 45
  if (/google/.test(n)) score += 35
  if (/luciana|francisca|joana|maria|camila|vit[oó]ria/.test(n)) score += 25
  if (/pt-br/i.test(v.lang)) score += 15
  return score
}

function bestBrowserVoice() {
  return [...portugueseVoices()].sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null
}

function unlockAudio() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined
    if (Ctx && !audioContext) audioContext = new Ctx()
    void audioContext?.resume().catch(() => {})
  } catch {}
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
      window.speechSynthesis.resume()
      const u = new SpeechSynthesisUtterance('\u200B')
      u.lang = 'pt-BR'
      u.volume = 0.01
      window.speechSynthesis.speak(u)
    } catch {}
  }
}

function stopAudio() {
  try { audioSource?.stop() } catch {}
  audioSource = null
  try { window.speechSynthesis?.cancel() } catch {}
  speaking = false
}

function setTextarea(value: string) {
  const { textarea } = getParts()
  if (!textarea) return
  try {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    if (setter) setter.call(textarea, value)
    else textarea.value = value
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
  } catch {
    textarea.value = value
  }
}

function clearTranscript() {
  setTextarea('')
  lastTranscript = ''
  lastTranscriptChange = Date.now()
}

function clickProgrammatically(btn: HTMLButtonElement | null) {
  if (!btn || btn.disabled) return false
  programmatic = true
  btn.click()
  window.setTimeout(() => { programmatic = false }, 150)
  return true
}

function stopSession() {
  sessionActive = false
  processing = false
  awaitingVoiceConfirmation = false
  pendingConfirmButton = null
  stopAudio()
  if (monitor !== null) {
    window.clearInterval(monitor)
    monitor = null
  }
}

function startListening(delay = 420) {
  if (!sessionActive || speaking || processing) return
  clearTranscript()
  window.setTimeout(() => {
    const { mic, orb } = getParts()
    if (!sessionActive || speaking || processing || !mic || !orb || orb.classList.contains('listening')) return
    clickProgrammatically(mic)
  }, delay)
}

function finishSpeech(resume: boolean) {
  speaking = false
  processing = false
  audioSource = null
  if (resume) startListening()
}

function speakWithBrowser(text: string, resume: boolean) {
  if (!('speechSynthesis' in window)) return finishSpeech(resume)
  try {
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-BR'
    u.rate = 1
    u.pitch = 1
    u.volume = 1
    const voice = bestBrowserVoice()
    if (voice) u.voice = voice
    u.onend = () => finishSpeech(resume)
    u.onerror = () => finishSpeech(resume)
    window.speechSynthesis.speak(u)
  } catch {
    finishSpeech(resume)
  }
}

async function speakNatural(text: string, resume: boolean) {
  stopAudio()
  speaking = true
  try {
    if (naturalVoiceAvailable !== false) {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 15000)
      const r = await fetch('/api/voice/speak', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'Kore' }),
        signal: controller.signal,
      })
      window.clearTimeout(timer)
      if (r.ok) {
        naturalVoiceAvailable = true
        const bytes = await r.arrayBuffer()
        if (audioContext) {
          await audioContext.resume().catch(() => {})
          const buffer = await audioContext.decodeAudioData(bytes.slice(0))
          const source = audioContext.createBufferSource()
          audioSource = source
          source.buffer = buffer
          source.connect(audioContext.destination)
          source.onended = () => finishSpeech(resume)
          source.start(0)
          return
        }
      } else if ([401, 403, 429, 503].includes(r.status)) {
        naturalVoiceAvailable = false
      }
    }
  } catch {}
  speakWithBrowser(text, resume)
}

function speak(text: string, resume = true) {
  const clean = normalize(text)
  if (!clean) {
    processing = false
    if (resume) startListening()
    return
  }
  void speakNatural(clean, resume)
}

function isYes(text: string) {
  return /^(sim|pode|pode sim|confirmo|confirma|confirmar|isso|isso mesmo|correto|certo|ok|okay|pode fazer|faz|faça)$/i.test(text.trim())
}

function isNo(text: string) {
  return /^(não|nao|não pode|nao pode|cancela|cancelar|deixa|deixa pra lá|deixa para la|esquece)$/i.test(text.trim())
}

function cancelPendingAction() {
  const { clear } = getParts()
  clickProgrammatically(clear)
  awaitingVoiceConfirmation = false
  pendingConfirmButton = null
}

function handlePendingVoiceConfirmation(text: string) {
  const { mic, orb } = getParts()
  if (orb?.classList.contains('listening')) clickProgrammatically(mic)
  clearTranscript()
  if (isYes(text)) {
    const button = pendingConfirmButton
    awaitingVoiceConfirmation = false
    pendingConfirmButton = null
    if (button && button.isConnected && !button.disabled) {
      processing = true
      clickProgrammatically(button)
    } else {
      speak(`Certo, ${firstName()}. Essa ação não está mais disponível. Pode me dizer novamente o que você quer fazer?`, true)
    }
    return
  }
  if (isNo(text)) {
    cancelPendingAction()
    speak(`Tudo bem, ${firstName()}. Não alterei nada. Pode continuar.`, true)
    return
  }
  speak(`${firstName()}, para essa alteração eu só preciso de uma confirmação. Diga sim para confirmar ou não para cancelar.`, true)
}

function inspectResponse() {
  if (!processing) return false
  const { result, message, confirm } = getParts()
  const msg = message?.textContent?.trim() || ''
  if (msg && msg !== lastMessage) {
    lastMessage = msg
    clearTranscript()
    speak(actionMessage(msg), true)
    return true
  }

  const heading = result?.querySelector('h3') as HTMLElement | null
  const raw = heading?.textContent?.trim() || ''
  if (!raw || raw === lastAnswer) return false

  lastAnswer = raw
  clearTranscript()
  const friendly = humanAnswer(raw)
  if (heading && heading.textContent !== friendly) heading.textContent = friendly

  if (confirm) {
    pendingConfirmButton = confirm
    awaitingVoiceConfirmation = true
    processing = false
    speak(`${friendly}. Quer que eu confirme essa alteração?`, true)
    return true
  }

  speak(friendly, true)
  return true
}

function processStableUtterance(value: string) {
  currentUtterance = value.trim()
  const { mic, orb } = getParts()
  if (orb?.classList.contains('listening')) clickProgrammatically(mic)

  if (awaitingVoiceConfirmation) {
    handlePendingVoiceConfirmation(currentUtterance)
    return
  }

  const greeting = greetingReply(currentUtterance)
  if (greeting) {
    clearTranscript()
    speak(greeting, true)
    return
  }

  processing = true
  window.setTimeout(() => {
    const current = getParts()
    if (!current.understand || current.understand.disabled) {
      processing = false
      speak(`${firstName()}, não consegui processar essa fala. Pode repetir?`, true)
      return
    }
    lastMessage = current.message?.textContent?.trim() || ''
    clickProgrammatically(current.understand)
  }, 260)
}

function tick() {
  if (!sessionActive) return
  const { agent, orb, mic, textarea, understand } = getParts()
  if (!agent) {
    stopSession()
    return
  }
  if (processing) {
    inspectResponse()
    return
  }
  if (speaking || !orb || !mic || !textarea || !understand) return
  if (!orb.classList.contains('listening')) return

  const value = textarea.value.trim()
  if (value !== lastTranscript) {
    lastTranscript = value
    lastTranscriptChange = Date.now()
    return
  }
  if (value.length < 2) return
  if (Date.now() - lastTranscriptChange < SILENCE_MS) return
  processStableUtterance(value)
}

function ensureMonitor() {
  if (monitor !== null) return
  monitor = window.setInterval(tick, POLL_MS)
}

document.addEventListener('click', event => {
  const target = event.target as Element | null
  const micButton = target?.closest('.v4-voice-orb button') as HTMLButtonElement | null
  if (!micButton || programmatic) return
  const orb = micButton.closest('.v4-voice-orb') as HTMLElement | null

  if (orb?.classList.contains('listening')) {
    stopSession()
    return
  }

  sessionActive = true
  processing = false
  speaking = false
  firstReply = true
  turn = 0
  lastAnswer = ''
  lastMessage = ''
  lastTranscript = ''
  lastTranscriptChange = Date.now()
  awaitingVoiceConfirmation = false
  pendingConfirmButton = null
  naturalVoiceAvailable = null
  unlockAudio()
  ensureMonitor()
}, true)

window.addEventListener('beforeunload', stopSession)
