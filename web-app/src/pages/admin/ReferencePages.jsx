import { api, upload } from '../../api.js'
import { useDialog } from '../../components/Modal.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import CrudPage from '../../components/CrudPage.jsx'
import { placeLabel, useApi } from '../../components/ui.jsx'
import {
  ATTRIBUTION_LABELS,
  formatDate,
  options,
  PLACE_TYPE_LABELS,
  SOURCE_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
} from '../../labels.js'

import { t } from '../../i18n/index.js'
import { consentFields, consentTransform, personFields, sourceFields } from './referenceFields.js'

function useLookups() {
  return useApi('/admin/lookups').data ?? { places: [], communities: [], languages: [], categories: [], users: [], questionnaires: [] }
}

export function PlacesPage() {
  const { can } = useAuth()
  const { places } = useLookups()
  return (
    <CrudPage
      title={t('common.places')}
      intro={t('reference.organisationTerritorialePaysProvincesTerritoires')}
      endpoint="/admin/places"
      listKey="places"
      canEdit={can('communities.manage')}
      canDelete={can('communities.manage')}
      fields={[
        { name: 'name', label: t('common.name'), required: true },
        { name: 'type', label: t('common.type'), type: 'select', required: true, options: options(PLACE_TYPE_LABELS) },
        {
          name: 'parentId',
          label: t('reference.rattacheA'),
          type: 'select',
          options: places.map((p) => ({ value: p.id, label: `${placeLabel(p, places)} — ${PLACE_TYPE_LABELS[p.type]}` })),
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
      ]}
      columns={[
        { label: t('common.name'), value: (r) => r.name },
        { label: t('common.type'), value: (r) => PLACE_TYPE_LABELS[r.type] },
        { label: t('reference.rattacheA'), value: (r) => places.find((p) => p.id === r.parentId)?.name },
        { label: t('common.communities'), value: (r) => r._count.communities },
        { label: t('reference.fiches'), value: (r) => r._count.items },
      ]}
    />
  )
}

export function LanguagesPage() {
  const { can } = useAuth()
  const { languages } = useLookups()
  return (
    <CrudPage
      title={t('reference.langues')}
      endpoint="/admin/languages"
      listKey="languages"
      canEdit={can('communities.manage')}
      canDelete={can('communities.manage')}
      fields={[
        { name: 'name', label: t('common.name'), required: true },
        { name: 'isoCode', label: t('reference.codeIso6393'), help: t('reference.facultatifParExempleHav') },
        { name: 'parentId', label: t('reference.varianteDe'), type: 'select', options: languages.map((l) => ({ value: l.id, label: l.name })) },
        { name: 'notes', label: t('common.notes'), type: 'textarea' },
      ]}
      columns={[
        { label: t('common.name'), value: (r) => r.name },
        { label: t('reference.code'), value: (r) => r.isoCode },
        { label: t('reference.varianteDe'), value: (r) => r.parent?.name },
        { label: t('common.communities'), value: (r) => r._count.communities },
      ]}
    />
  )
}

export function SourcesPage() {
  const { can } = useAuth()
  return (
    <CrudPage
      title={t('common.sources')}
      intro={t('reference.registreDesSourcesLivresArticles')}
      endpoint="/admin/sources?pageSize=100"
      listKey="sources"
      canEdit={can('sources.manage')}
      canDelete={can('sources.manage')}
      fields={sourceFields()}
      columns={[
        { label: t('common.title'), value: (r) => r.title },
        { label: t('common.type'), value: (r) => SOURCE_TYPE_LABELS[r.type] },
        { label: t('common.author'), value: (r) => r.author },
        { label: t('common.status'), value: (r) => SOURCE_STATUS_LABELS[r.status] },
        { label: t('reference.fiches'), value: (r) => r._count.items },
      ]}
    />
  )
}

export function PersonsPage() {
  const { communities } = useLookups()
  return (
    <CrudPage
      title={t('reference.personnesRessources')}
      intro={t('reference.donneesPersonnellesConfidentiellesEllesNe')}
      endpoint="/admin/persons"
      listKey="persons"
      canDelete
      fields={personFields(communities)}
      columns={[
        { label: t('common.name'), value: (r) => r.fullName },
        { label: t('reference.attribution'), value: (r) => `${ATTRIBUTION_LABELS[r.attributionMode]}${r.publicName ? ` : ${r.publicName}` : ''}` },
        { label: t('common.community'), value: (r) => r.community?.name },
        { label: t('reference.mineur'), value: (r) => (r.isMinor ? t('reference.oui') : t('reference.non')) },
      ]}
    />
  )
}


export function ConsentsPage() {
  const dialog = useDialog()
  const persons = useApi('/admin/persons').data?.persons ?? []
  const missions = useApi('/admin/missions').data?.missions ?? []
  return (
    <CrudPage
      title={t('reference.consentements')}
      intro={t('reference.chaqueDroitEstEnregistreSeparement')}
      endpoint="/admin/consents"
      listKey="consents"
      fields={consentFields(persons, missions)}
      transform={consentTransform}
      columns={[
        { label: t('reference.personne'), value: (r) => r.resourcePerson?.fullName ?? '—' },
        { label: t('reference.recueilliLe'), value: (r) => formatDate(r.collectedAt) },
        { label: t('reference.publication'), value: (r) => (r.canPublish ? t('reference.autorisee') : t('reference.non')) },
        {
          label: t('reference.etat'),
          render: (r) =>
            r.revokedAt ? (
              <span className="error">{t('reference.revoque')}</span>
            ) : r.publicationProblems.length ? (
              <span title={r.publicationProblems.join(' ; ')}>{t('reference.nonPubliable')}</span>
            ) : (
              <span className="ok">{t('reference.valide')}</span>
            ),
          value: (r) => (r.revokedAt ? t('reference.revoque') : ''),
        },
        { label: t('reference.document'), value: (r) => (r.documentFile ? t('reference.oui') : t('reference.non')) },
      ]}
      extraActions={(r, { reload, setError }) => (
        <>
          {!r.documentFile && (
            <label className="button secondary file-button">{t('reference.joindreLeDocument')}<input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
                hidden
                onChange={async (e) => {
                  const file = e.target.files[0]
                  if (!file) return
                  const form = new FormData()
                  form.append('file', file)
                  try {
                    await upload(`/admin/consents/${r.id}/document`, form)
                    reload()
                  } catch (err) {
                    setError(err)
                  }
                }}
              />
            </label>
          )}
          {r.documentFile && (
            <a className="button secondary" href={`/api/admin/consents/${r.id}/document`}>{t('reference.document')}</a>
          )}
          {!r.revokedAt && (
            <button
              type="button"
              className="secondary danger"
              onClick={async () => {
                const reason = await dialog.prompt({
                  title: t('reference.revoquerLeConsentement'),
                  message: t('reference.lesFichesPublieesQuiEn'),
                  label: t('reference.motifDeLaRevocation'),
                  confirmLabel: t('reference.revoquer'),
                  danger: true,
                })
                if (!reason) return
                try {
                  const res = await api(`/admin/consents/${r.id}/revoke`, { method: 'POST', body: { reason } })
                  if (res.suspendedItems.length) {
                    await dialog.confirm({
                      title: t('reference.consentementRevoque'),
                      message: t('reference.ficheSPublieeSOnt', { 0: res.suspendedItems.length }),
                      confirmLabel: t('reference.compris'),
                    })
                  }
                  reload()
                } catch (err) {
                  setError(err)
                }
              }}
            >{t('reference.revoquer')}</button>
          )}
        </>
      )}
    />
  )
}

export function QuestionnairesPage() {
  const { can } = useAuth()
  const { categories } = useLookups()
  return (
    <CrudPage
      title={t('reference.questionnairesDeCollecte')}
      intro={t('reference.questionnairesGenerauxEtSpecialisesA')}
      endpoint="/admin/questionnaires"
      listKey="questionnaires"
      canEdit={can('missions.manage')}
      fields={[
        { name: 'title', label: t('common.title'), required: true },
        { name: 'description', label: t('common.description'), type: 'textarea', rows: 2 },
        { name: 'categoryId', label: t('reference.categorieConcernee'), type: 'select', options: categories.map((c) => ({ value: c.id, label: c.name })) },
        { name: 'questions', label: t('reference.questionsUneParLigne'), type: 'lines', required: true, rows: 12 },
        { name: 'isActive', label: t('reference.actif'), type: 'checkbox', default: true },
      ]}
      columns={[
        { label: t('common.title'), value: (r) => r.title },
        { label: t('common.category'), value: (r) => r.category?.name },
        { label: t('reference.questions'), value: (r) => r.questions.length },
        { label: t('reference.actif'), value: (r) => (r.isActive ? t('reference.oui') : t('reference.non')) },
      ]}
      extraActions={(r) => (
        <details>
          <summary>{t('common.view')}</summary>
          <ol className="questions">
            {r.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </details>
      )}
    />
  )
}
