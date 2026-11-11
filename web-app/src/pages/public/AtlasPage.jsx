import { Award, Car, Trees } from 'lucide-react'
import { Link } from 'react-router'
import { AtlasMap } from '../../components/AtlasMap.jsx'
import { ATLAS_POINTS, CATEGORY_ICONS } from '../../components/atlasModel.js'
import { SectionHeader } from '../../components/ui.jsx'
import { atlasPhoto, CATEGORIES, ZONES } from '../../data/atlasContent.js'
import { NARRATION_VOICE } from '../../data/atlasNarration.js'
import { PARKS } from '../../data/atlasParks.js'
import { ROADS } from '../../data/atlasRoads.js'
import { t } from '../../i18n/index.js'

// Atlas vivant : la carte immersive, puis le catalogue des découvertes
// (alternative accessible à la carte) et les sources.
export default function AtlasPage() {
  const reveal = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  const photoKeys = [
    ...ATLAS_POINTS.map((p) => [p.id, p.name]),
    ...ZONES.filter((z) => !ATLAS_POINTS.some((p) => p.id === z.photo)).map((z) => [z.photo, z.name]),
    ...PARKS.filter((park) => !ATLAS_POINTS.some((p) => p.id === park.photo)).map((park) => [park.photo, park.nom]),
    ...ROADS.flatMap((road) => road.photos.map((key, i) => [key, `${road.name} (${t('atlas.vue').toLowerCase()} ${i + 1})`])),
  ]

  return (
    <>
      <AtlasMap />

      <section className="atlas-catalogue" aria-labelledby="atlas-catalogue-title">
        <SectionHeader id="atlas-catalogue-title" title={t('atlas.toutesLesDecouvertes')} description={t('atlas.toutesLesDecouvertesDescription')} />
        <div className="atlas-catalogue-group">
          <h3>
            <span className="atlas-cat-icon cat-parcs">
              <Trees size={15} className="icon" aria-hidden="true" />
            </span>
            {t('atlas.parcsNationaux')}
          </h3>
          <div className="atlas-cards">
            {PARKS.map((park) => (
              <Link key={park.id} to={`?parc=${park.id}`} preventScrollReset className="atlas-card" onClick={reveal}>
                <div className="atlas-card-media">
                  <img src={atlasPhoto(park.photo)?.thumb} alt="" loading="lazy" />
                </div>
                <div className="atlas-card-body">
                  <strong>{park.nom}</strong>
                  <em>
                    {t('atlas.typeEtCreation', { type: park.type, year: park.annee_creation })}
                    {park.patrimoine_unesco && (
                      <>
                        {' · '}
                        <Award size={12} className="icon" aria-hidden="true" /> {t('atlas.unesco')}
                      </>
                    )}
                  </em>
                  <p>{park.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="atlas-catalogue-group">
          <h3>
            <span className="atlas-cat-icon cat-routes">
              <Car size={15} className="icon" aria-hidden="true" />
            </span>
            {t('atlas.routesNationales')}
          </h3>
          <div className="atlas-cards">
            {ROADS.map((road) => (
              <Link key={road.id} to={`?route=${road.id}`} preventScrollReset className="atlas-card" onClick={reveal}>
                <div className="atlas-card-media">
                  {road.photos.length ? (
                    <img src={atlasPhoto(road.photos[0]).thumb} alt="" loading="lazy" />
                  ) : (
                    <span className="atlas-thumb-empty cat-routes">
                      <span className="atlas-shield atlas-shield-large">{road.ref}</span>
                    </span>
                  )}
                </div>
                <div className="atlas-card-body">
                  <strong>
                    <span className="atlas-shield">{road.ref}</span> {road.name}
                  </strong>
                  <em>{road.towns.length > 1 ? t('atlas.deAA', { from: road.towns[0], to: road.towns.at(-1) }) : road.provinces.join(', ')}</em>
                  <p>{road.intro ?? road.towns.join(' · ')}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c.id]
          return (
            <div key={c.id} className="atlas-catalogue-group">
              <h3>
                <span className={`atlas-cat-icon cat-${c.id}`}>
                  <Icon size={15} className="icon" aria-hidden="true" />
                </span>
                {c.plural}
              </h3>
              <div className="atlas-cards">
                {ATLAS_POINTS.filter((p) => p.category === c.id).map((p) => (
                  <Link key={p.id} to={`?lieu=${p.id}`} preventScrollReset className="atlas-card" onClick={reveal}>
                    <div className="atlas-card-media">
                      {atlasPhoto(p.id) ? (
                        <img src={atlasPhoto(p.id).thumb} alt="" loading="lazy" />
                      ) : (
                        <span className={`atlas-thumb-empty cat-${p.category}`}>
                          <Icon size={30} className="icon" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="atlas-card-body">
                      <strong>{p.name}</strong>
                      <em>{p.place}</em>
                      <p>{p.summary}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}

        <details className="atlas-sources">
          <summary>{t('atlas.sourcesEtCredits')}</summary>
          <p>{t('atlas.sourcesCartographie')}</p>
          <ul>
            {photoKeys.filter(([key]) => atlasPhoto(key)).map(([key, name]) => {
              const photo = atlasPhoto(key)
              return (
                <li key={key}>
                  {name} : {photo.author}, {photo.license} —{' '}
                  <a href={photo.sourceUrl} target="_blank" rel="noreferrer">{t('atlas.wikimediaCommons')}</a>
                </li>
              )
            })}
          </ul>
          <p>{t('atlas.sourcesPhotos')}</p>
          <p>{t('atlas.sourcesVoix', { voice: NARRATION_VOICE })}</p>
        </details>
      </section>
    </>
  )
}
