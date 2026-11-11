import { ArrowDown, ArrowUp, BarChart3, Eye, EyeOff, Gamepad2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../../api.js'
import { useDialog } from '../../components/Modal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { ErrorMessage, Loading, MultiSelect, TableWrap, useApi } from '../../components/ui.jsx'
import { POINTS } from '../../data/atlasContent.js'
import { contentName } from '../core/content.js'
import { MODES } from '../core/missions.js'
import { BADGES } from '../core/rewards.js'
import { g } from '../i18n.js'
import { ENVIRONMENTS, stepTargets } from '../world/ituri/catalog.js'
import '../games.css'

// Administration du module Jeux (permission « games.manage ») : missions,
// étapes, récompenses, contenus associés, publication, statistiques.

const STATUS = { DRAFT: g('admin.brouillon'), PUBLISHED: g('admin.publiee'), DISABLED: g('admin.desactivee') }
const STEP_TYPES = ['explore', 'identify', 'discover', 'talk', 'consult', 'quiz']
const modeName = (id) => MODES.find((m) => m.id === id)?.name ?? id
const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

export function GameMissionsPage() {
  const { data, error, loading, reload } = useApi('/admin/games/missions')
  const toast = useToast()
  const setStatus = async (m, status) => {
    await api(`/admin/games/missions/${m.id}`, { method: 'PATCH', body: { status } })
    toast.success(status === 'PUBLISHED' ? g('admin.missionPubliee') : g('admin.missionDesactivee'))
    reload()
  }
  return (
    <>
      <div className="page-head">
        <h1>{g('admin.missionsDuJeu')}</h1>
        <Link className="button" to="/admin/jeux/missions/nouvelle">
          <Plus size={17} className="icon" aria-hidden="true" />
          {g('admin.nouvelleMission')}
        </Link>
      </div>
      <p className="muted">{g('admin.intro')}</p>
      <section className="card">
        <Loading loading={loading} error={error}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{g('admin.ordre')}</th>
                  <th scope="col">{g('admin.titre')}</th>
                  <th scope="col">{g('admin.mode')}</th>
                  <th scope="col">{g('admin.etapes')}</th>
                  <th scope="col">{g('admin.recompense')}</th>
                  <th scope="col">{g('admin.statut')}</th>
                  <th scope="col">
                    <span className="sr-only">{g('admin.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.missions.map((m) => (
                  <tr key={m.id}>
                    <td>{m.position}</td>
                    <td>
                      <Link to={`/admin/jeux/missions/${m.id}`}>{m.title}</Link>
                      {m.builtin && <small className="muted"> · {g('admin.fournie')}</small>}
                      {m.community && <small className="muted"> · {m.community.name}</small>}
                    </td>
                    <td>{modeName(m.mode)}</td>
                    <td>{m.steps.length}</td>
                    <td>
                      {m.rewardXp} XP{m.badge ? ` · ${BADGES.find((b) => b.id === m.badge)?.name ?? m.badge}` : ''}
                    </td>
                    <td>{STATUS[m.status]}</td>
                    <td>
                      {m.status === 'PUBLISHED' ? (
                        <button type="button" className="secondary small" onClick={() => setStatus(m, 'DISABLED')}>
                          <EyeOff size={15} className="icon" aria-hidden="true" />
                          {g('admin.desactiver')}
                        </button>
                      ) : (
                        <button type="button" className="secondary small" onClick={() => setStatus(m, 'PUBLISHED')}>
                          <Eye size={15} className="icon" aria-hidden="true" />
                          {g('admin.publier')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Loading>
      </section>
    </>
  )
}

const emptyStep = (type = 'explore') => ({ id: '', type, label: '', targets: [], count: 1, questions: type === 'quiz' ? [emptyQuestion()] : undefined })
const emptyQuestion = () => ({ q: '', choices: ['', '', ''], answer: 0, source: '' })

const newMission = {
  slug: '',
  title: '',
  description: '',
  objective: '',
  mode: 'nature',
  environment: 'ituri',
  rewardXp: 100,
  badge: '',
  communityId: '',
  contentRefs: [],
  status: 'DRAFT',
  position: 10,
  steps: [emptyStep()],
}

function targetLabel(type, target) {
  if (type === 'identify' || type === 'discover') return contentName(target.id)
  return target.label
}

function QuestionEditor({ question, onChange, onRemove, index }) {
  const set = (patch) => onChange({ ...question, ...patch })
  return (
    <fieldset className="game-admin-question">
      <legend>{g('admin.questionN', { n: index + 1 })}</legend>
      <label>
        {g('admin.question')}
        <input required value={question.q} onChange={(e) => set({ q: e.target.value })} />
      </label>
      <label>
        {g('admin.choix')}
        <textarea rows={3} required value={question.choices.join('\n')} onChange={(e) => set({ choices: e.target.value.split('\n') })} />
      </label>
      <div className="grid-2">
        <label>
          {g('admin.bonneReponse')}
          <select value={question.answer} onChange={(e) => set({ answer: Number(e.target.value) })}>
            {question.choices.map((c, i) => (
              <option key={i} value={i}>
                {c || `${g('admin.choix')} ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          {g('admin.sourceQuestion')}
          <select required value={question.source} onChange={(e) => set({ source: e.target.value })}>
            <option value="">—</option>
            {POINTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" className="secondary small" onClick={onRemove}>
        <Trash2 size={14} className="icon" aria-hidden="true" />
        {g('admin.retirerQuestion')}
      </button>
    </fieldset>
  )
}

function StepEditor({ step, environment, onChange, onRemove, onMove, index, total }) {
  const set = (patch) => onChange({ ...step, ...patch })
  const options = stepTargets(environment, step.type)
  return (
    <fieldset className="game-admin-step">
      <legend>
        {g('admin.etapeN', { n: index + 1 })} · {g(`admin.type.${step.type}`)}
      </legend>
      <div className="grid-2">
        <label>
          {g('admin.typeEtape')}
          <select
            value={step.type}
            onChange={(e) => {
              const type = e.target.value
              onChange({ ...step, type, targets: [], count: 1, questions: type === 'quiz' ? step.questions ?? [emptyQuestion()] : undefined })
            }}
          >
            {STEP_TYPES.map((t) => (
              <option key={t} value={t}>
                {g(`admin.type.${t}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {g('admin.libelle')}
          <input required value={step.label} onChange={(e) => set({ label: e.target.value, id: step.id || slugify(e.target.value) })} />
        </label>
      </div>
      <MultiSelect
        label={step.type === 'quiz' ? g('admin.personnageQuiz') : g('admin.cibles')}
        options={options.map((o) => ({ value: o.id, label: targetLabel(step.type, o) }))}
        value={step.targets}
        onChange={(targets) => set({ targets, count: Math.min(step.count, Math.max(1, targets.length)) })}
      />
      {step.type !== 'quiz' && (
        <label className="game-admin-count">
          {g('admin.nombreRequis')}
          <input type="number" min={1} max={Math.max(1, step.targets.length)} value={step.count} onChange={(e) => set({ count: Number(e.target.value) })} />
        </label>
      )}
      {step.type === 'quiz' && (
        <div className="game-admin-questions">
          {(step.questions ?? []).map((q, i) => (
            <QuestionEditor
              key={i}
              index={i}
              question={q}
              onChange={(next) => set({ questions: step.questions.map((x, j) => (j === i ? next : x)) })}
              onRemove={() => set({ questions: step.questions.filter((_, j) => j !== i) })}
            />
          ))}
          <button type="button" className="secondary small" onClick={() => set({ questions: [...(step.questions ?? []), emptyQuestion()] })}>
            <Plus size={14} className="icon" aria-hidden="true" />
            {g('admin.ajouterQuestion')}
          </button>
        </div>
      )}
      <div className="game-admin-step-actions">
        <button type="button" className="secondary small" disabled={index === 0} onClick={() => onMove(-1)} aria-label={g('admin.monter')}>
          <ArrowUp size={14} aria-hidden="true" />
        </button>
        <button type="button" className="secondary small" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={g('admin.descendre')}>
          <ArrowDown size={14} aria-hidden="true" />
        </button>
        <button type="button" className="secondary small" disabled={total === 1} onClick={onRemove}>
          <Trash2 size={14} className="icon" aria-hidden="true" />
          {g('admin.retirerEtape')}
        </button>
      </div>
    </fieldset>
  )
}

function MissionForm({ initial, lookups, onSubmit, onDelete }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setSteps = (steps) => set({ steps })
  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit({
        ...form,
        slug: form.slug || slugify(form.title),
        rewardXp: Number(form.rewardXp),
        position: Number(form.position),
        steps: form.steps.map((s, i) => {
          const step = { id: s.id || `etape-${i + 1}`, type: s.type, label: s.label, targets: s.targets, count: s.type === 'quiz' ? 1 : Number(s.count) }
          if (s.type === 'quiz') step.questions = s.questions.map((q) => ({ ...q, choices: q.choices.map((c) => c.trim()).filter(Boolean) }))
          return step
        }),
      })
    } catch (err) {
      setError(err)
    }
  }
  return (
    <form className="form card" onSubmit={submit}>
      <div className="grid-2">
        <label>
          {g('admin.titre')}
          <input required value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>
          {g('admin.identifiant')}
          <input value={form.slug} disabled={initial.builtin} placeholder={slugify(form.title)} onChange={(e) => set({ slug: slugify(e.target.value) })} />
        </label>
      </div>
      <label>
        {g('admin.description')}
        <textarea rows={3} required value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </label>
      <label>
        {g('admin.objectif')}
        <textarea rows={2} required value={form.objective} onChange={(e) => set({ objective: e.target.value })} />
      </label>
      <div className="grid-2">
        <label>
          {g('admin.mode')}
          <select value={form.mode} onChange={(e) => set({ mode: e.target.value })}>
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {g('admin.environnement')}
          <select value={form.environment} onChange={(e) => set({ environment: e.target.value })}>
            {Object.values(ENVIRONMENTS).map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {g('admin.communaute')}
          <select value={form.communityId ?? ''} onChange={(e) => set({ communityId: e.target.value })}>
            <option value="">—</option>
            {lookups.communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {g('admin.statut')}
          <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
            {Object.entries(STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {g('admin.xp')}
          <input type="number" min={0} max={5000} value={form.rewardXp} onChange={(e) => set({ rewardXp: e.target.value })} />
        </label>
        <label>
          {g('admin.badge')}
          <select value={form.badge ?? ''} onChange={(e) => set({ badge: e.target.value })}>
            <option value="">—</option>
            {BADGES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {g('admin.ordre')}
          <input type="number" min={0} max={1000} value={form.position} onChange={(e) => set({ position: e.target.value })} />
        </label>
      </div>
      <MultiSelect
        label={g('admin.contenusAssocies')}
        options={POINTS.map((p) => ({ value: p.id, label: p.name }))}
        value={form.contentRefs}
        onChange={(contentRefs) => set({ contentRefs })}
      />
      <h2 className="game-admin-subtitle">{g('admin.etapes')}</h2>
      <p className="muted">{g('admin.etapesAide')}</p>
      {form.steps.map((step, i) => (
        <StepEditor
          key={i}
          index={i}
          total={form.steps.length}
          step={step}
          environment={form.environment}
          onChange={(next) => setSteps(form.steps.map((s, j) => (j === i ? next : s)))}
          onRemove={() => setSteps(form.steps.filter((_, j) => j !== i))}
          onMove={(delta) => {
            const steps = [...form.steps]
            const [moved] = steps.splice(i, 1)
            steps.splice(i + delta, 0, moved)
            setSteps(steps)
          }}
        />
      ))}
      <button type="button" className="secondary" onClick={() => setSteps([...form.steps, emptyStep()])}>
        <Plus size={16} className="icon" aria-hidden="true" />
        {g('admin.ajouterEtape')}
      </button>
      <ErrorMessage error={error} />
      <div className="game-admin-actions">
        <button type="submit">{g('admin.enregistrer')}</button>
        {onDelete && !initial.builtin && (
          <button type="button" className="danger" onClick={onDelete}>
            <Trash2 size={16} className="icon" aria-hidden="true" />
            {g('admin.supprimer')}
          </button>
        )}
      </div>
    </form>
  )
}

export function GameMissionEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dialog = useDialog()
  const lookups = useApi('/admin/lookups')
  const mission = useApi(id ? `/admin/games/missions/${id}` : null)
  if (!lookups.data || (id && !mission.data)) return <Loading loading error={lookups.error ?? mission.error} />
  const initial = id ? { ...mission.data.mission, communityId: mission.data.mission.communityId ?? '', badge: mission.data.mission.badge ?? '' } : newMission
  return (
    <>
      <div className="page-head">
        <h1>
          <Gamepad2 size={22} className="icon" aria-hidden="true" /> {id ? initial.title : g('admin.nouvelleMission')}
        </h1>
        <Link to="/admin/jeux/missions" className="button ghost">
          {g('admin.retourListe')}
        </Link>
      </div>
      <MissionForm
        key={id ?? 'new'}
        initial={initial}
        lookups={lookups.data}
        onSubmit={async (body) => {
          if (id) {
            const { slug, ...rest } = body
            await api(`/admin/games/missions/${id}`, { method: 'PATCH', body: initial.builtin ? rest : { slug, ...rest } })
            mission.reload()
          } else {
            const res = await api('/admin/games/missions', { method: 'POST', body })
            navigate(`/admin/jeux/missions/${res.mission.id}`, { replace: true })
          }
        }}
        onDelete={
          id
            ? async () => {
                const ok = await dialog.confirm({ title: g('admin.supprimer'), message: g('admin.confirmerSuppression'), danger: true, confirmLabel: g('admin.supprimer') })
                if (!ok) return
                await api(`/admin/games/missions/${id}`, { method: 'DELETE' })
                navigate('/admin/jeux/missions', { replace: true })
              }
            : null
        }
      />
    </>
  )
}

const EVENT_LABELS = {
  session: g('admin.evSession'),
  mission_start: g('admin.evStart'),
  mission_complete: g('admin.evComplete'),
  discovery: g('admin.evDiscovery'),
  quiz_perfect: g('admin.evQuiz'),
  challenge: g('admin.evChallenge'),
}

export function GameStatsPage() {
  const { data, error, loading } = useApi('/admin/games/stats')
  const missions = useApi('/admin/games/missions')
  const total = (event) => data?.totals.filter((t) => t.event === event).reduce((s, t) => s + t.count, 0) ?? 0
  const title = (slug) => missions.data?.missions.find((m) => m.slug === slug)?.title ?? slug
  const bySlug = {}
  for (const t of data?.totals ?? []) {
    if (!t.mission) continue
    bySlug[t.mission] ??= {}
    bySlug[t.mission][t.event] = t.count
  }
  const days = [...new Set((data?.days ?? []).map((d) => d.day))]
  return (
    <>
      <div className="page-head">
        <h1>
          <BarChart3 size={22} className="icon" aria-hidden="true" /> {g('admin.statistiques')}
        </h1>
      </div>
      <p className="muted">{g('admin.statsIntro')}</p>
      <Loading loading={loading} error={error}>
        <div className="game-admin-tiles">
          {Object.entries(EVENT_LABELS).map(([event, label]) => (
            <div key={event} className="card game-admin-tile">
              <span className="muted">{label}</span>
              <strong>{total(event)}</strong>
            </div>
          ))}
        </div>
        <section className="card">
          <h2>{g('admin.parMission')}</h2>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{g('admin.mission')}</th>
                  <th scope="col">{EVENT_LABELS.mission_start}</th>
                  <th scope="col">{EVENT_LABELS.mission_complete}</th>
                  <th scope="col">{g('admin.tauxReussite')}</th>
                  <th scope="col">{EVENT_LABELS.quiz_perfect}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(bySlug).map(([slug, counts]) => (
                  <tr key={slug}>
                    <td>{title(slug)}</td>
                    <td>{counts.mission_start ?? 0}</td>
                    <td>{counts.mission_complete ?? 0}</td>
                    <td>{counts.mission_start ? `${Math.round(((counts.mission_complete ?? 0) / counts.mission_start) * 100)} %` : '—'}</td>
                    <td>{counts.quiz_perfect ?? 0}</td>
                  </tr>
                ))}
                {Object.keys(bySlug).length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      {g('admin.aucuneDonnee')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>
        <section className="card">
          <h2>{g('admin.trenteJours')}</h2>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{g('admin.jour')}</th>
                  {Object.entries(EVENT_LABELS).map(([event, label]) => (
                    <th key={event} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.reverse().map((day) => (
                  <tr key={day}>
                    <td>{new Date(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    {Object.keys(EVENT_LABELS).map((event) => (
                      <td key={event}>{data.days.filter((d) => d.day === day && d.event === event).reduce((s, d) => s + d.count, 0)}</td>
                    ))}
                  </tr>
                ))}
                {days.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      {g('admin.aucuneDonnee')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>
      </Loading>
    </>
  )
}
