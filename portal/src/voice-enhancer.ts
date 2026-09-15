const AUTO_KEY = 'obra360_voice_conversation_auto'
const VOICE_KEY = 'obra360_voice_selected'
const SILENCE_MS = 1450
let lastSpoken = ''
let sessionArmed = false
let speaking = false
let processing = false
let programmaticClick = false
let lastTranscript = ''
let lastTranscriptChange = 0
let lastAnswer = ''
let responseCount = 0

function autoEnabled() {
  const saved = localStorage.getItem(AUTO_KEY)
  return saved === null ? true : saved === 'true'
}

function setAutoEnabled(value: boolean) {
  localStorage.setItem(AUTO_KEY, String(value))
}

function firstName() {
  const name = document.querySelector('.v4-side-user b')?.textContent?.trim() || ''
  return name.split(/\s+/).filter(Boolean)[0] || 'Olá'
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

function portugueseVoices() {
  const voices = window.speechSynthesis?.getVoices?.() || []
  const ptBr = voices.filter(v => /^pt(-|_)?BR/i.test(v.lang) || /^pt-BR$/i.test(v.lang))
  const pt = voices.filter(v => /^pt/i.test(v.lang))
  return ptBr.length ? ptBr : pt
}

function selectedVoice() {
  const voices = portugueseVoices()
  const saved = localStorage.getItem(VOICE_KEY)
  if (saved) {
    const found = voices.find(v => v.voiceURI === saved || v.name === saved)
    if (found) return found
  }
  const preferred = [
    'Luciana', 'Francisca', 'Flo', 'Joana', 'Camila', 'Vitória', 'Vitoria', 'Maria',
    'Google português do Brasil', 'Portuguese (Brazil)'
  ]
  for (const name of preferred) {
    const found = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase()))
    if (found) return found
  }
  return voices.find(v => v.localService) || voices[0] || null
}

function normalizeContent(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\bSST\b/gi, 'segurança do trabalho')
    .replace(/\bCNO\b/g, 'C N O')
    .replace(/\bRRT\b/g, 'R R T')
    .replace(/\bART\b/g, 'A R T')
    .replace(/\bp\.p\.\b/gi, 'pontos percentuais')
    .replace(/;\s*/g, '. ')
    .replace(/^Orçamento registrado:/i, 'Pelo que está registrado na obra, o orçamento é de')
    .replace(/^Pendências de regularização:/i, 'Para a regularização, ainda faltam:')
    .replace(/^Pontos de segurança do trabalho ainda pendentes no roteiro:/i, 'Na segurança do trabalho, ainda estão pendentes:')
    .replace(/^Próximas ações de arquitetura\/cliente:/i, 'Na arquitetura, os próximos pontos são:')
    .replace(/^A próxima ação obrigatória sugerida pelo roteiro é:/i, 'Pelo roteiro atual, o próximo passo é')
    .trim()
}

function friendlyAnswer(text: string) {
  const answer = normalizeContent(text)
  const name = firstName()
  const alreadyHasName = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i').test(answer)
  responseCount += 1
  if (alreadyHasName) return answer
  if (responseCount === 1) return `Oi, ${name}. Claro. ${answer}`
  return `${name}, ${answer}`
}

