import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../../api.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ErrorMessage, Loading, MultiSelect, TableWrap, placeLabel, useApi } from '../../components/ui.jsx'
import { formatDate, formatDateTime, MISSION_STATUS_LABELS } from '../../labels.js'
import { roleLabel } from '../../roles.js'
import { t } from '../../i18n/index.js'

export function MissionsPage() {
  const { can } = useAuth()
  const { data, error, loading } = useApi('/admin/missions')
  return (
    <>
      <div className="page-head">
        <h1>{t('mission.missionsDeCollecte')}</h1>
        {can('missions.manage') && (
          <Link className="button" to="/admin/missions/nouvelle">
            <Plus size={17} className="icon" aria-hidden="true" />{t('mission.nouvelleMission')}</Link>
        )}
      </div>
      <section className="card">
        <Loading loading={loading} error={error}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('mission.code')}</th>
                  <th scope="col">{t('common.title')}</th>
                  <th scope="col">{t('common.community')}</th>
                  <th scope="col">{t('mission.responsable')}</th>
                  <th scope="col">{t('mission.periode')}</th>
                  <th scope="col">{t('common.status')}</th>
                  <th scope="col">{t('mission.fichesMedias')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.missions.map((m) => (
                  <tr key={m.id}>
                    <td>{m.code}</td>
                    <td>
                      <Link to={`/admin/missions/${m.id}`}>{m.title}</Link>
                    </td>
                    <td>{m.community?.name ?? '—'}</td>
                    <td>{m.responsible.displayName}</td>
                    <td>
                      {m.startDate ? formatDate(m.startDate) : '—'} → {m.endDate ? formatDate(m.endDate) : '—'}
                    </td>
                    <td>{MISSION_STATUS_LABELS[m.status]}</td>
                    <td>
                      {m._count.items} / {m._count.media}
                    </td>
                  </tr>
                ))}
                {data?.missions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">{t('mission.aucuneMission')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </Loading>
      </section>
    </>
  )
}

const emptyMission = {
  title: '',
  objective: '',
  communityId: '',
  placeId: '',
  categoryIds: [],
  startDate: '',
  endDate: '',
  responsibleId: '',
  status: 'PLANNED',
  requiredDocuments: '',
  safetyGuidelines: '',
  expectedResults: '',
  budget: '',
  difficulties: '',
}

