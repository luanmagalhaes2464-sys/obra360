const SILENCE_MS = 1450

let sessionActive = false
let programmatic = false
let processing = false
let speaking = false
let monitor: number | null = null
let lastTranscript = ''
let lastTranscriptChange = 0
let lastAnswer = ''
let firstReply = true

function getParts() {
  const agent = document.querySelector('.v4-agent-work') as HTMLElement | null
  const orb = agent?.querySelector('.v4-voice-orb') as HTMLElement | null
  const mic = orb?.querySelector('button') as HTMLButtonElement | null
  const textarea = agent?.querySelector('.v4-transcript textarea') as HTMLTextAreaElement | null
  const buttons = Array.from(agent?.querySelectorAll('.v4-agent-actions button') || []) as HTMLButtonElement[]
  const understand = buttons.find(b => /entender/i.test(b.textContent || '')) || null
  const result = agent?.querySelector('.v4-agent-result') as HTMLElement | null
  const message = agent?.querySelector('.v4-agent-message') as HTMLElement | null
  return { agent, orb, mic, textarea, understand, result, message }
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
  const alreadyPersonal = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i').test(answer)
  if (alreadyPersonal) return answer
  if (firstReply) {
    firstReply = false
    return `Oi, ${name}. ${answer}`
  }
  return `${name}, ${answer}`
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

function bestVoice() {
  return [...portugueseVoices()].sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null
}

function unlockSpeech() {
  if (!('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    const u = new SpeechSynthesisUtterance('\u200B')
    u.lang = 'pt-BR'
    u.volume = 0.01
    window.speechSynthesis.speak(u)
  } catch {}
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
  window.setTimeout(() => { programmatic = false }, 120)
  return true
}

function stopSession() {
  sessionActive = false
  processing = false
  speaking = false
  try { window.speechSynthesis?.cancel() } catch {}
  if (monitor !== null) {
    window.clearInterval(monitor)
    monitor = null
  }
}

function startListening() {
  if (!sessionActive || speaking || processing) return
  clearTranscript()
  window.setTimeout(() => {
    const { mic, orb } = getParts()
    if (!sessionActive || !mic || !orb || orb.classList.contains('listening')) return
    clickProgrammatically(mic)
  }, 450)
}

function speak(text: string, resume = true) {
  if (!text) {
    processing = false
    if (resume) startListening()
    return
  }
  if (!('speechSynthesis' in window)) {
    processing = false
    if (resume) startListening()
    return
  }
  try {
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-BR'
    u.rate = 0.94
    u.pitch = 1.02
    u.volume = 1
    const voice = bestVoice()
    if (voice) u.voice = voice
    u.onstart = () => { speaking = true }
    u.onend = () => {
      speaking = false
      processing = false
      if (resume) startListening()
    }
    u.onerror = () => {
      speaking = false
      processing = false
      if (resume) startListening()
    }
    window.speechSynthesis.speak(u)
  } catch {
    speaking = false
    processing = false
    if (resume) startListening()
  }
}

function inspectResponse() {
  if (!processing) return false
  const { result, message } = getParts()
  const heading = result?.querySelector('h3') as HTMLElement | null
  const raw = heading?.textContent?.trim() || ''
  if (raw && raw !== lastAnswer) {
    lastAnswer = raw
    const friendly = humanAnswer(raw)
    const needsConfirmation = !!result?.querySelector('.v4-primary')
    if (heading && heading.textContent !== friendly) heading.textContent = friendly
    clearTranscript()
    speak(needsConfirmation ? `${friendly}. Se estiver correto, confirme a ação na tela.` : friendly, !needsConfirmation)
    if (needsConfirmation) sessionActive = false
    return true
  }

  const msg = message?.textContent?.trim() || ''
  if (msg) {
    clearTranscript()
    speak(humanAnswer(msg), true)
    return true
  }
  return false
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
  if (value.length < 3) return
  if (Date.now() - lastTranscriptChange < SILENCE_MS) return

  processing = true
  clickProgrammatically(mic)
  window.setTimeout(() => {
    const { understand: currentUnderstand } = getParts()
    if (!currentUnderstand || currentUnderstand.disabled) {
      processing = false
      return
    }
    clickProgrammatically(currentUnderstand)
  }, 300)
}

function ensureMonitor() {
  if (monitor !== null) return
  monitor = window.setInterval(tick, 280)
}

document.addEventListener('click', (event) => {
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
  lastAnswer = ''
  lastTranscript = ''
  lastTranscriptChange = Date.now()
  unlockSpeech()
  ensureMonitor()
}, true)

window.addEventListener('beforeunload', stopSession)
