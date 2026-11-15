import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CloudOff, Eye, FileText, History, Loader2, MessageSquare, Save, Send, ShieldAlert, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { api, errorText } from '../../../api.js'
import { useAuth } from '../../../auth/AuthContext.jsx'
import { WorkspaceTabs } from '../../../components/admin/ItemTable.jsx'
import { MediaUploadModal, QuickCreateModal } from '../../../components/admin/QuickCreate.jsx'
import { Modal, useDialog } from '../../../components/Modal.jsx'
import { useToast } from '../../../components/Toast.jsx'
import { ErrorMessage, Loading, StatusBadge, useApi } from '../../../components/ui.jsx'
import { formatDateTime } from '../../../labels.js'
import { t } from '../../../i18n/index.js'
import { personFields, sourceFields } from '../referenceFields.js'
import { DossierPreview } from './DossierPreview.jsx'
import {
  CONTENT_KINDS,
  defTitle,
  DOSSIER_ACTION_LABELS,
  DOSSIER_STATUS_LABELS,
  dossierProgress,
  emptySection,
  REVIEW_LABELS,
  sectionState,
  tDef,
} from './dossierLogic.js'
import { Attachments, EntryList, FieldList } from './fields.jsx'
import AuthorityExplorer, { authoritiesFromEntries } from '../../../components/AuthorityTree.jsx'
import { MediaStep, ReviewStep, SourcesStep, STATE_ICONS } from './steps.jsx'

export function DossierBadge({ status }) {
  return <span className={`badge dstatus-${status.toLowerCase()}`}>{DOSSIER_STATUS_LABELS[status]}</span>
}

// Retire les références incomplètes et les statuts vides avant l'envoi.
function cleanData(data) {
  const cleanPart = (part) => ({
    ...part,
    fieldStatus: Object.fromEntries(Object.entries(part.fieldStatus ?? {}).filter(([, v]) => v)),
    media: (part.media ?? []).filter((m) => m.mediaId),
    sources: (part.sources ?? []).filter((s) => s.sourceId),
  })
  return {
    sections: Object.fromEntries(
      Object.entries(data.sections).map(([key, section]) => [key, { ...cleanPart(section), entries: (section.entries ?? []).map(cleanPart) }]),
    ),
  }
}

// --- Enregistrement automatique --------------------------------------------

function useAutosave(dossierId, onSaved) {
  const [state, setState] = useState('saved')
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  const pending = useRef(null)
  const timer = useRef(null)
  const saving = useRef(Promise.resolve())

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (!pending.current) return saving.current
    const payload = pending.current
    pending.current = null
    setState('saving')
    saving.current = saving.current.then(async () => {
      try {
        const res = await api(`/admin/dossiers/${dossierId}`, { method: 'PATCH', body: payload })
        setState(pending.current ? 'dirty' : 'saved')
        setSavedAt(new Date())
        setError(null)
        onSaved(res.dossier)
      } catch (err) {
        pending.current = { ...payload, ...pending.current }
        setState('error')
        setError(err)
      }
    })
    return saving.current
  }, [dossierId, onSaved])

  const queue = useCallback(
    (patch) => {
      pending.current = { ...pending.current, ...patch }
      setState('dirty')
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, 1200)
    },
    [flush],
  )

  // Avant de quitter la page : enregistrement immédiat et avertissement.
  useEffect(() => {
    const warn = (e) => {
      if (!pending.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      flush()
    }
  }, [flush])

  return { state, savedAt, error, queue, flush }
}

function SaveIndicator({ state, savedAt, error, onRetry }) {
  if (state === 'saving')
    return (
      <span className="save-state">
        <Loader2 size={15} className="icon spin" aria-hidden="true" />{t('crud.enregistrement')}</span>
    )
  if (state === 'dirty') return <span className="save-state muted">{t('dossier.modificationsNonEnregistrees')}</span>
  if (state === 'error')
    return (
      <span className="save-state error" role="alert">
        <CloudOff size={15} className="icon" aria-hidden="true" />
        {errorText(error)}{' '}
        <button type="button" className="link-button" onClick={onRetry}>{t('dossier.reessayer')}</button>
      </span>
    )
  return (
    <span className="save-state ok">
      <CheckCircle2 size={15} className="icon" aria-hidden="true" />
      {savedAt ? t('dossier.enregistreA', { time: savedAt.toLocaleTimeString().slice(0, 5) }) : t('dossier.enregistre')}
    </span>
  )
}

