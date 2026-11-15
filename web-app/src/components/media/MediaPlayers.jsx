import {
  AlertTriangle,
  Captions,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Headphones,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/index.js'
import { formatLabel, formatTime, SPEEDS } from './mediaFormat.js'

// Lecteurs intégrés de la médiathèque : vidéo, audio (avec forme d'onde),
// visionneuse d'images (zoom, déplacement, navigation) et aperçu de documents.
// Les fichiers sont servis par /api/public/media/:id/file, qui accepte les
// requêtes partielles : on peut se déplacer sans tout télécharger.

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(`urithi.player.${key}`)
    return v === null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(`urithi.player.${key}`, JSON.stringify(value))
  } catch {
    // stockage indisponible : préférence non mémorisée
  }
}

// État d'un élément <audio>/<video>, synchronisé par ses événements.
function useMediaElement(ref) {
  const [state, setState] = useState({ playing: false, current: 0, duration: 0, buffered: 0, waiting: false, ended: false, error: null, started: false })
  const [volume, setVolumeState] = useState(() => readPref('volume', 1))
  const [muted, setMuted] = useState(() => readPref('muted', false))
  const [rate, setRateState] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    el.volume = volume
    el.muted = muted
    const patch = (p) => setState((s) => ({ ...s, ...p }))
    const buffered = () => (el.buffered.length ? el.buffered.end(el.buffered.length - 1) : 0)
    const handlers = {
      play: () => patch({ playing: true, ended: false, started: true }),
      pause: () => patch({ playing: false }),
      ended: () => patch({ playing: false, ended: true }),
      timeupdate: () => patch({ current: el.currentTime, buffered: buffered() }),
      progress: () => patch({ buffered: buffered() }),
      durationchange: () => patch({ duration: el.duration }),
      loadedmetadata: () => patch({ duration: el.duration }),
      waiting: () => patch({ waiting: true }),
      seeking: () => patch({ waiting: true }),
      playing: () => patch({ waiting: false }),
      seeked: () => patch({ waiting: false }),
      canplay: () => patch({ waiting: false }),
      error: () => patch({ error: el.error?.code === 4 ? 'format' : 'network', waiting: false, playing: false }),
    }
    for (const [name, fn] of Object.entries(handlers)) el.addEventListener(name, fn)
    return () => {
      for (const [name, fn] of Object.entries(handlers)) el.removeEventListener(name, fn)
    }
    // volume et muted ne sont appliqués qu'au montage : ensuite via les setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])

  const toggle = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }, [ref])
  const seek = useCallback(
    (time) => {
      const el = ref.current
      if (!el || !Number.isFinite(el.duration)) return
      el.currentTime = Math.min(Math.max(time, 0), el.duration)
      setState((s) => ({ ...s, current: el.currentTime }))
    },
    [ref],
  )
  const skip = useCallback((delta) => seek((ref.current?.currentTime ?? 0) + delta), [ref, seek])
  const setVolume = useCallback(
    (v) => {
      const value = Math.min(Math.max(v, 0), 1)
      if (ref.current) {
        ref.current.volume = value
        ref.current.muted = value === 0
      }
      setVolumeState(value)
      setMuted(value === 0)
      writePref('volume', value)
      writePref('muted', value === 0)
    },
    [ref],
  )
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      if (ref.current) ref.current.muted = next
      writePref('muted', next)
      return next
    })
  }, [ref])
  const setRate = useCallback(
    (r) => {
      if (ref.current) ref.current.playbackRate = r
      setRateState(r)
    },
    [ref],
  )
  return { ...state, volume, muted, rate, toggle, seek, skip, setVolume, toggleMute, setRate }
}

// Raccourcis clavier communs aux lecteurs (quand le lecteur a le focus).
function playerKeys(p, extra = {}) {
  return (e) => {
    if (e.target.closest('input, select, textarea, [role="menu"]')) return
    const map = {
      ' ': () => p.toggle(),
      k: () => p.toggle(),
      ArrowRight: () => p.skip(5),
      ArrowLeft: () => p.skip(-5),
      l: () => p.skip(10),
      j: () => p.skip(-10),
      ArrowUp: () => p.setVolume(p.volume + 0.1),
      ArrowDown: () => p.setVolume(p.volume - 0.1),
      m: () => p.toggleMute(),
      ...extra,
    }
    const fn = map[e.key]
    if (fn && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      fn()
    }
  }
}

