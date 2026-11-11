import { AmbientMusic } from '../../components/ambientMusic.js'

// Ambiance sonore du jeu, entièrement synthétisée (Web Audio) : aucun
// fichier à télécharger, aucune question de droits.
// - chœur d'insectes et brise de la forêt ;
// - murmure de la rivière, plus fort à son approche ;
// - chants d'oiseaux (gazouillis et appels sifflés) ;
// - pas du joueur (sol ou eau) et signaux de l'interface ;
// - musique douce (sanza) reprise de l'atlas, en option.

function noiseBuffer(ctx, seconds, kind) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      b0 = 0.997 * b0 + white * 0.029591
      b1 = 0.985 * b1 + white * 0.032534
      b2 = 0.95 * b2 + white * 0.048056
      data[i] = (b0 + b1 + b2) * 0.4
    }
  }
  return buffer
}

export class Ambience {
  constructor() {
    this.ctx = null
    this.timers = []
    this.zone = 'lisiere'
    this.music = null
  }

  start({ sound = true, music = true } = {}) {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)
    this.master.gain.setTargetAtTime(sound ? 0.9 : 0, ctx.currentTime, 1.5)
    this.soundOn = sound

    // Insectes : bruit aigu modulé par un battement lent.
    const insects = ctx.createBufferSource()
    insects.buffer = noiseBuffer(ctx, 3, 'pink')
    insects.loop = true
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 5200
    band.Q.value = 4
    this.insectGain = ctx.createGain()
    this.insectGain.gain.value = 0.05
    const trem = ctx.createOscillator()
    trem.frequency.value = 11
    const tremDepth = ctx.createGain()
    tremDepth.gain.value = 0.025
    trem.connect(tremDepth).connect(this.insectGain.gain)
    insects.connect(band).connect(this.insectGain).connect(this.master)

    // Brise.
    const wind = ctx.createBufferSource()
    wind.buffer = noiseBuffer(ctx, 4, 'pink')
    wind.loop = true
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'lowpass'
    windFilter.frequency.value = 700
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0.08
    wind.connect(windFilter).connect(this.windGain).connect(this.master)

    // Rivière.
    const river = ctx.createBufferSource()
    river.buffer = noiseBuffer(ctx, 4, 'brown')
    river.loop = true
    const riverFilter = ctx.createBiquadFilter()
    riverFilter.type = 'lowpass'
    riverFilter.frequency.value = 900
    this.riverGain = ctx.createGain()
    this.riverGain.gain.value = 0
    river.connect(riverFilter).connect(this.riverGain).connect(this.master)

    for (const s of [insects, wind, river, trem]) s.start()
    this.sources = [insects, wind, river, trem]
    this.scheduleBird()

    if (music) this.setMusic(true)
  }

  // Volume des couches selon le lieu et la distance à la rivière.
  setPlace(zone, riverDistance) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.zone = zone
    const forest = zone === 'foret' || zone === 'belvedere'
    this.insectGain.gain.setTargetAtTime(forest ? 0.08 : 0.035, now, 1.5)
    this.windGain.gain.setTargetAtTime(zone === 'belvedere' ? 0.18 : forest ? 0.05 : 0.09, now, 1.5)
    const river = Math.max(0, 1 - riverDistance / 28)
    this.riverGain.gain.setTargetAtTime(river * river * 0.5, now, 0.6)
  }

  scheduleBird() {
    if (!this.ctx) return
    const forest = this.zone === 'foret'
    this.bird()
    this.timers.push(setTimeout(() => this.scheduleBird(), (forest ? 1200 : 2500) + Math.random() * (forest ? 3000 : 5000)))
  }

  bird() {
    const ctx = this.ctx
    const now = ctx.currentTime
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (pan) pan.pan.value = Math.random() * 1.6 - 0.8
    const out = ctx.createGain()
    out.gain.value = 0.05 + Math.random() * 0.05
    ;(pan ? out.connect(pan) : out).connect(this.master)
    const whistle = Math.random() < 0.35
    const notes = whistle ? 2 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 5)
    const base = whistle ? 1200 + Math.random() * 700 : 2600 + Math.random() * 1800
    for (let i = 0; i < notes; i++) {
      const start = now + i * (whistle ? 0.38 : 0.09 + Math.random() * 0.05)
      const length = whistle ? 0.3 : 0.06 + Math.random() * 0.05
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const f = base * (whistle ? (i % 2 ? 0.84 : 1) : 1 + Math.random() * 0.25)
      osc.frequency.setValueAtTime(f, start)
      osc.frequency.exponentialRampToValueAtTime(f * (whistle ? 1.04 : 1.35), start + length)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, start)
      env.gain.linearRampToValueAtTime(1, start + 0.012)
      env.gain.exponentialRampToValueAtTime(0.001, start + length)
      osc.connect(env).connect(out)
      osc.start(start)
      osc.stop(start + length + 0.02)
    }
  }

  step(water) {
    if (!this.ctx || !this.soundOn) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.stepBuffer ??= noiseBuffer(ctx, 0.25, 'pink')
    const filter = ctx.createBiquadFilter()
    filter.type = water ? 'bandpass' : 'lowpass'
    filter.frequency.value = water ? 1400 + Math.random() * 600 : 380 + Math.random() * 160
    const env = ctx.createGain()
    env.gain.setValueAtTime(water ? 0.5 : 0.7, now)
    env.gain.exponentialRampToValueAtTime(0.001, now + (water ? 0.22 : 0.09))
    src.connect(filter).connect(env).connect(this.master)
    src.start(now)
    src.stop(now + 0.25)
  }

  // Signaux de l'interface : découverte, mission, réponse juste ou fausse.
  chime(kind = 'discover') {
    if (!this.ctx || !this.soundOn) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const seq = { discover: [72, 76, 79, 84], mission: [67, 72, 76, 79, 84, 88], correct: [76, 84], wrong: [64, 61], open: [79] }[kind] ?? [79]
    seq.forEach((midi, i) => {
      const start = now + i * (kind === 'mission' ? 0.12 : 0.08)
      const osc = ctx.createOscillator()
      osc.type = kind === 'wrong' ? 'triangle' : 'sine'
      osc.frequency.value = 440 * 2 ** ((midi - 69) / 12)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, start)
      env.gain.linearRampToValueAtTime(0.16, start + 0.01)
      env.gain.exponentialRampToValueAtTime(0.001, start + (kind === 'mission' ? 1.4 : 0.7))
      osc.connect(env).connect(this.master)
      osc.start(start)
      osc.stop(start + 1.5)
    })
  }

  setSound(on) {
    this.soundOn = on
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.4)
  }

  setMusic(on) {
    if (on && !this.music) {
      this.music = new AmbientMusic(0.5)
      this.music.start()
      // Musique en retrait : l'ambiance naturelle reste au premier plan.
      this.music.duck(true)
    } else if (!on && this.music) {
      this.music.stop()
      this.music = null
    }
  }

  pause() {
    this.ctx?.suspend()
    this.music?.pause()
  }

  resume() {
    this.ctx?.resume()
    this.music?.resume()
  }

  stop() {
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.music?.stop()
    this.music = null
    const ctx = this.ctx
    if (!ctx) return
    this.ctx = null
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
    setTimeout(() => {
      this.sources?.forEach((s) => s.stop())
      ctx.close()
    }, 1200)
  }
}
