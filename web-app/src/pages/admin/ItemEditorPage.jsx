import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, errorText } from '../../api.js'
import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Plus, Save, Send, Upload } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { MediaUploadModal, QuickCreateModal } from '../../components/admin/QuickCreate.jsx'
import { useToast } from '../../components/Toast.jsx'
import { ErrorMessage, Loading, MultiSelect, placeLabel, useApi } from '../../components/ui.jsx'
import { ACCESS_LABELS, DATE_KIND_LABELS, MEDIA_KIND_LABELS, VERIFICATION_LABELS } from '../../labels.js'
import { t } from '../../i18n/index.js'
import { personFields, sourceFields } from './referenceFields.js'
import { completenessChecks, EDITABLE_BY_AUTHOR, EDITOR_STEPS, LEVEL_LABELS } from './workflow.js'

const empty = {
  title: '',
  originalTitle: '',
  summary: '',
  body: '',
  keywords: '',
  categoryId: '',
  originalLanguageId: '',
  dateKind: 'UNKNOWN',
  dateValue: '',
  dateEnd: '',
  verificationStatus: 'INCOMPLETE',
  accessLevel: 'PRIVATE',
  isSensitive: false,
  resourcePersonId: '',
  missionId: '',
  communityIds: [],
  placeIds: [],
  sources: [],
  media: [],
  consentIds: [],
  fields: {},
  reason: '',
  publicNote: '',
}

function fromItem(item) {
  const form = { ...empty }
  for (const key of Object.keys(empty)) if (item[key] !== undefined && item[key] !== null) form[key] = item[key]
  form.communityIds = item.communities.map((c) => c.communityId)
  form.placeIds = item.places.map((p) => p.placeId)
  form.sources = item.sources.map((s) => ({ sourceId: s.sourceId, supports: s.supports ?? '', locator: s.locator ?? '' }))
  form.media = item.media.map((m) => ({ mediaId: m.mediaId, caption: m.caption ?? '' }))
  form.consentIds = item.consents.map((c) => c.consentId)
  form.fields = item.fields ?? {}
  form.reason = ''
  form.publicNote = ''
  return form
}

