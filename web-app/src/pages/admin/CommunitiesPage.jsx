import { FileJson, FileText, FolderOpen, Globe2, Map as MapIcon, Plus, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../../api.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { ErrorMessage, Loading, TableWrap, placeLabel, useApi } from '../../components/ui.jsx'
import { ItemTable, WorkspaceTabs } from '../../components/admin/ItemTable.jsx'
import { QuickCreateModal } from '../../components/admin/QuickCreate.jsx'
import { CommunityImportModal } from '../../components/admin/CommunityImport.jsx'
import { ATTRIBUTION_LABELS, DOC_STATUS_LABELS, MISSION_STATUS_LABELS, NAME_KIND_LABELS, formatDate } from '../../labels.js'
import { t } from '../../i18n/index.js'
import { personFields } from './referenceFields.js'
import { DossierTable } from './dossier/DossierListPage.jsx'

export function CommunitiesPage() {
  const { can } = useAuth()
  const { data, error, loading, reload } = useApi('/admin/communities')
  const [importing, setImporting] = useState(false)
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('common.communities')}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('ws.communautesIntro')}</p>
        </div>
        {can('communities.manage') && (
          <div className="actions">
            <button type="button" className="secondary" onClick={() => setImporting(true)}>
              <FileJson size={17} className="icon" aria-hidden="true" />{t('import.boutonImporter')}</button>
            <Link className="button" to="/admin/communautes/nouvelle">
              <Plus size={17} className="icon" aria-hidden="true" />{t('common.add')}</Link>
          </div>
        )}
      </div>
      <section className="card">
        <Loading loading={loading} error={error}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('common.name')}</th>
                  <th scope="col">{t('common.places')}</th>
                  <th scope="col">{t('communities.documentation')}</th>
                  <th scope="col">{t('communities.fiches')}</th>
                  <th scope="col">{t('communities.missions')}</th>
                  <th scope="col">{t('communities.sitePublic')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.communities.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/admin/communautes/${c.id}`}>{c.name}</Link>
                    </td>
                    <td>{c.places.map((p) => p.place.name).join(', ') || '—'}</td>
                    <td>{DOC_STATUS_LABELS[c.documentationStatus]}</td>
                    <td>{c._count.items}</td>
                    <td>{c._count.missions}</td>
                    <td>{c.isPublished ? t('itemDetail.publiee') : t('communities.nonPubliee')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Loading>
      </section>
      {importing && <CommunityImportModal onClose={() => setImporting(false)} onImported={reload} />}
    </>
  )
}

const emptyCommunity = {
  name: '',
  summary: '',
  description: '',
  history: '',
  documentationStatus: 'NOT_STARTED',
  documentationNote: '',
  isPublished: false,
  names: [],
  places: [],
  languages: [],
}

export function CommunityEditPage() {
  const { id } = useParams()
  const isNew = id === 'nouvelle'
  const navigate = useNavigate()
  const { can } = useAuth()
  const lookups = useApi('/admin/lookups').data
  const sources = useApi('/admin/sources?pageSize=100').data?.sources ?? []
  const [form, setForm] = useState(isNew ? emptyCommunity : null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const existing = useApi(isNew ? null : `/admin/communities/${id}`)
  const [params] = useSearchParams()
  const tab = isNew ? 'presentation' : params.get('onglet') ?? 'presentation'
  const items = useApi(isNew ? null : `/admin/items?communityId=${id}&pageSize=50`)
  const canCollect = can('dossiers.collect') || can('dossiers.review')
  const dossiers = useApi(!isNew && canCollect ? `/admin/dossiers?communityId=${id}&pageSize=50` : null)
  const personsApi = useApi(!isNew && can('persons.manage') ? '/admin/persons' : null)
  const missionsApi = useApi(!isNew && (can('missions.manage') || can('missions.participate')) ? '/admin/missions' : null)
  const [personModal, setPersonModal] = useState(false)

  useEffect(() => {
    if (!existing.data) return
    const c = existing.data.community
    setForm({
      name: c.name,
      summary: c.summary ?? '',
      description: c.description ?? '',
      history: c.history ?? '',
      documentationStatus: c.documentationStatus,
      documentationNote: c.documentationNote ?? '',
      isPublished: c.isPublished,
      names: c.names.map((n) => ({ name: n.name, kind: n.kind, notes: n.notes ?? '', sourceId: n.sourceId ?? '' })),
      places: c.places.map((p) => ({ placeId: p.placeId, notes: p.notes ?? '', sourceId: p.sourceId ?? '' })),
      languages: c.languages.map((l) => ({ languageId: l.languageId, notes: l.notes ?? '' })),
    })
  }, [existing.data])

  if (!lookups || !form) return <Loading loading error={existing.error} />
  const editable = can('communities.manage')
  const communityPersons = (personsApi.data?.persons ?? []).filter((p) => p.communityId === id)
  const communityMissions = (missionsApi.data?.missions ?? []).filter((m) => m.community?.id === id)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setRow = (key, index, patch) => set({ [key]: form[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) })
  const removeRow = (key, index) => set({ [key]: form[key].filter((_, i) => i !== index) })

  async function save(event) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    const clean = (v) => (v === '' ? null : v)
    const body = {
      ...form,
      names: form.names.map((n) => ({ ...n, notes: clean(n.notes), sourceId: clean(n.sourceId) })),
      places: form.places.filter((p) => p.placeId).map((p) => ({ ...p, notes: clean(p.notes), sourceId: clean(p.sourceId) })),
      languages: form.languages.filter((l) => l.languageId).map((l) => ({ ...l, notes: clean(l.notes) })),
    }
    try {
      if (isNew) {
        const res = await api('/admin/communities', { method: 'POST', body })
        navigate(`/admin/communautes/${res.community.id}`, { replace: true })
      } else {
        await api(`/admin/communities/${id}`, { method: 'PATCH', body })
        toast.success(t('communities.modificationsEnregistrees'))
      }
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const sourceOptions = sources.map((s) => (
    <option key={s.id} value={s.id}>
      {s.title}
    </option>
  ))

  return (
    <>
      <p>
        <Link to="/admin/communautes">{t('communities.communautes')}</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>{isNew ? t('communities.nouvelleCommunaute') : form.name}</h1>
          {!isNew && (
            <p style={{ margin: '0.35rem 0 0' }}>
              <span className="badge">{DOC_STATUS_LABELS[form.documentationStatus]}</span>
              {form.isPublished ? <span className="badge ok-badge">{t('itemDetail.publiee')}</span> : <span className="badge">{t('communities.nonPubliee')}</span>}
            </p>
          )}
        </div>
        {!isNew && canCollect && (
          <Link className="button" to={`/admin/collectes/nouvelle?communaute=${id}`}>
            <Plus size={17} className="icon" aria-hidden="true" />{t('dossier.nouvelleCollectePourCommunaute')}</Link>
        )}
      </div>
      {!isNew && (
        <WorkspaceTabs
          label={t('ws.sectionsDuDossier')}
          tabs={[
            { id: 'presentation', label: t('communities.presentation'), icon: Globe2 },
            ...(dossiers.data ? [{ id: 'collectes', label: t('dossier.collectes'), icon: FolderOpen, count: dossiers.data.total }] : []),
            { id: 'contenus', label: t('browse.contenus'), icon: FileText, count: items.data?.total },
            ...(personsApi.data ? [{ id: 'personnes', label: t('reference.personnesRessources'), icon: UserRound, count: communityPersons.length }] : []),
            ...(missionsApi.data ? [{ id: 'missions', label: t('communities.missions'), icon: MapIcon, count: communityMissions.length }] : []),
          ].map((tb) => ({ ...tb, to: `?onglet=${tb.id}`, active: tab === tb.id }))}
        />
      )}

      {tab === 'collectes' && (
        <section className="card">
          <p className="muted small">{t('dossier.collectesDeLaCommunaute')}</p>
          <Loading loading={dossiers.loading && !dossiers.data} error={dossiers.error}>
            {dossiers.data && <DossierTable dossiers={dossiers.data.dossiers} showCollector={can('dossiers.review')} />}
          </Loading>
        </section>
      )}

      {tab === 'contenus' && (
        <section className="card">
          <p className="muted small">{t('ws.contenusDeLaCommunaute')}</p>
          <Loading loading={items.loading && !items.data} error={items.error}>
            {items.data && <ItemTable items={items.data.items} showCommunities={false} />}
          </Loading>
        </section>
      )}

      {tab === 'personnes' && (
        <section className="card">
          <div className="section-header" style={{ marginBottom: '0.75rem' }}>
            <p className="muted small" style={{ margin: 0 }}>{t('reference.donneesPersonnellesConfidentiellesEllesNe')}</p>
            <button type="button" className="secondary" onClick={() => setPersonModal(true)}>
              <Plus size={16} className="icon" aria-hidden="true" />{t('ws.nouvellePersonne')}</button>
          </div>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('common.name')}</th>
                  <th scope="col">{t('reference.attribution')}</th>
                  <th scope="col">{t('reference.localite')}</th>
                </tr>
              </thead>
              <tbody>
                {communityPersons.map((p) => (
                  <tr key={p.id}>
                    <td>{p.fullName}</td>
                    <td>{ATTRIBUTION_LABELS[p.attributionMode]}{p.publicName ? ` : ${p.publicName}` : ''}</td>
                    <td>{p.locality || '—'}</td>
                  </tr>
                ))}
                {communityPersons.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">{t('crud.aucunElementPourLeMoment')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
          <Link to="/admin/personnes" className="action-link">{t('ws.gererLesPersonnes')}</Link>
        </section>
      )}

      {tab === 'missions' && (
        <section className="card">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('mission.code')}</th>
                  <th scope="col">{t('common.title')}</th>
                  <th scope="col">{t('common.status')}</th>
                  <th scope="col">{t('mission.debutPrevu')}</th>
                </tr>
              </thead>
              <tbody>
                {communityMissions.map((m) => (
                  <tr key={m.id}>
                    <td>{m.code}</td>
                    <td>
                      <Link to={`/admin/missions/${m.id}`}>{m.title}</Link>
                    </td>
                    <td>{MISSION_STATUS_LABELS[m.status]}</td>
                    <td>{m.startDate ? formatDate(m.startDate) : '—'}</td>
                  </tr>
                ))}
                {communityMissions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">{t('mission.aucuneMission')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
          {can('missions.manage') && (
            <Link to="/admin/missions/nouvelle" className="action-link">{t('mission.nouvelleMission')}</Link>
          )}
        </section>
      )}

      {personModal && (
        <QuickCreateModal
          title={t('ws.nouvellePersonne')}
          intro={t('reference.donneesPersonnellesConfidentiellesEllesNe')}
          fields={personFields(lookups.communities, id)}
          endpoint="/admin/persons"
          responseKey="person"
          onCreated={() => {
            setPersonModal(false)
            personsApi.reload()
          }}
          onClose={() => setPersonModal(false)}
        />
      )}

      {tab === 'presentation' && (
      <form className="form" onSubmit={save}>
      <p className="muted">{t('communities.nInventezJamaisDInformation')}</p>
        <fieldset disabled={!editable} className="plain">
          <section className="card">
            <h2>{t('communities.presentation')}</h2>
            <label>{t('communities.nomPrincipal')}<input required value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label>{t('common.summary')}<textarea rows={3} value={form.summary} onChange={(e) => set({ summary: e.target.value })} />
            </label>
            <label>{t('communities.presentationGenerale')}<textarea rows={8} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </label>
            <label>{t('communities.elementsHistoriques')}<textarea rows={6} value={form.history} onChange={(e) => set({ history: e.target.value })} />
            </label>
            <div className="grid-2">
              <label>{t('communities.etatDeLaDocumentation')}<select value={form.documentationStatus} onChange={(e) => set({ documentationStatus: e.target.value })}>
                  {Object.entries(DOC_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>{t('communities.noteSurLaDocumentation')}<input value={form.documentationNote} onChange={(e) => set({ documentationNote: e.target.value })} />
              </label>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />{t('communities.afficherCetteCommunauteSurLe')}</label>
          </section>

          <section className="card">
            <h2>{t('communities.denominationsDocumentees')}</h2>
            {form.names.map((n, i) => (
              <div key={i} className="row-editor">
                <input aria-label={t('common.name')} placeholder={t('common.name')} required value={n.name} onChange={(e) => setRow('names', i, { name: e.target.value })} />
                <select aria-label={t('common.type')} value={n.kind} onChange={(e) => setRow('names', i, { kind: e.target.value })}>
                  {Object.entries(NAME_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select aria-label={t('communities.source')} value={n.sourceId} onChange={(e) => setRow('names', i, { sourceId: e.target.value })}>
                  <option value="">{t('communities.source2')}</option>
                  {sourceOptions}
                </select>
                <input aria-label={t('common.notes')} placeholder={t('common.notes')} value={n.notes} onChange={(e) => setRow('names', i, { notes: e.target.value })} />
                <button type="button" className="secondary danger" onClick={() => removeRow('names', i)}>{t('common.remove')}</button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={() => set({ names: [...form.names, { name: '', kind: 'VARIANT', notes: '', sourceId: '' }] })}>{t('communities.ajouterUneDenomination')}</button>
          </section>

          <section className="card">
            <h2>{t('communities.localisationEtRepartition')}</h2>
            <p className="muted">{t('communities.uneCommunautePeutEtrePresente')}</p>
            {form.places.map((p, i) => (
              <div key={i} className="row-editor">
                <select aria-label={t('common.place')} required value={p.placeId} onChange={(e) => setRow('places', i, { placeId: e.target.value })}>
                  <option value="">{t('communities.choisirUnLieu')}</option>
                  {lookups.places.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {placeLabel(pl, lookups.places)}
                    </option>
                  ))}
                </select>
                <select aria-label={t('communities.source')} value={p.sourceId} onChange={(e) => setRow('places', i, { sourceId: e.target.value })}>
                  <option value="">{t('communities.source2')}</option>
                  {sourceOptions}
                </select>
                <input aria-label={t('common.notes')} placeholder={t('common.notes')} value={p.notes} onChange={(e) => setRow('places', i, { notes: e.target.value })} />
                <button type="button" className="secondary danger" onClick={() => removeRow('places', i)}>{t('common.remove')}</button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={() => set({ places: [...form.places, { placeId: '', notes: '', sourceId: '' }] })}>{t('communities.ajouterUnLieu')}</button>
          </section>

          <section className="card">
            <h2>{t('communities.langues')}</h2>
            {form.languages.map((l, i) => (
              <div key={i} className="row-editor">
                <select aria-label={t('common.language')} required value={l.languageId} onChange={(e) => setRow('languages', i, { languageId: e.target.value })}>
                  <option value="">{t('communities.choisirUneLangue')}</option>
                  {lookups.languages.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
                <input aria-label={t('common.notes')} placeholder={t('common.notes')} value={l.notes} onChange={(e) => setRow('languages', i, { notes: e.target.value })} />
                <button type="button" className="secondary danger" onClick={() => removeRow('languages', i)}>{t('common.remove')}</button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={() => set({ languages: [...form.languages, { languageId: '', notes: '' }] })}>{t('communities.ajouterUneLangue')}</button>
          </section>
        </fieldset>

        <ErrorMessage error={error} />
        {editable && (
          <div className="form-footer">
            <span className="small muted">{t('communities.lesModificationsSontJournalisees')}</span>
            <button type="submit" disabled={saving}>
              {saving ? t('crud.enregistrement') : t('common.save')}
            </button>
          </div>
        )}
      </form>
      )}
    </>
  )
}
