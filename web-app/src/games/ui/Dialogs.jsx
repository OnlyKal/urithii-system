import { ArrowLeft, ArrowRight, BookOpenText, Check, ExternalLink, Info, Leaf, Mountain, PawPrint, RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { POINTS } from '../../data/atlasContent.js'
import { contentName, contentParagraph, natureCard, sourceRef } from '../core/content.js'
import { shuffle } from '../core/quizGen.js'
import { badgeInfo } from '../core/rewards.js'
import { g } from '../i18n.js'

// Fenêtres d'interaction : fiches, identification, dialogues, quiz,
// récompenses. Toutes les informations proviennent des fiches URITHI.

export function GameWindow({ title, eyebrow, icon: Icon, onClose, onBack, children, wide = false, className = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="game-window-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <section className={`game-window ${wide ? 'is-wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="game-window-head">
          {onBack && (
            <button type="button" className="game-close game-back-button" onClick={onBack} aria-label={g('pf.retour')}>
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
          )}
          {Icon && (
            <span className="game-window-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
          )}
          <div>
            {eyebrow && <span className="game-eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          {onClose && (
            <button type="button" className="game-close" onClick={onClose} aria-label={g('fermer')}>
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </header>
        <div className="game-window-body">{children}</div>
      </section>
    </div>
  )
}

// Fiche documentaire d'une espèce (atlas vivant d'URITHI).
export function NatureCard({ id, status, onClose, onBack }) {
  const card = natureCard(id)
  if (!card) return null
  const icon = card.categoryId === 'faune' ? PawPrint : card.categoryId === 'flore' ? Leaf : Mountain
  return (
    <GameWindow title={card.name} eyebrow={status ?? card.category} icon={icon} onClose={onClose} onBack={onBack} wide className="nature-card">
      <div className="nature-card-grid">
        <figure className="nature-photo">
          {card.photo ? (
            <img src={card.photo.src} srcSet={card.photo.srcSet} sizes="(max-width: 720px) 90vw, 420px" alt={card.name} />
          ) : (
            <div className="nature-photo-empty" />
          )}
          {card.photo && (
            <figcaption>
              © {card.photo.author} · {card.photo.license}
              {card.photoNote ? ` · ${card.photoNote}` : ''}
            </figcaption>
          )}
        </figure>
        <div className="nature-text">
          <p className="nature-latin">{card.latin}</p>
          <div className="nature-tags">
            {card.iucn && (
              <span className={`game-tag iucn-${card.iucn.code}`}>
                {g('uicn')} : {card.iucn.label}
              </span>
            )}
            {card.endemic && <span className="game-tag is-mint">{g('endemique')}</span>}
          </div>
          <p className="nature-summary">{card.summary}</p>
          {card.text.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
          <dl className="nature-facts">
            <div>
              <dt>{g('habitat')}</dt>
              <dd>
                {card.place} · {card.province}
              </dd>
            </div>
            {card.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <a className="game-link" href={card.link} target="_blank" rel="noreferrer">
            <BookOpenText size={16} aria-hidden="true" /> {g('ficheUrithi')} <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </GameWindow>
  )
}


// Indice d'identification : le trait le plus distinctif de la fiche.
function hintFor(card) {
  for (const pattern of [/particularit/i, /signes/i, /port/i, /usage/i]) {
    const fact = card.facts.find(([k]) => pattern.test(k))
    if (fact) return fact[1]
  }
  return card.summary
}

// Identification d'une plante : choisir le bon nom parmi trois, les autres
// propositions étant d'autres plantes de l'atlas.
export function IdentifyChoice({ id, onSuccess, onClose }) {
  const [choices] = useState(() => {
    const others = POINTS.filter((p) => p.category === 'flore' && p.id !== id).map((p) => p.id)
    const pick = shuffle(others).slice(0, 2)
    return shuffle([id, ...pick])
  })
  const [wrong, setWrong] = useState([])
  const card = natureCard(id)
  return (
    <GameWindow title={g('quelleEspece')} eyebrow={g('identification')} icon={Leaf} onClose={onClose}>
      <p className="game-lead">{g('identificationAide')}</p>
      <p className="game-hint">
        <Info size={15} aria-hidden="true" /> {hintFor(card)}
      </p>
      <div className="game-choices">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            className={`game-choice ${wrong.includes(c) ? 'is-wrong' : ''}`}
            disabled={wrong.includes(c)}
            onClick={() => (c === id ? onSuccess(wrong.length === 0) : setWrong((w) => [...w, c]))}
          >
            <strong>{contentName(c)}</strong>
            <small>{natureCard(c)?.latin}</small>
          </button>
        ))}
      </div>
      {wrong.length > 0 && <p className="game-feedback is-wrong">{g('pasTout')}</p>}
    </GameWindow>
  )
}

// Dialogue avec un personnage : présentation, récit tiré des fiches, puis
// éventuellement un quiz : celui de la mission en cours, sinon des questions
// tirées des fiches URITHI (onFreeQuiz).
export function Dialogue({ npc, quiz, onQuiz, onFreeQuiz, onRead, onClose }) {
  const lines = useMemo(() => {
    const out = [{ text: npc.greeting }]
    for (const [id, i] of npc.story ?? []) {
      const p = contentParagraph(id, i)
      if (p) out.push(p)
    }
    for (const text of npc.lines ?? []) out.push({ text })
    out.push({ text: npc.farewell })
    return out
  }, [npc])
  const [index, setIndex] = useState(0)
  const line = lines[index]
  const last = index === lines.length - 1
  // Le récit compte comme écouté une fois la dernière réplique atteinte.
  const read = useRef(false)
  useEffect(() => {
    if (last && !read.current) {
      read.current = true
      onRead?.()
    }
  }, [last, onRead])
  return (
    <div className="game-dialogue" role="dialog" aria-label={npc.name}>
      <div className="game-dialogue-name">
        <strong>{npc.name}</strong> <small>{npc.role}</small>
      </div>
      <p className="game-dialogue-text" key={index}>
        {line.text}
      </p>
      {line.source && (
        <a className="game-dialogue-source" href={line.source.link} target="_blank" rel="noreferrer">
          <BookOpenText size={13} aria-hidden="true" /> {g('dApres', { name: line.source.name })}
        </a>
      )}
      <div className="game-dialogue-actions">
        <span className="game-muted">
          {index + 1} / {lines.length}
        </span>
        <button type="button" className="game-button ghost" onClick={onClose}>
          {g('fermer')}
        </button>
        {!last && (
          <button type="button" className="game-button" onClick={() => setIndex(index + 1)} autoFocus>
            {g('suite')} <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        {last && quiz && (
          <button type="button" className="game-button" onClick={onQuiz} autoFocus>
            {g('repondreQuestions')} <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        {last && !quiz && onFreeQuiz && (
          <button type="button" className="game-button ghost" onClick={onFreeQuiz}>
            {g('pf.posezQuestions')}
          </button>
        )}
        {last && !quiz && (
          <button type="button" className="game-button" onClick={onClose} autoFocus>
            {g('merci')}
          </button>
        )}
      </div>
      <p className="game-dialogue-note">{g('personnageFictif')}</p>
    </div>
  )
}

export function Quiz({ step, onDone, onClose, sound }) {
  // Ordre des propositions mélangé pour chaque question.
  const [orders] = useState(() => step.questions.map((q) => shuffle(q.choices.map((_, i) => i))))
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)
  const question = step.questions[index]
  const last = index === step.questions.length - 1
  const answered = picked !== null
  const correct = picked === question.answer
  const source = question.link ? { name: question.sourceName ?? question.source, link: question.link } : sourceRef(question.source)
  const choose = (i) => {
    if (answered) return
    setPicked(i)
    if (i === question.answer) setScore((s) => s + 1)
    sound?.(i === question.answer ? 'correct' : 'wrong')
  }
  return (
    <GameWindow title={step.label} eyebrow={g('question', { n: index + 1, total: step.questions.length })} icon={Sparkles} onClose={onClose}>
      <p className="quiz-question">{question.q}</p>
      <div className="game-choices">
        {orders[index]
          .map((i) => question.choices[i])
          .map((c, k) => {
            const i = orders[index][k]
            return (
              <button
                key={c}
                type="button"
                className={`game-choice ${answered && i === question.answer ? 'is-right' : ''} ${answered && i === picked && !correct ? 'is-wrong' : ''}`}
                onClick={() => choose(i)}
                disabled={answered && i !== picked && i !== question.answer}
              >
                <strong>{c}</strong>
              </button>
            )
          })}
      </div>
      {answered && (
        <div className={`game-feedback ${correct ? 'is-right' : 'is-wrong'}`}>
          {correct ? <Check size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}{' '}
          {correct ? g('bonneReponse') : g('reponseEtait', { answer: question.choices[question.answer] })}
          <a href={source.link} target="_blank" rel="noreferrer">
            {g('source', { name: source.name })}
          </a>
        </div>
      )}
      {answered && (
        <div className="game-window-actions">
          <button
            type="button"
            className="game-button"
            autoFocus
            onClick={() => {
              if (last) onDone(score, step.questions.length)
              else {
                setIndex(index + 1)
                setPicked(null)
              }
            }}
          >
            {last ? g('terminer') : g('questionSuivante')} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </GameWindow>
  )
}

// Écran de récompense : mission accomplie, badge, expérience.
export function RewardScreen({ mission, badge, xp, onClose }) {
  const info = badge ? badgeInfo(badge) : null
  const Icon = info?.icon
  return (
    <div className="game-reward" role="dialog" aria-modal="true" aria-label={g('missionAccomplie')}>
      <div className="game-reward-rays" aria-hidden="true" />
      <div className="game-reward-card">
        <span className="game-eyebrow">{g('missionAccomplie')}</span>
        <h2>{mission.title}</h2>
        {info && (
          <div className="game-reward-badge" style={{ '--badge': info.color }}>
            <span className="badge-medal">
              <Icon size={42} aria-hidden="true" />
            </span>
            <strong>{info.name}</strong>
            <small>{g('nouveauBadge')}</small>
          </div>
        )}
        <p className="game-reward-xp">+{xp} XP</p>
        <button type="button" className="game-button" onClick={onClose} autoFocus>
          {g('continuer')} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
