const AUTO_KEY = 'obra360_voice_conversation_auto'
const VOICE_KEY = 'obra360_voice_selected'
const SILENCE_MS = 1500

let sessionArmed = false
let speaking = false
let processing = false
let programmaticClick = false
let lastTranscript = ''
let lastTranscriptChange = 0
let lastAnswer = ''
let lastSpoken = ''
let responseCount = 0
let controlsMounted = false

function autoEnabled() {
  const saved = localStorage.getItem(AUTO_KEY)
  return saved === null ? true : saved === 'true'
}

function setAutoEnabled(value: boolean) {
  localStorage.setItem(AUTO_KEY, String(value))
}

function firstName() {
  const candidates = [
    document.querySelector('.v4-side-user b')?.textContent,
    document.querySelector('.v4-side-user strong')?.textContent,
    document.querySelector('[data-user-name]')?.textContent,
  ]
  const name = candidates.find(Boolean)?.trim() || ''
  return name.split(/\s+/).filter(Boolean)[0] || 'Luan'
}

function parts() {
  const agent = document.querySelector('.v4-agent-work') as HTMLElement | null
  const orb = agent?.querySelector('.v4-voice-orb') as HTMLElement | null
  const mic = orb?.querySelector('button') as HTMLButtonElement | null
  const textarea = agent?.querySelector('.v4-transcript textarea') as HTMLTextAreaElement | null
  const actionButtons = Array.from(agent?.querySelectorAll('.v4-agent-actions button') || []) as HTMLButtonElement[]
  const understand = actionButtons.find(b => /entender/i.test(b.textContent || '')) || null
  const result = agent?.querySelector('.v4-agent-result') as HTMLElement | null
  return { agent, orb, mic, textarea, understand, result }
}

function portugueseVoices() {
  if (!('speechSynthesis' in window)) return [] as SpeechSynthesisVoice[]
  const voices = window.speechSynthesis.getVoices() || []
  const br = voices.filter(v => /^pt(-|_)?BR$/i.test(v.lang))
  return br.length ? br : voices.filter(v => /^pt/i.test(v.lang))
}

function scoreVoice(v: SpeechSynthesisVoice) {
  const n = v.name.toLowerCase()
  let score = 0
  if (/natural|neural|premium|enhanced/.test(n)) score += 100
  if (/microsoft/.test(n)) score += 45
  if (/google/.test(n)) score += 35
  if (/luciana|francisca|joana|camila|vit[oó]ria|maria|flo/.test(n)) score += 25
  if (/pt-br/i.test(v.lang)) score += 15
  if (!v.localService) score += 8
  return score
}

function selectedVoice() {
  const voices = portugueseVoices()
  const saved = localStorage.getItem(VOICE_KEY)
  if (saved) {
    const exact = voices.find(v => v.voiceURI === saved || v.name === saved)
    if (exact) return exact
  }
  return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null
}

function normalizeContent(text: string) {
  return String(text || '')
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
  if (!answer) return ''
  responseCount += 1
  const nameRegex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  if (nameRegex.test(answer)) return answer
  return responseCount === 1 ? `Oi, ${name}. Claro. ${answer}` : `${name}, ${answer}`
}

