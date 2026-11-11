import { ArrowRight, BookOpen, Globe2, MapPin, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { normalizeName } from '../labels.js'
import { MAP_HEIGHT, MAP_WIDTH, PROVINCES } from './drcMapData.js'
import { useApi } from './ui.jsx'
import { t, tn } from '../i18n/index.js'

// Rattache chaque communauté publiée à ses provinces (en remontant la
// hiérarchie de ses lieux). Les contenus comptés sont ceux des communautés
// présentes dans la province : tout contenu publié est rattaché à une communauté.
function provinceStats(places = [], communities = []) {
  const byId = new Map(places.map((p) => [p.id, p]))
  const provinceOf = (place) => {
    for (let p = place; p; p = byId.get(p.parentId)) if (p.type === 'PROVINCE') return p
    return null
  }
  const stats = new Map()
  for (const place of places) {
    if (place.type === 'PROVINCE') stats.set(normalizeName(place.name), { id: place.id, communities: new Map() })
  }
  for (const community of communities) {
    for (const cp of community.places ?? []) {
      const place = places.find((p) => p.name === cp.name && p.type === cp.type)
      const province = place && provinceOf(place)
      if (province) stats.get(normalizeName(province.name)).communities.set(community.slug, community.itemCount ?? 0)
    }
  }
  return stats
}


// Carte interactive de la RDC : 26 provinces, marqueurs pulsants, panneau
// d'informations alimenté par les données publiques réelles.
export function DrcMap() {
  const places = useApi('/public/places').data?.places
  const communities = useApi('/public/communities').data?.communities
  const stats = useMemo(() => provinceStats(places, communities), [places, communities])
  const [active, setActive] = useState(null)
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  // L'animation d'entrée démarre quand la carte apparaît à l'écran.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const provinces = useMemo(
    () =>
      PROVINCES.map((p, i) => {
        const s = stats.get(normalizeName(p.name))
        const communityCount = s?.communities.size ?? 0
        const itemCount = s ? [...s.communities.values()].reduce((sum, n) => sum + n, 0) : 0
        return { ...p, index: i, placeId: s?.id, communityCount, itemCount, documented: communityCount > 0 }
      }),
    [stats],
  )
  // Vague d'apparition d'ouest en est.
  const order = useMemo(() => new Map([...provinces].sort((a, b) => a.cx - b.cx).map((p, i) => [p.name, i])), [provinces])
  const documented = provinces.filter((p) => p.documented)
  const current = provinces.find((p) => p.name === active)

  const panelRef = useRef(null)
  const goExplore = (province) => navigate(province.placeId ? `/explorer?lieu=${province.placeId}` : '/explorer')
  // Sur écran tactile, un premier toucher affiche la province, le second ouvre
  // l'exploration. À la souris ou au clavier, le clic ouvre directement.
  const explore = (province) => {
    const touch = window.matchMedia('(hover: none)').matches
    if (touch && active !== province.name) {
      setActive(province.name)
      panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      return
    }
    goExplore(province)
  }

  return (
    <div className={`drc-map ${visible ? 'is-visible' : ''}`} ref={ref}>
      <div className="drc-map-canvas" onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label={t('drcMap.carteDes26ProvincesDe')}>
          <g className="drc-outline" aria-hidden="true">
            {provinces.map((p) => (
              <path key={p.name} d={p.d} />
            ))}
          </g>
          <g aria-hidden="true">
            {provinces.map((p) => (
              <path
                key={p.name}
                d={p.d}
                className={`drc-province ${p.documented ? 'documented' : ''} ${active === p.name ? 'active' : ''}`}
                style={{ '--i': order.get(p.name) }}
                onMouseEnter={() => setActive(p.name)}
                onClick={() => explore(p)}
              />
            ))}
          </g>
        </svg>

        {provinces.map((p) => (
          <button
            key={p.name}
            type="button"
            className={`map-marker ${p.documented ? 'documented' : ''} ${active === p.name ? 'active' : ''}`}
            style={{ left: `${(p.cx / MAP_WIDTH) * 100}%`, top: `${(p.cy / MAP_HEIGHT) * 100}%`, '--i': order.get(p.name), '--delay': `${(p.index % 7) * 0.35}s` }}
            aria-label={t('drcMap.markerLabel', { name: p.name, details: p.documented ? `${tn('unit.community', p.communityCount)}, ${tn('unit.content', p.itemCount)}` : t('drcMap.documentationAVenir2') })}
            onMouseEnter={() => setActive(p.name)}
            onFocus={() => setActive(p.name)}
            onClick={() => explore(p)}
          >
            <span className="map-marker-dot" aria-hidden="true" />
          </button>
        ))}

        {current && (
          <span className="map-label" style={{ left: `${(current.cx / MAP_WIDTH) * 100}%`, top: `${(current.cy / MAP_HEIGHT) * 100}%` }} aria-hidden="true">
            {current.name}
          </span>
        )}
      </div>

      <aside className="drc-map-panel" aria-live="polite" ref={panelRef}>
        {current ? (
          <div className="map-info" key={current.name}>
            <p className="eyebrow">
              <MapPin size={14} className="icon" aria-hidden="true" />{t('drcMap.province')}</p>
            <h3>{current.name}</h3>
            {current.documented ? (
              <ul className="map-info-stats">
                <li>
                  <Users size={16} className="icon" aria-hidden="true" />
                  {tn('unit.community', current.communityCount)}
                </li>
                <li>
                  <BookOpen size={16} className="icon" aria-hidden="true" />
                  {tn('unit.publishedContent', current.itemCount)}
                </li>
              </ul>
            ) : (
              <p className="muted small">{t('drcMap.aucunContenuPubliePourLe')}</p>
            )}
            <button type="button" className={current.documented ? '' : 'secondary'} onClick={() => goExplore(current)}>{t('drcMap.explorerLaProvince')}<ArrowRight size={16} className="icon" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="map-info">
            <p className="eyebrow">
              <Globe2 size={14} className="icon" aria-hidden="true" />{t('drcMap.26Provinces')}</p>
            <h3>{t('drcMap.survolezOuTouchezUneProvince')}</h3>
            <p className="muted small">{t('drcMap.chaquePointMarqueUneProvince')}</p>
          </div>
        )}

        <div className="map-legend" aria-hidden="true">
          <span>
            <span className="legend-dot documented" />{t('drcMap.documentee')}</span>
          <span>
            <span className="legend-dot" />{t('drcMap.documentationAVenir')}</span>
        </div>

        {documented.length > 0 && (
          <div className="map-documented">
            <span className="small muted">{t('drcMap.provincesDocumentees')}</span>
            <div className="chip-list" style={{ margin: 0 }}>
              {documented.map((p) => (
                <button key={p.name} type="button" className={`chip ${active === p.name ? 'active' : ''}`} onClick={() => goExplore(p)} onMouseEnter={() => setActive(p.name)} onFocus={() => setActive(p.name)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Link to="/explorer" className="section-link">{t('drcMap.explorerParProvinceEtLocalite')}<ArrowRight size={15} className="icon" aria-hidden="true" />
        </Link>
        <p className="map-credit">{t('drcMap.limitesDesProvincesContributeursOpenstreetmap')}</p>
      </aside>
    </div>
  )
}