// Formulaire de documentation d'un élément culturel, en parcours guidé :
// communauté → informations → sources, témoignages et médias → diffusion →
// vérification et soumission. Sources, personnes et médias
// peuvent être créés sur place, sans quitter la fiche.
export default function ItemEditorPage() {
  const { id } = useParams()
  const isNew = id === undefined
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { can } = useAuth()
  const lookups = useApi('/admin/lookups').data
  const sourcesApi = useApi('/admin/sources?pageSize=100')
  const mediaApi = useApi('/admin/media?pageSize=100')
  const personsApi = useApi(can('persons.manage') ? '/admin/persons' : null)
  const missions = useApi(can('missions.manage') || can('missions.participate') ? '/admin/missions' : null).data?.missions ?? []
  const sources = sourcesApi.data?.sources ?? []
  const media = mediaApi.data?.media ?? []
  const persons = personsApi.data?.persons ?? []
  const existing = useApi(isNew ? null : `/admin/items/${id}`)
  const prefillCommunity = params.get('communaute')
  const [form, setForm] = useState(isNew ? { ...empty, communityIds: prefillCommunity ? [prefillCommunity] : [] } : null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const initialStep = Math.max(0, EDITOR_STEPS.findIndex((s) => s.key === params.get('etape')))
  const [step, setStep] = useState(initialStep)
  const [fieldErrors, setFieldErrors] = useState({})
  const [modal, setModal] = useState(null)
  const toast = useToast()

  useEffect(() => {
    if (existing.data) setForm(fromItem(existing.data.item))
  }, [existing.data])

  if (!lookups || !form) return <Loading loading error={existing.error} />

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const category = lookups.categories.find((c) => c.id === form.categoryId)
  const item = existing.data?.item
  const wasPublished = item?.publishedVersionId
  // La soumission n'est proposée que tant que l'auteur prépare sa fiche.
  const canSubmit = isNew || (EDITABLE_BY_AUTHOR.includes(item.status) && existing.data.transitions.some((tx) => tx.status === 'SUBMITTED'))
  const checks = completenessChecks(form)
  const blockingMissing = checks.filter((c) => c.blocking && !c.ok)
  const stepState = (key) => {
    const own = checks.filter((c) => c.step === key)
    if (!own.length) return 'neutral'
    if (own.some((c) => c.blocking && !c.ok)) return 'todo'
    return own.every((c) => c.ok) ? 'done' : 'partial'
  }
  const goTo = (key) => setStep(EDITOR_STEPS.findIndex((s) => s.key === key))

  // Validation des champs obligatoires, avec retour à l'étape concernée.
  async function save(submit) {
    setError(null)
    const missing = {}
    if (!form.title.trim()) missing.title = t('itemEditor.leTitrePrincipalEstObligatoire')
    if (!form.categoryId) missing.categoryId = t('itemEditor.choisissezUneCategorie')
    setFieldErrors(missing)
    if (Object.keys(missing).length) {
      goTo('infos')
      return
    }
    setSaving(true)
    const clean = (v) => (v === '' ? null : v)
    const fields = {}
    for (const def of category?.fieldsSchema ?? []) {
      const value = form.fields[def.key]
      if (value === undefined || value === '') continue
      fields[def.key] = def.type === 'list' ? (Array.isArray(value) ? value : String(value).split('\n')).map((s) => s.trim()).filter(Boolean) : value
    }
    const body = {
      ...form,
      originalLanguageId: clean(form.originalLanguageId),
      resourcePersonId: clean(form.resourcePersonId),
      missionId: clean(form.missionId),
      fields,
      sources: form.sources.filter((s) => s.sourceId).map((s) => ({ ...s, supports: clean(s.supports), locator: clean(s.locator) })),
      media: form.media.filter((m) => m.mediaId).map((m, position) => ({ ...m, position, caption: clean(m.caption) })),
    }
    if (!can('persons.manage')) delete body.resourcePersonId
    // Consentements retirés : on ne touche plus aux liens existants.
    delete body.consentIds
    let saved
    try {
      const res = isNew
        ? await api('/admin/items', { method: 'POST', body })
        : await api(`/admin/items/${id}`, { method: 'PATCH', body })
      saved = res.item
    } catch (err) {
      setError(err)
      setSaving(false)
      return
    }
    if (submit) {
      try {
        await api(`/admin/items/${saved.id}/transitions`, { method: 'POST', body: { toStatus: 'SUBMITTED' } })
        toast.success(t('ws.ficheSoumise'))
      } catch (err) {
        toast.error(`${t('ws.ficheEnregistreeNonSoumise')} ${errorText(err)}`)
      }
    } else {
      toast.success(isNew ? t('itemEditor.ficheCreee') : t('itemEditor.nouvelleVersionEnregistree'))
    }
    setSaving(false)
    navigate(`/admin/fiches/${saved.id}`)
  }

  const currentStep = Math.min(step, EDITOR_STEPS.length - 1)
  const currentKey = EDITOR_STEPS[currentStep].key
  const show = (key) => (currentKey === key ? undefined : { display: 'none' })

  const setSource = (i, patch) => set({ sources: form.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const setMedia = (i, patch) => set({ media: form.media.map((m, j) => (j === i ? { ...m, ...patch } : m)) })

  // Après une création sur place : ajout à la liste et association à la fiche.
  const created = {
    source: (source) => {
      sourcesApi.setData((d) => ({ ...d, sources: [source, ...(d?.sources ?? [])] }))
      set({ sources: [...form.sources.filter((s) => s.sourceId), { sourceId: source.id, supports: '', locator: '' }] })
    },
    person: (person) => {
      personsApi.setData((d) => ({ ...d, persons: [person, ...(d?.persons ?? [])] }))
      set({ resourcePersonId: person.id })
    },
    media: (asset) => {
      mediaApi.setData((d) => ({ ...d, media: [asset, ...(d?.media ?? [])] }))
      set({ media: [...form.media.filter((m) => m.mediaId), { mediaId: asset.id, caption: '' }] })
    },
  }
  const closeModal = () => setModal(null)
  const afterCreate = (kind) => (record) => {
    created[kind](record)
    setModal(null)
    toast.success(t('ws.elementCreeEtAssocie'))
  }

  return (
    <>
      <p>
        <Link to={isNew ? '/admin/fiches' : `/admin/fiches/${id}`}>{t('itemEditor.retour')}</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>{isNew ? t('itemEditor.nouvelleFicheCulturelle') : t('itemEditor.modifier', { 0: item.title })}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('ws.editeurIntro')}</p>
        </div>
      </div>
      {wasPublished && <p className="notice">{t('itemEditor.cetteFicheEstEnLigne')}</p>}
      <ol className="stepper" aria-label={t('itemEditor.etapesDuFormulaire')}>
        {EDITOR_STEPS.map(({ key, label }, i) => {
          const state = stepState(key)
          return (
            <li key={key}>
              <button type="button" className={`${i === currentStep ? 'current' : ''} ${state}`} aria-current={i === currentStep ? 'step' : undefined} onClick={() => setStep(i)}>
                <span className="step-number">{state === 'done' && i !== currentStep ? <Check size={14} aria-hidden="true" /> : i + 1}</span>
                <span className="step-label">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <form className="form" onSubmit={(e) => (e.preventDefault(), save(false))} noValidate>
        <section className="card" style={show('communaute')}>
          <h2>{t('ws.etape.communaute')}</h2>
          <p className="muted small">{t('ws.aideCommunaute')}</p>
          <MultiSelect
            label={t('itemEditor.communautesConcernees')}
            options={lookups.communities.map((c) => ({ value: c.id, label: c.name }))}
            value={form.communityIds}
            onChange={(communityIds) => set({ communityIds })}
          />
          {can('communities.manage') && (
            <p className="small">
              <Link to="/admin/communautes/nouvelle" target="_blank" rel="noreferrer">{t('ws.creerUneCommunaute')}</Link>
            </p>
          )}
          <MultiSelect
            label={t('itemEditor.lieuxDocumentes')}
            options={lookups.places.map((p) => ({ value: p.id, label: placeLabel(p, lookups.places) }))}
            value={form.placeIds}
            onChange={(placeIds) => set({ placeIds })}
          />
          <div className="grid-2">
            <label>{t('itemEditor.langueOriginale')}<select value={form.originalLanguageId ?? ''} onChange={(e) => set({ originalLanguageId: e.target.value })}>
                <option value="">—</option>
                {lookups.languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>{t('itemEditor.dateOuPeriodeDeReference')}<select value={form.dateKind} onChange={(e) => set({ dateKind: e.target.value })}>
                {Object.entries(DATE_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {form.dateKind !== 'UNKNOWN' && (
              <label>
                {form.dateKind === 'PERIOD' ? t('governance.debut') : t('common.date')}
                <input value={form.dateValue ?? ''} placeholder={t('itemEditor.ex1958OuAnnees1920')} onChange={(e) => set({ dateValue: e.target.value })} />
              </label>
            )}
            {form.dateKind === 'PERIOD' && (
              <label>{t('itemEditor.fin')}<input value={form.dateEnd ?? ''} onChange={(e) => set({ dateEnd: e.target.value })} />
              </label>
            )}
          </div>
        </section>

        <section className="card" style={show('infos')}>
          <h2>{t('ws.etape.infos')}</h2>
          <label>{t('itemEditor.titrePrincipal')}<input required value={form.title} aria-invalid={Boolean(fieldErrors.title)} onChange={(e) => set({ title: e.target.value })} />
            {fieldErrors.title && <small className="field-error">{fieldErrors.title}</small>}
          </label>
          <label>{t('itemEditor.titreOriginalLangueLocale')}<input value={form.originalTitle} onChange={(e) => set({ originalTitle: e.target.value })} />
          </label>
          <label>{t('common.category')}<select required value={form.categoryId} aria-invalid={Boolean(fieldErrors.categoryId)} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">{t('common.choose')}</option>
              {lookups.categories
                .filter((c) => c.isActive || c.id === form.categoryId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code}. ` : ''}
                    {c.name}
                  </option>
                ))}
            </select>
            {fieldErrors.categoryId && <small className="field-error">{fieldErrors.categoryId}</small>}
            <small className="muted">
              <Link to="/admin/categories" target="_blank" rel="noreferrer">{t('ws.voirLesCategories')}</Link>
            </small>
          </label>
          <label>{t('common.summary')}<textarea rows={3} required value={form.summary} onChange={(e) => set({ summary: e.target.value })} />
            <small className="muted">{t('ws.aideResume')}</small>
          </label>
          <label>{t('itemEditor.descriptionDetaillee')}<textarea rows={14} value={form.body} onChange={(e) => set({ body: e.target.value })} />
            <small className="muted">{t('itemEditor.separezLesSectionsParUne')}</small>
          </label>
          <label>{t('itemEditor.motsClesSeparesParDes')}<input value={form.keywords} onChange={(e) => set({ keywords: e.target.value })} />
          </label>

          {/* Champs propres à la catégorie choisie (recette, danse, conte…). */}
          {category?.fieldsSchema.length > 0 && (
            <fieldset className="subsection">
              <legend>{t('itemEditor.champsSpecifiques')}{' '}{category.name}</legend>
              {category.fieldsSchema.map((def) => {
                const value = form.fields[def.key] ?? (def.type === 'list' ? [] : '')
                const setValue = (v) => set({ fields: { ...form.fields, [def.key]: v } })
                return (
                  <label key={def.key}>
                    {def.label}
                    {def.type === 'text' && <input value={value} onChange={(e) => setValue(e.target.value)} />}
                    {def.type === 'longtext' && <textarea rows={4} value={value} onChange={(e) => setValue(e.target.value)} />}
                    {def.type === 'list' && (
                      <>
                        <textarea rows={5} value={Array.isArray(value) ? value.join('\n') : value} onChange={(e) => setValue(e.target.value.split('\n'))} />
                        <small className="muted">{t('itemEditor.unElementParLigne')}</small>
                      </>
                    )}
                  </label>
                )
              })}
            </fieldset>
          )}
        </section>

        <div style={show('sources')}>
          <section className="card">
            <h2>{t('itemEditor.sourcesEtVerification')}</h2>
            <p className="muted small">{t('ws.aideSources')}</p>
            <label>{t('itemEditor.statutDeLInformation')}<select value={form.verificationStatus} onChange={(e) => set({ verificationStatus: e.target.value })}>
                {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {form.sources.map((s, i) => (
              <div key={i} className="row-editor">
                <select aria-label={t('itemEditor.source')} required value={s.sourceId} onChange={(e) => setSource(i, { sourceId: e.target.value })}>
                  <option value="">{t('itemEditor.choisirUneSource')}</option>
                  {sources.map((src) => (
                    <option key={src.id} value={src.id}>
                      {src.title}
                    </option>
                  ))}
                </select>
                <input aria-label={t('itemEditor.ceQueLaSourceEtaye')} placeholder={t('itemEditor.ceQueLaSourceEtaye')} value={s.supports} onChange={(e) => setSource(i, { supports: e.target.value })} />
                <input aria-label={t('itemEditor.pageOuMinutage')} placeholder={t('itemEditor.pageMinutage')} value={s.locator} onChange={(e) => setSource(i, { locator: e.target.value })} />
                <button type="button" className="secondary danger" onClick={() => set({ sources: form.sources.filter((_, j) => j !== i) })}>{t('common.remove')}</button>
              </div>
            ))}
            <div className="actions">
              <button type="button" className="secondary" onClick={() => set({ sources: [...form.sources, { sourceId: '', supports: '', locator: '' }] })}>
                <Plus size={16} className="icon" aria-hidden="true" />{t('ws.associerUneSourceExistante')}</button>
              {can('sources.manage') && (
                <button type="button" className="secondary" onClick={() => setModal('source')}>
                  <Plus size={16} className="icon" aria-hidden="true" />{t('ws.nouvelleSource')}</button>
              )}
            </div>
          </section>

          {(can('persons.manage') || missions.length > 0) && (
            <section className="card">
              <h2>{t('ws.temoignagesEtConsentements')}</h2>
              <p className="muted small">{t('ws.aideTemoignages')}</p>
              {can('persons.manage') && (
                <div className="field-with-action">
                  <label>{t('itemEditor.personneRessource')}<select value={form.resourcePersonId ?? ''} onChange={(e) => set({ resourcePersonId: e.target.value })}>
                      <option value="">—</option>
                      {persons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="secondary" onClick={() => setModal('person')}>
                    <Plus size={16} className="icon" aria-hidden="true" />{t('ws.nouvellePersonne')}</button>
                </div>
              )}
              {missions.length > 0 && (
                <label>{t('itemEditor.missionDeCollecte')}<select value={form.missionId ?? ''} onChange={(e) => set({ missionId: e.target.value })}>
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
          )}

          <section className="card">
            <h2>{t('itemEditor.mediasAssocies')}</h2>
            <p className="muted small">{t('ws.aideMedias')}</p>
            {form.media.map((m, i) => (
              <div key={i} className="row-editor">
                <select aria-label={t('itemEditor.media')} required value={m.mediaId} onChange={(e) => setMedia(i, { mediaId: e.target.value })}>
                  <option value="">{t('itemEditor.choisirUnMedia')}</option>
                  {media.map((md) => (
                    <option key={md.id} value={md.id}>
                      {MEDIA_KIND_LABELS[md.kind]} — {md.title}
                    </option>
                  ))}
                </select>
                <input aria-label={t('itemEditor.legende')} placeholder={t('itemEditor.legende')} value={m.caption} onChange={(e) => setMedia(i, { caption: e.target.value })} />
                <button type="button" className="secondary danger" onClick={() => set({ media: form.media.filter((_, j) => j !== i) })}>{t('common.remove')}</button>
              </div>
            ))}
            <div className="actions">
              <button type="button" className="secondary" onClick={() => set({ media: [...form.media, { mediaId: '', caption: '' }] })}>
                <Plus size={16} className="icon" aria-hidden="true" />{t('ws.associerUnMediaExistant')}</button>
              {can('files.upload') && (
                <button type="button" className="secondary" onClick={() => setModal('media')}>
                  <Upload size={16} className="icon" aria-hidden="true" />{t('ws.televerserUnFichier')}</button>
              )}
            </div>
          </section>
        </div>

        <section className="card" style={show('diffusion')}>
          <h2>{t('itemEditor.diffusion')}</h2>
          <label>{t('itemEditor.niveauDAcces')}<select value={form.accessLevel} onChange={(e) => set({ accessLevel: e.target.value })}>
              {Object.entries(ACCESS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small className="muted">{t('itemEditor.seulLeNiveauPublicPermet')}</small>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={form.isSensitive} onChange={(e) => set({ isSensitive: e.target.checked })} />{t('itemEditor.contenuSensibleOuSoumisA')}</label>
          {!isNew && (
            <fieldset className="subsection">
              <legend>{t('itemEditor.motifDeLaModification')}</legend>
              <label>{t('itemEditor.motifHistoriqueInterne')}<input value={form.reason} onChange={(e) => set({ reason: e.target.value })} placeholder={t('itemEditor.exAjoutDUneVariante')} />
              </label>
              <label>{t('itemEditor.notePubliqueFacultativeAfficheeDans')}<input value={form.publicNote} onChange={(e) => set({ publicNote: e.target.value })} />
              </label>
            </fieldset>
          )}
        </section>

        <section className="card" style={show('verifier')}>
          <h2>{t('ws.etape.verifier')}</h2>
          <p className="muted small">{t('ws.aideVerifier')}</p>
          <ul className="checklist">
            {checks.map((c) => (
              <li key={c.key} className={c.ok ? 'ok' : c.level === 'submit' ? 'todo' : c.level === 'publish' ? 'publish' : 'optional'}>
                {c.ok ? <CheckCircle2 size={18} className="icon" aria-hidden="true" /> : c.level !== 'recommended' ? <AlertCircle size={18} className="icon" aria-hidden="true" /> : <Circle size={18} className="icon" aria-hidden="true" />}
                <span>
                  {c.label}
                  {!c.ok && <small className="muted"> — {LEVEL_LABELS[c.level]}</small>}
                </span>
                {!c.ok && (
                  <button type="button" className="link-button" onClick={() => goTo(c.step)}>{t('ws.completer')}</button>
                )}
              </li>
            ))}
          </ul>
          <p className="muted small">{t('ws.apresEnregistrementTraductions')}</p>
          {canSubmit && blockingMissing.length > 0 && <p className="notice warning">{t('ws.soumissionImpossible')}</p>}
        </section>

        <ErrorMessage error={error} />
        <div className="form-footer">
          <button type="button" className="secondary" disabled={currentStep === 0} onClick={() => setStep(currentStep - 1)}>
            <ChevronLeft size={16} className="icon" aria-hidden="true" />{t('common.previous')}</button>
          <span className="small muted">{t('itemEditor.etape')}{' '}{currentStep + 1}{' '}{t('itemEditor.sur')}{' '}{EDITOR_STEPS.length}
          </span>
          <div className="actions">
            {currentStep < EDITOR_STEPS.length - 1 && (
              <button type="button" className="secondary" onClick={() => setStep(currentStep + 1)}>{t('common.next')}<ChevronRight size={16} className="icon" aria-hidden="true" />
              </button>
            )}
            <button type="submit" className={currentKey === 'verifier' && canSubmit ? 'secondary' : ''} disabled={saving}>
              <Save size={16} className="icon" aria-hidden="true" />
              {saving ? t('crud.enregistrement') : canSubmit ? t('ws.enregistrerLeBrouillon') : t('common.save')}
            </button>
            {currentKey === 'verifier' && canSubmit && (
              <button type="button" disabled={saving || blockingMissing.length > 0} onClick={() => save(true)}>
                <Send size={16} className="icon" aria-hidden="true" />{t('ws.enregistrerEtSoumettre')}</button>
            )}
          </div>
        </div>
      </form>

      {modal === 'source' && (
        <QuickCreateModal title={t('ws.nouvelleSource')} intro={t('reference.registreDesSourcesLivresArticles')} fields={sourceFields()} endpoint="/admin/sources" responseKey="source" onCreated={afterCreate('source')} onClose={closeModal} />
      )}
      {modal === 'person' && (
        <QuickCreateModal
          title={t('ws.nouvellePersonne')}
          intro={t('reference.donneesPersonnellesConfidentiellesEllesNe')}
          fields={personFields(lookups.communities, form.communityIds[0])}
          endpoint="/admin/persons"
          responseKey="person"
          onCreated={afterCreate('person')}
          onClose={closeModal}
        />
      )}
      {modal === 'media' && <MediaUploadModal onUploaded={afterCreate('media')} onClose={closeModal} />}
    </>
  )
}