function stopSpeaking() {
  try { window.speechSynthesis?.cancel() } catch {}
  speaking = false
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

function setReactTextareaValue(el: HTMLTextAreaElement, value: string) {
  try {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } catch {
    el.value = value
  }
}

function clearTranscript() {
  const { textarea } = parts()
  if (textarea && textarea.value) setReactTextareaValue(textarea, '')
  lastTranscript = ''
  lastTranscriptChange = Date.now()
}

function clickProgrammatically(btn: HTMLButtonElement | null) {
  if (!btn || btn.disabled) return false
  programmaticClick = true
  btn.click()
  window.setTimeout(() => { programmaticClick = false }, 120)
  return true
}

function speak(text: string, resumeAfter = true) {
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
  stopSpeaking()

  try {
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = 'pt-BR'
    u.rate = 0.94
    u.pitch = 1.02
    u.volume = 1
    const voice = selectedVoice()
    if (voice) u.voice = voice
    u.onstart = () => { speaking = true }
    u.onend = () => {
      speaking = false
      processing = false
      if (resumeAfter) window.setTimeout(resumeConversation, 450)
    }
    u.onerror = () => {
      speaking = false
      processing = false
      if (resumeAfter) window.setTimeout(resumeConversation, 450)
    }
    window.speechSynthesis.speak(u)
  } catch {
    speaking = false
    processing = false
  }
}

function resumeConversation() {
  if (!sessionArmed || !autoEnabled() || speaking || processing) return
  const { mic, orb } = parts()
  if (!mic || !orb || orb.classList.contains('listening')) return
  if (document.querySelector('.v4-agent-result .v4-primary')) return
  clearTranscript()
  window.setTimeout(() => {
    const p = parts()
    if (sessionArmed && autoEnabled() && p.mic && p.orb && !p.orb.classList.contains('listening')) {
      clickProgrammatically(p.mic)
    }
  }, 500)
}

function updateOrbCopy() {
  const { orb } = parts()
  if (!orb) return
  const title = orb.querySelector('div > b') as HTMLElement | null
  const subtitle = orb.querySelector('div > span') as HTMLElement | null
  const wantedTitle = `Oi, ${firstName()}. Pode falar comigo normalmente.`
  const wantedSubtitle = 'Pergunte sobre a obra, registre o que aconteceu ou dê um comando. Eu respondo por voz.'
  if (title && title.textContent !== wantedTitle) title.textContent = wantedTitle
  if (subtitle && subtitle.textContent !== wantedSubtitle) subtitle.textContent = wantedSubtitle
}

function fillVoiceSelect(select: HTMLSelectElement) {
  const voices = portugueseVoices()
  const current = localStorage.getItem(VOICE_KEY) || selectedVoice()?.voiceURI || ''
  const signature = voices.map(v => `${v.voiceURI}:${v.name}`).join('|')
  if (select.dataset.signature === signature) return
  select.dataset.signature = signature
  select.innerHTML = ''
  if (!voices.length) {
    const o = document.createElement('option')
    o.textContent = 'Voz padrão do aparelho'
    select.appendChild(o)
    select.disabled = true
    return
  }
  select.disabled = false
  ;[...voices].sort((a,b)=>scoreVoice(b)-scoreVoice(a)).forEach(v => {
    const o = document.createElement('option')
    o.value = v.voiceURI
    const natural = /natural|neural|premium|enhanced/i.test(v.name) ? ' • natural' : ''
    o.textContent = `${v.name}${natural}`
    o.selected = v.voiceURI === current
    select.appendChild(o)
  })
}

function mountControls() {
  const { agent, orb } = parts()
  if (!agent || !orb) {
    controlsMounted = false
    return
  }
  updateOrbCopy()
  if (agent.querySelector('.v4-voice-reply-toggle')) {
    controlsMounted = true
    return
  }

  const wrap = document.createElement('div')
  wrap.className = 'v4-voice-reply-toggle'

  const auto = document.createElement('button')
  auto.type = 'button'
  auto.className = 'v4-auto-conversation-button'
  const renderAuto = () => {
    const on = autoEnabled()
    auto.classList.toggle('active', on)
    auto.innerHTML = `${on ? '🟢' : '⚪'} <span>Conversa automática</span><strong>${on ? 'Ativa' : 'Pausada'}</strong><small>${on ? 'você fala e eu respondo por voz' : 'toque para reativar'}</small>`
  }
  renderAuto()
  auto.onclick = () => {
    const next = !autoEnabled()
    setAutoEnabled(next)
    sessionArmed = next
    if (next) unlockSpeech(); else stopSpeaking()
    renderAuto()
  }

  const picker = document.createElement('div')
  picker.className = 'v4-voice-picker'
  const label = document.createElement('label')
  label.textContent = 'Voz do agente'
  const select = document.createElement('select')
  fillVoiceSelect(select)
  select.onchange = () => {
    localStorage.setItem(VOICE_KEY, select.value)
    unlockSpeech()
    window.setTimeout(() => speak(`Oi, ${firstName()}. Esta é a voz selecionada.`, false), 80)
  }
  const test = document.createElement('button')
  test.type = 'button'
  test.className = 'v4-voice-test'
  test.textContent = 'Ouvir'
  test.onclick = () => {
    unlockSpeech()
    window.setTimeout(() => speak(`Oi, ${firstName()}. Tudo bem? Esta é a voz atual do seu copiloto de obra.`, false), 80)
  }
  picker.append(label, select, test)
  wrap.append(auto, picker)
  orb.insertAdjacentElement('afterend', wrap)
  controlsMounted = true
}

function wireMic() {
  const { mic } = parts()
  if (!mic || mic.dataset.voiceConversationWired === '1') return
  mic.dataset.voiceConversationWired = '1'
  mic.addEventListener('click', () => {
    stopSpeaking()
    if (programmaticClick) return
    sessionArmed = true
    setAutoEnabled(true)
    unlockSpeech()
    clearTranscript()
    processing = false
  }, { capture: true })
}

function inspectAnswer() {
  const { result } = parts()
  if (!result) return
  const heading = result.querySelector('h3') as HTMLElement | null
  const raw = heading?.dataset.rawAnswer || heading?.textContent?.trim() || ''
  if (!heading || !raw || raw === lastAnswer) return
  if (!heading.dataset.rawAnswer) heading.dataset.rawAnswer = raw
  lastAnswer = raw
  processing = false
  clearTranscript()
  const needsConfirmation = !!result.querySelector('.v4-primary')
  const base = needsConfirmation ? `${raw}. Se estiver correto, confirme a ação na tela.` : raw
  const friendly = friendlyAnswer(base)
  if (heading.textContent !== friendly) heading.textContent = friendly
  speak(friendly, !needsConfirmation)
}

function pollConversation() {
  mountControls()
  wireMic()
  inspectAnswer()

  const { orb, mic, textarea, understand } = parts()
  if (!orb || !mic || !textarea || !understand || !sessionArmed || !autoEnabled() || speaking || processing) return

  const listening = orb.classList.contains('listening')
  const value = textarea.value.trim()
  if (!listening) return

  if (value !== lastTranscript) {
    lastTranscript = value
    lastTranscriptChange = Date.now()
    return
  }

  if (value.length >= 3 && Date.now() - lastTranscriptChange >= SILENCE_MS) {
    processing = true
    clickProgrammatically(mic)
    window.setTimeout(() => {
      const p = parts()
      if (p.understand && !p.understand.disabled) clickProgrammatically(p.understand)
      else processing = false
    }, 350)
  }
}

function boot() {
  if ('speechSynthesis' in window) {
    const warm = () => {
      try { window.speechSynthesis.getVoices(); window.speechSynthesis.resume() } catch {}
      const select = document.querySelector('.v4-voice-picker select') as HTMLSelectElement | null
      if (select) fillVoiceSelect(select)
    }
    warm()
    window.speechSynthesis.addEventListener?.('voiceschanged', warm)
  }

  // Deliberadamente sem MutationObserver: a versão anterior reagia às próprias
  // alterações do DOM e podia criar um loop pesado no Safari/iPhone.
  window.setInterval(pollConversation, 420)
  pollConversation()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
else boot()
