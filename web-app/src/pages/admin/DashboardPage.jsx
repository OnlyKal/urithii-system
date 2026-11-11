import { AlertCircle, Archive, ArrowRight, FolderPlus, BookOpen, CheckCircle2, Clock, FileText, Globe2, Image, Languages, Map, MessageSquareQuote, MessageSquareWarning, PencilLine, ScrollText, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext.jsx'
import { EmptyState, Loading, StatusBadge, useApi } from '../../components/ui.jsx'
import { formatDateTime } from '../../labels.js'
import { roleLabel } from '../../roles.js'
import { t } from '../../i18n/index.js'
import { countFor, EDITABLE_BY_AUTHOR } from './workflow.js'
import { DossierTable } from './dossier/DossierListPage.jsx'

const STATS = [
  ['communities', t('dashboard.communautesDocumentees'), Users],
  ['items', t('items.fichesCulturelles'), FileText],
  ['itemsPublished', t('dashboard.fichesPubliees'), CheckCircle2],
  ['itemsPending', t('dashboard.fichesEnCoursDeValidation'), Clock],
  ['itemsToRevise', t('dashboard.fichesACompleterOuEn'), PencilLine],
  ['testimonies', t('collections.temoignages'), MessageSquareQuote],
  ['media', t('dashboard.mediasArchives'), Image],
  ['transcriptions', t('dashboard.transcriptions'), ScrollText],
  ['translations', t('dashboard.traductions'), Languages],
  ['textsUnverified', t('dashboard.textesNonVerifies'), BookOpen],
  ['missionsActive', t('dashboard.missionsEnCours'), Map],
]

// Files du circuit de validation, avec les statuts qu'elles comptent
// (voir server-app/src/routes/admin/dashboard.js).
const QUEUES = {
  myToComplete: [t('dashboard.mesFichesACompleter'), 'corrections', 'NEEDS_COMPLETION', true],
  documentReview: [t('dashboard.verificationDocumentaire'), 'a-traiter', 'SUBMITTED,IN_DOCUMENT_REVIEW,AWAITING_AUTHORIZATION'],
  transcription: [t('labels.enTranscription'), 'a-traiter', 'IN_TRANSCRIPTION'],
  translation: [t('labels.enTraduction'), 'a-traiter', 'IN_TRANSLATION'],
  culturalReview: [t('dashboard.validationCulturelle'), 'a-traiter', 'IN_CULTURAL_REVIEW'],
  editorialReview: [t('dashboard.validationEditoriale'), 'a-traiter', 'IN_EDITORIAL_REVIEW'],
  toPublish: [t('dashboard.aPublier'), 'a-traiter', 'VALIDATED'],
}
const queueLink = ([, view, status, mine]) => `/admin/fiches?vue=${view}&status=${status}${mine ? '&mine=1' : ''}`

// Grandes étapes de la vie d'une fiche, de la collecte à la publication.
const PIPELINE = [
  ['brouillons', t('ws.brouillons'), ['DRAFT', 'IN_PREPARATION']],
  ['corrections', t('ws.correctionsDemandees'), ['NEEDS_COMPLETION', 'UNDER_REVISION']],
  ['en-validation', t('ws.enValidation'), ['SUBMITTED', 'IN_TRANSCRIPTION', 'IN_TRANSLATION', 'IN_DOCUMENT_REVIEW', 'IN_CULTURAL_REVIEW', 'IN_EDITORIAL_REVIEW', 'AWAITING_AUTHORIZATION']],
  ['en-validation', t('ws.pretesAPublier'), ['VALIDATED', 'SCHEDULED']],
  ['publies', t('ws.publies'), ['PUBLISHED']],
  ['retires', t('ws.suspendusEtArchives'), ['SUSPENDED', 'WITHDRAWN', 'ARCHIVED']],
]

function Pipeline({ counts, mine }) {
  return (
    <ol className="pipeline">
      {PIPELINE.map(([view, label, statuses]) => (
        <li key={label}>
          <Link to={`/admin/fiches?vue=${view}&status=${statuses.join(',')}${mine ? '&mine=1' : ''}`} className="pipeline-step">
            <span className="stat-value">{countFor(counts, statuses)}</span>
            <span className="stat-label">{label}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

// Fiches de l'utilisateur encore en préparation ou à corriger.
function MyDrafts() {
  const { data } = useApi(`/admin/items?mine=1&status=${EDITABLE_BY_AUTHOR.join(',')},UNDER_REVISION&pageSize=5`)
  if (!data) return null
  if (!data.items.length) return <p className="muted small">{t('ws.aucuneFicheEnCours')}</p>
  return (
    <ul className="resume-list">
      {data.items.map((item) => (
        <li key={item.id}>
          <Link to={`/admin/fiches/${item.id}`}>
            <span className="resume-title">{item.title}</span>
            <span className="small muted">
              {item.communities.map((c) => c.community.name).join(', ') || item.category.name} · {formatDateTime(item.updatedAt)}
            </span>
          </Link>
          <StatusBadge status={item.status} />
        </li>
      ))}
    </ul>
  )
}

// --- Dossiers de collecte --------------------------------------------------

const sum = (counts, statuses) => statuses.reduce((n, s) => n + (counts?.[s] ?? 0), 0)

// Accueil du collecteur : ses dossiers, ce qui lui est demandé, la suite.
function CollectorHome({ user, counts }) {
  const current = useApi('/admin/dossiers?mine=1&status=DRAFT,IN_PROGRESS,CHANGES_REQUESTED&pageSize=10')
  const toFix = counts?.CHANGES_REQUESTED ?? 0
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('ws.bonjour', { name: user.displayName })}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('dossier.accueilCollecteur')}</p>
        </div>
        <Link to="/admin/collectes/nouvelle" className="button">
          <FolderPlus size={17} className="icon" aria-hidden="true" />{t('dossier.nouvelleCollecte')}</Link>
      </div>
      {toFix > 0 && (
        <div className="notice warning">
          <AlertCircle size={20} className="icon" aria-hidden="true" />
          <div>
            <h2>{t('dossier.correctionsADemander', { n: toFix })}</h2>
            <Link to="/admin/collectes?vue=corrections">{t('dossier.voirLesCorrections')}</Link>
          </div>
        </div>
      )}
      <ol className="pipeline">
        {[
          ['en-cours', t('dossier.view.enCours'), ['DRAFT', 'IN_PROGRESS']],
          ['corrections', t('dossier.view.corrections'), ['CHANGES_REQUESTED']],
          ['soumis', t('dossier.view.soumis'), ['SUBMITTED', 'UNDER_REVIEW']],
          ['valides', t('dossier.view.valides'), ['VALIDATED']],
          ['publies', t('dossier.view.publies'), ['PUBLISHED']],
        ].map(([view, label, statuses]) => (
          <li key={view}>
            <Link to={`/admin/collectes?vue=${view}`} className="pipeline-step">
              <span className="stat-value">{sum(counts, statuses)}</span>
              <span className="stat-label">{label}</span>
            </Link>
          </li>
        ))}
      </ol>
      <section className="card" style={{ marginTop: '1.25rem' }}>
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('dossier.aReprendre')}</h2>
          <Link to="/admin/collectes" className="section-link">{t('dossier.mesCollectes')}<ArrowRight size={15} className="icon" aria-hidden="true" /></Link>
        </div>
        {current.data && <DossierTable dossiers={current.data.dossiers} showCollector={false} empty={t('dossier.aucunDossierEnCours')} />}
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.05rem' }}>{t('dossier.commentCaMarche')}</h2>
        <ol className="how-it-works">
          <li>{t('dossier.etape1')}</li>
          <li>{t('dossier.etape2')}</li>
          <li>{t('dossier.etape3')}</li>
          <li>{t('dossier.etape4')}</li>
        </ol>
      </section>
    </>
  )
}

// Bloc « Collectes » de l'administrateur.
function DossierOverview({ counts }) {
  const submitted = useApi('/admin/dossiers?status=SUBMITTED,UNDER_REVIEW&pageSize=5')
  const cards = [
    ['/admin/validations', t('dossier.aVerifierCourt'), sum(counts, ['SUBMITTED', 'UNDER_REVIEW']), true],
    ['/admin/validations', t('dossier.validesAPublier'), sum(counts, ['VALIDATED']), true],
    ['/admin/collectes?vue=corrections', t('dossier.view.corrections'), sum(counts, ['CHANGES_REQUESTED'])],
    ['/admin/collectes?vue=en-cours', t('dossier.view.enCours'), sum(counts, ['DRAFT', 'IN_PROGRESS'])],
    ['/admin/collectes?vue=publies', t('dossier.view.publies'), sum(counts, ['PUBLISHED'])],
  ]
  return (
    <section className="card">
      <div className="section-header" style={{ marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('dossier.collectes')}</h2>
        <Link to="/admin/collectes" className="section-link">{t('ws.toutVoir')}<ArrowRight size={15} className="icon" aria-hidden="true" /></Link>
      </div>
      <ul className="queue-list dossier-queues">
        {cards.map(([to, label, n, urgent]) => (
          <li key={label}>
            <Link to={to} className={n && urgent ? 'has-work' : ''}>
              <span>{label}</span>
              <span className="queue-count">{n}</span>
            </Link>
          </li>
        ))}
      </ul>
      {submitted.data?.dossiers.length > 0 && (
        <>
          <h3 className="small muted" style={{ margin: '1rem 0 0.5rem' }}>{t('dossier.derniersSoumis')}</h3>
          <DossierTable dossiers={submitted.data.dossiers} />
        </>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const { user, can } = useAuth()
  const { data, error, loading } = useApi('/admin/dashboard')
  const canDocument = can('content.edit')
  const reviewer = can('dossiers.review')
  const queues = data ? Object.entries(data.queues).filter(([key]) => key !== 'myToComplete') : []

  // Le collecteur a son propre accueil, centré sur ses dossiers.
  if (can('dossiers.collect') && !reviewer && !can('content.edit')) {
    return (
      <Loading loading={loading} error={error}>
        {data && <CollectorHome user={user} counts={data.dossiers} />}
      </Loading>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('ws.bonjour', { name: user.displayName })}</h1>
          <p className="muted" style={{ margin: 0 }}>{user.roles.map(roleLabel).join(', ')}</p>
        </div>
        <div className="actions">
          <Link to="/admin/communautes" className="button secondary">
            <Globe2 size={17} className="icon" aria-hidden="true" />{t('common.communities')}</Link>
          {reviewer && (
            <Link to="/admin/collectes/nouvelle" className="button">
              <FolderPlus size={17} className="icon" aria-hidden="true" />{t('dossier.nouvelleCollecte')}</Link>
          )}
        </div>
      </div>
      <Loading loading={loading} error={error}>
        {data && (
          <>
            {reviewer && <DossierOverview counts={data.dossiers} />}
            <div className="dossier-grid">
              {canDocument && !reviewer && (
                <section className="card">
                  <div className="section-header" style={{ marginBottom: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('ws.monTravail')}</h2>
                    <Link to="/admin/fiches?vue=tous&mine=1" className="section-link">{t('items.mesFiches')}<ArrowRight size={15} className="icon" aria-hidden="true" /></Link>
                  </div>
                  <p className="muted small">{t('ws.monTravailIntro')}</p>
                  <MyDrafts />
                  {data.queues.myToComplete > 0 && (
                    <p className="notice warning small" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                      <Link to={queueLink(QUEUES.myToComplete)}>{t('ws.fichesACorriger', { n: data.queues.myToComplete })}</Link>
                    </p>
                  )}
                </section>
              )}

              {(queues.length > 0 || data.takedownsOpen !== undefined) && (
                <section className="card">
                  <div className="section-header" style={{ marginBottom: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('ws.aTraiter')}</h2>
                    <Link to="/admin/fiches?vue=a-traiter" className="section-link">{t('ws.toutVoir')}<ArrowRight size={15} className="icon" aria-hidden="true" /></Link>
                  </div>
                  <ul className="queue-list">
                    {queues.map(([key, value]) => (
                      <li key={key}>
                        <Link to={queueLink(QUEUES[key])} className={value ? 'has-work' : ''}>
                          <span>{QUEUES[key][0]}</span>
                          <span className="queue-count">{value}</span>
                        </Link>
                      </li>
                    ))}
                    {data.takedownsOpen !== undefined && (
                      <li>
                        <Link to="/admin/signalements" className={data.takedownsOpen ? 'has-work' : ''}>
                          <span>
                            <MessageSquareWarning size={16} className="icon" aria-hidden="true" />{t('dashboard.demandesATraiter')}</span>
                          <span className="queue-count">{data.takedownsOpen}</span>
                        </Link>
                      </li>
                    )}
                  </ul>
                </section>
              )}
            </div>

            <section className="card">
              <div className="section-header" style={{ marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{t('ws.circuitDesFiches')}</h2>
                <Link to="/admin/fiches?vue=tous" className="section-link">{t('ws.tousLesContenus')}<ArrowRight size={15} className="icon" aria-hidden="true" /></Link>
              </div>
              {Object.keys(data.byStatus).length ? (
                <Pipeline counts={data.byStatus} />
              ) : (
                <EmptyState icon={FileText} title={t('items.aucuneFiche')}>{t('ws.commencezParDocumenter')}</EmptyState>
              )}
            </section>

            <section className="card">
              <h2 style={{ fontSize: '1.05rem' }}>{t('dashboard.chiffresCles')}</h2>
              <div className="stat-grid">
                {STATS.map(([key, label, Icon]) => (
                  <div key={key} className="stat">
                    <span className="stat-top">
                      <span className="stat-value">{data.stats[key]}</span>
                      <Icon size={20} className="icon" aria-hidden="true" />
                    </span>
                    <span className="stat-label">{label}</span>
                  </div>
                ))}
              </div>
              <p className="muted small">{t('dashboard.fichesCompteesSelonVosDroits')}</p>
            </section>

            {(data.preservation || data.auditChain) && (
              <div className="dossier-grid">
                {data.preservation && (
                  <section className="card">
                    <h2 style={{ fontSize: '1.05rem' }}>
                      <Archive size={20} className="icon icon-blue" aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />{t('dashboard.conservation')}</h2>
                    <ul className="plain-list">
                      <li>{t('dashboard.derniereSauvegarde')}{' '}{data.preservation.lastBackup ? `${formatDateTime(data.preservation.lastBackup.startedAt)} (${data.preservation.lastBackup.status === 'SUCCESS' ? t('dashboard.reussie') : t('dashboard.echec')})` : '—'}</li>
                      <li>{t('dashboard.dernierTestDeRestauration')}{' '}{data.preservation.lastRestoreTest ? `${formatDateTime(data.preservation.lastRestoreTest.startedAt)} (${data.preservation.lastRestoreTest.status === 'SUCCESS' ? t('dashboard.reussi') : t('dashboard.echec')})` : '—'}</li>
                      <li>{t('dashboard.dernierControleDIntegrite')}{' '}{data.preservation.lastIntegrityCheck ? formatDateTime(data.preservation.lastIntegrityCheck.startedAt) : '—'}</li>
                      <li className={data.preservation.filesCorrupted ? 'error' : ''}>{t('dashboard.fichiersCorrompusOuManquants')}{' '}{data.preservation.filesCorrupted}</li>
                    </ul>
                    <Link to="/admin/conservation" className="action-link">{t('dashboard.gererLesSauvegardes')}</Link>
                  </section>
                )}
                {data.auditChain && (
                  <section className="card">
                    <h2 style={{ fontSize: '1.05rem' }}>
                      <ShieldCheck size={20} className="icon icon-blue" aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />{t('dashboard.integriteDuJournalDAudit')}</h2>
                    {data.auditChain.valid ? (
                      <p className="ok">{t('dashboard.chaineVerifiee')}{' '}{data.auditChain.checked}{' '}{t('dashboard.entreesAucuneAlterationDetectee')}</p>
                    ) : (
                      <p className="error">{t('dashboard.alterationDetecteeALEntree')}{' '}{data.auditChain.brokenAtId}{t('dashboard.uneVerificationEstNecessaire')}</p>
                    )}
                    <Link to="/admin/journal" className="action-link">{t('audit.journalDAudit')}</Link>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </Loading>
    </>
  )
}
