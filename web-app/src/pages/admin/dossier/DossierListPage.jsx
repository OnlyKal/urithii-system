import { FolderPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api } from '../../../api.js'
import { useAuth } from '../../../auth/AuthContext.jsx'
import { WorkspaceTabs } from '../../../components/admin/ItemTable.jsx'
import { EmptyState, ErrorMessage, Loading, Pagination, TableWrap, useApi } from '../../../components/ui.jsx'
import { formatDateTime } from '../../../labels.js'
import { t } from '../../../i18n/index.js'
import { DossierBadge } from './DossierPage.jsx'
import { DOSSIER_VIEWS } from './dossierLogic.js'

const countFor = (counts, statuses) =>
  statuses.length ? statuses.reduce((n, s) => n + (counts?.[s] ?? 0), 0) : Object.values(counts ?? {}).reduce((a, b) => a + b, 0)

// Tableau des dossiers, commun aux collectes, aux validations et aux
// dossiers de communauté.
export function DossierTable({ dossiers, showCollector = true, empty }) {
  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th scope="col">{t('dossier.dossier')}</th>
            {showCollector && <th scope="col">{t('mission.collecteur')}</th>}
            <th scope="col">{t('common.status')}</th>
            <th scope="col">{t('dossier.avancement')}</th>
            <th scope="col">{t('items.modifiee')}</th>
          </tr>
        </thead>
        <tbody>
          {dossiers.map((d) => (
            <tr key={d.id}>
              <td>
                <Link to={`/admin/collectes/${d.id}`} className="item-title-link">{d.title || d.community?.name || d.proposedCommunityName}</Link>
                <div className="small muted">
                  {d.community?.name ?? `${d.proposedCommunityName} (${t('dossier.proposee')})`}
                </div>
                {d.sectionsToFix > 0 && <span className="badge status-needs_completion">{t('dossier.etapesACorriger', { n: d.sectionsToFix })}</span>}
              </td>
              {showCollector && <td>{d.collector.displayName}</td>}
              <td>
                <DossierBadge status={d.status} />
              </td>
              <td>
                <span className="mini-progress" aria-label={`${d.progress} %`}>
                  <span style={{ width: `${d.progress}%` }} />
                </span>
                <span className="small muted">{d.progress} %</span>
              </td>
              <td>{formatDateTime(d.updatedAt)}</td>
            </tr>
          ))}
          {dossiers.length === 0 && (
            <tr>
              <td colSpan={showCollector ? 5 : 4} className="muted">{empty ?? t('dossier.aucunDossier')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </TableWrap>
  )
}

export default function DossierListPage() {
  const { can } = useAuth()
  const reviewer = can('dossiers.review')
  const [params, setParams] = useSearchParams()
  const view = DOSSIER_VIEWS.find((v) => v.id === params.get('vue')) ?? DOSSIER_VIEWS[DOSSIER_VIEWS.length - 1]
  const collectorId = params.get('collecteur') ?? ''
  const [q, setQ] = useState(params.get('q') ?? '')
  const [communityId, setCommunityId] = useState('')
  const [page, setPage] = useState(1)
  const lookups = useApi('/admin/lookups').data
  const counts = useApi('/admin/dossiers/counts').data
  const query = new URLSearchParams({ page, pageSize: 25 })
  if (view.statuses.length) query.set('status', view.statuses.join(','))
  if (q) query.set('q', q)
  if (communityId) query.set('communityId', communityId)
  if (collectorId) query.set('collectorId', collectorId)
  const { data, error, loading } = useApi(`/admin/dossiers?${query}`)
  const collectors = (lookups?.users ?? []).filter((u) => u.roles.some((r) => ['COLLECTEUR', 'RESPONSABLE_COLLECTE'].includes(r)))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{reviewer ? t('dossier.collectes') : t('dossier.mesCollectes')}</h1>
          <p className="muted" style={{ margin: 0 }}>{reviewer ? t('dossier.collectesIntroAdmin') : t('dossier.collectesIntro')}</p>
        </div>
        <Link to="/admin/collectes/nouvelle" className="button">
          <FolderPlus size={17} className="icon" aria-hidden="true" />{t('dossier.nouvelleCollecte')}</Link>
      </div>
      <WorkspaceTabs
        label={t('ws.filesDeTravail')}
        tabs={DOSSIER_VIEWS.map((v) => ({
          id: v.id,
          label: v.label,
          to: `?vue=${v.id}${collectorId ? `&collecteur=${collectorId}` : ''}`,
          active: v.id === view.id,
          count: counts ? countFor(counts.byStatus, v.statuses) : undefined,
        }))}
      />
      <section className="card filters">
        <input type="search" placeholder={t('dossier.rechercherUnDossier')} value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} aria-label={t('common.search')} />
        <select value={communityId} onChange={(e) => (setCommunityId(e.target.value), setPage(1))} aria-label={t('common.community')}>
          <option value="">{t('items.toutesLesCommunautes')}</option>
          {lookups?.communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {reviewer && (
          <select
            value={collectorId}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value) next.set('collecteur', e.target.value)
              else next.delete('collecteur')
              setParams(next)
              setPage(1)
            }}
            aria-label={t('mission.collecteur')}
          >
            <option value="">{t('dossier.tousLesCollecteurs')}</option>
            {collectors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        )}
      </section>
      <section className="card">
        <Loading loading={loading && !data} error={error}>
          {data && <DossierTable dossiers={data.dossiers} showCollector={reviewer} />}
          {data && <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />}
        </Loading>
      </section>
    </>
  )
}

