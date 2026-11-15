import { Backpack, BookOpen, Check, Hand, Map as MapIcon, Pause, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { currentStep, stepCount, stepDone } from '../core/missions.js'
import { badgeInfo, levelFor, TROPHIES } from '../core/rewards.js'
import { g } from '../i18n.js'
import { drawMap } from './mapCanvas.js'

// Affichage tête haute : profil et niveau, mission en cours, mini-carte,
// invite d'interaction, notifications.

export function PlayerBadge({ progress }) {
  const lv = levelFor(progress.xp)
  return (
    <div className="hud-card hud-player">
      <span className="hud-avatar" style={{ background: progress.profile.color }} aria-hidden="true">
        {(progress.profile.name || 'G').slice(0, 1).toUpperCase()}
      </span>
      <div className="hud-player-info">
        <strong>{progress.profile.name || g('gardien')}</strong>
        <small>{g('niveauTitre', { n: lv.level, title: lv.title })}</small>
        <div className="hud-xp" role="progressbar" aria-valuemin={0} aria-valuemax={lv.need} aria-valuenow={lv.into} aria-label={g('experience')}>
          <span style={{ width: `${(lv.into / lv.need) * 100}%` }} />
        </div>
        <small className="hud-xp-label">{lv.into} / {lv.need} XP</small>
      </div>
    </div>
  )
}

export function MissionTracker({ mission, progress, onOpen }) {
  if (!mission) {
    return (
      <button type="button" className="hud-card hud-mission is-empty" onClick={onOpen}>
        <BookOpen size={16} aria-hidden="true" /> {g('choisirMission')}
      </button>
    )
  }
  const step = currentStep(mission, progress)
  return (
    <button type="button" className="hud-card hud-mission" onClick={onOpen} aria-label={g('ouvrirJournal')}>
      <span className="hud-eyebrow">{g('missionEnCours')}</span>
      <strong>{mission.title}</strong>
      <ol className="hud-steps">
        {mission.steps.map((s) => {
          const done = stepDone(s, progress, mission)
          const current = s === step
          return (
            <li key={s.id} className={done ? 'is-done' : current ? 'is-current' : ''}>
              <span className="hud-step-mark" aria-hidden="true">{done ? <Check size={11} /> : null}</span>
              <span>
                {s.label}
                {s.type !== 'quiz' && s.count > 1 && !done && <em> {stepCount(s, progress, mission)}/{s.count}</em>}
              </span>
            </li>
          )
        })}
      </ol>
    </button>
  )
}

export function Minimap({ runtime, targets, discovered, onOpen }) {
  const canvas = useRef()
  const state = useRef({ targets, discovered })
  useEffect(() => {
    state.current = { targets, discovered }
  }, [targets, discovered])
  useEffect(() => {
    const ctx = canvas.current.getContext('2d')
    const size = canvas.current.width
    let frame = 0
    let last = 0
    const draw = (time) => {
      frame = requestAnimationFrame(draw)
      if (time - last < 120) return
      last = time
      const p = runtime.player.pos
      drawMap(ctx, size, { runtime, ...state.current, view: { cx: p.x, cz: p.z, radius: 42 } })
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [runtime])
  return (
    <button type="button" className="hud-minimap" onClick={onOpen} aria-label={g('ouvrirCarte')}>
      <canvas ref={canvas} width={176} height={176} />
      <span className="hud-minimap-north" aria-hidden="true">N</span>
    </button>
  )
}

export function HudButtons({ onMap, onJournal, onInventory, onPause, sound, onSound }) {
  const items = [
    [MapIcon, g('carte'), 'M', onMap],
    [BookOpen, g('journal'), 'J', onJournal],
    [Backpack, g('inventaire'), 'I', onInventory],
  ]
  return (
    <div className="hud-buttons">
      {items.map(([Icon, label, key, action]) => (
        <button key={label} type="button" className="hud-icon-button" onClick={action} title={`${label} (${key})`} aria-label={label}>
          <Icon size={18} aria-hidden="true" />
          <kbd aria-hidden="true">{key}</kbd>
        </button>
      ))}
      <button type="button" className="hud-icon-button" onClick={onSound} aria-label={sound ? g('couperSon') : g('activerSon')} aria-pressed={!sound}>
        {sound ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
      </button>
      <button type="button" className="hud-icon-button" onClick={onPause} aria-label={g('pause')} title={`${g('pause')} (Échap)`}>
        <Pause size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

const VERB = { plant: 'identifier', animal: 'observer', npc: 'parler', station: 'consulter', panorama: 'regarder' }

export function InteractPrompt({ target, discovered, onInteract }) {
  if (!target) return null
  const known = discovered[target.id]
  if (target.kind === 'trace') {
    const verb = target.traceKind === 'plant' ? 'identifier' : 'observer'
    return (
      <button type="button" className="hud-prompt" onClick={onInteract}>
        <kbd>E</kbd>
        <Hand size={16} aria-hidden="true" />
        <span>
          {g(`verbe.${verb}`)} <strong>{known ? target.name : g('pf.traceInconnue')}</strong>
        </span>
      </button>
    )
  }
  return (
    <button type="button" className="hud-prompt" onClick={onInteract}>
      <kbd>E</kbd>
      <Hand size={16} aria-hidden="true" />
      <span>
        {g(`verbe.${VERB[target.kind]}`)} <strong>{target.kind === 'plant' && !known ? g('plantInconnue') : target.name}</strong>
      </span>
    </button>
  )
}

export function ZoneBanner({ zone }) {
  if (!zone) return null
  return (
    <div className="hud-zone" key={zone.id} role="status">
      <span>{zone.name}</span>
      <small>{zone.hint}</small>
    </div>
  )
}

export function Notices({ notices }) {
  return (
    <div className="hud-notices" aria-live="polite">
      {notices.map((n) => (
        <div key={n.key} className={`hud-notice is-${n.type}`}>
          {n.type === 'xp' && (
            <>
              <strong>+{n.amount} XP</strong> <span>{n.label}</span>
            </>
          )}
          {n.type === 'trophy' && (
            <>
              <strong>{g('trophee')}</strong> <span>{TROPHIES.find((t) => t.id === n.id)?.name}</span>
            </>
          )}
          {n.type === 'level' && (
            <>
              <strong>{g('niveauAtteint', { n: n.level })}</strong> <span>{g('bravo')}</span>
            </>
          )}
          {n.type === 'badge' && (
            <>
              <strong>{g('badge')}</strong> <span>{badgeInfo(n.id).name}</span>
            </>
          )}
          {n.type === 'info' && <span>{n.text}</span>}
        </div>
      ))}
    </div>
  )
}
