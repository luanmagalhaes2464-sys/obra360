const VOICE_KEY = 'obra360_voice_selected'
const USER_KEY = 'obra360_voice_selected_by_user'
const AUTO_VERSION_KEY = 'obra360_voice_auto_profile'
const AUTO_VERSION = 'natural-v2'

function portugueseVoices() {
  const voices = window.speechSynthesis?.getVoices?.() || []
  const br = voices.filter(v => /^pt(-|_)?BR/i.test(v.lang) || /^pt-BR$/i.test(v.lang))
  const pt = voices.filter(v => /^pt/i.test(v.lang))
  return br.length ? br : pt
}

function qualityScore(name: string) {
  const n = name.toLowerCase()
  let score = 0
  if (/(natural|neural|generative|premium|enhanced)/.test(n)) score += 120
  if (n.includes('microsoft')) score += 18
  if (n.includes('google')) score += 16
  if (n.includes('luciana')) score += 88
  if (n.includes('francisca')) score += 84
  if (n.includes('joana')) score += 80
  if (n.includes('maria')) score += 72
  if (n.includes('camila')) score += 70
  if (n.includes('vitoria') || n.includes('vitória')) score += 68
  if (n.includes('felipe')) score += 62
  if (/(compact|eloquence|novelty)/.test(n)) score -= 100
  return score
}

function chooseNaturalVoice() {
  if (!('speechSynthesis' in window)) return
  if (localStorage.getItem(USER_KEY) === '1') return
  const voices = portugueseVoices()
  if (!voices.length) return
  const best = [...voices].sort((a, b) => qualityScore(b.name) - qualityScore(a.name))[0]
  if (!best) return
  if (localStorage.getItem(AUTO_VERSION_KEY) !== AUTO_VERSION || !localStorage.getItem(VOICE_KEY)) {
    localStorage.setItem(VOICE_KEY, best.voiceURI)
    localStorage.setItem(AUTO_VERSION_KEY, AUTO_VERSION)
  }
}

function wirePicker() {
  const select = document.querySelector('.v4-voice-picker select') as HTMLSelectElement | null
  if (!select || select.dataset.qualityWired === '1') return
  select.dataset.qualityWired = '1'
  select.addEventListener('change', () => localStorage.setItem(USER_KEY, '1'))

  const box = select.closest('.v4-voice-picker') as HTMLElement | null
  if (box && !box.querySelector('.v4-natural-voice-note')) {
    const note = document.createElement('small')
    note.className = 'v4-natural-voice-note'
    note.textContent = 'O Obra360 prioriza automaticamente a voz em português mais natural disponível neste aparelho.'
    box.appendChild(note)
  }
}

function bootNaturalVoice() {
  chooseNaturalVoice()
  wirePicker()
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
    chooseNaturalVoice()
    setTimeout(wirePicker, 50)
  })
  const observer = new MutationObserver(() => wirePicker())
  observer.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootNaturalVoice, { once: true })
else bootNaturalVoice()
