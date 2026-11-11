import { useEffect, useState } from 'react'
import { api, translateServerMessage } from '../../api.js'
import { TableWrap } from '../../components/ui.jsx'
import { locale, t } from '../../i18n/index.js'

const ACTION_LABELS = {
  AUTH_LOGIN: t('audit.connexion'),
  AUTH_LOGOUT: t('audit.deconnexion'),
  AUTH_LOGIN_FAILED: t('audit.echecDeConnexion'),
  AUTH_ACCOUNT_LOCKED: t('audit.compteVerrouille'),
  AUTH_PASSWORD_CHANGED: t('audit.motDePasseChange'),
  USER_CREATED: t('audit.compteCree'),
  USER_UPDATED: t('audit.compteModifie'),
  USER_ROLES_CHANGED: t('audit.rolesModifies'),
  USER_DEACTIVATED: t('audit.compteDesactive'),
  USER_REACTIVATED: t('audit.compteReactive'),
  USER_PASSWORD_RESET: t('audit.motDePasseReinitialise'),
  USER_SESSIONS_REVOKED: t('audit.sessionsRevoquees'),
  ITEM_CREATED: t('audit.ficheCreee'),
  ITEM_UPDATED: t('audit.ficheModifiee'),
  ITEM_STATUS_CHANGED: t('audit.etapeDeValidation'),
  ITEM_PUBLISHED: t('audit.fichePubliee'),
  ITEM_ACCESS_CHANGED: t('audit.niveauDAccesModifie'),
  ITEM_ACCESS_GRANTED: t('audit.accesNominatifAccorde'),
  ITEM_ACCESS_REVOKED: t('audit.accesNominatifRetire'),
  ITEM_COMMENTED: t('labels.commentaire'),
  ITEM_RELATION_ADDED: t('audit.relationAjoutee'),
  ITEM_RELATION_REMOVED: t('audit.relationRetiree'),
  ITEM_SCHEDULE_FAILED: t('audit.publicationProgrammeeAnnulee'),
  MEDIA_UPLOADED: t('audit.mediaTeleverse'),
  MEDIA_UPDATED: t('audit.mediaModifie'),
  MEDIA_ACCESS_CHANGED: t('audit.accesAuMediaModifie'),
  MEDIA_ORIGINAL_ACCESSED: t('audit.originalConsulte'),
  MEDIA_INTEGRITY_CHECKED: t('audit.integriteDuMediaControlee'),
  CONSENT_CREATED: t('audit.consentementEnregistre'),
  CONSENT_UPDATED: t('audit.consentementModifie'),
  CONSENT_REVOKED: t('reference.consentementRevoque'),
  CONSENT_DOCUMENT_ADDED: t('audit.documentDeConsentementJoint'),
  PERSON_CREATED: t('audit.personneRessourceCreee'),
  PERSON_UPDATED: t('audit.personneRessourceModifiee'),
  TEXT_CREATED: t('audit.texteCree'),
  TEXT_REVISED: t('audit.texteRevise'),
  TEXT_VERIFIED: t('audit.texteVerifie'),
  COMMUNITY_CREATED: t('audit.communauteCreee'),
  COMMUNITIES_IMPORTED: t('import.auditImport'),
  COMMUNITY_UPDATED: t('audit.communauteModifiee'),
  COMMUNITY_PUBLISHED: t('audit.communautePubliee'),
  COMMUNITY_UNPUBLISHED: t('audit.communauteRetireeDuSite'),
  MISSION_CREATED: t('audit.missionCreee'),
  MISSION_UPDATED: t('audit.missionModifiee'),
  MISSION_CLOSED: t('audit.missionCloturee'),
  TAKEDOWN_RECEIVED: t('audit.signalementRecu'),
  TAKEDOWN_UPDATED: t('audit.signalementTraite'),
  TAKEDOWN_CONTENT_SUSPENDED: t('audit.contenuSuspenduSignalement'),
  ROLE_PERMISSIONS_CHANGED: t('audit.permissionsModifiees'),
  ROLE_PERMISSIONS_RESET: t('audit.permissionsReinitialisees'),
  BACKUP_CREATED: t('audit.sauvegarde'),
  BACKUP_RESTORE_TESTED: t('audit.testDeRestauration'),
  INTEGRITY_CHECKED: t('audit.controleDIntegrite'),
  EXPORT_FULL: t('audit.exportComplet'),
  SEED_APPLIED: t('audit.donneesDeReference'),
  PLACE_CREATED: t('audit.lieuCree'),
  PLACE_UPDATED: t('audit.lieuModifie'),
  PLACE_DELETED: t('audit.lieuSupprime'),
  LANGUAGE_CREATED: t('audit.langueCreee'),
  LANGUAGE_UPDATED: t('audit.langueModifiee'),
  LANGUAGE_DELETED: t('audit.langueSupprimee'),
  CATEGORY_CREATED: t('audit.categorieCreee'),
  CATEGORY_UPDATED: t('audit.categorieModifiee'),
  CATEGORY_DELETED: t('audit.categorieSupprimee'),
  SOURCE_CREATED: t('audit.sourceCreee'),
  SOURCE_UPDATED: t('audit.sourceModifiee'),
  SOURCE_DELETED: t('audit.sourceSupprimee'),
  PERSON_DELETED: t('audit.personneSupprimee'),
  COMMUNITY_DELETED: t('audit.communauteSupprimee'),
  MISSION_MEMBER_ADDED: t('audit.membreAjoute'),
  MISSION_MEMBER_REMOVED: t('audit.membreRetire'),
  MISSION_PERSON_ADDED: t('audit.personneAjouteeMission'),
  FIELD_NOTE_ADDED: t('audit.noteDeTerrain'),
  MISSION_REPORT_DRAFTED: t('audit.rapportBrouillon'),
  MISSION_REPORT_SUBMITTED: t('audit.rapportSoumis'),
  MISSION_REPORT_REVIEWED: t('audit.rapportExamine'),
  QUESTIONNAIRE_CREATED: t('audit.questionnaireCree'),
  QUESTIONNAIRE_UPDATED: t('audit.questionnaireModifie'),
  TEXT_VISIBILITY_CHANGED: t('audit.visibiliteTexte'),
  REFERENCE_CHANGED: t('audit.etapeFormulaire'),
  DOSSIER_CREATED: t('audit.dossierCree'),
  DOSSIER_STATUS_CHANGED: t('audit.dossierStatut'),
  DOSSIER_SECTION_REVIEWED: t('audit.dossierEtape'),
  DOSSIER_PUBLISHED: t('audit.dossierPublie'),
}

