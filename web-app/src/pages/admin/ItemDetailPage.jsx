import { AlertCircle, CheckCircle2, Circle, FileText, History, Image, Link2, PencilLine } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { api, translateServerMessage } from '../../api.js'
import { WorkspaceTabs } from '../../components/admin/ItemTable.jsx'
import { useDialog } from '../../components/Modal.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ErrorMessage, Loading, StatusBadge, TableWrap, useApi } from '../../components/ui.jsx'
import {
  ACCESS_LABELS,
  DECISION_LABELS,
  MEDIA_KIND_LABELS,
  formatDateTime,
  RELATION_LABELS,
  STATUS_LABELS,
  VERIFICATION_LABELS,
} from '../../labels.js'

import { locale, t } from '../../i18n/index.js'
import { ACTION_LABELS, BACKWARD_ACTIONS, EDITABLE_BY_AUTHOR, EDITOR_STEPS, itemToChecks, LEVEL_LABELS, primaryAction } from './workflow.js'
const SNAPSHOT_LABELS = {
  title: t('common.title'),
  originalTitle: t('itemDetail.titreOriginal'),
  summary: t('common.summary'),
  body: t('common.description'),
  keywords: t('itemDetail.motsCles'),
  categoryId: t('common.category'),
  originalLanguageId: t('item.langueOriginale'),
  dateKind: t('itemDetail.typeDeDate'),
  dateValue: t('common.date'),
  dateEnd: t('itemDetail.finDePeriode'),
  verificationStatus: t('itemDetail.statutDeVerification'),
  resourcePersonId: t('item.personneRessource'),
  missionId: t('reference.mission'),
  fields: t('itemDetail.champsSpecifiques'),
  communityIds: t('common.communities'),
  placeIds: t('common.places'),
  sources: t('common.sources'),
  media: t('common.media'),
  consentIds: t('reference.consentements'),
}

const show = (value) => (value === null || value === undefined || value === '' ? '—' : typeof value === 'string' ? value : JSON.stringify(value, null, 1))