// Création d'un dossier : communauté existante ou proposée.
export function NewDossierPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [params] = useSearchParams()
  const lookups = useApi('/admin/lookups').data
  const missions = useApi(can('missions.manage') || can('missions.participate') ? '/admin/missions' : null).data?.missions ?? []
  const [form, setForm] = useState({ mode: 'existing', communityId: params.get('communaute') ?? '', proposedCommunityName: '', title: '', missionId: '' })
  const [filter, setFilter] = useState('')
  const [error, setError] = useState(null)
  const similar = useApi(form.mode === 'new' && form.proposedCommunityName.trim().length > 1 ? `/admin/dossiers/similar-communities?name=${encodeURIComponent(form.proposedCommunityName.trim())}` : null).data?.communities ?? []
  const communities = (lookups?.communities ?? []).filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))

  async function create(event) {
    event.preventDefault()
    setError(null)
    try {
      const res = await api('/admin/dossiers', {
        method: 'POST',
        body: {
          title: form.title || undefined,
          missionId: form.missionId || undefined,
          ...(form.mode === 'existing' ? { communityId: form.communityId } : { proposedCommunityName: form.proposedCommunityName }),
        },
      })
      navigate(`/admin/collectes/${res.dossier.id}`, { replace: true })
    } catch (err) {
      setError(err)
    }
  }

  const ready = form.mode === 'existing' ? Boolean(form.communityId) : Boolean(form.proposedCommunityName.trim()) && similar.length === 0

  return (
    <>
      <p>
        <Link to="/admin/collectes">{t('dossier.retourCollectes')}</Link>
      </p>
      <h1>{t('dossier.nouvelleCollecte')}</h1>
      <p className="muted">{t('dossier.nouvelleCollecteIntro')}</p>
      <form className="form" onSubmit={create}>
        <section className="card">
          <h2>{t('dossier.quelleCommunaute')}</h2>
          <div className="segmented" role="radiogroup">
            <label className="checkbox">
              <input type="radio" checked={form.mode === 'existing'} onChange={() => setForm({ ...form, mode: 'existing' })} />{t('dossier.communauteExistante')}</label>
            <label className="checkbox">
              <input type="radio" checked={form.mode === 'new'} onChange={() => setForm({ ...form, mode: 'new' })} />{t('dossier.proposerUneCommunaute')}</label>
          </div>
          {form.mode === 'existing' ? (
            <>
              {(lookups?.communities ?? []).length > 8 && (
                <input type="search" placeholder={t('browse.rechercherUneCommunauteOuUne')} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t('common.search')} />
              )}
              <div className="community-picker">
                {communities.map((c) => (
                  <label key={c.id} className={`community-option ${form.communityId === c.id ? 'selected' : ''}`}>
                    <input type="radio" name="community" checked={form.communityId === c.id} onChange={() => setForm({ ...form, communityId: c.id })} />
                    {c.name}
                  </label>
                ))}
                {communities.length === 0 && <p className="muted small">{t('ui.aucunElement')}</p>}
              </div>
            </>
          ) : (
            <label>{t('dossier.nomDeLaCommunauteProposee')}<input required value={form.proposedCommunityName} onChange={(e) => setForm({ ...form, proposedCommunityName: e.target.value })} />
              <small className="muted">{t('dossier.aideProposition')}</small>
            </label>
          )}
          {form.mode === 'new' && similar.length > 0 && (
            <p className="notice warning small">
              {t('dossier.communauteDejaExistante')}{' '}
              {similar.map((c) => (
                <button key={c.id} type="button" className="link-button" onClick={() => setForm({ ...form, mode: 'existing', communityId: c.id })}>{c.name}</button>
              ))}
            </p>
          )}
        </section>
        <section className="card">
          <h2>{t('dossier.informationsFacultatives')}</h2>
          <label>{t('dossier.titreDuDossier')}<input value={form.title} placeholder={t('dossier.exempleTitre')} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          {missions.length > 0 && (
            <label>{t('itemEditor.missionDeCollecte')}<select value={form.missionId} onChange={(e) => setForm({ ...form, missionId: e.target.value })}>
                <option value="">—</option>
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
        <ErrorMessage error={error} />
        <div className="form-footer">
          <span className="small muted">{t('dossier.aideCreation')}</span>
          <button type="submit" disabled={!ready}>
            <FolderPlus size={16} className="icon" aria-hidden="true" />{t('dossier.commencerLaCollecte')}</button>
        </div>
      </form>
    </>
  )
}

// File de l'administrateur : dossiers soumis et validés à publier.
export function DossierValidationsPage() {
  const submitted = useApi('/admin/dossiers?status=SUBMITTED,UNDER_REVIEW&pageSize=100')
  const validated = useApi('/admin/dossiers?status=VALIDATED&pageSize=100')
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('validations.validations')}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('dossier.validationsIntro')}</p>
        </div>
      </div>
      <section className="card">
        <h2 style={{ fontSize: '1.05rem' }}>{t('dossier.aVerifierTitre', { n: submitted.data?.total ?? 0 })}</h2>
        <Loading loading={submitted.loading && !submitted.data} error={submitted.error}>
          {submitted.data?.total === 0 ? (
            <EmptyState title={t('ws.rienATraiter')} />
          ) : (
            submitted.data && <DossierTable dossiers={submitted.data.dossiers} />
          )}
        </Loading>
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.05rem' }}>{t('dossier.aPublierTitre', { n: validated.data?.total ?? 0 })}</h2>
        <Loading loading={validated.loading && !validated.data} error={validated.error}>
          {validated.data && <DossierTable dossiers={validated.data.dossiers} empty={t('ws.rienATraiter')} />}
        </Loading>
      </section>
    </>
  )
}