// --- Choix de la communauté ----------------------------------------------

function CommunityChoice({ dossier, lookups, readOnly, onChange }) {
  const [mode, setMode] = useState(dossier.communityId ? 'existing' : 'new')
  const [name, setName] = useState(dossier.proposedCommunityName ?? '')
  const similar = useApi(mode === 'new' && name.trim().length > 1 ? `/admin/dossiers/similar-communities?name=${encodeURIComponent(name.trim())}` : null).data?.communities ?? []
  return (
    <section className="card community-choice">
      <h3>{t('dossier.communauteDocumentee')}</h3>
      {readOnly ? (
        <p>{dossier.community?.name ?? `${dossier.proposedCommunityName} (${t('dossier.proposee')})`}</p>
      ) : (
        <>
          <div className="segmented" role="radiogroup">
            <label className="checkbox">
              <input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} />{t('dossier.communauteExistante')}</label>
            <label className="checkbox">
              <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} />{t('dossier.proposerUneCommunaute')}</label>
          </div>
          {mode === 'existing' ? (
            <label>{t('common.community')}<select value={dossier.communityId ?? ''} onChange={(e) => e.target.value && onChange({ communityId: e.target.value })}>
                <option value="">{t('common.choose')}</option>
                {lookups.communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>{t('dossier.nomDeLaCommunauteProposee')}<input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && !similar.length && name.trim() !== dossier.proposedCommunityName && onChange({ proposedCommunityName: name.trim() })} />
              <small className="muted">{t('dossier.aideProposition')}</small>
            </label>
          )}
          {mode === 'new' && similar.length > 0 && (
            <p className="notice warning small">
              {t('dossier.communauteDejaExistante')}{' '}
              {similar.map((c) => (
                <button key={c.id} type="button" className="link-button" onClick={() => (setMode('existing'), onChange({ communityId: c.id }))}>{c.name}</button>
              ))}
            </p>
          )}
        </>
      )}
    </section>
  )
}

// --- Vérification d'une étape par l'administrateur -------------------------

