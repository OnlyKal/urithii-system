import { Award, Backpack, BookOpen, BookOpenText, Check, Gauge, Home, Keyboard, Leaf, Lock, Map as MapIcon, Mountain, Music, PawPrint, Play, ScrollText, Users, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { contentName } from '../core/content.js'
import { missionProgress, missionStatus } from '../core/missions.js'
import { BADGES, TROPHIES } from '../core/rewards.js'
import { HD_CREDITS } from '../hd/credits.js'
import { QUALITY } from '../engine/quality.js'
import { g } from '../i18n.js'
import { GameWindow } from './Dialogs.jsx'
import { drawMap } from './mapCanvas.js'

const MODE_LABEL = { exploration: 'Exploration', patrimoine: 'Patrimoine culturel', nature: 'Nature et biodiversité', histoire: 'Histoire et mémoire', defis: 'Défis' }

export function Journal({ missions, progress, error, onStart, onClose }) {
  return (
    <GameWindow title={g('journalMissions')} eyebrow={g('journal')} icon={BookOpen} onClose={onClose} wide>
      {error && <p className="game-feedback is-wrong">{g('missionsIndisponibles')}</p>}
      <ul className="journal-list">
        {missions.map((m) => {
          const status = missionStatus(m, progress)
          const { done, total, ratio } = missionProgress(m, progress)
          const active = progress.activeMission === m.slug
          return (
            <li key={m.slug} className={`journal-item is-${status} ${active ? 'is-active' : ''}`}>
              <div className="journal-head">
                <span className="game-tag">{MODE_LABEL[m.mode] ?? m.mode}</span>
                {status === 'done' && (
                  <span className="game-tag is-mint">
                    <Check size={12} aria-hidden="true" /> {g('terminee')}
                  </span>
                )}
                {active && <span className="game-tag is-orange">{g('enCours')}</span>}
              </div>
              <h3>{m.title}</h3>
              <p>{m.description}</p>
              <p className="journal-objective">
                <strong>{g('objectif')} :</strong> {m.objective}
              </p>
              <div className="journal-foot">
                <div className="game-progress" aria-label={g('etapes', { done, total })}>
                  <span style={{ width: `${ratio * 100}%` }} />
                </div>
                <small>
                  {g('etapes', { done, total })} · {m.rewardXp} XP
                </small>
                {status !== 'done' && !active && (
                  <button type="button" className="game-button small" onClick={() => onStart(m)}>
                    <Play size={14} aria-hidden="true" /> {status === 'active' ? g('reprendre') : g('accepter')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </GameWindow>
  )
}

export function Inventory({ progress, onOpenCard, onOpenItem, onOpenCommunity, onClose }) {
  const groups = [
    ['plante', g('plantesIdentifiees'), Leaf],
    ['animal', g('animauxObserves'), PawPrint],
    ['paysage', g('pf.paysagesDecouverts'), Mountain],
    ['savoir', g('savoirsConsultes'), ScrollText],
    ['fiche', g('pf.fichesLues'), BookOpenText],
    ['communaute', g('pf.communautesRencontrees'), Users],
  ]
  const openers = { plante: onOpenCard, animal: onOpenCard, paysage: onOpenCard, fiche: onOpenItem, communaute: onOpenCommunity }
  return (
    <GameWindow title={g('carnet')} eyebrow={g('inventaire')} icon={Backpack} onClose={onClose} wide>
      <div className="inventory-grid">
        {groups.map(([kind, label, Icon]) => {
          const items = progress.inventory.filter((i) => i.kind === kind)
          return (
            <section key={kind} className="inventory-group">
              <h3>
                <Icon size={16} aria-hidden="true" /> {label} <small>{items.length}</small>
              </h3>
              {items.length === 0 && <p className="game-muted">{g('rienEncore')}</p>}
              <ul>
                {items.map((i) => (
                  <li key={i.id}>
                    {!openers[kind] ? (
                      <span className="inventory-item">{i.name}</span>
                    ) : (
                      <button type="button" className="inventory-item" onClick={() => openers[kind](i.id)}>
                        {['fiche', 'communaute'].includes(kind) ? i.name : contentName(i.id)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <h3 className="inventory-title">
        <Award size={16} aria-hidden="true" /> {g('badgesEtTrophees')}
      </h3>
      <div className="badge-row">
        {BADGES.map((b) => {
          const Icon = b.icon
          const owned = progress.badges[b.id]
          return (
            <div key={b.id} className={`badge-chip ${owned ? 'is-owned' : ''}`} style={{ '--badge': b.color }} title={b.hint}>
              <span className="badge-medal small">{owned ? <Icon size={18} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}</span>
              <small>{b.name}</small>
            </div>
          )
        })}
        {TROPHIES.map((t) => {
          const Icon = t.icon
          const owned = progress.trophies[t.id]
          return (
            <div key={t.id} className={`badge-chip is-trophy ${owned ? 'is-owned' : ''}`} title={t.hint}>
              <span className="badge-medal small">{owned ? <Icon size={18} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}</span>
              <small>{t.name}</small>
            </div>
          )
        })}
      </div>
    </GameWindow>
  )
}

export function MapPanel({ runtime, targets, discovered, onClose }) {
  const canvas = useRef()
  useEffect(() => {
    const ctx = canvas.current.getContext('2d')
    let frame = 0
    const draw = () => {
      drawMap(ctx, canvas.current.width, { runtime, targets, discovered, labels: true })
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [runtime, targets, discovered])
  return (
    <GameWindow title={g('carteExploration')} eyebrow="Lisière de l’Ituri" icon={MapIcon} onClose={onClose} wide>
      <div className="map-panel">
        <canvas ref={canvas} width={560} height={560} aria-label={g('carteExploration')} />
        <ul className="map-legend">
          <li><span className="legend-dot is-target" /> {g('legendeCible')}</li>
          <li><span className="legend-dot is-npc" /> {g('legendePersonnage')}</li>
          <li><span className="legend-dot is-station" /> {g('legendeEspace')}</li>
          <li><span className="legend-dot is-plant" /> {g('legendePlante')}</li>
          <li><span className="legend-dot is-animal" /> {g('legendeAnimal')}</li>
          <li><span className="legend-arrow" /> {g('legendeVous')}</li>
        </ul>
      </div>
    </GameWindow>
  )
}

export function PauseMenu({ settings, quality, onSettings, onResume, onClose }) {
  const [tab, setTab] = useState('menu')
  return (
    <GameWindow title={g('pause')} icon={Gauge} onClose={onClose}>
      {tab === 'menu' && (
        <div className="pause-menu">
          <button type="button" className="game-button" onClick={onResume} autoFocus>
            <Play size={16} aria-hidden="true" /> {g('reprendrePartie')}
          </button>
          <button type="button" className="game-button ghost" onClick={() => setTab('controls')}>
            <Keyboard size={16} aria-hidden="true" /> {g('commandes')}
          </button>
          <div className="pause-settings">
            <label className="pause-toggle">
              <Volume2 size={16} aria-hidden="true" /> {g('ambianceSonore')}
              <input type="checkbox" checked={settings.sound} onChange={(e) => onSettings({ sound: e.target.checked })} />
            </label>
            <label className="pause-toggle">
              <Music size={16} aria-hidden="true" /> {g('musique')}
              <input type="checkbox" checked={settings.music} onChange={(e) => onSettings({ music: e.target.checked })} />
            </label>
            <label className="pause-select">
              <Gauge size={16} aria-hidden="true" /> {g('qualite')}
              <select value={settings.quality} onChange={(e) => onSettings({ quality: e.target.value })}>
                <option value="auto">{g('qualiteAuto', { label: QUALITY[quality].label })}</option>
                {Object.entries(QUALITY).map(([id, q]) => (
                  <option key={id} value={id}>
                    {q.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="game-muted small">{g('sauvegardeAuto')}</p>
          </div>
          <button type="button" className="game-button ghost" onClick={() => setTab('credits')}>
            {g('creditsModeles')}
          </button>
          <Link to="/jeux" className="game-button ghost">
            <Home size={16} aria-hidden="true" /> {g('quitter')}
          </Link>
        </div>
      )}
      {tab === 'controls' && <Controls onBack={() => setTab('menu')} />}
      {tab === 'credits' && (
        <div className="pause-credits">
          {HD_CREDITS.map((c) => (
            <section key={c.group}>
              <h3>{c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.group}</a> : c.group}</h3>
              <ul>
                {c.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </section>
          ))}
          <button type="button" className="game-button ghost" onClick={() => setTab('menu')}>
            {g('retour')}
          </button>
        </div>
      )}
    </GameWindow>
  )
}

export function Controls({ onBack }) {
  const rows = [
    ['Z Q S D / W A S D / ↑ ↓', g('cmdDeplacer')],
    ['← →', g('cmdTourner')],
    ['Maj', g('cmdCourir')],
    [g('espace'), g('cmdSauter')],
    ['E', g('cmdInteragir')],
    [g('glisser'), g('cmdCamera')],
    [g('molette'), g('cmdZoom')],
    ['M · J · I', g('cmdPanneaux')],
    ['Échap', g('pause')],
  ]
  return (
    <div className="controls-help">
      <dl>
        {rows.map(([k, v]) => (
          <div key={v}>
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="game-muted small">{g('cmdTactile')}</p>
      {onBack && (
        <button type="button" className="game-button ghost" onClick={onBack}>
          {g('retour')}
        </button>
      )}
    </div>
  )
}

