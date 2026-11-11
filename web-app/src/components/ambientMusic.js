// Musique d'ambiance de la visite documentaire de l'atlas.
//
// Entièrement synthétisée dans le navigateur (Web Audio) : aucun fichier
// audio, aucune question de droits. Quatre couches douces :
// - une mélodie lente au timbre de sanza (likembe), le piano à pouces
//   d'Afrique centrale, sur une gamme pentatonique ;
// - des nappes d'accords (sinus et triangles filtrés), dans un registre
//   médium que reproduisent aussi les haut-parleurs d'ordinateur portable ;
// - de rares notes cristallines ;
// - un souffle léger, comme le vent dans la forêt ou une rivière lointaine.
// Le tout passe par une réverbération ample.

// Fréquence d'une note MIDI.
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)

// Progression calme en do majeur : Cmaj9 – Am9 – Fmaj7 – G6sus2.
const CHORDS = [
  [60, 67, 71, 74, 76],
  [57, 64, 67, 71, 72],
  [53, 60, 64, 67, 69],
  [55, 62, 67, 69, 74],
]
// Phrases de sanza, une par accord (une note toutes les 0,75 s ; null = silence).
const PHRASES = [
  [72, 76, 79, null, 76, 74, 72, null, 67, 69, 72, null],
  [69, 72, 76, null, 74, 72, 69, null, 64, 67, 69, null],
  [69, 72, 74, null, 72, 69, 67, null, 65, 67, 69, null],
  [67, 71, 74, null, 76, 74, 71, null, 69, 67, 62, null],
]
const STEP_SECONDS = 0.75
// Pentatonique majeure de do, deux octaves au-dessus.
const BELLS = [72, 74, 76, 79, 81, 84, 86, 88]

const CHORD_SECONDS = 9
const VOLUME = 1.1

function impulse(ctx, seconds = 4.5, decay = 2.8) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
  }
  return buffer
}

export class AmbientMusic {
  // « volume » : niveau général (le jeu l'utilise plus discrètement que l'atlas).
  constructor(volume = VOLUME) {
    this.volume = volume
    this.ctx = null
    this.timers = []
    this.chordIndex = 0
  }

  get running() {
    return Boolean(this.ctx)
  }

  start() {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    this.ctx = ctx

    // Chaîne de sortie : volume général → compresseur doux → haut-parleurs.
    this.master = ctx.createGain()
    this.master.gain.value = 0
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -24
    compressor.ratio.value = 3
    this.master.connect(compressor).connect(ctx.destination)

    // Réverbération partagée.
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = impulse(ctx)
    const wet = ctx.createGain()
    wet.gain.value = 0.55
    this.reverb.connect(wet).connect(this.master)
    this.dry = ctx.createGain()
    this.dry.gain.value = 0.6
    this.dry.connect(this.master)

    this.startBreeze()
    this.playChord()
    this.timers.push(setInterval(() => this.playChord(), CHORD_SECONDS * 1000))
    this.step = 0
    this.timers.push(setInterval(() => this.playMelodyStep(), STEP_SECONDS * 1000))
    this.scheduleBell()

    // Fondu d'entrée sur quatre secondes.
    this.master.gain.setTargetAtTime(this.level(), ctx.currentTime, 1.4)
  }

  // Souffle : bruit rose filtré, dont l'intensité ondule lentement.
  startBreeze() {
    const ctx = this.ctx
    const length = ctx.sampleRate * 4
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.997 * b0 + white * 0.029591
      b1 = 0.985 * b1 + white * 0.032534
      b2 = 0.95 * b2 + white * 0.048056
      data[i] = (b0 + b1 + b2) * 0.4
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 520
    band.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.value = 0.05
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const depth = ctx.createGain()
    depth.gain.value = 0.03
    lfo.connect(depth).connect(gain.gain)
    noise.connect(band).connect(gain)
    gain.connect(this.dry)
    gain.connect(this.reverb)
    noise.start()
    lfo.start()
    this.sources = [noise, lfo]
  }