function MissionForm({ initial, onSubmit, lookups, submitLabel }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const responsibles = lookups.users.filter((u) => u.roles.some((r) => ['SUPER_ADMIN', 'RESPONSABLE_COLLECTE'].includes(r)))

  async function submit(event) {
    event.preventDefault()
    setError(null)
    const clean = (v) => (v === '' ? null : v)
    try {
      await onSubmit({
        ...form,
        communityId: clean(form.communityId),
        placeId: clean(form.placeId),
        startDate: clean(form.startDate),
        endDate: clean(form.endDate),
        responsibleId: form.responsibleId || undefined,
      })
    } catch (err) {
      setError(err)
    }
  }

  return (
    <form className="form card" onSubmit={submit}>
      <label>{t('common.title')}<input required value={form.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <label>{t('mission.objectif')}<textarea rows={3} required value={form.objective} onChange={(e) => set({ objective: e.target.value })} />
      </label>
      <div className="grid-2">
        <label>{t('mission.communauteCiblee')}<select value={form.communityId ?? ''} onChange={(e) => set({ communityId: e.target.value })}>
            <option value="">—</option>
            {lookups.communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>{t('mission.lieuProvinceTerritoireLocalite')}<select value={form.placeId ?? ''} onChange={(e) => set({ placeId: e.target.value })}>
            <option value="">—</option>
            {lookups.places.map((p) => (
              <option key={p.id} value={p.id}>
                {placeLabel(p, lookups.places)}
              </option>
            ))}
          </select>
        </label>
        <label>{t('mission.debutPrevu')}<input type="date" value={form.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value })} />
        </label>
        <label>{t('mission.finPrevue')}<input type="date" value={form.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value })} />
        </label>
        <label>{t('mission.responsable')}<select value={form.responsibleId ?? ''} onChange={(e) => set({ responsibleId: e.target.value })}>
            <option value="">{t('mission.moiMeme')}</option>
            {responsibles.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>{t('common.status')}<select value={form.status} onChange={(e) => set({ status: e.target.value })}>
            {Object.entries(MISSION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MultiSelect
        label={t('mission.categoriesADocumenter')}
        options={lookups.categories.map((c) => ({ value: c.id, label: c.name }))}
        value={form.categoryIds}
        onChange={(categoryIds) => set({ categoryIds })}
      />
      <label>{t('mission.documentsNecessaires')}<textarea rows={2} value={form.requiredDocuments ?? ''} onChange={(e) => set({ requiredDocuments: e.target.value })} />
      </label>
      <label>{t('mission.consignesDeSecuriteEtDe')}<textarea rows={3} value={form.safetyGuidelines ?? ''} onChange={(e) => set({ safetyGuidelines: e.target.value })} />
      </label>
      <label>{t('mission.resultatsAttendus')}<textarea rows={2} value={form.expectedResults ?? ''} onChange={(e) => set({ expectedResults: e.target.value })} />
      </label>
      <div className="grid-2">
        <label>{t('mission.budgetPrevisionnelFacultatif')}<input value={form.budget ?? ''} onChange={(e) => set({ budget: e.target.value })} />
        </label>
      </div>
      <label>{t('mission.difficultesRencontrees')}<textarea rows={2} value={form.difficulties ?? ''} onChange={(e) => set({ difficulties: e.target.value })} />
      </label>
      <ErrorMessage error={error} />
      <div>
        <button type="submit">{submitLabel}</button>
      </div>
    </form>
  )
}

export function MissionNewPage() {
  const navigate = useNavigate()
  const lookups = useApi('/admin/lookups').data
  if (!lookups) return <Loading loading />
  return (
    <>
      <h1>{t('mission.nouvelleMission')}</h1>
      <MissionForm
        initial={emptyMission}
        lookups={lookups}
        submitLabel={t('mission.creerLaMission')}
        onSubmit={async (body) => {
          const res = await api('/admin/missions', { method: 'POST', body })
          navigate(`/admin/missions/${res.mission.id}`, { replace: true })
        }}
      />
    </>
  )
}

export function MissionDetailPage() {
  const { id } = useParams()
  const { user, can } = useAuth()
  const { data, error, loading, reload } = useApi(`/admin/missions/${id}`)
  const lookups = useApi('/admin/lookups').data
  const persons = useApi(can('persons.manage') ? '/admin/persons' : null).data?.persons ?? []
  const [editing, setEditing] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [note, setNote] = useState({ content: '', unverified: '' })
  const [report, setReport] = useState({ summary: '', results: '', difficulties: '' })
  const [member, setMember] = useState('')
  const [personId, setPersonId] = useState('')
  const [questionnaireId, setQuestionnaireId] = useState('')

  useEffect(() => setEditing(false), [id])

  if (!data || !lookups) return <Loading loading={loading || !lookups} error={error} />
  const mission = data.mission
  const isSuper = user.roles.includes('SUPER_ADMIN')
  const manage = isSuper || (can('missions.manage') && mission.responsible.id === user.id)
  const isMember = mission.responsible.id === user.id || mission.members.some((m) => m.user.id === user.id)

  async function run(fn) {
    setActionError(null)
    try {
      await fn()
      await reload()
      return true
    } catch (err) {
      setActionError(err)
      return false
    }
  }

  return (
    <>
      <p>
        <Link to="/admin/missions">{t('mission.missions')}</Link>
      </p>
      <div className="page-head">
        <h1>
          {mission.code} — {mission.title}
        </h1>
        {manage && !editing && (
          <button type="button" onClick={() => setEditing(true)}>{t('common.edit')}</button>
        )}
      </div>
      <ErrorMessage error={actionError} />

      {editing ? (
        <MissionForm
          lookups={lookups}
          submitLabel={t('common.save')}
          initial={{
            ...emptyMission,
            ...Object.fromEntries(Object.entries(mission).filter(([k]) => k in emptyMission).map(([k, v]) => [k, v ?? ''])),
            startDate: mission.startDate?.slice(0, 10) ?? '',
            endDate: mission.endDate?.slice(0, 10) ?? '',
            responsibleId: mission.responsible.id,
          }}
          onSubmit={async (body) => {
            await api(`/admin/missions/${id}`, { method: 'PATCH', body })
            setEditing(false)
            reload()
          }}
        />
      ) : (
        <section className="card">
          <dl className="details">
            <dt>{t('common.status')}</dt>
            <dd>{MISSION_STATUS_LABELS[mission.status]}</dd>
            <dt>{t('mission.objectif')}</dt>
            <dd>{mission.objective}</dd>
            <dt>{t('common.community')}</dt>
            <dd>{mission.community?.name ?? '—'}</dd>
            <dt>{t('common.place')}</dt>
            <dd>{mission.place?.name ?? '—'}</dd>
            <dt>{t('mission.periode')}</dt>
            <dd>
              {formatDate(mission.startDate)} → {formatDate(mission.endDate)}
            </dd>
            <dt>{t('mission.responsable')}</dt>
            <dd>{mission.responsible.displayName}</dd>
            <dt>{t('mission.categories')}</dt>
            <dd>{mission.categoryIds.map((cid) => lookups.categories.find((c) => c.id === cid)?.name).filter(Boolean).join(', ') || '—'}</dd>
            {mission.safetyGuidelines && (
              <>
                <dt>{t('mission.consignes')}</dt>
                <dd className="prose">{mission.safetyGuidelines}</dd>
              </>
            )}
            {mission.expectedResults && (
              <>
                <dt>{t('mission.resultatsAttendus')}</dt>
                <dd className="prose">{mission.expectedResults}</dd>
              </>
            )}
            <dt>{t('mission.collecte')}</dt>
            <dd>
              {mission._count.items}{' '}{t('mission.ficheS')}{' '}{mission._count.media}{' '}{t('mission.mediaS')}</dd>
          </dl>
        </section>
      )}

      <section className="card">
        <h2>{t('mission.equipe')}</h2>
        <ul className="plain-list">
          {mission.members.map((m) => (
            <li key={m.user.id}>
              {m.user.displayName} <span className="muted">({m.role})</span>
              {manage && (
                <button type="button" className="link-button" onClick={() => run(() => api(`/admin/missions/${id}/members/${m.user.id}`, { method: 'DELETE' }))}>{t('common.removeLower')}</button>
              )}
            </li>
          ))}
          {mission.members.length === 0 && <li className="muted">{t('mission.aucunCollecteurAffecte')}</li>}
        </ul>
        {manage && (
          <form
            className="row-editor"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => api(`/admin/missions/${id}/members`, { method: 'POST', body: { userId: member } })).then(() => setMember(''))
            }}
          >
            <select required value={member} onChange={(e) => setMember(e.target.value)} aria-label={t('mission.collecteur')}>
              <option value="">{t('mission.affecterUnUtilisateur')}</option>
              {lookups.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.roles.map(roleLabel).join(', ')})
                </option>
              ))}
            </select>
            <button type="submit">{t('mission.affecter')}</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2>{t('mission.personnesRessourcesIdentifiees')}</h2>
        <ul className="plain-list">
          {mission.resourcePersons.map(({ resourcePerson: p }) => (
            <li key={p.id}>{p.fullName}</li>
          ))}
          {mission.resourcePersons.length === 0 && <li className="muted">{t('mission.aucune')}</li>}
        </ul>
        {can('persons.manage') && (manage || isMember) && (
          <form
            className="row-editor"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => api(`/admin/missions/${id}/persons`, { method: 'POST', body: { resourcePersonId: personId } })).then(() => setPersonId(''))
            }}
          >
            <select required value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label={t('mission.personneRessource')}>
              <option value="">{t('mission.ajouterUnePersonne')}</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
            <button type="submit">{t('common.add')}</button> <Link to="/admin/personnes">{t('mission.creerUneFichePersonne')}</Link>
          </form>
        )}
      </section>

      <section className="card">
        <h2>{t('mission.questionnaires')}</h2>
        {mission.questionnaires.map(({ questionnaire: q }) => (
          <details key={q.id}>
            <summary>
              {q.title}
              {manage && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => run(() => api(`/admin/missions/${id}/questionnaires/${q.id}`, { method: 'DELETE' }))}
                >{t('common.removeLower')}</button>
              )}
            </summary>
            <ol className="questions">
              {JSON.parse(q.questions).map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </details>
        ))}
        {manage && (
          <form
            className="row-editor"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => api(`/admin/missions/${id}/questionnaires`, { method: 'POST', body: { questionnaireId } })).then(() => setQuestionnaireId(''))
            }}
          >
            <select required value={questionnaireId} onChange={(e) => setQuestionnaireId(e.target.value)} aria-label={t('mission.questionnaire')}>
              <option value="">{t('mission.associerUnQuestionnaire')}</option>
              {lookups.questionnaires.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
            <button type="submit">{t('mission.associer')}</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2>{t('mission.notesDeTerrain')}</h2>
        {(isMember || manage) && (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (await run(() => api(`/admin/missions/${id}/notes`, { method: 'POST', body: note }))) setNote({ content: '', unverified: '' })
            }}
          >
            <label>{t('mission.note')}<textarea rows={3} required value={note.content} onChange={(e) => setNote({ ...note, content: e.target.value })} />
            </label>
            <label>{t('mission.informationsNonVerifieesSurLe')}<textarea rows={2} value={note.unverified} onChange={(e) => setNote({ ...note, unverified: e.target.value })} />
            </label>
            <div>
              <button type="submit" className="secondary">{t('mission.ajouterLaNote')}</button>
            </div>
          </form>
        )}
        <ol className="timeline">
          {mission.notes.map((n) => (
            <li key={n.id}>
              <div className="muted">
                {n.author.displayName}, {formatDateTime(n.createdAt)}
              </div>
              <div className="prose">{n.content}</div>
              {n.unverified && <div className="muted">{t('mission.nonVerifie')}{' '}{n.unverified}</div>}
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>{t('mission.rapportsDeMission')}</h2>
        {mission.reports.map((r) => (
          <details key={r.id}>
            <summary>
              {r.author.displayName} — {formatDateTime(r.createdAt)} — {{ DRAFT: t('labels.brouillon'), SUBMITTED: t('labels.soumis'), REVIEWED: t('mission.examine') }[r.status]}
            </summary>
            <div className="prose">{r.summary}</div>
            {r.results && <p>{t('mission.resultats')}{' '}{r.results}</p>}
            {r.difficulties && <p>{t('mission.difficultes')}{' '}{r.difficulties}</p>}
            <div className="actions">
              {r.status === 'DRAFT' && r.author.id === user.id && (
                <button type="button" className="secondary" onClick={() => run(() => api(`/admin/missions/${id}/reports/${r.id}`, { method: 'PATCH', body: { submit: true } }))}>{t('mission.soumettre')}</button>
              )}
              {r.status === 'SUBMITTED' && manage && (
                <button type="button" className="secondary" onClick={() => run(() => api(`/admin/missions/${id}/reports/${r.id}`, { method: 'PATCH', body: { reviewed: true } }))}>{t('mission.marquerCommeExamine')}</button>
              )}
            </div>
          </details>
        ))}
        {(isMember || manage) && (
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault()
              const submit = e.nativeEvent.submitter?.value === 'submit'
              if (await run(() => api(`/admin/missions/${id}/reports`, { method: 'POST', body: { ...report, submit } }))) {
                setReport({ summary: '', results: '', difficulties: '' })
              }
            }}
          >
            <h3>{t('mission.nouveauRapport')}</h3>
            <label>{t('mission.synthese')}<textarea rows={4} required value={report.summary} onChange={(e) => setReport({ ...report, summary: e.target.value })} />
            </label>
            <label>{t('mission.resultats2')}<textarea rows={3} value={report.results} onChange={(e) => setReport({ ...report, results: e.target.value })} />
            </label>
            <label>{t('mission.difficultesRencontrees')}<textarea rows={2} value={report.difficulties} onChange={(e) => setReport({ ...report, difficulties: e.target.value })} />
            </label>
            <div className="actions">
              <button type="submit" value="draft" className="secondary">{t('mission.enregistrerLeBrouillon')}</button>
              <button type="submit" value="submit">{t('mission.soumettre')}</button>
            </div>
          </form>
        )}
      </section>
    </>
  )
}