const PAGE_SIZE = 50

export default function AuditPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api(`/audit?page=${page}&pageSize=${PAGE_SIZE}`)
      .then(setData)
      .catch((err) => setError(translateServerMessage(err.message)))
  }, [page])

  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <>
      <h1>{t('audit.journalDAudit')}</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data && (
        <section className="card">
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">N°</th>
                  <th scope="col">{t('common.date')}</th>
                  <th scope="col">{t('audit.action')}</th>
                  <th scope="col">{t('common.author')}</th>
                  <th scope="col">{t('audit.cible')}</th>
                  <th scope="col">{t('audit.details')}</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.id}</td>
                    <td>{new Date(e.createdAt).toLocaleString(locale())}</td>
                    <td>{ACTION_LABELS[e.action] ?? e.action}</td>
                    <td>{e.actor?.displayName ?? '—'}</td>
                    <td>{e.entityType ? `${e.entityType} ${e.entityId?.slice(0, 8)}` : '—'}</td>
                    <td>{e.details ? <code>{JSON.stringify(e.details)}</code> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <div className="pagination">
            <button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('common.previous')}</button>
            <span>{t('audit.page')}{' '}{page} / {pageCount} — {data.total}{' '}{t('audit.entrees')}</span>
            <button type="button" className="secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>{t('common.next')}</button>
          </div>
        </section>
      )}
    </>
  )
}
