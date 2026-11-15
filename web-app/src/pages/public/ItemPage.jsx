import { AlertTriangle, BookMarked, Calendar, CheckCircle2, Flag, History, Info, Languages, Link2, ListTree, MapPin, MessageSquareQuote, Users } from 'lucide-react'
import { Link, useParams } from 'react-router'
import Prose from '../../components/Prose.jsx'
import { MediaCard, SourceReference } from '../../components/PublicCards.jsx'
import { Breadcrumbs, Loading, useApi } from '../../components/ui.jsx'
import { formatDate, formatItemDate, PLACE_TYPE_LABELS, RELATION_LABELS, VERIFICATION_HELP, VERIFICATION_LABELS } from '../../labels.js'
import { t } from '../../i18n/index.js'

const VERIFICATION_ICONS = {
  SOURCED: CheckCircle2,
  CORROBORATED: CheckCircle2,
  TESTIMONY: MessageSquareQuote,
  ORAL_TRADITION: MessageSquareQuote,
  CONTESTED: AlertTriangle,
  HYPOTHESIS: Info,
  INCOMPLETE: Info,
}

export default function ItemPage() {
  const { slug } = useParams()
  const { data, error, loading } = useApi(`/public/items/${slug}`)
  if (!data) return <Loading loading={loading} error={error} />
  const item = data.item
  const variants = item.relations.filter((r) => r.type === 'VARIANT_OF')
  const related = item.relations.filter((r) => r.type !== 'VARIANT_OF')
  const photos = item.media.filter((m) => m.kind === 'PHOTO' || m.kind === 'DOCUMENT')
  const players = item.media.filter((m) => m.kind === 'AUDIO' || m.kind === 'VIDEO')
  const VerificationIcon = VERIFICATION_ICONS[item.verificationStatus] ?? Info

  const toc = [
    item.body && ['description', t('common.description')],
    ...item.fields.map((f) => [`champ-${f.key}`, f.label]),
    item.media.length > 0 && ['medias', t('common.media')],
    variants.length > 0 && ['variantes', t('item.variantes')],
    related.length > 0 && ['associes', t('item.contenusAssocies')],
    ['sources', t('common.sources')],
  ].filter(Boolean)

  return (
    <article>
      <Breadcrumbs
        items={[
          { label: t('common.home'), to: '/' },
          item.category ? { label: item.category.name, to: `/themes/${item.category.slug}` } : { label: t('item.contenus'), to: '/contenus' },
          { label: item.title },
        ]}
      />

      <header className="article-head">
        {item.category && <p className="eyebrow">{item.category.name}</p>}
        <h1>{item.title}</h1>
        {item.originalTitle && <p className="original-title">{item.originalTitle}</p>}
        {item.summary && <p className="lead">{item.summary}</p>}
      </header>

      <div className={`verification verif-${item.verificationStatus.toLowerCase()}`} role="note">
        <VerificationIcon size={20} className="icon" aria-hidden="true" />
        <div>
          <strong>{VERIFICATION_LABELS[item.verificationStatus]}</strong>
          <span>{VERIFICATION_HELP[item.verificationStatus]}</span>
        </div>
      </div>

      {item.isAuthority && item.communities.find((c) => c.slug) && (
        <p>
          <Link to={`/communautes/${item.communities.find((c) => c.slug).slug}?autorite=${item.slug}`} className="button secondary">
            <ListTree size={16} className="icon" aria-hidden="true" />{t('authority.voirDansLArbre')}</Link>
        </p>
      )}

      <div className="article-layout">
        <div className="article-main">
          {photos.length > 0 && (
            <div className="media-gallery media-grid" id={players.length ? undefined : 'medias'}>
              {photos.map((m) => (
                <MediaCard key={m.id} media={m} />
              ))}
            </div>
          )}

          {item.body && (
            <section id="description">
              <h2>{t('common.description')}</h2>
              <div className="reading">
                <Prose text={item.body} />
              </div>
            </section>
          )}

          {item.fields.map((f) => (
            <section key={f.key} id={`champ-${f.key}`}>
              <h2>{f.label}</h2>
              <div className="reading">
                {f.type === 'list' ? (
                  <ul>
                    {f.value.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <Prose text={f.value} />
                )}
              </div>
            </section>
          ))}

          {players.length > 0 && (
            <section id="medias">
              <h2>{t('item.ecouterEtRegarder')}</h2>
              <div className="media-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {players.map((m) => (
                  <MediaCard key={m.id} media={m} />
                ))}
              </div>
            </section>
          )}

          {variants.length > 0 && (
            <section id="variantes">
              <h2>{t('item.variantesDocumentees')}</h2>
              <p className="muted small">{t('item.lesPratiquesPeuventVarierSelon')}</p>
              <ul className="related-list">
                {variants.map((r) => (
                  <li key={r.slug}>
                    <Link to={`/contenus/${r.slug}`}>
                      <span>
                        {r.title}
                        {r.notes && <small>{r.notes}</small>}
                      </span>
                      <Link2 size={16} className="icon" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {related.length > 0 && (
            <section id="associes">
              <h2>{t('item.contenusAssocies')}</h2>
              <ul className="related-list">
                {related.map((r) => (
                  <li key={`${r.type}-${r.slug}`}>
                    <Link to={`/contenus/${r.slug}`}>
                      <span>
                        {r.title}
                        <small>{RELATION_LABELS[r.type]}</small>
                      </span>
                      <Link2 size={16} className="icon" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section id="sources">
            <h2>
              <BookMarked size={20} className="icon icon-blue" aria-hidden="true" />{t('item.sourcesEtReferences')}</h2>
            {item.sources.length > 0 && (
              <ol className="source-list">
                {item.sources.map((s) => (
                  <SourceReference key={s.title} source={s} />
                ))}
              </ol>
            )}
            {item.sources.length === 0 && item.hasConsent && item.privateSourceCount === 0 && (
              <blockquote>{t('item.ceContenuReposeSurUn')}</blockquote>
            )}
            {item.privateSourceCount > 0 && (
              <p className="muted small" style={{ marginTop: '0.75rem' }}>
                {item.sources.length > 0 ? t('item.dAutresSources') : t('item.lesSourcesDeCeContenu')}{' '}{t('item.sontConserveesParUrithiMais')}</p>
            )}
          </section>

          <p className="small muted">
            <Flag size={14} className="icon" aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}{t('item.uneErreurUnProblemeDe')}{' '}<Link to={`/signaler?contenu=${item.slug}`}>{t('item.signalerCeContenu')}</Link>
          </p>
        </div>

        <aside className="article-aside" aria-label={t('item.contexte')}>
          <div className="context-card">
            <h2>{t('item.contexte')}</h2>
            <dl className="context-list">
              {item.communities.length > 0 && (
                <div>
                  <Users size={16} className="icon" aria-hidden="true" />
                  <dt>{t('common.community')}</dt>
                  <dd>
                    {item.communities.map((c, i) => (
                      <span key={c.name}>
                        {i > 0 && ', '}
                        {c.slug ? <Link to={`/communautes/${c.slug}`}>{c.name}</Link> : c.name}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {item.places.length > 0 && (
                <div>
                  <MapPin size={16} className="icon" aria-hidden="true" />
                  <dt>{t('common.places')}</dt>
                  <dd>{item.places.map((p) => `${p.name}${p.parent ? ` (${p.parent})` : ` · ${PLACE_TYPE_LABELS[p.type]}`}`).join(', ')}</dd>
                </div>
              )}
              {item.originalLanguage && (
                <div>
                  <Languages size={16} className="icon" aria-hidden="true" />
                  <dt>{t('item.langueOriginale')}</dt>
                  <dd>{item.originalLanguage}</dd>
                </div>
              )}
              <div>
                <Calendar size={16} className="icon" aria-hidden="true" />
                <dt>{t('item.periode')}</dt>
                <dd>{formatItemDate(item.date)}</dd>
              </div>
              {item.narrator && (
                <div>
                  <MessageSquareQuote size={16} className="icon" aria-hidden="true" />
                  <dt>{t('item.personneRessource')}</dt>
                  <dd>{item.narrator}</dd>
                </div>
              )}
              <div>
                <History size={16} className="icon" aria-hidden="true" />
                <dt>{t('item.miseAJour')}</dt>
                <dd>{formatDate(item.updatedAt ?? item.publishedAt)}</dd>
              </div>
            </dl>
          </div>
          {toc.length > 2 && (
            <nav className="context-card desktop-only" aria-label={t('item.surCettePage')}>
              <h2>{t('item.surCettePage')}</h2>
              <div className="toc">
                {toc.map(([id, label]) => (
                  <a key={id} href={`#${id}`}>
                    {label}
                  </a>
                ))}
              </div>
            </nav>
          )}
        </aside>
      </div>
    </article>
  )
}