  // Nappe : chaque note monte lentement, tient, puis s'éteint en douceur.
  playChord() {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    const notes = CHORDS[this.chordIndex++ % CHORDS.length]
    const length = CHORD_SECONDS + 4
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(700, now)
    filter.frequency.linearRampToValueAtTime(1100, now + length / 2)
    filter.frequency.linearRampToValueAtTime(700, now + length)
    filter.connect(this.dry)
    filter.connect(this.reverb)
    for (const [i, midi] of notes.entries()) {
      for (const [type, detune, level] of [['sine', 0, 0.045], ['triangle', 7, 0.022]]) {
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.value = hz(midi)
        osc.detune.value = detune * (i % 2 ? 1 : -1)
        const env = ctx.createGain()
        env.gain.setValueAtTime(0, now)
        env.gain.linearRampToValueAtTime(level, now + 3.5)
        env.gain.setValueAtTime(level, now + length - 4.5)
        env.gain.linearRampToValueAtTime(0, now + length)
        osc.connect(env).connect(filter)
        osc.start(now)
        osc.stop(now + length + 0.1)
      }
    }
  }

  // Mélodie : la phrase de l'accord en cours, avec quelques notes omises au
  // hasard et une intensité variable, pour un jeu vivant et jamais répétitif.
  playMelodyStep() {
    if (!this.ctx) return
    const phrase = PHRASES[(this.chordIndex - 1 + PHRASES.length) % PHRASES.length]
    const midi = phrase[this.step++ % phrase.length]
    if (midi == null || Math.random() < 0.18) return
    this.pluck(midi, 0.7 + Math.random() * 0.3)
  }

  // Note de sanza : attaque nette, extinction rapide, léger partiel aigu.
  pluck(midi, velocity = 1) {
    const ctx = this.ctx
    const now = ctx.currentTime
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.13 * velocity, now + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, now + 2.2)
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (pan) pan.pan.value = (midi - 70) / 20
    const out = pan ? env.connect(pan) : env
    out.connect(this.dry)
    out.connect(this.reverb)
    for (const [ratio, level, decay] of [[1, 1, 2.2], [2.01, 0.18, 0.8], [5.4, 0.06, 0.25]]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = hz(midi) * ratio
      const partial = ctx.createGain()
      partial.gain.setValueAtTime(level, now)
      partial.gain.exponentialRampToValueAtTime(0.0001, now + decay)
      osc.connect(partial).connect(env)
      osc.start(now)
      osc.stop(now + 2.3)
    }
  }

  // Notes cristallines espacées de 2,5 à 6 secondes, réparties dans l'espace.
  scheduleBell() {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz(BELLS[Math.floor(Math.random() * BELLS.length)])
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.035, now + 0.04)
    env.gain.exponentialRampToValueAtTime(0.0001, now + 3.2)
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (pan) pan.pan.value = Math.random() * 1.2 - 0.6
    const out = pan ? osc.connect(env).connect(pan) : osc.connect(env)
    out.connect(this.reverb)
    out.connect(this.dry)
    osc.start(now)
    osc.stop(now + 3.3)
    this.timers.push(setTimeout(() => this.scheduleBell(), 5000 + Math.random() * 6000))
  }

  // Volume cible : nul si coupé, abaissé pendant que la voix parle.
  level() {
    return this.muted ? 0 : this.ducked ? this.volume * 0.65 : this.volume
  }

  setMuted(muted) {
    this.muted = muted
    if (!this.ctx) return
    this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.5)
  }

  duck(on) {
    this.ducked = on
    if (!this.ctx) return
    this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.8)
  }

  pause() {
    this.ctx?.suspend()
  }

  resume() {
    this.ctx?.resume()
  }

  // Fondu de sortie, puis libération des ressources audio.
  stop() {
    const ctx = this.ctx
    if (!ctx) return
    this.ctx = null
    this.timers.forEach((id) => (clearInterval(id), clearTimeout(id)))
    this.timers = []
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.6)
    setTimeout(() => {
      this.sources?.forEach((s) => s.stop())
      ctx.close()
    }, 2500)
  }
}
