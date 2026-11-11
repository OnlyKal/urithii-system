import { ArrowLeft, Check, ExternalLink, Play, RotateCcw, Timer, Trophy, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { atlasPhoto, CATEGORIES, POINTS } from '../../data/atlasContent.js'
import { recordChallenge, useProgress } from '../core/progress.js'
import { g } from '../i18n.js'
import '../games.css'

// Mode « Défis et connaissances » : défi éclair d'identification. Une
// photographie de l'atlas, quatre propositions, soixante secondes.

const DURATION = 60
const POOL = POINTS.filter((p) => atlasPhoto(p.id))

const shuffle = (list) => [...list].sort(() => Math.random() - 0.5)

function question(category, exclude) {
  const pool = POOL.filter((p) => (category === 'tout' || p.category === category) && !exclude.has(p.id))
  const answer = pool[Math.floor(Math.random() * pool.length)] ?? POOL[0]
  // Propositions de la même catégorie, pour un vrai choix.
  const same = POOL.filter((p) => p.category === answer.category && p.id !== answer.id)
  const others = shuffle(same.length >= 3 ? same : POOL.filter((p) => p.id !== answer.id)).slice(0, 3)
  return { answer, choices: shuffle([answer, ...others]), photo: atlasPhoto(answer.id) }
}

export default function DefiPage() {
  const progress = useProgress()
  const [category, setCategory] = useState('tout')
  const [phase, setPhase] = useState('ready')
  const [left, setLeft] = useState(DURATION)
  const [score, setScore] = useState(0)
  const [asked, setAsked] = useState(0)
  const [current, setCurrent] = useState(null)
  const [picked, setPicked] = useState(null)
  const [history, setHistory] = useState([])
  const seen = useRef(new Set())
  const categories = useMemo(() => CATEGORIES.filter((c) => POOL.filter((p) => p.category === c.id).length >= 4), [])

  const next = useCallback(() => {
    const q = question(category, seen.current)
    seen.current.add(q.answer.id)
    setCurrent(q)
    setPicked(null)
  }, [category])

  const start = () => {
    seen.current = new Set()
    setScore(0)
    setAsked(0)
    setHistory([])
    setLeft(DURATION)
    setPhase('playing')
    next()
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'playing' && left <= 0) {
      setPhase('over')
      recordChallenge(score)
    }
  }, [left, phase, score])

  const choose = (p) => {
    if (picked) return
    const right = p.id === current.answer.id
    setPicked(p.id)
    setAsked((n) => n + 1)
    if (right) setScore((s) => s + 1)
    setHistory((h) => [...h, { id: current.answer.id, name: current.answer.name, right }])
    setTimeout(next, right ? 650 : 1300)
  }

  return (
    <div className="games-defi">
      <Link to="/jeux" className="games-back">
        <ArrowLeft size={16} aria-hidden="true" /> {g('retourJeux')}
      </Link>
      <header className="games-section-head">
        <span className="games-eyebrow">
          <Timer size={16} aria-hidden="true" /> {g('defisConnaissances')}
        </span>
        <h1>{g('defiEclair')}</h1>
        <p>{g('defiIntro', { n: DURATION })}</p>
      </header>

      {phase === 'ready' && (
        <div className="defi-start">
          <div className="defi-categories" role="radiogroup" aria-label={g('theme')}>
            {[{ id: 'tout', plural: g('toutesCategories') }, ...categories].map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={category === c.id} className={category === c.id ? 'is-active' : ''} onClick={() => setCategory(c.id)}>
                {c.plural}
              </button>
            ))}
          </div>
          <button type="button" className="button games-cta" onClick={start}>
            <Play size={18} aria-hidden="true" /> {g('lancerDefi')}
          </button>
          {progress.stats.challengeBest > 0 && (
            <p className="games-small">
              <Trophy size={14} aria-hidden="true" /> {g('meilleurScore', { n: progress.stats.challengeBest })}
            </p>
          )}
        </div>
      )}

      {phase === 'playing' && current && (
        <div className="defi-board">
          <div className="defi-meta">
            <span className={`defi-timer ${left <= 10 ? 'is-low' : ''}`}>
              <Timer size={16} aria-hidden="true" /> {left} s
            </span>
            <div className="games-progress" aria-hidden="true">
              <span style={{ width: `${(left / DURATION) * 100}%` }} />
            </div>
            <span className="defi-score">
              {score} / {asked}
            </span>
          </div>
          <figure className="defi-photo">
            <img src={current.photo.src} srcSet={current.photo.srcSet} sizes="(max-width: 720px) 92vw, 640px" alt={g('photoMystere')} />
            <figcaption>
              © {current.photo.author} · {current.photo.license}
            </figcaption>
          </figure>
          <p className="defi-question">{g('quiEstCe')}</p>
          <div className="defi-choices">
            {current.choices.map((p) => {
              const state = picked ? (p.id === current.answer.id ? 'is-right' : p.id === picked ? 'is-wrong' : '') : ''
              return (
                <button key={p.id} type="button" className={`game-choice ${state}`} onClick={() => choose(p)} disabled={Boolean(picked)}>
                  <strong>{p.name}</strong>
                  {p.latin && <small>{p.latin}</small>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {phase === 'over' && (
        <div className="defi-over">
          <Trophy size={40} aria-hidden="true" />
          <h2>{g('scoreFinal', { n: score })}</h2>
          <p>{score >= 8 ? g('defiExcellent') : score >= 4 ? g('defiBien') : g('defiEncore')}</p>
          <ul className="defi-history">
            {history.map((h, i) => (
              <li key={i} className={h.right ? 'is-right' : 'is-wrong'}>
                {h.right ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                <Link to={`/atlas?lieu=${h.id}`}>
                  {h.name} <ExternalLink size={12} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" className="button games-cta" onClick={start}>
            <RotateCcw size={16} aria-hidden="true" /> {g('rejouer')}
          </button>
        </div>
      )}
    </div>
  )
}
