import { Archive, ArrowRight, BookOpen, Camera, Clock, Compass, Globe2, Hammer, History, Languages, Music, Network, Play, Shirt, Sparkles, Tags, UtensilsCrossed, Map as MapIcon } from 'lucide-react'
import { Link } from 'react-router'
import { DrcMap } from '../../components/DrcMap.jsx'
import { HeritageNetwork } from '../../components/HeritageNetwork.jsx'
import { visualProps } from '../../components/homeVisuals.js'
import { CategoryItem, CommunityCard, CultureContentCard } from '../../components/PublicCards.jsx'
import { SearchBar } from '../../components/SearchBar.jsx'
import { EmptyState, LoadingSkeleton, SectionHeader, useApi } from '../../components/ui.jsx'
import { useReveal } from '../../components/useReveal.js'
import { t, tn } from '../../i18n/index.js'

// Domaines mis en avant sur l'accueil. Les huit premiers renvoient aux
// catégories (par leur code), les deux derniers aux collections de médias.
const HOME_THEMES = [
  { code: 'B', label: t('home.histoireEtMemoire'), icon: History },
  { code: 'C', label: t('home.languesEtExpressions'), icon: Languages },
  { code: 'D', label: t('home.gastronomie'), icon: UtensilsCrossed },
  { code: 'E', label: t('home.dansesEtMusique'), icon: Music },
  { code: 'F', label: t('home.contesEtTraditionsOrales'), icon: BookOpen },
  { code: 'G', label: t('home.coutumesEtCeremonies'), icon: Sparkles },
  { code: 'J', label: t('home.artisanatEtSavoirFaire'), icon: Hammer },
  { code: 'I', label: t('home.vetementsEtParures'), icon: Shirt },
  { label: t('home.archivesPhotographiques'), icon: Camera, to: '/mediatheque?kind=PHOTO', count: (c) => c.photos, unit: 'photo' },
  { label: t('home.temoignagesAudiovisuels'), icon: Play, to: '/mediatheque', count: (c) => c.videos + c.audios, unit: 'recording' },
]

// Tuiles de la mosaïque : chacune ouvre la page du thème correspondant.
const MOSAIC = [
  { visual: 'causerie', label: t('home.contesEtTraditionsOrales'), hint: t('home.laParoleDesAnciensTransmise'), to: '/themes/contes-legendes-et-litterature-orale', icon: BookOpen },
  { visual: 'foret', label: t('home.savoirsTraditionnels'), hint: t('home.connaissancesDeLaForetDes'), to: '/themes/savoirs-traditionnels', icon: Sparkles },
  { visual: 'riviere', label: t('home.vieQuotidienne'), hint: t('home.gestesPratiquesEtEvolutionsD'), to: '/themes/vie-quotidienne-et-evolution-contemporaine', icon: Globe2 },
]

// Section qui apparaît en douceur lorsqu'elle entre dans l'écran.
function Reveal({ as: Tag = 'section', className = '', children, ...props }) {
  const [ref, visible] = useReveal()
  return (
    <Tag ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} {...props}>
      {children}
    </Tag>
  )
}

