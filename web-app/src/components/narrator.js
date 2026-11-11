// Voix de la visite documentaire de l'atlas : synthèse vocale du navigateur
// (Web Speech API), en français, posée et un peu lente.
//
// Le texte est lu phrase par phrase : certains navigateurs interrompent les
// longs énoncés, et cela permet d'afficher les sous-titres et de reprendre
// une pause à la phrase en cours.

// Voix françaises préférées, des plus naturelles aux plus courantes.
const PREFERRED = ['Denise', 'Vivienne', 'Henri', 'Google français', 'Amélie', 'Audrey', 'Thomas', 'Marie']
const WORDS_PER_SECOND = 2.4

export const narrationSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

function frenchVoice() {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('fr'))
  for (const name of PREFERRED) {
    const voice = voices.find((v) => v.name.includes(name))
    if (voice) return voice
  }
  return voices.find((v) => v.lang.toLowerCase() === 'fr-fr') ?? voices[0] ?? null
}

// La liste des voix se charge parfois après l'ouverture de la page.
if (narrationSupported) window.speechSynthesis.getVoices()

const sentences = (text) => text.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ«])/).map((s) => s.trim()).filter(Boolean)
const countWords = (list) => list.join(' ').split(/\s+/).length

// Commentaire d'un lieu : son nom, son résumé et sa description, limités à
// environ 75 mots (une trentaine de secondes).
export function narrationFor(point, maxWords = 75) {
  const out = [`${point.name}.`, point.summary]
  for (const sentence of point.text.flatMap(sentences)) {
    if (countWords([...out, sentence]) > maxWords && out.length > 2) break
    out.push(sentence)
  }
  return out
}

// Durée estimée de la lecture, en millisecondes.
export const narrationDuration = (list) => Math.round((countWords(list) / WORDS_PER_SECOND) * 1000)

export class Narrator {
  constructor() {
    this.token = 0
  }

  // Lit les phrases à partir de « from ». onSentence(i, texte) annonce chaque
  // phrase ; onEnd() est appelé à la fin de la dernière.
  speak(list, from, { onSentence, onEnd }) {
    if (!narrationSupported) return onEnd?.()
    this.cancel()
    const token = ++this.token
    const synth = window.speechSynthesis
    const voice = frenchVoice()
    let i = from
    const next = () => {
      if (token !== this.token) return
      if (i >= list.length) return onEnd?.()
      const utterance = new SpeechSynthesisUtterance(list[i])
      utterance.lang = 'fr-FR'
      if (voice) utterance.voice = voice
      utterance.rate = 0.93
      utterance.pitch = 1
      utterance.volume = 1
      onSentence?.(i, list[i])
      // Garde-fou : si la voix ne signale pas la fin de la phrase (voix
      // indisponible, navigateur bloqué), la visite continue quand même.
      const watchdog = setTimeout(() => done(), narrationDuration([list[i]]) * 1.8 + 2500)
      let finished = false
      const done = () => {
        if (finished || token !== this.token) return
        finished = true
        clearTimeout(watchdog)
        i += 1
        setTimeout(next, 280)
      }
      utterance.onend = done
      utterance.onerror = done
      synth.speak(utterance)
    }
    next()
  }

  cancel() {
    this.token += 1
    if (narrationSupported) window.speechSynthesis.cancel()
  }
}

// Commentaires enregistrés (fichiers MP3), lus de préférence à la synthèse
// du navigateur. Les sous-titres suivent le minutage de chaque phrase, ou à
// défaut la longueur des phrases.
export class ClipPlayer {
  constructor(timings = {}) {
    this.timings = timings
    this.audio = null
    this.id = null
  }

  // Joue, ou reprend là où elle s'était arrêtée, la piste du lieu « id ».
  play(id, lines, { onSentence, onEnd, onError }) {
    if (this.id !== id) {
      this.stop()
      this.id = id
      this.sentence = -1
      this.audio = new Audio(`/audio/atlas/${id}.mp3`)
      this.audio.preload = 'auto'
    }
    const audio = this.audio
    const starts = this.timings[id]?.starts
    audio.ontimeupdate = () => {
      const t = audio.currentTime
      let i
      if (starts) {
        i = starts.findLastIndex((start) => start <= t + 0.05)
      } else if (audio.duration) {
        // Répartition proportionnelle à la longueur des phrases.
        const total = lines.reduce((sum, l) => sum + l.length, 0)
        let acc = 0
        i = lines.findIndex((l) => (acc += l.length) / total >= t / audio.duration)
      }
      if (i >= 0 && i < lines.length && i !== this.sentence) {
        this.sentence = i
        onSentence?.(i, lines[i])
      }
    }
    audio.onended = () => onEnd?.()
    audio.onerror = () => onError?.()
    audio.play().catch((error) => error.name !== 'AbortError' && onError?.())
  }

  pause() {
    this.audio?.pause()
  }

  stop() {
    if (this.audio) {
      const audio = this.audio
      audio.ontimeupdate = audio.onended = audio.onerror = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    this.audio = null
    this.id = null
  }
}