function unlockSpeechOnUserGesture() {
  if (!('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    const unlock = new SpeechSynthesisUtterance('\u200B')
    unlock.lang = 'pt-BR'
    unlock.volume = 0.01
    unlock.rate = 1
    window.speechSynthesis.speak(unlock)
  } catch {}
}

function clickProgrammatically(button: HTMLButtonElement | null) {
  if (!button || button.disabled) return false
  programmaticClick = true
  button.click()
  setTimeout(() => { programmaticClick = false }, 100)
  return true
}

function clearTranscriptOnly() {
  const { textarea } = getVoiceParts()
  if (!textarea) return
  try {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    if (setter) setter.call(textarea, '')
    else textarea.value = ''
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
  } catch {
    textarea.value = ''
  }
  lastTranscript = ''
  lastTranscriptChange = Date.now()
}

function resumeConversation() {
  if (!sessionArmed || !autoEnabled()) return
  const { mic, orb } = getVoiceParts()
  if (!mic || !orb || orb.classList.contains('listening')) return
  if (document.querySelector('.v4-agent-result .v4-primary')) return

  clearTranscriptOnly()

  setTimeout(() => {
    const current = getVoiceParts()
    if (sessionArmed && autoEnabled() && current.mic && current.orb && !current.orb.classList.contains('listening')) {
      clickProgrammatically(current.mic)
    }
  }, 650)
}

function speakPrepared(text: string, resumeAfter = true) {
  if (!text || !('speechSynthesis' in window)) {
    if (resumeAfter) resumeConversation()
    return
  }

  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean || clean === lastSpoken) {
    if (resumeAfter) resumeConversation()
    return
  }
  lastSpoken = clean

  try {
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = 'pt-BR'
    utterance.rate = 0.90
    utterance.pitch = 1
    utterance.volume = 1
    const voice = selectedVoice()
    if (voice) utterance.voice = voice

    utterance.onstart = () => { speaking = true }
    utterance.onend = () => {
      speaking = false
      processing = false
      if (resumeAfter) setTimeout(resumeConversation, 450)
    }
    utterance.onerror = () => {
      speaking = false
      processing = false
      if (resumeAfter) setTimeout(resumeConversation, 450)
    }

    window.speechSynthesis.speak(utterance)
    setTimeout(() => {
      try { window.speechSynthesis.resume() } catch {}
    }, 120)
  } catch {
    speaking = false
    processing = false
    if (resumeAfter) resumeConversation()
  }
}

function stopSpeaking() {
  try { window.speechSynthesis?.cancel() } catch {}
  speaking = false
}

function updateOrbCopy() {
  const { orb } = getVoiceParts()
  if (!orb) return
  const title = orb.querySelector('div > b') as HTMLElement | null
  const subtitle = orb.querySelector('div > span') as HTMLElement | null
  const name = firstName()
  if (title) title.textContent = `Oi, ${name}. Pode falar comigo normalmente.`
  if (subtitle) subtitle.textContent = 'Pergunte sobre a obra, registre o que aconteceu ou dê um comando. Eu respondo por voz.'
}

function populateVoiceSelect(select: HTMLSelectElement) {
  const voices = portugueseVoices()
  const current = localStorage.getItem(VOICE_KEY) || selectedVoice()?.voiceURI || ''
  select.innerHTML = ''
  if (!voices.length) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'Voz padrão do aparelho'
    select.appendChild(option)
    select.disabled = true
    return
  }
  select.disabled = false
  voices.forEach(v => {
    const option = document.createElement('option')
    option.value = v.voiceURI
    option.textContent = `${v.name}${v.localService ? ' • aparelho' : ''}`
    option.selected = v.voiceURI === current
    select.appendChild(option)
  })
}