export default function HomePage() {
  const { data, error } = useApi('/public/home')
  const latest = data ? [...data.updated, ...data.recent.filter((r) => !data.updated.some((u) => u.slug === r.slug))].slice(0, 6) : []

  return (
    <>
      <section className="hero hero-split" aria-labelledby="hero-title">
        <div className="hero-text">
          <p className="eyebrow">
            <Globe2 size={14} className="icon" aria-hidden="true" />{t('home.republiqueDemocratiqueDuCongo')}</p>
          <h1 id="hero-title">{t('home.preserverLHeritageCulturelCongolais')}</h1>
          <p className="lead">{t('home.urithiDocumenteLesHistoiresLes')}</p>
          <SearchBar large placeholder={t('home.uneCommunauteUneLangueUn')} />
          <div className="hero-actions">
            <Link to="/communautes" className="button">
              <Compass size={18} className="icon" aria-hidden="true" />{t('home.explorerLesCultures')}</Link>
            <Link to="/collections" className="button secondary">
              <Archive size={18} className="icon" aria-hidden="true" />{t('home.decouvrirLesArchives')}</Link>
          </div>
        </div>

        <figure className="hero-collage">
          <div className="collage-tile collage-tall">
            <img {...visualProps('pecheurs', '(min-width: 960px) 260px, 45vw', { eager: true })} />
          </div>
          <div className="collage-tile collage-main">
            <img {...visualProps('tambour', '(min-width: 960px) 300px, 45vw', { eager: true })} className="kenburns" />
            <span className="collage-chip">
              <Music size={14} className="icon" aria-hidden="true" />{t('home.musiqueEtDanses')}</span>
          </div>
          <div className="collage-tile collage-small">
            <img {...visualProps('marche', '(min-width: 960px) 300px, 45vw', { eager: true })} />
            <span className="collage-chip">
              <UtensilsCrossed size={14} className="icon" aria-hidden="true" />{t('home.gastronomie')}</span>
          </div>
          <figcaption className="collage-caption">{t('home.imagesDIllustration')}</figcaption>
        </figure>
      </section>

      {error && <EmptyState title={t('home.impossibleDeChargerLesContenus')}>{t('home.reessayezDansQuelquesInstants')}</EmptyState>}
      {!data && !error && <LoadingSkeleton variant="cards" count={3} />}

      {data && (
        <>
          <div className="stats-strip stats-raised" aria-label={t('home.urithiEnChiffres')}>
            <div>
              <strong>{data.stats.communities}</strong>
              <span>{tn('stats.communitiesDocumented', data.stats.communities)}</span>
            </div>
            <div>
              <strong>{data.stats.items}</strong>
              <span>{tn('stats.contentsPublished', data.stats.items)}</span>
            </div>
            <div>
              <strong>{data.stats.media}</strong>
              <span>{t('home.photosVideosEtEnregistrements')}</span>
            </div>
          </div>

          <Reveal className="section" aria-labelledby="mosaique">
            <SectionHeader
              id="mosaique"
              icon={Sparkles}
              title={t('home.uneMosaiqueDeCultures')}
              description={t('home.traditionsOralesSavoirsDeLa')}
              link="/themes"
              linkLabel={t('home.tousLesThemes')}
            />
            <div className="mosaic">
              {MOSAIC.map((tile, i) => (
                <Link key={tile.visual} to={tile.to} className={`mosaic-tile ${i === 0 ? 'mosaic-wide' : ''}`} style={{ '--i': i }}>
                  <img {...visualProps(tile.visual, i === 0 ? '(min-width: 960px) 680px, (min-width: 640px) 56vw, 100vw' : '(min-width: 960px) 500px, (min-width: 640px) 42vw, 100vw')} />
                  <span className="mosaic-label">
                    <span className="mosaic-icon">
                      <tile.icon size={18} className="icon" aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{tile.label}</strong>
                      <small>{tile.hint}</small>
                    </span>
                    <ArrowRight size={18} className="icon mosaic-arrow" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>

          <Reveal className="section table-feature" aria-labelledby="table">
            <div className="table-feature-text">
              <p className="eyebrow">
                <UtensilsCrossed size={14} className="icon" aria-hidden="true" />{t('home.gastronomieEtAlimentation')}</p>
              <h2 id="table">{t('home.laTableCongolaise')}</h2>
              <p>{t('home.platsTraditionnelsIngredientsEtLeurs')}</p>
              <Link to="/themes/gastronomie-et-alimentation" className="button">{t('home.decouvrirLaGastronomie')}<ArrowRight size={17} className="icon" aria-hidden="true" />
              </Link>
            </div>
            <div className="table-feature-media">
              <div className="table-tile table-tall">
                <img {...visualProps('mais', '(min-width: 960px) 280px, 45vw')} />
              </div>
              <div className="table-tile table-wide">
                <img {...visualProps('grillades', '(min-width: 960px) 380px, 50vw')} />
              </div>
              {(() => {
                const gastronomy = data.categories.find((c) => c.code === 'D' && !c.parentId)
                const count = gastronomy?.itemCount ?? 0
                return (
                  <Link to="/themes/gastronomie-et-alimentation" className={`table-count ${count > 0 ? 'has-content' : ''}`}>
                    <img {...visualProps('foufou', '(min-width: 960px) 380px, 50vw')} />
                    <span className="table-count-label">
                      <strong>{count}</strong>
                      <span>{count > 0 ? tn('stats.recipesPublished', count) : t('home.documentationEnCours')}</span>
                      <ArrowRight size={18} className="icon" aria-hidden="true" />
                    </span>
                  </Link>
                )
              })()}
            </div>
          </Reveal>

          <Reveal className="section map-section" aria-labelledby="carte">
            <SectionHeader
              id="carte"
              icon={MapIcon}
              title={t('home.laRdcProvinceParProvince')}
              description={t('home.vingtSixProvincesDesCentaines')}
            />
            <DrcMap />
          </Reveal>

          <Reveal className="section network-section" aria-labelledby="reseau">
            <SectionHeader
              id="reseau"
              icon={Network}
              title={t('network.titre')}
              description={t('network.description')}
              link="/communautes"
              linkLabel={t('home.toutesLesCommunautes')}
            />
            <HeritageNetwork />
          </Reveal>

          <Reveal className="section" aria-labelledby="communautes">
            <SectionHeader
              id="communautes"
              icon={Globe2}
              title={t('home.explorerLesCommunautes')}
              description={t('home.chaqueCommunauteATraversSon')}
              link={data.communities.length ? '/communautes' : null}
              linkLabel={t('home.toutesLesCommunautes')}
            />
            {data.communities.length ? (
              <div className="card-grid">
                {data.communities.map((c) => (
                  <CommunityCard key={c.slug} community={c} />
                ))}
              </div>
            ) : (
              <div className="illustrated-empty">
                <div className="illustrated-empty-media" aria-hidden="true">
                  {['causerie', 'pecheurs', 'riviere'].map((key, i) => (
                    <img key={key} {...visualProps(key, '160px')} alt="" style={{ '--i': i }} />
                  ))}
                </div>
                <EmptyState icon={Globe2} title={t('home.documentationEnCours')}>{t('home.laPremiereCommunauteDocumenteeSera')}</EmptyState>
              </div>
            )}
          </Reveal>

          <Reveal className="section" aria-labelledby="themes">
            <SectionHeader id="themes" icon={Tags} title={t('home.explorerParDomaine')} description={t('home.lesGrandsDomainesDuPatrimoine')} link="/themes" linkLabel={t('home.tousLesThemes')} />
            <div className="category-grid stagger">
              {HOME_THEMES.map((theme, i) => {
                if (theme.code) {
                  const category = data.categories.find((c) => c.code === theme.code && !c.parentId)
                  return category ? (
                    <div key={theme.label} style={{ '--i': i }}>
                      <CategoryItem category={category} label={theme.label} icon={theme.icon} />
                    </div>
                  ) : null
                }
                return (
                  <div key={theme.label} style={{ '--i': i }}>
                    <CategoryItem label={theme.label} icon={theme.icon} to={theme.to} count={theme.count(data.collections)} unit={theme.unit} />
                  </div>
                )
              })}
            </div>
          </Reveal>

          <Reveal className="section mission-band" aria-labelledby="mission">
            <div className="mission-band-inner">
              <div>
                <p className="eyebrow">
                  <History size={14} className="icon" aria-hidden="true" />{t('home.notreMission')}</p>
                <h2 id="mission">{t('home.pourquoiUrithi')}</h2>
              </div>
              <div>
                <p>{t('home.deNombreusesConnaissancesCulturellesSont')}</p>
                <Link to="/a-propos" className="button mission-cta">{t('home.enSavoirPlusSurLa')}<ArrowRight size={17} className="icon" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal className="section" aria-labelledby="recents">
            <SectionHeader id="recents" icon={Clock} title={t('home.dernieresPublications')} description={t('home.contenusRecemmentPubliesOuMis')} link={latest.length ? '/contenus' : null} linkLabel={t('home.tousLesContenus')} />
            {latest.length ? (
              <div className="card-grid">
                {latest.map((item) => (
                  <CultureContentCard key={item.slug} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState icon={BookOpen} title={t('home.aucunContenuPubliePourLe')}>{t('home.lesPremiersContenusApparaitrontIci')}</EmptyState>
            )}
          </Reveal>
        </>
      )}
    </>
  )
}
