import { MessageSquareWarning, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ItemTable, WorkspaceTabs } from '../../components/admin/ItemTable.jsx'
import { Loading, Pagination, useApi } from '../../components/ui.jsx'
import { STATUS_LABELS } from '../../labels.js'
import { TakedownsPage } from './GovernancePages.jsx'
import { t } from '../../i18n/index.js'
import { contentViews, countFor } from './workflow.js'

// Onglets de l'espace « Contenus » : files de travail et signalements.
export function ContentsTabs({ current, mine = false, counts: given }) {
  const { can } = useAuth()
  const fetched = useApi(given === undefined ? '/admin/dashboard?scope=counts' : null).data
  const dashboard = given ?? fetched
  const counts = mine ? dashboard?.myByStatus : dashboard?.byStatus
  const tabs = contentViews(can).map((view) => ({
    id: view.id,
    label: view.label,
    to: `/admin/fiches?vue=${view.id}${mine ? '&mine=1' : ''}`,
    active: current === view.id,
    count: dashboard ? countFor(counts, view.statuses) : undefined,
  }))
  if (can('reports.manage')) {
    tabs.push({
      id: 'signalements',
      label: t('adminLayout.demandesDeCorrection'),
      icon: MessageSquareWarning,
      to: '/admin/signalements',
      active: current === 'signalements',
      count: dashboard?.takedownsOpen,
    })
  }
  return <WorkspaceTabs tabs={tabs} label={t('ws.filesDeTravail')} />
}

export function ContentsHeader() {
  const { can } = useAuth()
  return (
    <div className="page-head">
      <div>
        <h1>{t('items.fichesCulturelles')}</h1>
        <p className="muted" style={{ margin: 0 }}>{t('ws.contenusIntro')}</p>
      </div>
      {(can('content.create') || can('content.edit')) && (
        <Link className="button" to="/admin/fiches/nouvelle">
          <Plus size={17} className="icon" aria-hidden="true" />{t('items.nouvelleFiche')}</Link>
      )}
    </div>
  )
}

export default function ItemsPage() {
  const { can } = useAuth()
  const lookups = useApi('/admin/lookups').data
  const [searchParams, setSearchParams] = useSearchParams()
  const views = contentViews(can)
  const viewId = searchParams.get('vue') ?? views[0].id
  const view = views.find((v) => v.id === viewId) ?? views[0]
  const mine = searchParams.get('mine') === '1'
  const status = searchParams.get('status') ?? ''
  const [filters, setFilters] = useState({ q: searchParams.get('q') ?? '', categoryId: '', communityId: searchParams.get('communityId') ?? '' })
  const [page, setPage] = useState(1)

  // La recherche de la barre supérieure arrive par l'adresse.
  const urlQuery = searchParams.get('q') ?? ''
  useEffect(() => {
    setFilters((f) => (f.q === urlQuery ? f : { ...f, q: urlQuery }))
  }, [urlQuery])

  const statuses = status ? status.split(',') : view.statuses
  const params = new URLSearchParams({ page, pageSize: 25 })
  if (statuses.length) params.set('status', statuses.join(','))
  if (mine) params.set('mine', '1')
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v)
  const { data, error, loading } = useApi(`/admin/items?${params}`)
  const counts = useApi('/admin/dashboard?scope=counts').data
  const byStatus = mine ? counts?.myByStatus : counts?.byStatus

  const stepChips = byStatus
    ? (view.statuses.length ? view.statuses : Object.keys(STATUS_LABELS)).filter((s) => byStatus[s] > 0 || s === status)
    : []
  // Inutile d'affiner quand une seule étape contient des fiches.
  if (stepChips.length === 1 && !status) stepChips.length = 0

  const setParam = (patch) => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    setSearchParams(next, { replace: true })
    setPage(1)
  }
  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }

  return (
    <>
      <ContentsHeader />
      <ContentsTabs current={view.id} mine={mine} counts={counts} />

      <section className="card filters">
        <input type="search" placeholder={t('items.rechercherUnTitre')} value={filters.q} onChange={(e) => set({ q: e.target.value })} aria-label={t('common.search')} />
        <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })} aria-label={t('common.category')}>
          <option value="">{t('items.toutesLesCategories')}</option>
          {lookups?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={filters.communityId} onChange={(e) => set({ communityId: e.target.value })} aria-label={t('common.community')}>
          <option value="">{t('items.toutesLesCommunautes')}</option>
          {lookups?.communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={mine} onChange={(e) => setParam({ mine: e.target.checked ? '1' : '' })} />{t('items.mesFiches')}</label>
      </section>

      {/* Affinage par étape : seules les étapes qui contiennent des fiches. */}
      {stepChips.length > 0 && (
        <div className="chip-list step-chips" role="group" aria-label={t('ws.affinerParEtape')}>
          <button type="button" className={`chip ${!status ? 'active' : ''}`} onClick={() => setParam({ status: '' })}>{t('browse.tout')}</button>
          {stepChips.map((s) => (
            <button key={s} type="button" className={`chip ${status === s ? 'active' : ''}`} onClick={() => setParam({ status: s })}>
              {STATUS_LABELS[s]}
              <span className="chip-count">{byStatus?.[s] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      <section className="card">
        <Loading loading={loading && !data} error={error}>
          {data && <ItemTable items={data.items} empty={view.id === 'a-traiter' ? t('ws.rienATraiter') : undefined} />}
          {data && <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />}
        </Loading>
      </section>
    </>
  )
}

// Signalements du public, présentés comme une file de l'espace « Contenus ».
export function TakedownsWorkspace() {
  return (
    <>
      <ContentsHeader />
      <ContentsTabs current="signalements" />
      <TakedownsPage embedded />
    </>
  )
}
