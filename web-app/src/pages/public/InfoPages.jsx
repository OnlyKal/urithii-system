import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../../api.js'
import { CheckCircle2, Flag } from 'lucide-react'
import { Breadcrumbs, ErrorMessage } from '../../components/ui.jsx'
import { TAKEDOWN_REASON_LABELS } from '../../labels.js'
import { t } from '../../i18n/index.js'

export function AboutPage() {
  return (
    <article className="prose-page">
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('info.aPropos') }]} />
      <h1>{t('info.aProposDUrithi')}</h1>
      <p className="lead">
        <em>{t('info.urithi')}</em>{' '}{t('info.signifieHeritageEnSwahiliUrithi')}</p>
      <h2>{t('info.pourquoiUrithi')}</h2>
      <p>{t('info.deNombreusesConnaissancesCulturellesSont')}</p>
      <h2>{t('info.commentLireLesContenus')}</h2>
      <p>{t('info.chaqueContenuIndiqueClairementLa')}</p>
      <ul>
        <li>
          <strong>{t('info.etayeParUneSource')}</strong>{' '}{t('info.ou')}{' '}<strong>{t('info.corrobore')}</strong>{' '}{t('info.informationAppuyeeSurDesSources')}</li>
        <li>
          <strong>{t('info.temoignagePersonnel')}</strong>{' '}{t('info.recitDUnePersonneAvec')}</li>
        <li>
          <strong>{t('info.traditionOrale')}</strong>{' '}{t('info.recitTransmisOralementQuiN')}</li>
        <li>
          <strong>{t('info.informationContestee')}</strong>{' '}{t('info.ou')}{' '}<strong>{t('info.hypothese')}</strong>{' '}{t('info.versionsDivergentesOuInterpretationsA')}</li>
      </ul>
      <p>{t('info.lorsquePlusieursVersionsDUne')}</p>
      <h2>{t('info.commentLesContenusSontIls')}</h2>
      <p>{t('info.lesContenusSontRecueillisLors')}</p>
      <h2>{t('info.communautePilote')}</h2>
      <p>{t('info.laPremiereCommunauteDocumenteeEst')}</p>
      <p>
        <Link to="/signaler">{t('info.signalerUneErreurOuDemander')}</Link> · <Link to="/confidentialite">{t('info.politiqueDeConfidentialite')}</Link>
      </p>
    </article>
  )
}

export function PrivacyPage() {
  return (
    <article className="prose-page">
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('info.confidentialite') }]} />
      <h1>{t('info.politiqueDeConfidentialite')}</h1>
      <p className="notice warning">{t('info.versionProvisoireAFaireVerifier')}</p>
      <h2>{t('info.consultationDuSite')}</h2>
      <p>{t('info.laConsultationEstLibreEt')}</p>
      <h2>{t('info.personnesRessourcesEtTemoins')}</h2>
      <p>{t('info.lesCoordonneesDocumentsDIdentite')}</p>
      <h2>{t('info.contributeurs')}</h2>
      <p>{t('info.lesComptesDeContributionSont')}</p>
      <h2>{t('info.demandes')}</h2>
      <p>{t('info.pourTouteDemandeRelativeA')}{' '}
        <Link to="/signaler">{t('info.formulaireDeSignalement')}</Link>.
      </p>
    </article>
  )
}

export function ReportPage() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({
    itemSlug: searchParams.get('contenu') ?? '',
    pageUrl: '',
    requesterName: '',
    requesterContact: '',
    requesterRelation: '',
    reason: 'ERROR',
    description: '',
  })
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setError(null)
    try {
      const res = await api('/public/takedown-requests', { method: 'POST', body: form })
      setDone(res.message)
    } catch (err) {
      setError(err)
    }
  }

  if (done) {
    return (
      <section className="card narrow" role="status">
        <CheckCircle2 size={28} className="icon ok" aria-hidden="true" />
        <h1>{t('info.demandeEnvoyee')}</h1>
        <p>{done}</p>
        <Link to="/">{t('info.retourALAccueil')}</Link>
      </section>
    )
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  return (
    <section className="card narrow wide">
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('info.signalerUnContenu') }]} />
      <h1>
        <Flag size={24} className="icon icon-blue" aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />{t('info.signalerUnContenu')}</h1>
      <p className="muted">{t('info.erreurMauvaiseAttributionProblemeDe')}</p>
      <form className="form" onSubmit={submit}>
        {form.itemSlug ? (
          <p>{t('info.contenuConcerne')}{' '}<Link to={`/contenus/${form.itemSlug}`}>{form.itemSlug}</Link>
          </p>
        ) : (
          <label>{t('info.adresseDeLaPageConcernee')}<input value={form.pageUrl} onChange={(e) => set({ pageUrl: e.target.value })} />
          </label>
        )}
        <label>{t('common.reason')}<select value={form.reason} onChange={(e) => set({ reason: e.target.value })}>
            {Object.entries(TAKEDOWN_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>{t('common.description')}<textarea rows={5} required minLength={10} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label>{t('info.votreNom')}<input required minLength={2} value={form.requesterName} onChange={(e) => set({ requesterName: e.target.value })} />
        </label>
        <label>{t('info.commentVousJoindreEMail')}<input required minLength={5} value={form.requesterContact} onChange={(e) => set({ requesterContact: e.target.value })} />
        </label>
        <label>{t('info.votreLienAvecLeContenu')}<input value={form.requesterRelation} onChange={(e) => set({ requesterRelation: e.target.value })} placeholder={t('info.exPersonneInterrogeeMembreDe')} />
        </label>
        <ErrorMessage error={error} />
        <div>
          <button type="submit">{t('info.envoyerLaDemande')}</button>
        </div>
      </form>
    </section>
  )
}
