const STORAGE_KEY = 'obra360_voice_reply_enabled'
let lastSpoken = ''
let voicesReady = false

function enabled() {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === null ? true : saved === 'true'
}

function setEnabled(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value))
}

function getBestPortugueseVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || []
  const pt = voices.filter(v => /^pt(-|_)?BR/i.test(v.lang) || /^pt-BR$/i.test(v.lang))
  const preferredNames = [
    'Luciana', 'Camila', 'Vitória', 'Vitoria', 'Francisca', 'Joana', 'Maria', 'Flo',
    'Google português do Brasil', 'Portuguese (Brazil)'
  ]
  for (const name of preferredNames) {
    const found = pt.find(v => v.name.toLowerCase().includes(name.toLowerCase()))
    if (found) return found
  }
  return pt[0] || voices.find(v => /^pt/i.test(v.lang)) || null
}

function speak(text: string) {
  if (!enabled() || !text || !('speechSynthesis' in window)) return
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean || clean === lastSpoken) return
  lastSpoken = clean
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(clean)
  utterance.lang = 'pt-BR'
  utterance.rate = 0.98
  utterance.pitch = 1.03
  utterance.volume = 1
  const voice = getBestPortugueseVoice()
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

function ensureToggle() {
  const agent = document.querySelector('.v4-agent-work')
  if (!agent || agent.querySelector('.v4-voice-reply-toggle')) return
  const voiceOrb = agent.querySelector('.v4-voice-orb')
  if (!voiceOrb) return

  const wrap = document.createElement('div')
  wrap.className = 'v4-voice-reply-toggle'
  const button = document.createElement('button')
  button.type = 'button'

  const render = () => {
    const isOn = enabled()
    button.className = isOn ? 'active' : ''
    button.innerHTML = `${isOn ? '🔊' : '🔇'} <span>Resposta por voz</span><strong>${isOn ? 'Ativada' : 'Desativada'}</strong>`
  }

  button.addEventListener('click', () => {
    const next = !enabled()
    setEnabled(next)
    if (!next) stopSpeaking()
    render()
    if (next) speak('Resposta por voz ativada.')
  })

  render()
  wrap.appendChild(button)
  voiceOrb.insertAdjacentElement('afterend', wrap)
}

function inspectForAnswer() {
  ensureToggle()
  const result = document.querySelector('.v4-agent-result')
  if (!result) return
  const heading = result.querySelector('h3')?.textContent?.trim() || ''
  if (!heading) return
  speak(heading)
}

function wireMicCancel() {
  document.querySelectorAll('.v4-voice-orb button').forEach(btn => {
    if ((btn as HTMLElement).dataset.voiceCancelWired === '1') return
    ;(btn as HTMLElement).dataset.voiceCancelWired = '1'
    btn.addEventListener('click', stopSpeaking)
  })
}

function boot() {
  if (!('speechSynthesis' in window)) return
  const warmVoices = () => {
    window.speechSynthesis.getVoices()
    voicesReady = true
  }
  warmVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', warmVoices)

  const observer = new MutationObserver(() => {
    inspectForAnswer()
    wireMicCancel()
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  inspectForAnswer()
  wireMicCancel()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