function TransitionPanel({ item, transitions, onDone }) {
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState({ reason: '', comments: '', requestedChanges: '', scheduledAt: '' })
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setError(null)
    try {
      await api(`/admin/items/${item.id}/transitions`, {
        method: 'POST',
        body: {
          toStatus: target.status,
          reason: form.reason,
          comments: form.comments,
          requestedChanges: form.requestedChanges,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        },
      })
      setTarget(null)
      setForm({ reason: '', comments: '', requestedChanges: '', scheduledAt: '' })
      onDone()
    } catch (err) {
      setError(err)
    }
  }

  if (transitions.length === 0) return <p className="muted">{t('itemDetail.aucuneActionPossiblePourVous')}</p>
  const main = primaryAction(transitions)

  return (
    <>
      <div className="actions">
        {[...transitions]
          .sort((a, b) => (b.status === main) - (a.status === main) || BACKWARD_ACTIONS.has(a.status) - BACKWARD_ACTIONS.has(b.status))
          .map((tx) => (
            <button
              key={tx.status}
              type="button"
              className={target?.status === tx.status || (tx.status === main && !target) ? (tx.status === 'PUBLISHED' ? 'positive' : '') : 'secondary'}
              disabled={Boolean(tx.blockedReason)}
              title={tx.blockedReason ? translateServerMessage(tx.blockedReason) : STATUS_LABELS[tx.status]}
              onClick={() => setTarget(tx)}
            >
              {ACTION_LABELS[tx.status] ?? STATUS_LABELS[tx.status]}
            </button>
          ))}
      </div>
      {transitions.some((tx) => tx.blockedReason) && (
        <p className="muted">{translateServerMessage(transitions.find((tx) => tx.blockedReason).blockedReason)}</p>
      )}
      {target && (
        <form className="form transition-form" onSubmit={submit}>
          <h3>{ACTION_LABELS[target.status] ?? STATUS_LABELS[target.status]}</h3>
          <p className="muted small">{t('itemDetail.passerA')}{' '}{STATUS_LABELS[target.status]} »</p>
          <label>{t('common.reason')}{target.reasonRequired ? '' : ` (${t('ws.facultatif')})`}
            <input required={target.reasonRequired} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
          {target.status === 'NEEDS_COMPLETION' && (
            <label>{t('itemDetail.modificationsDemandees')}<textarea rows={3} value={form.requestedChanges} onChange={(e) => setForm({ ...form, requestedChanges: e.target.value })} />
            </label>
          )}
          {target.status === 'SCHEDULED' && (
            <label>{t('itemDetail.dateEtHeureDePublication')}<input type="datetime-local" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            </label>
          )}
          <label>{t('common.comments')}<textarea rows={2} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
          </label>
          <ErrorMessage error={error} />
          <div className="actions">
            <button type="submit">{t('common.confirm')}</button>
            <button type="button" className="secondary" onClick={() => setTarget(null)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </>
  )
}

function VersionsPanel({ item, versions, canEdit, onRestored }) {
  const dialog = useDialog()
  const [selected, setSelected] = useState([])
  const [comparison, setComparison] = useState(null)
  const [error, setError] = useState(null)

  async function compare() {
    setError(null)
    try {
      const [a, b] = [...selected].sort((x, y) => x - y)
      const [va, vb] = await Promise.all([
        api(`/admin/items/${item.id}/versions/${a}`),
        api(`/admin/items/${item.id}/versions/${b}`),
      ])
      setComparison({ a: va.version, b: vb.version })
    } catch (err) {
      setError(err)
    }
  }

  async function restore(version) {
    const ok = await dialog.confirm({
      title: t('itemDetail.restaurerLaVersion', { 0: version }),
      message: t('itemDetail.uneNouvelleVersionIdentiqueSera'),
      confirmLabel: t('itemDetail.restaurer'),
    })
    if (!ok) return
    try {
      await api(`/admin/items/${item.id}/versions/${version}/restore`, { method: 'POST' })
      onRestored()
    } catch (err) {
      setError(err)
    }
  }

  const toggle = (v) => setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s.slice(-1), v]))
  const diffKeys = comparison
    ? Object.keys(SNAPSHOT_LABELS).filter((k) => JSON.stringify(comparison.a.snapshot[k]) !== JSON.stringify(comparison.b.snapshot[k]))
    : []

  return (
    <>
      <ErrorMessage error={error} />
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col">{t('itemDetail.comparer')}</th>
              <th scope="col">{t('common.version')}</th>
              <th scope="col">{t('common.date')}</th>
              <th scope="col">{t('common.author')}</th>
              <th scope="col">{t('common.reason')}</th>
              <th scope="col">{t('itemDetail.publiee')}</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td>
                  <input type="checkbox" aria-label={t('itemDetail.comparerLaVersion', { 0: v.version })} checked={selected.includes(v.version)} onChange={() => toggle(v.version)} />
                </td>
                <td>
                  {v.version}
                  {v.version === item.currentVersion && <span className="badge">{t('itemDetail.actuelle')}</span>}
                  {item.publishedVersion?.version === v.version && <span className="badge ok-badge">{t('itemDetail.enLigne')}</span>}
                </td>
                <td>{formatDateTime(v.createdAt)}</td>
                <td>{v.author.displayName}</td>
                <td>{v.reason}</td>
                <td>{v.publishedAt ? formatDateTime(v.publishedAt) : '—'}</td>
                <td>
                  {canEdit && v.version !== item.currentVersion && (
                    <button type="button" className="secondary" onClick={() => restore(v.version)}>{t('itemDetail.restaurer')}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <button type="button" className="secondary" disabled={selected.length !== 2} onClick={compare}>{t('itemDetail.comparerLesDeuxVersionsCochees')}</button>
      {comparison && (
        <div className="comparison">
          <h3>{t('itemDetail.differencesEntreLaVersion')}{' '}{comparison.a.version}{' '}{t('itemDetail.etLaVersion')}{' '}{comparison.b.version}
          </h3>
          {diffKeys.length === 0 && <p className="muted">{t('itemDetail.aucuneDifferenceDeContenu')}</p>}
          {diffKeys.map((k) => (
            <div key={k} className="diff-row">
              <strong>{SNAPSHOT_LABELS[k]}</strong>
              <pre className="diff-old">{show(comparison.a.snapshot[k])}</pre>
              <pre className="diff-new">{show(comparison.b.snapshot[k])}</pre>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function RelationsPanel({ item, relations, canEdit, onChange }) {
  const [form, setForm] = useState({ q: '', toId: '', type: 'RELATED', notes: '' })
  const [error, setError] = useState(null)
  const candidates = useApi(form.q.length >= 2 ? `/admin/items?q=${encodeURIComponent(form.q)}&pageSize=10` : null).data?.items ?? []

  async function add(event) {
    event.preventDefault()
    setError(null)
    try {
      await api(`/admin/items/${item.id}/relations`, { method: 'POST', body: { toId: form.toId, type: form.type, notes: form.notes } })
      setForm({ q: '', toId: '', type: 'RELATED', notes: '' })
      onChange()
    } catch (err) {
      setError(err)
    }
  }

  async function remove(relation) {
    try {
      await api(`/admin/items/${item.id}/relations/${relation.id}`, { method: 'DELETE' })
      onChange()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <>
      <p className="muted">{t('itemDetail.lesRelationsSontEtabliesManuellement')} {t('itemDetail.aideReseau')}</p>
      <ul className="plain-list">
        {relations.map((r) => {
          const outgoing = r.fromId === item.id
          const other = outgoing ? r.to : r.from
          return (
            <li key={r.id}>
              {outgoing ? RELATION_LABELS[r.type] : `${RELATION_LABELS[r.type]} (inverse)`} :{' '}
              <Link to={`/admin/fiches/${other.id}`}>{other.title}</Link> <StatusBadge status={other.status} />
              {r.notes && <span className="muted"> — {r.notes}</span>}
              {canEdit && (
                <button type="button" className="link-button" onClick={() => remove(r)}>{t('common.removeLower')}</button>
              )}
            </li>
          )
        })}
        {relations.length === 0 && <li className="muted">{t('itemDetail.aucuneRelation')}</li>}
      </ul>
      {canEdit && (
        <form className="form" onSubmit={add}>
          <div className="row-editor">
            <input placeholder={t('itemDetail.rechercherUneFiche')} value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value, toId: '' })} aria-label={t('itemDetail.rechercherUneFiche2')} />
            <select required value={form.toId} onChange={(e) => setForm({ ...form, toId: e.target.value })} aria-label={t('itemDetail.ficheLiee')}>
              <option value="">{t('common.choose')}</option>
              {candidates
                .filter((c) => c.id !== item.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.communities?.length ? ` — ${c.communities.map((x) => x.community?.name ?? x.name).join(', ')}` : ''}
                  </option>
                ))}
            </select>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label={t('itemDetail.typeDeRelation')}>
              {Object.entries(RELATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input placeholder={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} aria-label={t('common.notes')} />
            <button type="submit">{t('itemDetail.relier')}</button>
          </div>
          <ErrorMessage error={error} />
        </form>
      )}
    </>
  )
}

function GrantsPanel({ item, onChange }) {
  const users = useApi('/admin/lookups').data?.users ?? []
  const [form, setForm] = useState({ userId: '', reason: '', expiresAt: '' })
  const [error, setError] = useState(null)

  async function grant(event) {
    event.preventDefault()
    try {
      await api(`/admin/items/${item.id}/grants`, {
        method: 'POST',
        body: { userId: form.userId, reason: form.reason, expiresAt: form.expiresAt || null },
      })
      setForm({ userId: '', reason: '', expiresAt: '' })
      onChange()
    } catch (err) {
      setError(err)
    }
  }

  async function revoke(userId) {
    await api(`/admin/items/${item.id}/grants/${userId}`, { method: 'DELETE' }).catch(setError)
    onChange()
  }

  return (
    <>
      <ul className="plain-list">
        {item.accessGrants.map((g) => (
          <li key={g.id}>
            {users.find((u) => u.id === g.userId)?.displayName ?? g.userId}
            {g.expiresAt && <span className="muted">{' '}{t('itemDetail.jusquAu')}{' '}{new Date(g.expiresAt).toLocaleDateString(locale())}</span>}
            {g.reason && <span className="muted"> — {g.reason}</span>}{' '}
            <button type="button" className="link-button" onClick={() => revoke(g.userId)}>{t('common.removeLower')}</button>
          </li>
        ))}
        {item.accessGrants.length === 0 && <li className="muted">{t('itemDetail.aucunAccesNominatif')}</li>}
      </ul>
      <form className="row-editor" onSubmit={grant}>
        <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} aria-label={t('itemDetail.utilisateur')}>
          <option value="">{t('itemDetail.choisirUnUtilisateur')}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
        <input placeholder={t('common.reason')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} aria-label={t('common.reason')} />
        <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} aria-label={t('itemDetail.expiration')} />
        <button type="submit">{t('itemDetail.accorderLAcces')}</button>
      </form>
      <ErrorMessage error={error} />
    </>
  )
}

// Avancement du dossier : étapes du parcours de documentation, textes
// associés, puis circuit de validation.
function ProgressTracker({ item, texts, canEdit }) {
  const checks = itemToChecks(item)
  const stateOf = (key) => {
    const own = checks.filter((c) => c.step === key)
    if (own.some((c) => c.blocking && !c.ok)) return 'todo'
    return own.every((c) => c.ok) ? 'done' : 'partial'
  }
  const reviewDone = ['PUBLISHED', 'SCHEDULED', 'VALIDATED'].includes(item.status)
  const inReview = !EDITABLE_BY_AUTHOR.includes(item.status) && !reviewDone
  const steps = [
    ...EDITOR_STEPS.filter((s) => s.key !== 'verifier').map((s) => ({ ...s, state: stateOf(s.key), to: `/admin/fiches/${item.id}/modifier?etape=${s.key}` })),
    { key: 'textes', label: t('ws.etape.textes'), state: texts.length ? 'done' : 'partial', to: `?onglet=medias`, hint: texts.length ? String(texts.length) : t('ws.facultatif') },
    { key: 'validation', label: t('ws.etape.validation'), state: reviewDone ? 'done' : inReview ? 'current' : 'todo', hint: STATUS_LABELS[item.status] },
  ]
  const done = checks.filter((c) => c.ok).length
  return (
    <section className="card">
      <div className="section-header" style={{ marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('ws.avancementDuDossier')}</h2>
        <span className="small muted">{t('ws.elementsCompletes', { done, total: checks.length })}</span>
      </div>
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={done}>
        <span style={{ width: `${(done / checks.length) * 100}%` }} />
      </div>
      <ol className="progress-steps">
        {steps.map((s) => {
          const icon = s.state === 'done' ? <CheckCircle2 size={18} className="icon" aria-hidden="true" /> : s.state === 'todo' ? <AlertCircle size={18} className="icon" aria-hidden="true" /> : <Circle size={18} className="icon" aria-hidden="true" />
          const body = (
            <>
              {icon}
              <span>
                <strong>{s.label}</strong>
                {s.hint && <small>{s.hint}</small>}
              </span>
            </>
          )
          const linkable = s.to && (s.key === 'textes' || canEdit)
          return (
            <li key={s.key} className={`progress-step ${s.state}`}>
              {linkable ? <Link to={s.to}>{body}</Link> : <span>{body}</span>}
            </li>
          )
        })}
      </ol>
      {canEdit && checks.some((c) => !c.ok) && (
        <ul className="checklist compact">
          {checks
            .filter((c) => !c.ok)
            .map((c) => (
              <li key={c.key} className={c.level === 'submit' ? 'todo' : c.level === 'publish' ? 'publish' : 'optional'}>
                {c.level !== 'recommended' ? <AlertCircle size={16} className="icon" aria-hidden="true" /> : <Circle size={16} className="icon" aria-hidden="true" />}
                <span>
                  {c.label}
                  <small className="muted"> — {LEVEL_LABELS[c.level]}</small>
                </span>
                <Link to={`/admin/fiches/${item.id}/modifier?etape=${c.step}`} className="link-button">{t('ws.completer')}</Link>
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}

const TABS = [
  ['contenu', t('ws.onglet.contenu'), FileText],
  ['medias', t('ws.onglet.medias'), Image],
  ['liens', t('ws.onglet.liens'), Link2],
  ['historique', t('ws.onglet.historique'), History],
]

export default function ItemDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const [params] = useSearchParams()
  const tab = TABS.some(([key]) => key === params.get('onglet')) ? params.get('onglet') : 'contenu'
  const { data, error, loading, reload } = useApi(`/admin/items/${id}`)
  const texts = useApi(`/admin/texts?itemId=${id}`).data?.texts ?? []
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState(null)

  if (!data) return <Loading loading={loading} error={error} />
  const { item, transitions, publicationProblems, decisions, relations, versions, canEdit } = data
  const preparing = EDITABLE_BY_AUTHOR.includes(item.status)
  // Dernière demande de complément, rappelée tant que la fiche est à reprendre.
  const lastRequest = ['NEEDS_COMPLETION', 'UNDER_REVISION'].includes(item.status)
    ? decisions.find((d) => d.toStatus === item.status && (d.requestedChanges || d.reason))
    : null

  async function addComment(event) {
    event.preventDefault()
    try {
      await api(`/admin/items/${item.id}/comments`, { method: 'POST', body: { comments: comment } })
      setComment('')
      reload()
    } catch (err) {
      setCommentError(err)
    }
  }

  return (
    <>
      <p>
        <Link to="/admin/fiches">{t('items.retourFiches')}</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>{item.title}</h1>
          <p style={{ margin: '0.35rem 0 0' }}>
            <StatusBadge status={item.status} /> <span className="badge">{ACCESS_LABELS[item.accessLevel]}</span>{' '}
            {item.isSensitive && <span className="badge">{t('itemDetail.sensible')}</span>} <span className="muted small">{t('common.version')}{' '}{item.currentVersion} · {item.category.name}</span>
          </p>
        </div>
        <div className="actions">
          {canEdit && item.status !== 'ARCHIVED' && (
            <Link className="button" to={`/admin/fiches/${item.id}/modifier`}>
              <PencilLine size={16} className="icon" aria-hidden="true" />{preparing ? t('ws.completerLaFiche') : t('common.edit')}</Link>
          )}
          {item.publishedVersionId && !['SUSPENDED', 'WITHDRAWN', 'ARCHIVED'].includes(item.status) && item.accessLevel === 'PUBLIC' && (
            <a className="button secondary" href={`/contenus/${item.slug}`} target="_blank" rel="noreferrer">{t('itemDetail.voirSurLeSite')}</a>
          )}
        </div>
      </div>

      {lastRequest && (
        <div className="notice warning">
          <AlertCircle size={20} className="icon" aria-hidden="true" />
          <div>
            <h2>{t('itemDetail.modificationsDemandees')}</h2>
            {lastRequest.requestedChanges && <p style={{ margin: 0 }}>{lastRequest.requestedChanges}</p>}
            {lastRequest.reason && <p className="muted small" style={{ margin: 0 }}>{t('itemDetail.motif')}{' '}{lastRequest.reason} — {lastRequest.author.displayName}, {formatDateTime(lastRequest.createdAt)}</p>}
          </div>
        </div>
      )}

      <div className="dossier-grid">
        <ProgressTracker item={item} texts={texts} canEdit={canEdit} />
        <section className="card">
          <h2 style={{ fontSize: '1.05rem' }}>{t('ws.prochaineEtape')}</h2>
          <TransitionPanel item={item} transitions={transitions} onDone={reload} />
          {publicationProblems.length > 0 && !preparing && (
            <div className="notice warning" style={{ marginTop: '1rem', marginBottom: 0 }}>
              <div>
                <strong>{t('itemDetail.conditionsDePublicationNonRemplies')}</strong>
                <ul>
                  {publicationProblems.map((p) => {
                    // Un média en cause : lien direct vers sa page.
                    const title = p.match(/^Média « (.+?) »/)?.[1]
                    const media = title && item.media.find((m) => m.media.title === title)
                    return (
                      <li key={p}>
                        {translateServerMessage(p)}
                        {media && (
                          <>
                            {' — '}
                            <Link to={`/admin/medias/${media.mediaId}`}>{t('itemDetail.corrigerMedia')}</Link>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>

      <WorkspaceTabs
        label={t('ws.sectionsDuDossier')}
        tabs={TABS.map(([key, label, icon]) => ({
          id: key,
          label,
          icon,
          to: `?onglet=${key}`,
          active: tab === key,
          count: key === 'medias' ? item.media.length + texts.length : key === 'liens' ? relations.length : undefined,
        }))}
      />

      {tab === 'contenu' && (
        <section className="card">
          <h2>{t('itemDetail.contenuVersionDeTravail')}</h2>
          <dl className="details">
            <dt>{t('common.category')}</dt>
            <dd>{item.category.name}</dd>
            {item.originalTitle && (
              <>
                <dt>{t('itemDetail.titreOriginal')}</dt>
                <dd>{item.originalTitle}</dd>
              </>
            )}
            <dt>{t('common.summary')}</dt>
            <dd>{item.summary || '—'}</dd>
            <dt>{t('common.communities')}</dt>
            <dd>
              {item.communities.length
                ? item.communities.map((c, i) => (
                    <span key={c.communityId}>
                      {i > 0 && ', '}
                      <Link to={`/admin/communautes/${c.communityId}`}>{c.community.name}</Link>
                    </span>
                  ))
                : '—'}
            </dd>
            <dt>{t('common.places')}</dt>
            <dd>{item.places.map((p) => p.place.name).join(', ') || '—'}</dd>
            <dt>{t('itemDetail.statutDeLInformation')}</dt>
            <dd>{VERIFICATION_LABELS[item.verificationStatus]}</dd>
            <dt>{t('common.sources')}</dt>
            <dd>
              {item.sources.length
                ? item.sources.map((s) => (
                    <div key={s.sourceId}>
                      {s.source.title}
                      {s.supports && <span className="muted">{' '}{t('itemDetail.etaye')}{' '}{s.supports}</span>}
                    </div>
                  ))
                : '—'}
            </dd>
            <dt>{t('itemDetail.creeePar')}</dt>
            <dd>
              {item.createdBy.displayName}{t('itemDetail.le')}{' '}{formatDateTime(item.createdAt)}
            </dd>
          </dl>
          {item.body && (
            <details>
              <summary>{t('itemDetail.descriptionDetaillee')}</summary>
              <div className="prose">{item.body}</div>
            </details>
          )}
        </section>
      )}

      {tab === 'medias' && (
        <>
          <section className="card">
            <h2>{t('common.media')}</h2>
            {item.media.length ? (
              <div className="media-grid">
                {item.media.map((m) => (
                  <Link key={m.mediaId} to={`/admin/medias/${m.mediaId}`} className="media-card">
                    {m.media.kind === 'PHOTO' || (m.media.kind === 'VIDEO' && m.media.thumbnailFileId) ? (
                      <img src={`/api/admin/media/${m.mediaId}/file?variant=thumbnail`} alt={m.media.title} className="thumb" loading="lazy" />
                    ) : (
                      <span className="thumb placeholder">{MEDIA_KIND_LABELS[m.media.kind]}</span>
                    )}
                    <strong>{m.media.title}</strong>
                    <span className="muted">{m.caption || ACCESS_LABELS[m.media.accessLevel]}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">{t('ws.aucunMediaAssocie')}</p>
            )}
            {canEdit && (
              <Link to={`/admin/fiches/${item.id}/modifier?etape=sources`} className="action-link">{t('ws.ajouterDesMedias')}</Link>
            )}
          </section>
          <section className="card">
            <h2>{t('itemDetail.transcriptionsEtTraductions')}</h2>
            <p className="muted small">{t('ws.aideTextes')}</p>
            <ul className="plain-list">
              {texts.map((tx) => (
                <li key={tx.id}>
                  <Link to={`/admin/textes/${tx.id}`}>
                    {tx.kind === 'TRANSCRIPTION' ? t('text.transcription') : t('text.traduction')} — {tx.language.name}
                  </Link>{' '}
                  <span className="muted">
                    v{tx.currentVersion}, {tx.verification === 'VERIFIED' ? t('itemDetail.verifiee') : t('publicCards.nonVerifiee')}
                  </span>
                </li>
              ))}
              {texts.length === 0 && <li className="muted">{t('itemDetail.aucunTexteAssocie')}</li>}
            </ul>
            {(can('transcription.edit') || can('translation.edit') || can('content.edit')) && (
              <Link to={`/admin/textes/nouveau?itemId=${item.id}`} className="button secondary">{t('itemDetail.ajouterUneTranscriptionOuUne')}</Link>
            )}
          </section>
        </>
      )}

      {tab === 'liens' && (
        <>
          <section className="card">
            <h2>{t('itemDetail.relationsAvecDAutresFiches')}</h2>
            <RelationsPanel item={item} relations={relations} canEdit={canEdit} onChange={reload} />
          </section>
          {['TEAM', 'SPECIAL'].includes(item.accessLevel) && (can('content.edit') || can('settings.manage')) ? (
            <section className="card">
              <h2>{t('itemDetail.accesNominatifs')}</h2>
              <GrantsPanel item={item} onChange={reload} />
            </section>
          ) : null}
        </>
      )}

      {tab === 'historique' && (
        <>
          <section className="card">
            <h2>{t('itemDetail.decisionsEtCommentaires')}</h2>
            <form className="form" onSubmit={addComment}>
              <label>{t('itemDetail.ajouterUnCommentaire')}<textarea rows={2} required value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
              <ErrorMessage error={commentError} />
              <div>
                <button type="submit" className="secondary">{t('itemDetail.commenter')}</button>
              </div>
            </form>
            <ol className="timeline">
              {decisions.map((d) => (
                <li key={d.id}>
                  <strong>{DECISION_LABELS[d.type]}</strong>
                  {d.toStatus && (
                    <>
                      {' '}
                      : {STATUS_LABELS[d.fromStatus]} → {STATUS_LABELS[d.toStatus]}
                    </>
                  )}
                  <div className="muted">
                    {d.author.displayName}, {formatDateTime(d.createdAt)}{' '}{t('itemDetail.version')}{' '}{d.version})
                  </div>
                  {d.reason && <div>{t('itemDetail.motif')}{' '}{d.reason}</div>}
                  {d.requestedChanges && <div>{t('itemDetail.modificationsDemandees2')}{' '}{d.requestedChanges}</div>}
                  {d.comments && <div>{d.comments}</div>}
                </li>
              ))}
            </ol>
          </section>
          <section className="card">
            <h2>{t('itemDetail.versions')}</h2>
            <VersionsPanel item={{ ...item, publishedVersion: versions.find((v) => v.id === item.publishedVersionId) }} versions={versions} canEdit={canEdit} onRestored={reload} />
          </section>
        </>
      )}
    </>
  )
}