// Le brouillon du commentaire est gardé par la page (une entrée par étape).
function SectionReview({ dossier, def, review, comment, setComment, onReviewed }) {
  const [error, setError] = useState(null)
  const send = async (status) => {
    setError(null)
    try {
      const res = await api(`/admin/dossiers/${dossier.id}/reviews/${def.key}`, { method: 'PUT', body: { status, comment } })
      onReviewed(res.dossier)
    } catch (err) {
      setError(err)
    }
  }
  return (
    <section className="card review-panel">
      <div className="section-header" style={{ marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>{t('dossier.verificationDeLEtape')}</h3>
        {review && <span className={`badge review-${review.status.toLowerCase()}`}>{REVIEW_LABELS[review.status]}</span>}
      </div>
      <label>{t('dossier.commentairePourLeCollecteur')}<textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <ErrorMessage error={error} />
      <div className="actions">
        <button type="button" onClick={() => send('APPROVED')}>
          <CheckCircle2 size={16} className="icon" aria-hidden="true" />{t('dossier.approuverEtape')}</button>
        <button type="button" className="secondary" onClick={() => send('CHANGES_REQUESTED')}>
          <AlertCircle size={16} className="icon" aria-hidden="true" />{t('dossier.demanderCorrection')}</button>
        <button type="button" className="secondary danger" onClick={() => send('REJECTED')}>
          <XCircle size={16} className="icon" aria-hidden="true" />{t('dossier.rejeterEtape')}</button>
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>{t('dossier.aideRejet')}</p>
    </section>
  )
}

// --- Éditeur d'une étape ----------------------------------------------------

function SectionEditor({ def, section, onChange, ctx }) {
  const patch = (p) => onChange((s) => ({ ...s, ...p }))
  const hint = tDef(def, 'mediaHint', def.mediaHint)
  return (
    <>
      {def.fields.length > 0 && (
        <section className="card">
          <FieldList
            def={def}
            fields={def.fields}
            values={section.values}
            statuses={section.fieldStatus}
            onValue={(k, v) => onChange((s) => ({ ...s, values: { ...(s.values ?? {}), [k]: v } }))}
            onStatus={(k, v) => onChange((s) => ({ ...s, fieldStatus: { ...(s.fieldStatus ?? {}), [k]: v || undefined } }))}
            ctx={ctx}
          />
        </section>
      )}
      {def.entry && (
        <section className="card">
          <EntryList def={def} entries={section.entries} onChange={(entries) => patch({ entries })} ctx={ctx} withAttachments={def.kind !== 'testimonies'} />
        </section>
      )}
      {def.kind === 'authorities' && authoritiesFromEntries(section.entries).length > 0 && (
        <section className="card">
          <details className="authority-preview">
            <summary>{t('authority.apercuDeLArbre', { n: authoritiesFromEntries(section.entries).length })}</summary>
            <p className="muted small">{t('authority.aideApercu')}</p>
            <AuthorityExplorer authorities={authoritiesFromEntries(section.entries)} compact />
          </details>
        </section>
      )}
      {def.kind !== 'testimonies' && (
        <section className="card">
          <Attachments part={section} onPatch={patch} ctx={ctx} label={t('dossier.mediasEtSourcesEtape')} />
          {hint && <p className="muted small" style={{ margin: '0.5rem 0 0' }}>{hint}</p>}
        </section>
      )}
      <section className={`card section-flags ${def.sensitiveNotice ? 'flag-highlight' : ''}`}>
        <label className="checkbox">
          <input type="checkbox" checked={Boolean(section.sensitive)} onChange={(e) => patch({ sensitive: e.target.checked })} disabled={ctx.readOnly} />
          <span>
            <strong>{t('dossier.contenuSensible')}</strong>
            <small className="muted">{t('dossier.aideSensible')}</small>
          </span>
        </label>
        {section.sensitive && (
          <label>{t('dossier.precisionsSensible')}<textarea rows={2} value={section.sensitiveNote ?? ''} onChange={(e) => patch({ sensitiveNote: e.target.value })} disabled={ctx.readOnly} />
          </label>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={Boolean(section.notDocumented)} onChange={(e) => patch({ notDocumented: e.target.checked })} disabled={ctx.readOnly} />
          <span>
            <strong>{t('dossier.sectionNonDocumentee')}</strong>
            <small className="muted">{t('dossier.aideNonDocumentee')}</small>
          </span>
        </label>
      </section>
    </>
  )
}

// --- Historique ------------------------------------------------------------

const EVENT_LABELS = {
  CREATED: t('dossier.event.CREATED'),
  TRANSITION: t('dossier.event.TRANSITION'),
  SECTION_REVIEW: t('dossier.event.SECTION_REVIEW'),
  COMMENT: t('dossier.event.COMMENT'),
  ADMIN_EDIT: t('dossier.event.ADMIN_EDIT'),
  COMMUNITY_CREATED: t('dossier.event.COMMUNITY_CREATED'),
  COMMUNITY_LINKED: t('dossier.event.COMMUNITY_LINKED'),
}

function HistoryTab({ dossier, events, versions, defs, ctx, onCommented }) {
  const [comment, setComment] = useState('')
  const [sectionKey, setSectionKey] = useState('')
  const [error, setError] = useState(null)
  const [viewing, setViewing] = useState(null)
  const defName = (key) => {
    const def = defs.find((d) => d.key === key)
    return def ? defTitle(def) : key
  }
  async function send(e) {
    e.preventDefault()
    try {
      await api(`/admin/dossiers/${dossier.id}/comments`, { method: 'POST', body: { comment, sectionKey: sectionKey || undefined } })
      setComment('')
      onCommented()
    } catch (err) {
      setError(err)
    }
  }
  async function view(version) {
    const res = await api(`/admin/dossiers/${dossier.id}/versions/${version}`)
    setViewing(res.version)
  }
  return (
    <>
      <section className="card">
        <h3>{t('dossier.commentairesInternes')}</h3>
        <form className="form" onSubmit={send}>
          <label>{t('itemDetail.ajouterUnCommentaire')}<textarea rows={2} required value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <label>{t('dossier.etapeConcernee')}<select value={sectionKey} onChange={(e) => setSectionKey(e.target.value)}>
              <option value="">{t('dossier.toutLeDossier')}</option>
              {defs.map((d) => (
                <option key={d.key} value={d.key}>
                  {defTitle(d)}
                </option>
              ))}
            </select>
          </label>
          <ErrorMessage error={error} />
          <div>
            <button type="submit" className="secondary">
              <MessageSquare size={16} className="icon" aria-hidden="true" />{t('itemDetail.commenter')}</button>
          </div>
        </form>
        <ol className="timeline">
          {events.map((ev) => (
            <li key={ev.id}>
              <strong>{EVENT_LABELS[ev.type] ?? ev.type}</strong>
              {ev.toStatus && (
                <>
                  {' '}
                  : {ev.fromStatus ? `${DOSSIER_STATUS_LABELS[ev.fromStatus]} → ` : ''}
                  {DOSSIER_STATUS_LABELS[ev.toStatus]}
                </>
              )}
              {ev.sectionKey && <span className="badge">{defName(ev.sectionKey)}</span>}
              <div className="muted">
                {ev.author.displayName}, {formatDateTime(ev.createdAt)} · {t('common.version')} {ev.version}
              </div>
              {ev.comment && <div className="preserve-lines">{ev.type === 'SECTION_REVIEW' ? reviewComment(ev.comment) : ev.comment}</div>}
            </li>
          ))}
        </ol>
      </section>
      <section className="card">
        <h3>{t('itemDetail.versions')}</h3>
        <ul className="plain-list">
          {versions.map((v) => (
            <li key={v.id}>
              <strong>{t('common.version')} {v.version}</strong> — {v.reason} · {v.author.displayName}, {formatDateTime(v.createdAt)}{' '}
              <button type="button" className="link-button" onClick={() => view(v.version)}>{t('common.view')}</button>
            </li>
          ))}
          {versions.length === 0 && <li className="muted">{t('dossier.aucuneVersion')}</li>}
        </ul>
      </section>
      {viewing && (
        <Modal title={`${t('common.version')} ${viewing.version} — ${viewing.reason ?? ''}`} onClose={() => setViewing(null)} wide>
          <DossierPreview defs={defs} data={viewing.data} ctx={ctx} />
        </Modal>
      )}
    </>
  )
}

const reviewComment = (text) => {
  const [status, ...rest] = text.split(' : ')
  return `${REVIEW_LABELS[status] ?? status}${rest.length ? ` : ${rest.join(' : ')}` : ''}`
}

// --- Publication -------------------------------------------------------------

function PublishModal({ dossier, onClose, onPublished }) {
  const [options, setOptions] = useState({ updateCommunity: true, publishCommunity: true })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  async function publish() {
    setBusy(true)
    setError(null)
    try {
      const res = await api(`/admin/dossiers/${dossier.id}/publish`, { method: 'POST', body: options })
      onPublished(res.report)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={t('dossier.publierLeDossier')}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="positive" onClick={publish} disabled={busy}>{busy ? t('crud.enregistrement') : t('ws.action.PUBLISHED')}</button>
        </>
      }
    >
      <p className="muted small">{t('dossier.aidePublication')}</p>
      <label className="checkbox">
        <input type="checkbox" checked={options.updateCommunity} onChange={(e) => setOptions({ ...options, updateCommunity: e.target.checked })} />
        {t('dossier.mettreAJourCommunaute')}
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={options.publishCommunity} onChange={(e) => setOptions({ ...options, publishCommunity: e.target.checked })} />
        {t('dossier.publierCommunaute')}
      </label>
      <ErrorMessage error={error} />
    </Modal>
  )
}

function ReportModal({ report, onClose }) {
  const block = (title, list, tone, extra) =>
    list.length > 0 && (
      <section>
        <h3 className={tone}>
          {title} ({list.length})
        </h3>
        <ul className="plain-list">
          {list.map((u) => (
            <li key={u.key}>
              {u.itemId ? <Link to={`/admin/fiches/${u.itemId}`}>{u.title}</Link> : u.title}
              {extra?.(u)}
            </li>
          ))}
        </ul>
      </section>
    )
  return (
    <Modal title={t('dossier.resultatPublication')} onClose={onClose} wide actions={<button type="button" onClick={onClose}>{t('reference.compris')}</button>}>
      {block(t('dossier.fichesPubliees'), report.published, 'ok')}
      {block(t('dossier.fichesEnAttente'), report.pending, 'warning-text', (u) => (
        <ul className="small muted">
          {u.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ))}
      {block(t('dossier.fichesSensibles'), report.sensitive, 'warning-text', () => <span className="small muted"> — {t('dossier.aidePublicationSensible')}</span>)}
      {block(t('dossier.etapesNonPubliees'), report.skipped, 'muted', (u) => <span className="small muted"> — {t(`dossier.skip.${u.reason}`)}</span>)}
    </Modal>
  )
}

// --- Page ---------------------------------------------------------------------

const TABS = [
  ['formulaire', t('dossier.tab.formulaire'), FileText],
  ['apercu', t('dossier.tab.apercu'), Eye],
  ['historique', t('dossier.tab.historique'), History],
]

export default function DossierPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const dialog = useDialog()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const detail = useApi(`/admin/dossiers/${id}`)
  const defsApi = useApi('/admin/dossier-sections')
  const lookups = useApi('/admin/lookups').data
  const mediaApi = useApi('/admin/media?pageSize=100')
  const sourcesApi = useApi('/admin/sources?pageSize=100')
  const personsApi = useApi(can('persons.manage') ? '/admin/persons' : null)
  const [data, setData] = useState(null)
  const [dossier, setDossier] = useState(null)
  const [modal, setModal] = useState(null)
  const [transition, setTransition] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [report, setReport] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [reviewDrafts, setReviewDrafts] = useState({})

  const onSaved = useCallback((saved) => setDossier((d) => ({ ...d, ...saved, data: d.data })), [])
  const autosave = useAutosave(id, onSaved)

  useEffect(() => {
    if (!detail.data) return
    setDossier(detail.data.dossier)
    setData((current) => current ?? detail.data.dossier.data)
  }, [detail.data])

  const defs = (defsApi.data?.sections ?? []).filter((d) => d.isActive || data?.sections?.[d.key])
  if (!detail.data || !dossier || !data || !defs.length || !lookups) return <Loading loading error={detail.error ?? defsApi.error} />

  const { canEdit, canReview, transitions, events, versions, items } = detail.data
  const readOnly = !canEdit
  const stepKey = defs.some((d) => d.key === params.get('etape')) ? params.get('etape') : defs[0].key
  const stepIndex = defs.findIndex((d) => d.key === stepKey)
  const def = defs[stepIndex]
  const tab = params.get('onglet') ?? 'formulaire'
  const reviews = dossier.reviews ?? {}
  const reviewable = canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(dossier.status)
  const progress = dossierProgress(defs, data)

  const goTo = (key) => {
    const next = new URLSearchParams(params)
    next.set('etape', key)
    next.delete('onglet')
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateSection = (key, fn) => {
    setData((current) => {
      const next = { sections: { ...current.sections, [key]: fn(current.sections[key] ?? emptySection()) } }
      autosave.queue({ data: cleanData(next) })
      return next
    })
  }
  const saveMeta = (patch) => {
    setDossier((d) => ({ ...d, ...patch }))
    autosave.queue(patch)
  }
  const reload = async () => {
    await autosave.flush()
    detail.reload()
  }

  const ctx = {
    readOnly,
    defs,
    persons: personsApi.data?.persons ?? [],
    media: mediaApi.data?.media ?? [],
    sources: sourcesApi.data?.sources ?? [],
    canUpload: can('files.upload'),
    canManagePersons: can('persons.manage'),
    canManageSources: can('sources.manage'),
    openModal: setModal,
    confirm: (options) => dialog.confirm(options),
    confirmRemove: async (fn) => {
      const ok = await dialog.confirm({ title: t('dossier.supprimerElement'), message: t('dossier.supprimerElementAide'), confirmLabel: t('common.delete'), danger: true })
      if (ok) fn()
    },
  }

  const created = (kind, record) => {
    const lists = { person: [personsApi, 'persons'], source: [sourcesApi, 'sources'], media: [mediaApi, 'media'] }
    const [apiState, key] = lists[kind]
    apiState.setData((d) => ({ ...d, [key]: [record, ...(d?.[key] ?? [])] }))
    modal.onCreated?.(record)
    setModal(null)
    toast.success(t('ws.elementCreeEtAssocie'))
  }

  async function runTransition(toStatus, comment) {
    setActionError(null)
    try {
      await autosave.flush()
      await api(`/admin/dossiers/${dossier.id}/transitions`, { method: 'POST', body: { toStatus, comment } })
      setTransition(null)
      toast.success(DOSSIER_STATUS_LABELS[toStatus])
      detail.reload()
    } catch (err) {
      setActionError(err)
    }
  }
  const askTransition = (tx) => setTransition({ ...tx, comment: '' })

  async function resolveCommunity(communityId) {
    setActionError(null)
    try {
      await autosave.flush()
      await api(`/admin/dossiers/${dossier.id}/community`, { method: 'POST', body: { communityId } })
      detail.reload()
    } catch (err) {
      setActionError(err)
    }
  }

  // Étapes à reprendre et dernier message de l'administrateur.
  const toFix = Object.entries(reviews).filter(([, r]) => ['CHANGES_REQUESTED', 'REJECTED'].includes(r.status))
  const lastRequest = dossier.status === 'CHANGES_REQUESTED' ? events.find((e) => e.toStatus === 'CHANGES_REQUESTED' && e.comment) : null
  const review = reviews[def.key]
  const submit = transitions.find((tx) => tx.status === 'SUBMITTED')

  return (
    <>
      <p>
        <Link to="/admin/collectes">{t('dossier.retourCollectes')}</Link>
      </p>
      <div className="page-head dossier-head">
        <div style={{ minWidth: 0, flex: '1 1 18rem' }}>
          {canEdit ? (
            <input
              className="title-input"
              value={dossier.title ?? ''}
              placeholder={t('dossier.titreDuDossier')}
              aria-label={t('dossier.titreDuDossier')}
              onChange={(e) => saveMeta({ title: e.target.value })}
            />
          ) : (
            <h1>{dossier.title || t('dossier.sansTitre')}</h1>
          )}
          <p className="dossier-meta">
            <DossierBadge status={dossier.status} />
            <span>{dossier.community?.name ?? `${dossier.proposedCommunityName} (${t('dossier.proposee')})`}</span>
            <span className="muted">· {dossier.collector.displayName}</span>
            <SaveIndicator {...autosave} onRetry={autosave.flush} />
          </p>
        </div>
        <div className="actions">
          {submit && (
            <button type="button" onClick={() => goTo(defs[defs.length - 1].key)}>
              <Send size={16} className="icon" aria-hidden="true" />{t('dossier.verifierEtSoumettre')}</button>
          )}
          {canReview &&
            transitions
              .filter((tx) => tx.status !== 'SUBMITTED')
              .map((tx) => {
                // Repasser en vérification un dossier validé ou publié, c'est le rouvrir.
                const reopen = tx.status === 'UNDER_REVIEW' && ['VALIDATED', 'PUBLISHED'].includes(dossier.status)
                return (
                  <button
                    key={tx.status}
                    type="button"
                    className={tx.status === 'VALIDATED' ? '' : 'secondary'}
                    onClick={() => (tx.commentRequired || reopen ? askTransition({ ...tx, reopen }) : runTransition(tx.status))}
                  >
                    {reopen ? t('dossier.action.reopen') : DOSSIER_ACTION_LABELS[tx.status]}
                  </button>
                )
              })}
          {canReview && dossier.status === 'VALIDATED' && (
            <button type="button" onClick={() => setPublishing(true)}>
              <Send size={16} className="icon" aria-hidden="true" />{t('dossier.publierLeDossier')}</button>
          )}
        </div>
      </div>
      <div className="progress-bar dossier-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={t('dossier.avancement')}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="small muted" style={{ marginTop: '-0.5rem' }}>{t('dossier.avancementPourcent', { n: progress })}</p>
      <ErrorMessage error={actionError} />

      {canReview && dossier.proposedCommunityName && !dossier.communityId && (
        <div className="notice warning">
          <AlertCircle size={20} className="icon" aria-hidden="true" />
          <div>
            <h2>{t('dossier.communauteProposeeTitre', { name: dossier.proposedCommunityName })}</h2>
            <p className="small">{t('dossier.communauteProposeeAide')}</p>
            <div className="actions">
              <button type="button" onClick={() => resolveCommunity(undefined)}>{t('dossier.creerCetteCommunaute')}</button>
              <select defaultValue="" onChange={(e) => e.target.value && resolveCommunity(e.target.value)} aria-label={t('dossier.associerExistante')}>
                <option value="">{t('dossier.associerExistante')}</option>
                {lookups.communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {(lastRequest || (toFix.length > 0 && !canReview)) && (
        <div className="notice warning">
          <AlertCircle size={20} className="icon" aria-hidden="true" />
          <div>
            <h2>{t('itemDetail.modificationsDemandees')}</h2>
            {lastRequest && <p className="preserve-lines" style={{ margin: '0 0 0.4rem' }}>{lastRequest.comment}</p>}
            {toFix.length > 0 && (
              <ul>
                {toFix.map(([key, r]) => {
                  const d = defs.find((x) => x.key === key)
                  return (
                    <li key={key}>
                      <button type="button" className="link-button" onClick={() => goTo(key)}>{d ? defTitle(d) : key}</button>
                      {' — '}
                      {REVIEW_LABELS[r.status]}
                      {r.comment ? ` : ${r.comment}` : ''}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <WorkspaceTabs
        label={t('ws.sectionsDuDossier')}
        tabs={[
          ...TABS.map(([key, label, icon]) => ({ id: key, label, icon, to: `?${key === 'formulaire' ? `etape=${stepKey}` : `onglet=${key}`}`, active: tab === key, count: key === 'historique' ? events.length : undefined })),
          ...(items.length ? [{ id: 'fiches', label: t('dossier.tab.fiches'), icon: CheckCircle2, to: '?onglet=fiches', active: tab === 'fiches', count: items.length }] : []),
        ]}
      />

      {tab === 'formulaire' && (
        <div className="dossier-layout">
          <nav className="step-nav" aria-label={t('itemEditor.etapesDuFormulaire')}>
            <select className="step-select" value={stepKey} onChange={(e) => goTo(e.target.value)} aria-label={t('itemEditor.etapesDuFormulaire')}>
              {defs.map((d, i) => (
                <option key={d.key} value={d.key}>
                  {i + 1}. {defTitle(d)}
                </option>
              ))}
            </select>
            <ol>
              {defs.map((d, i) => {
                const state = sectionState(d, data.sections[d.key])
                const Icon = STATE_ICONS[state]
                const r = reviews[d.key]
                return (
                  <li key={d.key}>
                    <button type="button" className={`step-link ${d.key === stepKey ? 'current' : ''} state-${state}`} onClick={() => goTo(d.key)} aria-current={d.key === stepKey ? 'step' : undefined}>
                      <span className="step-index">{i + 1}</span>
                      <span className="step-title">{defTitle(d)}</span>
                      {r && r.status !== 'PENDING' && <span className={`review-dot review-${r.status.toLowerCase()}`} title={REVIEW_LABELS[r.status]} />}
                      {data.sections[d.key]?.sensitive && <ShieldAlert size={13} className="icon warning-text" aria-hidden="true" />}
                      <Icon size={15} className="icon state-icon" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <div className="step-main">
            <div className="step-heading">
              <span className="eyebrow">{t('dossier.etapeNsurM', { n: stepIndex + 1, total: defs.length })}</span>
              <h2>{defTitle(def)}</h2>
              {def.description && <p className={`muted ${def.sensitiveNotice ? 'notice warning small' : ''}`}>{tDef(def, 'description', def.description)}</p>}
            </div>

            {review && ['CHANGES_REQUESTED', 'REJECTED'].includes(review.status) && (
              <div className="notice warning">
                <AlertCircle size={20} className="icon" aria-hidden="true" />
                <div>
                  <strong>{REVIEW_LABELS[review.status]}</strong>
                  {review.comment && <p style={{ margin: 0 }}>{review.comment}</p>}
                  <p className="muted small" style={{ margin: 0 }}>{review.reviewerName}, {formatDateTime(review.at)}</p>
                </div>
              </div>
            )}

            {reviewable && (CONTENT_KINDS.includes(def.kind) || def.kind === 'testimonies') && (
              <SectionReview
                dossier={dossier}
                def={def}
                review={review}
                comment={reviewDrafts[def.key] ?? review?.comment ?? ''}
                setComment={(value) => setReviewDrafts((drafts) => ({ ...drafts, [def.key]: value }))}
                onReviewed={(d) => (setDossier((x) => ({ ...x, ...d, reviews: d.reviews })), detail.reload())}
              />
            )}

            {def.kind === 'identification' && (
              <CommunityChoice dossier={dossier} lookups={lookups} readOnly={readOnly} onChange={async (patch) => {
                try {
                  await autosave.flush()
                  const res = await api(`/admin/dossiers/${dossier.id}`, { method: 'PATCH', body: patch })
                  setDossier((d) => ({ ...d, ...res.dossier, data: d.data }))
                  detail.reload()
                } catch (err) {
                  setActionError(err)
                }
              }} />
            )}

            {(CONTENT_KINDS.includes(def.kind) || def.kind === 'testimonies') && (
              <SectionEditor def={def} section={data.sections[def.key] ?? emptySection()} onChange={(fn) => updateSection(def.key, fn)} ctx={ctx} />
            )}
            {def.kind === 'sources' && <SourcesStep defs={defs} data={data} ctx={ctx} updateSection={updateSection} goTo={goTo} />}
            {def.kind === 'media' && <MediaStep defs={defs} data={data} ctx={ctx} updateSection={updateSection} libraryKey={def.key} />}
            {def.kind === 'review' && (
              <ReviewStep defs={defs} data={data} ctx={ctx} dossier={dossier} reviews={reviews} goTo={goTo} canSubmit={Boolean(submit)} onSubmit={() => askTransition(submit)} />
            )}

            <div className="form-footer">
              <button type="button" className="secondary" disabled={stepIndex === 0} onClick={() => goTo(defs[stepIndex - 1].key)}>
                <ChevronLeft size={16} className="icon" aria-hidden="true" />{t('common.previous')}</button>
              <span className="small muted">{t('dossier.etapeNsurM', { n: stepIndex + 1, total: defs.length })}</span>
              <div className="actions">
                {canEdit && (
                  <button type="button" className="secondary" onClick={autosave.flush}>
                    <Save size={16} className="icon" aria-hidden="true" />{t('common.save')}</button>
                )}
                {stepIndex < defs.length - 1 && (
                  <button type="button" onClick={() => goTo(defs[stepIndex + 1].key)}>{t('common.next')}<ChevronRight size={16} className="icon" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'apercu' && <DossierPreview defs={defs} data={data} ctx={ctx} reviews={reviews} onGoTo={goTo} />}
      {tab === 'historique' && <HistoryTab dossier={dossier} events={events} versions={versions} defs={defs} ctx={ctx} onCommented={reload} />}
      {tab === 'fiches' && (
        <section className="card">
          <p className="muted small">{t('dossier.aideFichesPubliees')}</p>
          <ul className="plain-list">
            {items.map((item) => (
              <li key={item.id}>
                <Link to={`/admin/fiches/${item.id}`}>{item.title}</Link> <StatusBadge status={item.status} />
                {item.isSensitive && <span className="badge">{t('dossier.sensible')}</span>}
                {' · '}
                <Link to={`/admin/fiches/${item.id}?onglet=liens`} className="small">{t('dossier.relierAUneAutreFiche')}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {transition && (
        <Modal
          title={transition.reopen ? t('dossier.action.reopen') : DOSSIER_ACTION_LABELS[transition.status]}
          onClose={() => setTransition(null)}
          actions={
            <>
              <button type="button" className="secondary" onClick={() => setTransition(null)}>{t('common.cancel')}</button>
              <button type="button" disabled={transition.commentRequired && !transition.comment.trim()} onClick={() => runTransition(transition.status, transition.comment)}>{t('common.confirm')}</button>
            </>
          }
        >
          <p className="muted small">{t(transition.reopen ? 'dossier.confirm.reopen' : `dossier.confirm.${transition.status}`)}</p>
          <label>
            {transition.commentRequired ? t('dossier.messageObligatoire') : t('dossier.messageFacultatif')}
            <textarea rows={3} value={transition.comment} onChange={(e) => setTransition({ ...transition, comment: e.target.value })} />
          </label>
          <ErrorMessage error={actionError} />
        </Modal>
      )}
      {publishing && (
        <PublishModal
          dossier={dossier}
          onClose={() => setPublishing(false)}
          onPublished={(r) => {
            setPublishing(false)
            setReport(r)
            detail.reload()
          }}
        />
      )}
      {report && <ReportModal report={report} onClose={() => setReport(null)} />}

      {modal?.kind === 'source' && (
        <QuickCreateModal title={t('ws.nouvelleSource')} intro={t('reference.registreDesSourcesLivresArticles')} fields={sourceFields()} endpoint="/admin/sources" responseKey="source" onCreated={(r) => created('source', r)} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'person' && (
        <QuickCreateModal
          title={t('ws.nouvellePersonne')}
          intro={t('reference.donneesPersonnellesConfidentiellesEllesNe')}
          fields={personFields(lookups.communities, dossier.communityId ?? undefined)}
          endpoint="/admin/persons"
          responseKey="person"
          onCreated={(r) => created('person', r)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'media' && <MediaUploadModal extended onUploaded={(r) => created('media', r)} onClose={() => setModal(null)} />}
    </>
  )
}
