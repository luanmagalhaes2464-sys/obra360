const AUTO_KEY = 'obra360_voice_conversation_auto'
const SILENCE_MS = 1250
let lastSpoken = ''
let sessionArmed = false
let speaking = false
let processing = false
let programmaticClick = false
let lastTranscript = ''
let lastTranscriptChange = 0
let lastAnswer = ''

function autoEnabled() {
  const saved = localStorage.getItem(AUTO_KEY)
  return saved === null ? true : saved === 'true'
}

function setAutoEnabled(value: boolean) {
  localStorage.setItem(AUTO_KEY, String(value))
}

function getVoiceParts() {
  const agent = document.querySelector('.v4-agent-work') as HTMLElement | null
  const orb = agent?.querySelector('.v4-voice-orb') as HTMLElement | null
  const mic = orb?.querySelector('button') as HTMLButtonElement | null
  const textarea = agent?.querySelector('.v4-transcript textarea') as HTMLTextAreaElement | null
  const actions = agent?.querySelector('.v4-agent-actions') as HTMLElement | null
  const buttons = Array.from(actions?.querySelectorAll('button') || []) as HTMLButtonElement[]
  const understand = buttons.find(b => /entender/i.test(b.textContent || '')) || null
  const clear = buttons.find(b => /limpar/i.test(b.textContent || '')) || null
  const result = agent?.querySelector('.v4-agent-result') as HTMLElement | null
  return { agent, orb, mic, textarea, understand, clear, result }
}

function getBestPortugueseVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || []
  const ptBr = voices.filter(v => /^pt(-|_)?BR/i.test(v.lang) || /^pt-BR$/i.test(v.lang))
  const preferred = [
    'Luciana', 'Joana', 'Francisca', 'Camila', 'Vitória', 'Vitoria', 'Maria', 'Flo',
    'Google português do Brasil', 'Portuguese (Brazil)'
  ]
  for (const name of preferred) {
    const found = ptBr.find(v => v.name.toLowerCase().includes(name.toLowerCase()))
    if (found) return found
  }
  return ptBr[0] || voices.find(v => /^pt/i.test(v.lang)) || null
}

function naturalize(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\bSST\b/gi, 'segurança do trabalho')
    .replace(/\bCNO\b/g, 'C N O')
    .replace(/\bRRT\b/g, 'R R T')
    .replace(/\bART\b/g, 'A R T')
    .replace(/\bp\.p\.\b/gi, 'pontos percentuais')
    .replace(/;\s*/g, '. ')
    .trim()
}

function clickProgrammatically(button: HTMLButtonElement | null) {
  if (!button || button.disabled) return false
  programmaticClick = true
  button.click()
  setTimeout(() => { programmaticClick = false }, 80)
  return true
}

function resumeConversation() {
  if (!sessionArmed || !autoEnabled()) return
  const { mic, clear, orb } = getVoiceParts()
  if (!mic || !orb || orb.classList.contains('listening')) return
  clickProgrammatically(clear)
  lastTranscript = ''
  lastTranscriptChange = Date.now()
  setTimeout(() => {
    const current = getVoiceParts()
    if (sessionArmed && autoEnabled() && current.mic && current.orb && !current.orb.classList.contains('listening')) {
      clickProgrammatically(current.mic)
    }
  }, 380)
}

function speak(text: string) {
  if (!autoEnabled() || !text || !('speechSynthesis' in window)) {
    resumeConversation()
    return
  }
  const clean = naturalize(text)
  if (!clean || clean === lastSpoken) return
  lastSpoken = clean
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(clean)
  utterance.lang = 'pt-BR'
  utterance.rate = 0.94
  utterance.pitch = 1
  utterance.volume = 1
  const voice = getBestPortugueseVoice()
  if (voice) utterance.voice = voice
  utterance.onstart = () => { speaking = true }
  utterance.onend = () => {
    speaking = false
    processing = false
    setTimeout(resumeConversation, 260)
  }
  utterance.onerror = () => {
    speaking = false
    processing = false
    setTimeout(resumeConversation, 260)
  }
  window.speechSynthesis.speak(utterance)
}

function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  speaking = false
}

function ensureConversationControl() {
  const { agent, orb } = getVoiceParts()
  if (!agent || !orb || agent.querySelector('.v4-voice-reply-toggle')) return
  const wrap = document.createElement('div')
  wrap.className = 'v4-voice-reply-toggle'
  const button = document.createElement('button')
  button.type = 'button'

  const render = () => {
    const on = autoEnabled()
    button.className = on ? 'active' : ''
    button.innerHTML = `${on ? '🟢' : '⚪'} <span>Conversa automática</span><strong>${on ? 'Ativada' : 'Pausada'}</strong><small>${on ? 'fale e aguarde' : 'toque para ativar'}</small>`
  }

  button.addEventListener('click', () => {
    const next = !autoEnabled()
    setAutoEnabled(next)
    sessionArmed = next
    if (!next) stopSpeaking()
    render()
    if (next) {
      const { mic, orb } = getVoiceParts()
      if (mic && orb && !orb.classList.contains('listening')) setTimeout(() => clickProgrammatically(mic), 160)
    }
  })

  render()
  wrap.appendChild(button)
  orb.insertAdjacentElement('afterend', wrap)
}

function wireMic() {
  const { mic } = getVoiceParts()
  if (!mic || mic.dataset.voiceConversationWired === '1') return
  mic.dataset.voiceConversationWired = '1'
  mic.addEventListener('click', () => {
    stopSpeaking()
    if (programmaticClick) return
    sessionArmed = true
    setAutoEnabled(true)
    lastTranscript = ''
    lastTranscriptChange = Date.now()
    setTimeout(() => ensureConversationControl(), 0)
  })
}

function inspectAnswer() {
  const { result } = getVoiceParts()
  if (!result) return
  const heading = result.querySelector('h3')?.textContent?.trim() || ''
  if (!heading || heading === lastAnswer) return
  lastAnswer = heading
  processing = false
  speak(heading)
}

function pollConversation() {
  ensureConversationControl()
  wireMic()
  inspectAnswer()

  const { orb, mic, textarea, understand } = getVoiceParts()
  if (!orb || !mic || !textarea || !understand || !sessionArmed || !autoEnabled() || speaking || processing) return
  const listening = orb.classList.contains('listening')
  const value = textarea.value.trim()

  if (listening) {
    if (value !== lastTranscript) {
      lastTranscript = value
      lastTranscriptChange = Date.now()
    }
    const enoughSpeech = value.length >= 3
    if (enoughSpeech && Date.now() - lastTranscriptChange >= SILENCE_MS) {
      processing = true
      clickProgrammatically(mic)
      setTimeout(() => {
        const current = getVoiceParts()
        if (current.understand && !current.understand.disabled) clickProgrammatically(current.understand)
        else processing = false
      }, 220)
    }
  }
}

function boot() {
  if ('speechSynthesis' in window) {
    const warm = () => window.speechSynthesis.getVoices()
    warm()
    window.speechSynthesis.addEventListener?.('voiceschanged', warm)
  }
  const observer = new MutationObserver(() => {
    ensureConversationControl()
    wireMic()
    inspectAnswer()
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] })
  setInterval(pollConversation, 220)
  pollConversation()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true })
else boot()
