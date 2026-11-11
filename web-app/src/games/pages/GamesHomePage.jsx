import { ArrowRight, BookOpenText, Check, Clock, Compass, Footprints, Gamepad2, Landmark, Leaf, Lock, PawPrint, Play, RotateCcw, ScrollText, Sparkles, Target, Timer, Trophy } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { contentName } from '../core/content.js'
import { fetchMissions } from '../core/gameApi.js'
import { missionProgress, missionStatus, MODES } from '../core/missions.js'
import { hasSave, newGame, resetProgress, useProgress } from '../core/progress.js'
import { BADGES, levelFor, TROPHIES } from '../core/rewards.js'
import { g } from '../i18n.js'
import '../games.css'

// Accueil du module Jeux : présentation, modes, missions, badges et
// progression du joueur.
const HeroScene = lazy(() => import('../engine/HeroScene.jsx'))

const MODE_ICONS = { exploration: Compass, patrimoine: ScrollText, nature: Leaf, histoire: Landmark, defis: Timer }
const COLORS = ['#29cb94', '#ffb547', '#3f5ca6', '#c2552b', '#7b5ea7', '#2f6c4b']

const duration = (s) => {
  const m = Math.round(s / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

function NewGameDialog({ onClose, existing }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  return (
    <div className="games-dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="games-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-game-title"
        onSubmit={(e) => {
          e.preventDefault()
          newGame({ name: name.trim().slice(0, 30), color })
          navigate('/jeux/gardiens')
        }}
      >
        <h2 id="new-game-title">{g('nouvellePartie')}</h2>
        <label className="games-field">
          {g('nomGardien')}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder={g('nomExemple')} autoFocus />
        </label>
        <fieldset className="games-colors">
          <legend>{g('couleur')}</legend>
          {COLORS.map((c) => (
            <label key={c} style={{ '--c': c }}>
              <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} />
              <span aria-hidden="true" />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </fieldset>
        {existing && <p className="games-warning">{g('ecraserSauvegarde')}</p>}
        <p className="games-small">{g('sauvegardeLocale')}</p>
        <div className="games-dialog-actions">
          <button type="button" className="button ghost" onClick={onClose}>
            {g('annuler')}
          </button>
          <button type="submit" className="button">
            <Play size={16} aria-hidden="true" /> {g('commencerAventure')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function GamesHomePage() {
  const progress = useProgress()
  const [missions, setMissions] = useState(null)
  const [error, setError] = useState(false)
  const [dialog, setDialog] = useState(false)
  const saved = hasSave()
  const lv = levelFor(progress.xp)
  useEffect(() => {
    fetchMissions()
      .then(setMissions)
      .catch(() => setError(true))
  }, [])
  const done = Object.values(progress.missions).filter((m) => m.status === 'done').length
  const discoveries = Object.keys(progress.discoveries).length
  const accuracy = progress.stats.quizAnswered ? Math.round((progress.stats.quizCorrect / progress.stats.quizAnswered) * 100) : null

  return (
    <div className="games-home">
      <section className="games-hero">
        <div className="games-hero-scene" aria-hidden="true">
          <Suspense fallback={null}>
            <HeroScene />
          </Suspense>
        </div>
        <div className="games-hero-text">
          <span className="games-eyebrow">
            <Gamepad2 size={16} aria-hidden="true" /> {g('jeuxUrithi')}
          </span>
          <h1>
            URITHI <span>–</span> <em>Les Gardiens de l’Héritage</em>
          </h1>
          <p className="games-pitch">{g('pitch')}</p>
          <div className="games-hero-actions">
            {saved && (
              <Link to="/jeux/gardiens" className="button games-cta">
                <Play size={18} aria-hidden="true" /> {g('continuerPartie')}
              </Link>
            )}
            <button type="button" className={`button ${saved ? 'ghost games-ghost' : 'games-cta'}`} onClick={() => setDialog(true)}>
              <Compass size={18} aria-hidden="true" /> {g('commencerAventure')}
            </button>
          </div>
          {saved && (
            <p className="games-hero-save">
              <span className="games-avatar" style={{ background: progress.profile.color }} aria-hidden="true">
                {(progress.profile.name || 'G').slice(0, 1).toUpperCase()}
              </span>
              {g('sauvegardeResume', { name: progress.profile.name || g('gardien'), level: lv.level, title: lv.title })}
            </p>
          )}
        </div>
      </section>

      <section className="games-section">
        <header className="games-section-head">
          <h2>{g('modesDeJeu')}</h2>
          <p>{g('modesIntro')}</p>
        </header>
        <div className="games-modes">
          {MODES.map((mode) => {
            const Icon = MODE_ICONS[mode.id]
            const to = mode.id === 'defis' ? '/jeux/defi' : saved ? '/jeux/gardiens' : null
            const content = (
              <>
                <span className="games-mode-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <strong>{mode.name}</strong>
                <p>{mode.hint}</p>
                <span className={`games-mode-status ${mode.available ? '' : 'is-soon'}`}>
                  {mode.available ? (
                    <>
                      {g('jouer')} <ArrowRight size={14} aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <Lock size={13} aria-hidden="true" /> {g('enPreparation')}
                    </>
                  )}
                </span>
              </>
            )
            if (!mode.available) return <div key={mode.id} className="games-mode is-locked">{content}</div>
            return to ? (
              <Link key={mode.id} to={to} className="games-mode">
                {content}
              </Link>
            ) : (
              <button key={mode.id} type="button" className="games-mode" onClick={() => setDialog(true)}>
                {content}
              </button>
            )
          })}
        </div>
      </section>

      <section className="games-section">
        <header className="games-section-head">
          <h2>{g('missionsDisponibles')}</h2>
          <p>{g('missionsIntro')}</p>
        </header>
        {error && <p className="games-warning">{g('missionsIndisponibles')}</p>}
        {!missions && !error && <p className="games-small">{g('chargement')}…</p>}
        {missions && (
          <div className="games-missions">
            {missions.map((m) => {
              const status = missionStatus(m, progress)
              const { done: stepsDone, total, ratio } = missionProgress(m, progress)
              const Icon = MODE_ICONS[m.mode] ?? Compass
              return (
                <article key={m.slug} className={`games-mission is-${status}`}>
                  <div className="games-mission-head">
                    <Icon size={18} aria-hidden="true" />
                    <span>{MODES.find((x) => x.id === m.mode)?.name}</span>
                    {status === 'done' && (
                      <span className="games-pill is-done">
                        <Check size={12} aria-hidden="true" /> {g('terminee')}
                      </span>
                    )}
                    {status === 'active' && <span className="games-pill">{g('enCours')}</span>}
                  </div>
                  <h3>{m.title}</h3>
                  <p>{m.description}</p>
                  <ol className="games-mission-steps">
                    {m.steps.map((s) => (
                      <li key={s.id}>{s.label}</li>
                    ))}
                  </ol>
                  <div className="games-mission-foot">
                    <div className="games-progress" aria-label={g('etapes', { done: stepsDone, total })}>
                      <span style={{ width: `${ratio * 100}%` }} />
                    </div>
                    <small>
                      {m.rewardXp} XP{m.badge ? ` · ${BADGES.find((b) => b.id === m.badge)?.name ?? m.badge}` : ''}
                    </small>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="games-section games-split">
        <div>
          <header className="games-section-head">
            <h2>{g('badgesEtTrophees')}</h2>
            <p>{g('badgesIntro')}</p>
          </header>
          <div className="games-badges">
            {BADGES.map((b) => {
              const Icon = b.icon
              const owned = progress.badges[b.id]
              return (
                <div key={b.id} className={`games-badge ${owned ? 'is-owned' : ''}`} style={{ '--badge': b.color }}>
                  <span className="badge-medal">{owned ? <Icon size={26} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}</span>
                  <strong>{b.name}</strong>
                  <small>{owned ? g('obtenu') : b.hint}</small>
                </div>
              )
            })}
          </div>
          <div className="games-trophies">
            {TROPHIES.map((t) => {
              const Icon = t.icon
              const owned = progress.trophies[t.id]
              return (
                <div key={t.id} className={`games-trophy ${owned ? 'is-owned' : ''}`} title={t.hint}>
                  {owned ? <Icon size={18} aria-hidden="true" /> : <Trophy size={18} aria-hidden="true" />}
                  <span>
                    <strong>{t.name}</strong>
                    <small>{t.hint}</small>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <header className="games-section-head">
            <h2>{g('maProgression')}</h2>
            <p>{g('progressionIntro')}</p>
          </header>
          <div className="games-level">
            <span className="games-level-number">{lv.level}</span>
            <div>
              <strong>{lv.title}</strong>
              <div className="games-progress is-large">
                <span style={{ width: `${(lv.into / lv.need) * 100}%` }} />
              </div>
              <small>
                {progress.xp} XP · {g('prochainNiveau', { n: lv.need - lv.into })}
              </small>
            </div>
          </div>
          <dl className="games-stats">
            {[
              [Target, g('statMissions'), done],
              [Sparkles, g('statDecouvertes'), discoveries],
              [BookOpenText, g('statSavoirs'), Object.keys(progress.consulted).length],
              [Footprints, g('statDistance'), `${(progress.stats.distance / 1000).toFixed(2)} km`],
              [Clock, g('statTemps'), duration(progress.stats.playSeconds)],
              [PawPrint, g('statQuiz'), accuracy === null ? '—' : `${accuracy} %`],
            ].map(([Icon, label, value]) => (
              <div key={label}>
                <dt>
                  <Icon size={15} aria-hidden="true" /> {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <h3 className="games-subtitle">{g('historique')}</h3>
          {progress.log.length === 0 ? (
            <p className="games-small">{g('historiqueVide')}</p>
          ) : (
            <ul className="games-log">
              {progress.log.slice(0, 8).map((entry) => (
                <li key={`${entry.type}-${entry.id}-${entry.at}`}>
                  <span className={`games-log-dot is-${entry.type}`} aria-hidden="true" />
                  {entry.type === 'mission' ? (
                    <span>
                      {g('logMission')} <strong>{entry.name}</strong>
                    </span>
                  ) : entry.type === 'consult' ? (
                    <span>
                      {g('logConsult')} <strong>{entry.name}</strong>
                    </span>
                  ) : (
                    <span>
                      {entry.type === 'identify' ? g('logIdentify') : g('logDiscover')}{' '}
                      <Link to={`/atlas?lieu=${entry.id}`}>
                        <strong>{contentName(entry.id)}</strong>
                      </Link>
                    </span>
                  )}
                  <time dateTime={entry.at}>{new Date(entry.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</time>
                </li>
              ))}
            </ul>
          )}
          {saved && (
            <button
              type="button"
              className="button ghost games-reset"
              onClick={() => {
                if (window.confirm(g('confirmerEffacer'))) resetProgress()
              }}
            >
              <RotateCcw size={15} aria-hidden="true" /> {g('effacerProgression')}
            </button>
          )}
        </div>
      </section>

      <section className="games-note">
        <BookOpenText size={20} aria-hidden="true" />
        <p>{g('noteSources')}</p>
      </section>

      {dialog && <NewGameDialog existing={saved} onClose={() => setDialog(false)} />}
    </div>
  )
}