// Barre de progression : clic, glisser (souris ou doigt), clavier, aperçu
// du temps au survol. `children` permet de dessiner une forme d'onde.
function Seekbar({ current, duration, buffered = 0, onSeek, className = '', children }) {
  const ref = useRef(null)
  const [hover, setHover] = useState(null)
  const [drag, setDrag] = useState(null)
  const ratioAt = (clientX) => {
    const rect = ref.current.getBoundingClientRect()
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  }
  const shown = drag ?? (duration ? current / duration : 0)
  const onPointerDown = (e) => {
    if (!duration) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag(ratioAt(e.clientX))
  }
  const onPointerMove = (e) => {
    const r = ratioAt(e.clientX)
    setHover(r)
    if (drag !== null) setDrag(r)
  }
  const onPointerUp = (e) => {
    if (drag === null) return
    onSeek(ratioAt(e.clientX) * duration)
    setDrag(null)
  }
  const onKeyDown = (e) => {
    const step = { ArrowRight: 5, ArrowLeft: -5, PageUp: 30, PageDown: -30 }[e.key]
    if (step) {
      e.preventDefault()
      e.stopPropagation()
      onSeek(current + step)
    } else if (e.key === 'Home') onSeek(0)
    else if (e.key === 'End') onSeek(duration)
  }
  return (
    <div
      ref={ref}
      className={`seekbar ${drag !== null ? 'dragging' : ''} ${className}`}
      role="slider"
      tabIndex={0}
      aria-label={t('player.progression')}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration || 0)}
      aria-valuenow={Math.round(current || 0)}
      aria-valuetext={`${formatTime(current)} / ${formatTime(duration)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      style={{ '--progress': shown, '--buffered': duration ? buffered / duration : 0 }}
    >
      {children ?? (
        <div className="seekbar-track">
          <span className="seekbar-buffered" />
          <span className="seekbar-fill" />
          <span className="seekbar-thumb" />
        </div>
      )}
      {hover !== null && duration > 0 && (
        <span className="seekbar-tooltip" style={{ left: `${hover * 100}%` }}>
          {formatTime(hover * duration)}
        </span>
      )}
    </div>
  )
}

function VolumeControl({ p }) {
  const Icon = p.muted || p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2
  return (
    <div className="volume">
      <button type="button" className="player-btn" onClick={p.toggleMute} aria-label={p.muted ? t('player.activerLeSon') : t('player.couperLeSon')} title={p.muted ? t('player.activerLeSon') : t('player.couperLeSon')}>
        <Icon size={19} aria-hidden="true" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={p.muted ? 0 : p.volume}
        onChange={(e) => p.setVolume(Number(e.target.value))}
        aria-label={t('player.volume')}
        style={{ '--value': p.muted ? 0 : p.volume }}
      />
    </div>
  )
}

function SpeedMenu({ p }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="speed" ref={ref}>
      <button type="button" className="player-btn speed-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} title={t('player.vitesse')}>
        <Gauge size={18} aria-hidden="true" />
        <span>{p.rate === 1 ? '1×' : `${p.rate}×`}</span>
      </button>
      {open && (
        <div className="speed-menu" role="menu" aria-label={t('player.vitesse')}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={p.rate === s}
              className={p.rate === s ? 'active' : ''}
              onClick={() => {
                p.setRate(s)
                setOpen(false)
              }}
            >
              {s === 1 ? t('player.normale') : `${s}×`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PlayerError({ kind, media }) {
  return (
    <div className="player-error" role="alert">
      <AlertTriangle size={26} aria-hidden="true" />
      <strong>{kind === 'format' ? t('player.formatNonPrisEnCharge') : t('player.mediaIndisponible')}</strong>
      <span>{kind === 'format' ? t('player.formatAide') : t('player.indisponibleAide')}</span>
      {kind === 'format' && (
        <a className="button secondary" href={media.url} target="_blank" rel="noreferrer">
          <ExternalLink size={15} className="icon" aria-hidden="true" />
          {t('player.ouvrirLeFichier')}
        </a>
      )}
    </div>
  )
}

function useFullscreen(ref) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [ref])
  const toggle = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else ref.current?.requestFullscreen?.().catch(() => {})
  }, [ref])
  return [active, toggle, Boolean(typeof document !== 'undefined' && document.fullscreenEnabled)]
}

// ----- Vidéo ---------------------------------------------------------------

export function VideoPlayer({ media, autoPlay = false, onEnded, transcriptOpen, onToggleTranscript }) {
  const videoRef = useRef(null)
  const shellRef = useRef(null)
  const p = useMediaElement(videoRef)
  const [fullscreen, toggleFullscreen, canFullscreen] = useFullscreen(shellRef)
  const [idle, setIdle] = useState(false)
  const [flash, setFlash] = useState(null)
  const idleTimer = useRef(null)
  const canPip = typeof document !== 'undefined' && document.pictureInPictureEnabled

  const wake = useCallback(() => {
    setIdle(false)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), 2600)
  }, [])
  useEffect(() => () => clearTimeout(idleTimer.current), [])
  useEffect(() => {
    if (autoPlay) videoRef.current?.play().catch(() => {})
  }, [autoPlay])
  useEffect(() => {
    if (p.ended) onEnded?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ended])

  const toggleWithFlash = () => {
    setFlash(p.playing ? 'pause' : 'play')
    p.toggle()
  }
  const pip = () => {
    const el = videoRef.current
    if (document.pictureInPictureElement) document.exitPictureInPicture()
    else el?.requestPictureInPicture?.().catch(() => {})
  }
  const error = p.error
  const showControls = !p.playing || !idle

  return (
    <div
      ref={shellRef}
      className={`vplayer ${showControls ? 'controls-on' : 'controls-off'} ${p.started ? 'started' : ''} ${fullscreen ? 'is-fullscreen' : ''}`}
      tabIndex={0}
      aria-label={t('player.lecteurVideo', { title: media.title })}
      onKeyDown={playerKeys(p, { f: toggleFullscreen, c: () => onToggleTranscript?.() })}
      onPointerMove={wake}
      onPointerLeave={() => p.playing && setIdle(true)}
    >
      {error ? (
        <PlayerError kind={error} media={media} />
      ) : (
        <>
          <video
            ref={videoRef}
            src={`${media.url}#t=0.1`}
            poster={media.posterUrl ?? undefined}
            preload="metadata"
            playsInline
            controlsList={media.downloadable ? undefined : 'nodownload'}
            onContextMenu={media.downloadable ? undefined : (e) => e.preventDefault()}
            onClick={toggleWithFlash}
            onDoubleClick={toggleFullscreen}
            aria-label={media.title}
          />
          {!p.started && (
            <button type="button" className="vplayer-poster" onClick={p.toggle} aria-label={t('player.lire')}>
              <span className="big-play">
                <Play size={34} fill="currentColor" aria-hidden="true" />
              </span>
              {p.duration > 0 && <span className="duration-badge">{formatTime(p.duration)}</span>}
            </button>
          )}
          {p.waiting && p.started && (
            <span className="player-spinner" aria-hidden="true">
              <Loader2 size={40} />
            </span>
          )}
          {flash && (
            <span key={`${flash}-${p.current}`} className="player-flash" aria-hidden="true" onAnimationEnd={() => setFlash(null)}>
              {flash === 'play' ? <Play size={30} fill="currentColor" /> : <Pause size={30} fill="currentColor" />}
            </span>
          )}
          <div className="vplayer-bar">
            <Seekbar current={p.current} duration={p.duration} buffered={p.buffered} onSeek={p.seek} />
            <div className="vplayer-controls">
              <button type="button" className="player-btn" onClick={p.toggle} aria-label={p.playing ? t('player.pause') : t('player.lire')} title={`${p.playing ? t('player.pause') : t('player.lire')} (k)`}>
                {p.playing ? <Pause size={20} fill="currentColor" aria-hidden="true" /> : <Play size={20} fill="currentColor" aria-hidden="true" />}
              </button>
              <button type="button" className="player-btn hide-xs" onClick={() => p.skip(-10)} aria-label={t('player.reculer10')} title={`${t('player.reculer10')} (j)`}>
                <RotateCcw size={18} aria-hidden="true" />
              </button>
              <button type="button" className="player-btn hide-xs" onClick={() => p.skip(10)} aria-label={t('player.avancer10')} title={`${t('player.avancer10')} (l)`}>
                <RotateCw size={18} aria-hidden="true" />
              </button>
              <VolumeControl p={p} />
              <span className="player-time">
                {formatTime(p.current)} <span aria-hidden="true">/</span> {formatTime(p.duration)}
              </span>
              <span className="player-spacer" />
              {onToggleTranscript && (
                <button
                  type="button"
                  className={`player-btn ${transcriptOpen ? 'on' : ''}`}
                  onClick={onToggleTranscript}
                  aria-pressed={Boolean(transcriptOpen)}
                  aria-label={t('player.transcription')}
                  title={`${t('player.transcription')} (c)`}
                >
                  <Captions size={20} aria-hidden="true" />
                </button>
              )}
              <SpeedMenu p={p} />
              {canPip && (
                <button type="button" className="player-btn hide-xs" onClick={pip} aria-label={t('player.incrustation')} title={t('player.incrustation')}>
                  <PictureInPicture2 size={18} aria-hidden="true" />
                </button>
              )}
              {canFullscreen && (
                <button type="button" className="player-btn" onClick={toggleFullscreen} aria-label={fullscreen ? t('player.quitterPleinEcran') : t('player.pleinEcran')} title={`${fullscreen ? t('player.quitterPleinEcran') : t('player.pleinEcran')} (f)`}>
                  {fullscreen ? <Minimize size={19} aria-hidden="true" /> : <Maximize size={19} aria-hidden="true" />}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ----- Audio ---------------------------------------------------------------

const MAX_WAVEFORM_BYTES = 30 * 1024 * 1024

// Forme d'onde réelle, calculée dans le navigateur à partir du fichier.
// Les très gros fichiers sont ignorés (barre de progression simple).
function useWaveform(url, enabled, bars) {
  const [peaks, setPeaks] = useState(null)
  useEffect(() => {
    if (!enabled || !url || typeof window === 'undefined') return undefined
    const Ctx = window.AudioContext ?? window.webkitAudioContext
    if (!Ctx) return undefined
    const controller = new AbortController()
    let ctx
    ;(async () => {
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok || Number(res.headers.get('content-length') ?? 0) > MAX_WAVEFORM_BYTES) return
        const buffer = await res.arrayBuffer()
        ctx = new Ctx()
        const audio = await ctx.decodeAudioData(buffer)
        const data = audio.getChannelData(0)
        const block = Math.floor(data.length / bars) || 1
        const out = []
        for (let i = 0; i < bars; i += 1) {
          let sum = 0
          for (let j = 0; j < block; j += 1) sum += Math.abs(data[i * block + j] ?? 0)
          out.push(sum / block)
        }
        const max = Math.max(...out) || 1
        if (!controller.signal.aborted) setPeaks(out.map((v) => Math.max(0.06, v / max)))
      } catch {
        // forme d'onde facultative : on garde la barre simple
      } finally {
        ctx?.close?.()
      }
    })()
    return () => controller.abort()
  }, [url, enabled, bars])
  return peaks
}

export function AudioPlayer({ media, autoPlay = false, onEnded, waveform = false, subtitle, compact = false }) {
  const audioRef = useRef(null)
  const p = useMediaElement(audioRef)
  const bars = compact ? 56 : 110
  // Sur une carte, la forme d'onde n'est calculée qu'après le début de la
  // lecture (le fichier est alors déjà en cours de chargement).
  const peaks = useWaveform(media.url, waveform || p.started, bars)
  // Format illisible (erreur 4) ou fichier inaccessible : message adapté.
  const error = p.error

  useEffect(() => {
    if (autoPlay) audioRef.current?.play().catch(() => {})
  }, [autoPlay])
  useEffect(() => {
    if (p.ended) onEnded?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.ended])

  return (
    <div className={`aplayer ${compact ? 'compact' : ''} ${p.playing ? 'is-playing' : ''}`} tabIndex={0} aria-label={t('player.lecteurAudio', { title: media.title })} onKeyDown={playerKeys(p)}>
      <audio
        ref={audioRef}
        src={media.url}
        preload="metadata"
        controlsList={media.downloadable ? undefined : 'nodownload'}
        onContextMenu={media.downloadable ? undefined : (e) => e.preventDefault()}
      />
      <div className="aplayer-art" aria-hidden="true">
        <Headphones size={compact ? 22 : 34} />
        <span className="eq">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="aplayer-body">
        <div className="aplayer-head">
          <div className="aplayer-titles">
            <strong>{media.caption ?? media.title}</strong>
            {subtitle && <span>{subtitle}</span>}
          </div>
          {!error && (
            <button type="button" className="aplayer-play" onClick={p.toggle} aria-label={p.playing ? t('player.pause') : t('player.lire')}>
              {p.waiting && p.playing ? <Loader2 size={22} className="spin" aria-hidden="true" /> : p.playing ? <Pause size={22} fill="currentColor" aria-hidden="true" /> : <Play size={22} fill="currentColor" aria-hidden="true" />}
            </button>
          )}
        </div>
        {error ? (
          <PlayerError kind={error} media={media} />
        ) : (
          <>
            <Seekbar current={p.current} duration={p.duration} buffered={p.buffered} onSeek={p.seek} className={peaks ? 'has-wave' : ''}>
              {peaks ? (
                <div className="wave" aria-hidden="true">
                  {peaks.map((v, i) => (
                    <span key={i} className={i / peaks.length < (p.duration ? p.current / p.duration : 0) ? 'played' : ''} style={{ height: `${v * 100}%` }} />
                  ))}
                </div>
              ) : undefined}
            </Seekbar>
            <div className="aplayer-controls">
              <span className="player-time">
                {formatTime(p.current)} <span aria-hidden="true">/</span> {formatTime(p.duration)}
              </span>
              <span className="player-spacer" />
              {!compact && (
                <>
                  <button type="button" className="player-btn" onClick={() => p.skip(-10)} aria-label={t('player.reculer10')} title={t('player.reculer10')}>
                    <RotateCcw size={17} aria-hidden="true" />
                  </button>
                  <button type="button" className="player-btn" onClick={() => p.skip(10)} aria-label={t('player.avancer10')} title={t('player.avancer10')}>
                    <RotateCw size={17} aria-hidden="true" />
                  </button>
                </>
              )}
              <VolumeControl p={p} />
              <SpeedMenu p={p} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ----- Images --------------------------------------------------------------

const MIN_ZOOM = 1
const MAX_ZOOM = 5

export function ImageViewer({ media, onPrev, onNext }) {
  const shellRef = useRef(null)
  const stageRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [status, setStatus] = useState('loading')
  const dragRef = useRef(null)
  const [fullscreen, toggleFullscreen, canFullscreen] = useFullscreen(shellRef)

  const applyZoom = useCallback((next) => {
    const z = Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM)
    setZoom(z)
    if (z === 1) setOffset({ x: 0, y: 0 })
  }, [])
  // Molette : zoom (écouteur non passif pour empêcher le défilement).
  useEffect(() => {
    const el = stageRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      setZoom((z) => {
        const next = Math.min(Math.max(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN_ZOOM), MAX_ZOOM)
        if (next === 1) setOffset({ x: 0, y: 0 })
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e) => {
    if (zoom === 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
  }
  const onPointerMove = (e) => {
    if (!dragRef.current) return
    setOffset({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y })
  }
  const onPointerUp = () => {
    dragRef.current = null
  }
  const onKeyDown = (e) => {
    const map = {
      '+': () => applyZoom(zoom * 1.25),
      '=': () => applyZoom(zoom * 1.25),
      '-': () => applyZoom(zoom / 1.25),
      0: () => applyZoom(1),
      f: toggleFullscreen,
      ArrowLeft: () => (zoom === 1 ? onPrev?.() : setOffset((o) => ({ ...o, x: o.x + 40 }))),
      ArrowRight: () => (zoom === 1 ? onNext?.() : setOffset((o) => ({ ...o, x: o.x - 40 }))),
    }
    if (map[e.key]) {
      e.preventDefault()
      map[e.key]()
    }
  }

  return (
    <div ref={shellRef} className={`iviewer ${fullscreen ? 'is-fullscreen' : ''}`} tabIndex={0} aria-label={t('player.visionneuse', { title: media.title })} onKeyDown={onKeyDown}>
      <div
        ref={stageRef}
        className={`iviewer-stage ${zoom > 1 ? 'zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => applyZoom(zoom > 1 ? 1 : 2.5)}
      >
        {status === 'loading' && (
          <span className="player-spinner" aria-hidden="true">
            <Loader2 size={36} />
          </span>
        )}
        {status === 'error' ? (
          <PlayerError kind="network" media={media} />
        ) : (
          <img
            src={media.url}
            alt={media.caption ?? media.title}
            draggable={false}
            onLoad={() => setStatus('ready')}
            onError={() => setStatus('error')}
            onContextMenu={media.downloadable ? undefined : (e) => e.preventDefault()}
            className={status === 'ready' ? 'ready' : ''}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          />
        )}
        {onPrev && (
          <button type="button" className="iviewer-nav prev" onClick={onPrev} aria-label={t('player.precedent')}>
            <ChevronLeft size={26} aria-hidden="true" />
          </button>
        )}
        {onNext && (
          <button type="button" className="iviewer-nav next" onClick={onNext} aria-label={t('player.suivant')}>
            <ChevronRight size={26} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="iviewer-toolbar">
        <button type="button" className="player-btn" onClick={() => applyZoom(zoom / 1.25)} disabled={zoom <= MIN_ZOOM} aria-label={t('player.dezoomer')} title={t('player.dezoomer')}>
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <button type="button" className="zoom-level" onClick={() => applyZoom(1)} title={t('player.reinitialiserZoom')}>
          {Math.round(zoom * 100)} %
        </button>
        <button type="button" className="player-btn" onClick={() => applyZoom(zoom * 1.25)} disabled={zoom >= MAX_ZOOM} aria-label={t('player.zoomer')} title={t('player.zoomer')}>
          <ZoomIn size={18} aria-hidden="true" />
        </button>
        <span className="player-spacer" />
        <span className="iviewer-hint hide-xs">{t('player.aideZoom')}</span>
        {canFullscreen && (
          <button type="button" className="player-btn" onClick={toggleFullscreen} aria-label={fullscreen ? t('player.quitterPleinEcran') : t('player.pleinEcran')} title={fullscreen ? t('player.quitterPleinEcran') : t('player.pleinEcran')}>
            {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  )
}

// ----- Documents -----------------------------------------------------------

const INLINE_DOCS = ['application/pdf', 'text/plain']

export function DocumentPreview({ media }) {
  const shellRef = useRef(null)
  const [fullscreen, toggleFullscreen, canFullscreen] = useFullscreen(shellRef)
  if (media.mimeType?.startsWith('image/')) return <ImageViewer media={media} />
  const inline = INLINE_DOCS.includes(media.mimeType)
  return (
    <div ref={shellRef} className={`dviewer ${fullscreen ? 'is-fullscreen' : ''}`}>
      <div className="dviewer-toolbar">
        <FileText size={17} aria-hidden="true" />
        <strong>{media.title}</strong>
        <span className="badge">{formatLabel(media.mimeType)}</span>
        <span className="player-spacer" />
        <a className="player-btn" href={media.url} target="_blank" rel="noreferrer" aria-label={t('player.ouvrirDansUnOnglet')} title={t('player.ouvrirDansUnOnglet')}>
          <ExternalLink size={17} aria-hidden="true" />
        </a>
        {media.downloadUrl && (
          <a className="player-btn" href={media.downloadUrl} aria-label={t('player.telecharger')} title={t('player.telecharger')}>
            <Download size={17} aria-hidden="true" />
          </a>
        )}
        {inline && canFullscreen && (
          <button type="button" className="player-btn" onClick={toggleFullscreen} aria-label={fullscreen ? t('player.quitterPleinEcran') : t('player.pleinEcran')}>
            {fullscreen ? <Minimize size={17} aria-hidden="true" /> : <Maximize size={17} aria-hidden="true" />}
          </button>
        )}
      </div>
      {inline ? (
        <iframe className="dviewer-frame" src={media.url} title={media.title} />
      ) : (
        <div className="dviewer-empty">
          <FileText size={40} aria-hidden="true" />
          <strong>{t('player.apercuIndisponible', { format: formatLabel(media.mimeType) || '?' })}</strong>
          <span>{t('player.apercuIndisponibleAide')}</span>
          <a className="button secondary" href={media.url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} className="icon" aria-hidden="true" />
            {t('player.ouvrirLeFichier')}
          </a>
        </div>
      )}
    </div>
  )
}