function ensureConversationControl() {
  const { agent, orb } = getVoiceParts()
  if (!agent || !orb) return
  updateOrbCopy()
  if (agent.querySelector('.v4-voice-reply-toggle')) return

  const wrap = document.createElement('div')
  wrap.className = 'v4-voice-reply-toggle'

  const autoButton = document.createElement('button')
  autoButton.type = 'button'
  autoButton.className = 'v4-auto-conversation-button'

  const renderAuto = () => {
    const on = autoEnabled()
    autoButton.classList.toggle('active', on)
    autoButton.innerHTML = `${on ? '🟢' : '⚪'} <span>Conversa automática</span><strong>${on ? 'Ativa' : 'Pausada'}</strong><small>${on ? 'você fala e eu respondo por voz' : 'toque para reativar'}</small>`
  }

  autoButton.addEventListener('click', () => {
    const next = !autoEnabled()
    setAutoEnabled(next)
    sessionArmed = next
    if (!next) stopSpeaking()
    else unlockSpeechOnUserGesture()
    renderAuto()
  })

  const voiceBox = document.createElement('div')
  voiceBox.className = 'v4-voice-picker'
  const label = document.createElement('label')
  label.textContent = 'Voz do agente'
  const select = document.createElement('select')
  populateVoiceSelect(select)
  select.addEventListener('change', () => {
    localStorage.setItem(VOICE_KEY, select.value)
    unlockSpeechOnUserGesture()
    const name = firstName()
    setTimeout(() => speakPrepared(`Oi, ${name}. Esta é a voz que você escolheu para o Obra360.`, false), 80)
  })
  const test = document.createElement('button')
  test.type = 'button'
  test.className = 'v4-voice-test'
  test.textContent = 'Ouvir'
  test.addEventListener('click', () => {
    unlockSpeechOnUserGesture()
    const name = firstName()
    setTimeout(() => speakPrepared(`Oi, ${name}. Tudo bem? Esta é a voz atual do seu copiloto de obra.`, false), 80)
  })
  voiceBox.append(label, select, test)

  renderAuto()
  wrap.append(autoButton, voiceBox)
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
    unlockSpeechOnUserGesture()
    clearTranscriptOnly()
    processing = false
    setTimeout(() => ensureConversationControl(), 0)
  }, { capture: true })
}

function inspectAnswer() {
  const { result } = getVoiceParts()
  if (!result) return
  const heading = result.querySelector('h3') as HTMLElement | null
  const raw = heading?.dataset.rawAnswer || heading?.textContent?.trim() || ''
  if (!heading || !raw || raw === lastAnswer) return
  if (!heading.dataset.rawAnswer) heading.dataset.rawAnswer = raw

  lastAnswer = raw
  processing = false
  clearTranscriptOnly()
  const needsConfirmation = !!result.querySelector('.v4-primary')
  const combined = needsConfirmation ? `${raw}. Se estiver correto, confirme a ação na tela.` : raw
  const friendly = friendlyAnswer(combined)
  heading.textContent = friendly
  heading.dataset.voiceFriendly = '1'
  speakPrepared(friendly, !needsConfirmation)
}

function speakMessageIfNeeded() {
  if (!processing) return
  const msg = document.querySelector('.v4-agent-message')?.textContent?.trim() || ''
  if (!msg) return
  processing = false
  clearTranscriptOnly()
  const friendly = friendlyAnswer(msg)
  speakPrepared(friendly, sessionArmed)
}

function pollConversation() {
  ensureConversationControl()
  wireMic()
  inspectAnswer()
  speakMessageIfNeeded()

  const { orb, mic, textarea, understand } = getVoiceParts()
  if (!orb || !mic || !textarea || !understand || !sessionArmed || !autoEnabled() || speaking || processing) return

  const listening = orb.classList.contains('listening')
  const value = textarea.value.trim()

  if (listening) {
    if (value !== lastTranscript) {
      lastTranscript = value
      lastTranscriptChange = Date.now()
    }

    if (value.length >= 3 && Date.now() - lastTranscriptChange >= SILENCE_MS) {
      processing = true
      clickProgrammatically(mic)
      setTimeout(() => {
        const current = getVoiceParts()
        if (current.understand && !current.understand.disabled) clickProgrammatically(current.understand)
        else processing = false
      }, 300)
    }
  }
}

function boot() {
  if ('speechSynthesis' in window) {
    const warm = () => {
      try {
        window.speechSynthesis.getVoices()
        window.speechSynthesis.resume()
        const select = document.querySelector('.v4-voice-picker select') as HTMLSelectElement | null
        if (select) populateVoiceSelect(select)
      } catch {}
    }
    warm()
    window.speechSynthesis.addEventListener?.('voiceschanged', warm)
  }

  const observer = new MutationObserver(() => {
    ensureConversationControl()
    updateOrbCopy()
    wireMic()
    inspectAnswer()
    speakMessageIfNeeded()
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] })

  setInterval(pollConversation, 220)
  pollConversation()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true })
else boot()
