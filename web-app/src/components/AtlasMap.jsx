import { Award, Car, ChevronLeft, Mic, MicOff, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronRight, Compass, Expand, ExternalLink, Layers, MapPin, Minus, Play, Plus, Sparkles, Trees, X } from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import { atlasPhoto, CATEGORIES, CITIES, IUCN, RELIEFS, ZONES } from '../data/atlasContent.js'
import { AmbientMusic } from './ambientMusic.js'
import { NARRATION_TIMINGS } from '../data/atlasNarration.js'
import { ClipPlayer, narrationDuration, narrationFor, narrationSupported, Narrator } from './narrator.js'
import { ATLAS_POINTS, CATEGORY_ICONS, TOUR, toXY, ZONE_BOXES } from './atlasModel.js'
import { t } from '../i18n/index.js'
import { PARK_OF_POINT, PARKS, pointForTag } from '../data/atlasParks.js'
import { ROADS } from '../data/atlasRoads.js'
import { LAKES, RIVERS } from './atlasMapData.js'
import { PARK_SHAPES } from './atlasParksData.js'
import { MAP_HEIGHT as MH, MAP_WIDTH as MW, PROVINCES } from './drcMapData.js'
import './atlas.css'

// Atlas vivant : carte artistique de la RDC (et d'elle seule). Rendu SVG en
// couches — socle en relief, régions naturelles texturées, reliefs, lacs et
// rivières découpés par le contour du pays — avec navigation libre (glisser,
// molette, pincement, clavier) et fiches détaillées illustrées.

const CITIES_XY = CITIES.map((c) => ({ ...c, xy: toXY(c.at) }))
const LABELS_XY = ZONES.map((z) => ({ id: z.id, name: z.short, xy: toXY(z.label) }))

// Étiquettes des grands cours d'eau, écrites le long du tracé (de gauche à droite).
const RIVER_LABELS = [
  ['Congo', 'Fleuve Congo', 0.42],
  ['Lualaba', 'Lualaba', 0.5],
  ['Kasai', 'Kasaï', 0.45],
  ['Ubangi', 'Ubangi', 0.5],
].map(([name, label, at]) => {
  const parts = RIVERS.filter((r) => r.name === name)
  if (!parts.length) return null
  const longest = parts.reduce((a, b) => (b.d.length > a.d.length ? b : a))
  let pts = longest.d.slice(1).split('L').map((s) => s.split(',').map(Number))
  if (pts[0][0] > pts.at(-1)[0]) pts = pts.reverse()
  return { id: `river-${name}`, label, at, d: 'M' + pts.map((p) => p.join(',')).join('L') }
}).filter(Boolean)

// ---------------------------------------------------------------------------
// Textures des régions naturelles : motifs générés une fois, de façon
// déterministe (cimes d'arbres, touffes d'herbe, acacias).
// ---------------------------------------------------------------------------
const TILE = 28

function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function scatter(seed, n, margin = 2.5) {
  const r = random(seed)
  const cols = Math.ceil(Math.sqrt(n))
  const cell = (TILE - 2 * margin) / cols
  const out = []
  for (let i = 0; i < cols * cols && out.length < n; i++) {
    const cx = margin + ((i % cols) + 0.5) * cell + (r() - 0.5) * cell * 0.8
    const cy = margin + (Math.floor(i / cols) + 0.5) * cell + (r() - 0.5) * cell * 0.8
    out.push([cx, cy, r()])
  }
  return out
}

const f1 = (n) => Math.round(n * 100) / 100

function crowns(seed, n, rMin, rMax) {
  return scatter(seed, n).map(([x, y, v], i) => {
    const r = f1(rMin + v * (rMax - rMin))
    const lobes = [[0, -0.2, 0.78], [-0.5, 0.22, 0.66], [0.5, 0.26, 0.62]]
    return (
      <g key={i}>
        <ellipse className="tx-shade" cx={f1(x + r * 0.3)} cy={f1(y + r * 0.45)} rx={f1(r * 1.05)} ry={f1(r * 0.8)} />
        {lobes.map(([dx, dy, k], j) => (
          <circle key={j} className="tx-crown" cx={f1(x + dx * r)} cy={f1(y + dy * r)} r={f1(r * k)} />
        ))}
        <circle className="tx-light" cx={f1(x - r * 0.22)} cy={f1(y - r * 0.42)} r={f1(r * 0.36)} />
      </g>
    )
  })
}

function grass(seed, n) {
  const d = scatter(seed, n, 1.5).map(([x, y, v]) => {
    const h = 1.1 + v * 0.8
    return `M${f1(x)},${f1(y)}l-0.55,-${f1(h)}M${f1(x)},${f1(y)}l0.1,-${f1(h * 1.15)}M${f1(x)},${f1(y)}l0.65,-${f1(h * 0.9)}`
  }).join('')
  return <path className="tx-grass" d={d} />
}

function acacias(seed, n) {
  return scatter(seed, n, 5).map(([x, y], i) => (
    <g key={i}>
      <path className="tx-trunk" d={`M${f1(x)},${f1(y + 2.2)}L${f1(x)},${f1(y)}`} />
      <ellipse className="tx-shade" cx={f1(x + 0.4)} cy={f1(y + 0.35)} rx="2.6" ry="0.95" />
      <ellipse className="tx-crown" cx={f1(x)} cy={f1(y)} rx="2.6" ry="0.95" />
    </g>
  ))
}

const PATTERNS = {
  foret: <>{crowns(11, 16, 1.5, 2.5)}</>,
  rift: <>{crowns(23, 25, 1.0, 1.7)}</>,
  nord: <>{grass(31, 20)}{acacias(37, 3)}{crowns(39, 3, 0.9, 1.3)}</>,
  kasai: <>{grass(41, 24)}{crowns(43, 4, 0.9, 1.4)}</>,
  katanga: <>{grass(51, 14)}{crowns(53, 8, 1.2, 1.9)}</>,
  atlantique: <>{grass(61, 10)}{crowns(63, 9, 1.1, 1.8)}</>,
}

function ReliefGlyph({ x, y, size, type }) {
  const s = size
  const transform = `translate(${f1(x)} ${f1(y)})`
  if (type === 'volcano') {
    return (
      <g transform={transform} className="relief volcano">
        <ellipse className="relief-shadow" cx={s * 0.15} cy={0.6} rx={s} ry={s * 0.22} />
        <path className="relief-light" d={`M${-s * 0.9},0L${-s * 0.2},${-s * 0.85}L${s * 0.05},${-s * 0.85}L${s * 0.05},0Z`} />
        <path className="relief-dark" d={`M${s * 0.05},0L${s * 0.05},${-s * 0.85}L${s * 0.2},${-s * 0.85}L${s * 0.9},0Z`} />
        <ellipse className="relief-glow" cx="0" cy={-s * 0.86} rx={s * 0.42} ry={s * 0.2} />
        <ellipse className="relief-lava" cx="0" cy={-s * 0.86} rx={s * 0.2} ry={s * 0.07} />
      </g>
    )
  }
  return (
    <g transform={transform} className="relief">
      <ellipse className="relief-shadow" cx={s * 0.15} cy={0.6} rx={s} ry={s * 0.22} />
      <path className="relief-light" d={`M${-s * 0.9},0L0,${-s}L${s * 0.12},0Z`} />
      <path className="relief-dark" d={`M${s * 0.12},0L0,${-s}L${s * 0.9},0Z`} />
      {type === 'snow' && <path className="relief-snow" d={`M${-s * 0.3},${-s * 0.66}L0,${-s}L${s * 0.3},${-s * 0.66}L${s * 0.1},${-s * 0.72}L${-s * 0.06},${-s * 0.62}L${-s * 0.16},${-s * 0.7}Z`} />}
    </g>
  )
}

// Territoire national, eaux comprises : les provinces et la partie congolaise
// des lacs (frontières au milieu des lacs Tanganyika, Kivu, Édouard, Albert, Moero).
const TERRITORY = [...PROVINCES.map((p) => p.d), ...LAKES.map((l) => l.d)]

// La carte elle-même : ne dépend d'aucun état, elle n'est dessinée qu'une fois.
const MapArt = memo(function MapArt() {
  return (
    <>
      <defs>
        <g id="atlas-country">
          {TERRITORY.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <clipPath id="atlas-clip">
          {TERRITORY.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
        <mask id="atlas-outside" maskUnits="userSpaceOnUse" x={-MW} y={-MH} width={MW * 3} height={MH * 3}>
          <rect x={-MW} y={-MH} width={MW * 3} height={MH * 3} fill="#fff" />
          <use href="#atlas-country" fill="#000" />
        </mask>
        <filter id="atlas-soft" x="-15%" y="-15%" width="130%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        {/* Hachures claires : distinguent les parcs sur tous les fonds. */}
        <pattern id="atlas-park-hatch" className="atlas-park-hatch-tile" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3.2" />
        </pattern>
        {Object.entries(PATTERNS).map(([id, content]) => (
          <pattern key={id} id={`atlas-tex-${id}`} className={`atlas-tex atlas-tex-${id}`} width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            {content}
          </pattern>
        ))}
      </defs>

      {/* Socle : ombre portée puis épaisseur du terrain. */}
      <use href="#atlas-country" className="atlas-ground-shadow" filter="url(#atlas-soft)" />
      <g className="atlas-extrusion">
        {[6, 5, 4, 3, 2, 1].map((i) => (
          <use key={i} href="#atlas-country" style={{ '--i': i }} />
        ))}
      </g>

      {/* Régions naturelles, colorées et texturées. */}
      <g className="atlas-zones">
        {ZONES.map((zone, zi) => (
          <g key={zone.id} className={`atlas-zone zone-${zone.id}`} data-zone={zone.id} style={{ '--zi': zi }}>
            {PROVINCES.filter((p) => zone.provinces.includes(p.name)).map((p) => (
              <g key={p.name}>
                <path d={p.d} className="atlas-land" />
                <path d={p.d} className="atlas-texture" fill={`url(#atlas-tex-${zone.id})`} />
                <path d={p.d} className="atlas-veil" />
              </g>
            ))}
          </g>
        ))}
      </g>
      <g className="atlas-province-lines" aria-hidden="true">
        {PROVINCES.map((p) => (
          <path key={p.name} d={p.d} />
        ))}
      </g>

      {/* Eaux : lacs et rivières, limités au territoire congolais. */}
      <g clipPath="url(#atlas-clip)" className="atlas-water">
        {LAKES.map((l) => (
          <path key={l.name} d={l.d} className="atlas-lake" />
        ))}
        {RIVERS.map((r, i) => (
          <path key={i} d={r.d} className="atlas-river" style={{ '--w': r.w }} />
        ))}
        {RIVERS.filter((r) => r.flow).map((r, i) => (
          <path key={i} d={r.d} className="atlas-river-flow" style={{ '--w': r.w }} />
        ))}
      </g>

      <g className="atlas-reliefs">
        {RELIEFS.map(([lat, lon, size, type], i) => {
          const [x, y] = toXY([lat, lon])
          return <ReliefGlyph key={i} x={x} y={y} size={size} type={type} />
        })}
      </g>

      {/* Parcs nationaux et parc marin : limites réelles, couleur de chaque parc. */}
      <g className="atlas-parks">
        {PARKS.map((park) => (
          <g key={park.id} className={`atlas-park park-${park.id}`} data-park={park.id} style={{ '--park': park.couleur_carte }}>
            <path d={PARK_SHAPES[park.id].d} className="atlas-park-fill" />
            <path d={PARK_SHAPES[park.id].d} className="atlas-park-hatch" fill="url(#atlas-park-hatch)" />
          </g>
        ))}
      </g>

      {/* Routes nationales : liseré sombre, trait clair, zone de clic élargie. */}
      <g className="atlas-roads">
        {ROADS.map((road) => (
          <g key={road.id} className={`atlas-road road-${road.id}`} data-road={road.id}>
            <path d={road.d} className="atlas-road-hit" />
            <path d={road.d} className="atlas-road-casing" />
            <path d={road.d} className="atlas-road-line" />
          </g>
        ))}
      </g>

      <g className="atlas-coast" mask="url(#atlas-outside)">
        {TERRITORY.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      <g className="atlas-river-labels">
        {RIVER_LABELS.map((r) => (
          <g key={r.id}>
            <path id={r.id} d={r.d} fill="none" stroke="none" />
            <text dy="-0.55em">
              <textPath href={`#${r.id}`} startOffset={`${r.at * 100}%`} textAnchor="middle">
                {r.label}
              </textPath>
            </text>
          </g>
        ))}
      </g>
    </>
  )
})

// ---------------------------------------------------------------------------
// Fiches
// ---------------------------------------------------------------------------
function Photo({ photo, alt, onExpand, icon: Icon, children }) {
  const [loaded, setLoaded] = useState(false)
  if (!photo) {
    return (
      <figure className="atlas-photo is-empty">
        {Icon && <Icon size={56} className="icon" aria-hidden="true" />}
        <figcaption>{t('atlas.photoAVenir')}</figcaption>
        {children}
      </figure>
    )
  }
  return (
    <figure className="atlas-photo">
      <img
        src={photo.src}
        srcSet={photo.srcSet}
        sizes="(max-width: 899px) 100vw, 440px"
        alt={alt}
        className={loaded ? 'is-loaded' : ''}
        onLoad={() => setLoaded(true)}
        ref={(img) => img?.complete && img.naturalWidth && !loaded && setLoaded(true)}
      />
      {onExpand && (
        <button type="button" className="atlas-photo-expand" onClick={onExpand} aria-label={t('atlas.agrandirLaPhoto')}>
          <Expand size={16} className="icon" aria-hidden="true" />
        </button>
      )}
      {children}
    </figure>
  )
}

// Vignette d'un point : sa photographie, ou l'icône de sa catégorie.
function PointThumb({ point }) {
  const photo = atlasPhoto(point.id)
  const Icon = CATEGORY_ICONS[point.category]
  return photo ? (
    <img src={photo.thumb} alt="" loading="lazy" />
  ) : (
    <span className={`atlas-thumb-empty cat-${point.category}`}>
      <Icon size={22} className="icon" aria-hidden="true" />
    </span>
  )
}

function Credit({ photo, note }) {
  if (!photo) return null
  return (
    <p className="atlas-credit">
      {note && <span className="atlas-credit-note">{note}</span>}
      {t('atlas.photo')} {photo.author} — {photo.license} ·{' '}
      <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
        {t('atlas.wikimediaCommons')}
        <ExternalLink size={12} className="icon" aria-hidden="true" />
      </a>
    </p>
  )
}

function Facts({ facts }) {
  return (
    <dl className="atlas-facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PointSheet({ point, position, onOpen, onClose, onExpand }) {
  const category = CATEGORIES.find((c) => c.id === point.category)
  const Icon = CATEGORY_ICONS[point.category]
  const zone = ZONES.find((z) => z.id === point.zone)
  const photo = atlasPhoto(point.id)
  const neighbours = ATLAS_POINTS.filter((p) => p.zone === point.zone && p.id !== point.id).slice(0, 4)
  const park = PARKS.find((p) => p.id === PARK_OF_POINT.get(point.id))
  return (
    <article className={`atlas-sheet cat-${point.category}`} aria-labelledby="atlas-sheet-title">
      <Photo photo={photo} alt={point.name} icon={Icon} onExpand={photo ? () => onExpand({ photo, title: point.name, note: point.photoNote }) : null}>
        <span className="atlas-photo-chip">
          <Icon size={14} className="icon" aria-hidden="true" />
          {category.label}
        </span>
      </Photo>
      <div className="atlas-sheet-body">
        <p className="atlas-sheet-eyebrow">
          <MapPin size={14} className="icon" aria-hidden="true" />
          {point.place}
        </p>
        <h2 id="atlas-sheet-title">{point.name}</h2>
        <p className={point.category === 'faune' || point.category === 'flore' ? 'atlas-latin' : 'atlas-subtitle'}>{point.latin}</p>
        {(point.endemic || point.iucn || point.status) && (
          <div className="atlas-badges">
            {point.status === 'construction' && <span className="atlas-badge iucn">{t('atlas.enConstruction')}</span>}
            {point.endemic && (
              <span className="atlas-badge endemic">
                <Sparkles size={13} className="icon" aria-hidden="true" />{t('atlas.endemiqueDeLaRdc')}</span>
            )}
            {point.iucn && (
              <span className={`atlas-badge iucn iucn-${point.iucn}`} title={t('atlas.listeRougeUicn')}>
                {t('atlas.uicn')} {point.iucn} · {IUCN[point.iucn]}
              </span>
            )}
          </div>
        )}
        <p className="atlas-summary">{point.summary}</p>
        {point.text.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
        <Facts facts={[...point.facts, [t('atlas.province'), point.province]]} />
        {park && (
          <button type="button" className="atlas-zone-link" onClick={() => onOpen({ parc: park.id })}>
            <span className="atlas-swatch" style={{ background: park.couleur_carte }} aria-hidden="true" />
            <span>
              <small>{park.type === 'Parc marin et côtier' ? t('atlas.parcMarin') : t('atlas.parcNational')}</small>
              {park.nom}
            </span>
            <ChevronRight size={16} className="icon" aria-hidden="true" />
          </button>
        )}
        {zone && (
          <button type="button" className="atlas-zone-link" onClick={() => onOpen({ region: zone.id })}>
            <span className={`atlas-swatch zone-${zone.id}`} aria-hidden="true" />
            <span>
              <small>{t('atlas.regionNaturelle')}</small>
              {zone.name}
            </span>
            <ChevronRight size={16} className="icon" aria-hidden="true" />
          </button>
        )}
        {neighbours.length > 0 && (
          <div className="atlas-neighbours">
            <h3>{t('atlas.aDecouvrirAProximite')}</h3>
            <div className="atlas-thumbs">
              {neighbours.map((p) => (
                <button key={p.id} type="button" className="atlas-thumb" onClick={() => onOpen({ lieu: p.id })}>
                  <PointThumb point={p} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Credit photo={photo} note={point.photoNote} />
      </div>
      <SheetNav position={position} onOpen={onOpen} onClose={onClose} />
    </article>
  )
}

function ZoneSheet({ zone, onOpen, onClose, onExpand }) {
  const photo = atlasPhoto(zone.photo)
  const points = ATLAS_POINTS.filter((p) => p.zone === zone.id)
  return (
    <article className="atlas-sheet" aria-labelledby="atlas-sheet-title">
      <Photo photo={photo} alt={zone.name} onExpand={() => onExpand({ photo, title: zone.name })}>
        <span className={`atlas-photo-chip zone-chip zone-${zone.id}`}>
          <Layers size={14} className="icon" aria-hidden="true" />{t('atlas.regionNaturelle')}</span>
      </Photo>
      <div className="atlas-sheet-body">
        <p className="atlas-sheet-eyebrow">
          <MapPin size={14} className="icon" aria-hidden="true" />
          {zone.provinces.join(' · ')}
        </p>
        <h2 id="atlas-sheet-title">{zone.name}</h2>
        <p className="atlas-summary">{zone.summary}</p>
        {zone.text.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
        <Facts facts={zone.facts} />
        {points.length > 0 && (
          <div className="atlas-neighbours">
            <h3>{t('atlas.aDecouvrirDansCetteRegion')}</h3>
            <div className="atlas-thumbs">
              {points.map((p) => (
                <button key={p.id} type="button" className="atlas-thumb" onClick={() => onOpen({ lieu: p.id })}>
                  <PointThumb point={p} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Credit photo={photo} />
      </div>
      <div className="atlas-sheet-nav">
        <button type="button" className="secondary" onClick={onClose}>
          <X size={16} className="icon" aria-hidden="true" />{t('common.close')}</button>
      </div>
    </article>
  )
}

// Étiquettes d'une liste du parc ; celles qui ont une fiche sur l'atlas l'ouvrent.
function Tags({ title, items, onOpen }) {
  if (!items?.length) return null
  return (
    <div className="atlas-tag-group">
      <h3>{title}</h3>
      <ul className="atlas-tags">
        {items.map((item) => {
          const id = pointForTag(item)
          return (
            <li key={item}>
              {id ? (
                <button type="button" className="atlas-tag is-link" onClick={() => onOpen({ lieu: id })} title={t('atlas.voirLaFiche')}>
                  {item}
                  <ChevronRight size={13} className="icon" aria-hidden="true" />
                </button>
              ) : (
                <span className="atlas-tag">{item}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ParkSheet({ park, onOpen, onClose, onExpand }) {
  const photo = atlasPhoto(park.photo)
  const marine = park.type === 'Parc marin et côtier'
  const points = park.points.map((id) => ATLAS_POINTS.find((p) => p.id === id)).filter(Boolean)
  return (
    <article className="atlas-sheet" style={{ '--park': park.couleur_carte }} aria-labelledby="atlas-sheet-title">
      <Photo photo={photo} alt={park.nom} onExpand={() => onExpand({ photo, title: park.nom })}>
        <span className="atlas-photo-chip park-chip">
          <Trees size={14} className="icon" aria-hidden="true" />
          {marine ? t('atlas.parcMarin') : t('atlas.parcNational')}
        </span>
      </Photo>
      <div className="atlas-sheet-body">
        <p className="atlas-sheet-eyebrow">
          <MapPin size={14} className="icon" aria-hidden="true" />
          {park.province.join(' · ')}
        </p>
        <h2 id="atlas-sheet-title">{park.nom}</h2>
        <p className="atlas-subtitle">{t('atlas.typeEtCreation', { type: park.type, year: park.annee_creation })}</p>
        {(park.patrimoine_unesco || park.site_ramsar) && (
          <div className="atlas-badges">
            {park.patrimoine_unesco && (
              <span className="atlas-badge unesco">
                <Award size={13} className="icon" aria-hidden="true" />{t('atlas.patrimoineMondialUnesco')}</span>
            )}
            {park.site_ramsar && <span className="atlas-badge endemic">{t('atlas.siteRamsar')}</span>}
          </div>
        )}
        <p className="atlas-summary">{park.description}</p>
        <Facts
          facts={[
            [t('atlas.creation'), String(park.annee_creation)],
            [park.province.length > 1 ? t('atlas.provinces') : t('atlas.province'), park.province.join(', ')],
            [t('atlas.type'), park.type],
          ]}
        />
        <Tags title={t('atlas.particularites')} items={park.particularites} onOpen={onOpen} />
        <Tags title={t('atlas.faune')} items={park.faune} onOpen={onOpen} />
        <Tags title={t('atlas.flore')} items={park.flore} onOpen={onOpen} />
        <Tags title={t('atlas.eauxDuParc')} items={park.hydrographie} onOpen={onOpen} />
        <Tags title={t('atlas.sitesRemarquables')} items={park.sites_remarquables} onOpen={onOpen} />
        <Tags title={t('atlas.aVivreSurPlace')} items={park.interet_touristique} onOpen={onOpen} />
        {points.length > 0 && (
          <div className="atlas-neighbours">
            <h3>{t('atlas.dansCeParcSurLAtlas')}</h3>
            <div className="atlas-thumbs">
              {points.map((p) => (
                <button key={p.id} type="button" className="atlas-thumb" onClick={() => onOpen({ lieu: p.id })}>
                  <PointThumb point={p} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Credit photo={photo} />
      </div>
      <div className="atlas-sheet-nav">
        <button type="button" className="secondary" onClick={onClose}>
          <X size={16} className="icon" aria-hidden="true" />{t('common.close')}</button>
      </div>
    </article>
  )
}

function RoadSheet({ road, onClose, onExpand }) {
  const photos = road.photos.map((key) => atlasPhoto(key)).filter(Boolean)
  const [index, setIndex] = useState(0)
  const photo = photos[index] ?? null
  const towns = road.towns
  return (
    <article className="atlas-sheet cat-routes" aria-labelledby="atlas-sheet-title">
      <Photo key={index} photo={photo} alt={`${road.name} — ${t('atlas.vue')} ${index + 1}`} icon={Car} onExpand={photo ? () => onExpand({ photo, title: road.name }) : null}>
        <span className="atlas-photo-chip road-chip">
          <Car size={14} className="icon" aria-hidden="true" />{t('atlas.routeNationale')}</span>
      </Photo>
      {photos.length > 1 && (
        <div className="atlas-gallery" role="group" aria-label={t('atlas.vuesDeLaRoute')}>
          {photos.map((p, i) => (
            <button key={p.src} type="button" className={i === index ? 'is-active' : ''} aria-pressed={i === index} aria-label={`${t('atlas.vue')} ${i + 1}`} onClick={() => setIndex(i)}>
              <img src={p.thumb} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <div className="atlas-sheet-body">
        <p className="atlas-sheet-eyebrow">
          <MapPin size={14} className="icon" aria-hidden="true" />
          {road.provinces.join(' · ')}
        </p>
        <h2 id="atlas-sheet-title">
          <span className="atlas-shield">{road.ref}</span> {road.name}
        </h2>
        {towns.length > 1 && <p className="atlas-subtitle">{t('atlas.deAA', { from: towns[0], to: towns.at(-1) })}</p>}
        {road.intro && <p className="atlas-summary">{road.intro}</p>}
        <Facts
          facts={[
            [t('atlas.traceCartographie'), t('atlas.environKm', { km: road.km.toLocaleString('fr-FR') })],
            [road.provinces.length > 1 ? t('atlas.provinces') : t('atlas.province'), road.provinces.join(', ')],
          ]}
        />
        {towns.length > 0 && (
          <div className="atlas-tag-group">
            <h3>{t('atlas.villesDesservies')}</h3>
            <ol className="atlas-itinerary">
              {towns.map((town) => (
                <li key={town}>{town}</li>
              ))}
            </ol>
          </div>
        )}
        <p className="atlas-credit-note atlas-road-note">{t('atlas.noteRoutes')}</p>
        {photos.map((p, i) => i === index && <Credit key={p.src} photo={p} />)}
      </div>
      <div className="atlas-sheet-nav">
        <button type="button" className="secondary" onClick={onClose}>
          <X size={16} className="icon" aria-hidden="true" />{t('common.close')}</button>
      </div>
    </article>
  )
}

function SheetNav({ position, onOpen }) {
  if (!position) return null
  const { prev, next, index, total } = position
  return (
    <div className="atlas-sheet-nav">
      <button type="button" className="secondary" onClick={() => onOpen({ lieu: prev.id })} aria-label={t('atlas.precedentNom', { name: prev.name })}>
        <ChevronLeft size={16} className="icon" aria-hidden="true" />{t('atlas.precedent')}</button>
      <span className="atlas-sheet-count">
        {index + 1} / {total}
      </span>
      <button type="button" onClick={() => onOpen({ lieu: next.id })} aria-label={t('atlas.suivantNom', { name: next.name })}>
        {t('atlas.suivant')}<ChevronRight size={16} className="icon" aria-hidden="true" />
      </button>
    </div>
  )
}

function Lightbox({ item, onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && (e.stopPropagation(), onClose())
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previous?.focus?.()
    }
  }, [onClose])
  return createPortal(
    <div className="atlas-lightbox" role="dialog" aria-modal="true" aria-label={item.title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button ref={closeRef} type="button" className="atlas-lightbox-close" onClick={onClose} aria-label={t('common.close')}>
        <X size={20} className="icon" aria-hidden="true" />
      </button>
      <figure>
        <img src={item.photo.src} alt={item.title} />
        <figcaption>
          <strong>{item.title}</strong>
          <Credit photo={item.photo} note={item.note} />
        </figcaption>
      </figure>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Carte interactive
// ---------------------------------------------------------------------------
// 100 km en unités de la carte (projection de Mercator, à l'équateur).
const UNITS_PER_KM = 34.49 / 100
const SCALE_STEPS = [20, 50, 100, 200, 500]
const K_MIN = 0.9
const K_MAX = 10
const PANEL_W = 440
// Durée d'une étape de la visite documentaire : le temps de lire le résumé
// et le premier paragraphe, entre 9 et 17 secondes.
const stepDuration = (point) => Math.min(17000, Math.max(9000, 3500 + (point.summary.length + point.text[0].length) * 38))

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function AtlasMap() {
  const [params, setParams] = useSearchParams()
  const selectedPoint = ATLAS_POINTS.find((p) => p.id === params.get('lieu')) ?? null
  const selectedPark = selectedPoint ? null : PARKS.find((p) => p.id === params.get('parc')) ?? null
  const selectedRoad = selectedPoint || selectedPark ? null : ROADS.find((r) => r.id === params.get('route')) ?? null
  const selectedZone = selectedPoint || selectedPark || selectedRoad ? null : ZONES.find((z) => z.id === params.get('region')) ?? null
  const panelOpen = Boolean(selectedPoint || selectedPark || selectedRoad || selectedZone)

  const [cats, setCats] = useState(() => new Set(CATEGORIES.map((c) => c.id)))
  const [level, setLevel] = useState(0)
  const [hoverZone, setHoverZone] = useState(null)
  const [hoverPark, setHoverPark] = useState(null)
  const [showParks, setShowParks] = useState(true)
  const [showRoads, setShowRoads] = useState(true)
  const [hoverRoad, setHoverRoad] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [explorerOpen, setExplorerOpen] = useState(() => window.innerWidth >= 900)
  const [ready, setReady] = useState(false)
  // Visite documentaire : null, ou { paused, muted }.
  const [tour, setTour] = useState(null)
  const tourRef = useRef(null)
  useEffect(() => {
    tourRef.current = tour
  }, [tour])
  const music = useRef(null)
  const explorerBefore = useRef(true)
  const step = useRef({ id: null, remaining: 0, started: 0, sentence: 0 })
  const narrator = useRef(null)
  const clips = useRef(null)

  const stageRef = useRef(null)
  const svgRef = useRef(null)
  const explorerRef = useRef(null)
  const scaleRef = useRef(null)
  const view = useRef({ cx: MW / 2, cy: MH / 2, k: 1 })
  const size = useRef({ w: 0, h: 0, s0: 1, mobile: false })
  const levelRef = useRef(0)
  const frame = useRef(0)

  const visiblePoints = useMemo(() => ATLAS_POINTS.filter((p) => cats.has(p.category)), [cats])
  const position = useMemo(() => {
    if (!selectedPoint) return null
    const list = visiblePoints.some((p) => p.id === selectedPoint.id) ? visiblePoints : ATLAS_POINTS
    const index = list.findIndex((p) => p.id === selectedPoint.id)
    return { index, total: list.length, prev: list[(index - 1 + list.length) % list.length], next: list[(index + 1) % list.length] }
  }, [selectedPoint, visiblePoints])

  // ---- Caméra -------------------------------------------------------------
  const apply = useCallback(() => {
    const svg = svgRef.current
    const stage = stageRef.current
    if (!svg || !stage) return
    const { w, h, s0 } = size.current
    const { cx, cy, k } = view.current
    const s = s0 * k
    const vw = w / s
    const vh = h / s
    const vx = cx - vw / 2
    const vy = cy - vh / 2
    svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`)
    const st = stage.style
    st.setProperty('--vx', vx)
    st.setProperty('--vy', vy)
    st.setProperty('--vw', vw)
    st.setProperty('--vh', vh)
    st.setProperty('--k', k)
    st.setProperty('--s', s)
    // Échelle graphique : la longueur « ronde » la plus proche de 90 px.
    const km = SCALE_STEPS.reduce((best, d) => (Math.abs(d * UNITS_PER_KM * s - 90) < Math.abs(best * UNITS_PER_KM * s - 90) ? d : best))
    st.setProperty('--scale-w', `${Math.round(km * UNITS_PER_KM * s)}px`)
    if (scaleRef.current) scaleRef.current.textContent = `${km} km`
    const next = k < 1.7 ? 0 : k < 3 ? 1 : 2
    if (next !== levelRef.current) {
      levelRef.current = next
      setLevel(next)
    }
  }, [])

  // Marges occupées par les panneaux : la carte se centre dans l'espace libre.
  const insets = useCallback((withPanel) => {
    const { w, h, mobile } = size.current
    const explorer = explorerRef.current
    if (mobile) {
      return { l: 0, r: 0, t: explorer ? explorer.offsetHeight + 12 : 0, b: withPanel ? Math.round(h * 0.6) : 0 }
    }
    return { l: explorer ? explorer.offsetWidth + 24 : 0, r: withPanel ? Math.min(PANEL_W, w * 0.45) + 24 : 0, t: 0, b: 0 }
  }, [])

  const clampView = ({ cx, cy, k }) => {
    const kk = Math.min(K_MAX, Math.max(K_MIN, k))
    return { cx: Math.min(MW, Math.max(0, cx)), cy: Math.min(MH, Math.max(0, cy)), k: kk }
  }

  const centerOn = useCallback((x, y, k, withPanel) => {
    const { w, h, s0 } = size.current
    const ins = insets(withPanel)
    const s = s0 * k
    const ax = ins.l + (w - ins.l - ins.r) / 2
    const ay = ins.t + (h - ins.t - ins.b) / 2
    return { cx: x + (w / 2 - ax) / s, cy: y + (h / 2 - ay) / s, k }
  }, [insets])

  const animateTo = useCallback((target, duration = 1000) => {
    cancelAnimationFrame(frame.current)
    target = clampView(target)
    const from = { ...view.current }
    if (reducedMotion()) {
      view.current = target
      apply()
      return
    }
    // Pour les longs trajets, la caméra prend de la hauteur à mi-parcours.
    const { w, s0 } = size.current
    const distance = Math.hypot(target.cx - from.cx, target.cy - from.cy) * s0 * Math.min(from.k, target.k)
    const lift = 1 - Math.min(1, Math.max(0.45, (w * 0.7) / Math.max(distance, 1)))
    const t0 = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration)
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const k = from.k * Math.pow(target.k / from.k, e) * (1 - lift * Math.sin(Math.PI * t))
      view.current = { cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e, k }
      apply()
      if (t < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }, [apply])

  const homeView = useCallback((withPanel = false) => centerOn(MW / 2, MH / 2, 1, withPanel), [centerOn])

  const zoomAt = useCallback((px, py, k2) => {
    cancelAnimationFrame(frame.current)
    const { w, h, s0 } = size.current
    const v = view.current
    const s = s0 * v.k
    const mx = v.cx + (px - w / 2) / s
    const my = v.cy + (py - h / 2) / s
    const k = Math.min(K_MAX, Math.max(K_MIN, k2))
    const s2 = s0 * k
    view.current = clampView({ cx: mx - (px - w / 2) / s2, cy: my - (py - h / 2) / s2, k })
    apply()
  }, [apply])

  // Taille de la scène et échelle de base (toute la RDC visible).
  useLayoutEffect(() => {
    const stage = stageRef.current
    const measure = () => {
      const w = stage.clientWidth
      const h = stage.clientHeight
      const mobile = w < 900
      size.current = { w, h, s0: 1, mobile }
      const ins = insets(false)
      const availW = w - ins.l - ins.r - (mobile ? 24 : 64)
      const availH = h - ins.t - ins.b - (mobile ? 24 : 64)
      size.current.s0 = Math.max(0.2, Math.min(availW / MW, availH / MH))
    }
    measure()
    view.current = homeView(false)
    apply()
    const observer = new ResizeObserver(() => {
      const { cx, cy, k } = view.current
      measure()
      view.current = clampView({ cx, cy, k })
      apply()
    })
    observer.observe(stage)
    const id = requestAnimationFrame(() => setReady(true))
    return () => {
      observer.disconnect()
      cancelAnimationFrame(id)
    }
  }, [apply, homeView, insets])

  // Cadrage automatique sur l'élément sélectionné.
  useEffect(() => {
    if (selectedPoint) {
      animateTo(centerOn(selectedPoint.x, selectedPoint.y, tourRef.current ? 4.6 : Math.max(view.current.k, 4.2), true), tourRef.current ? 2600 : 1000)
    } else if (selectedZone || selectedPark || selectedRoad) {
      const box = selectedRoad ? selectedRoad.box : selectedPark ? PARK_SHAPES[selectedPark.id].box : ZONE_BOXES.get(selectedZone.id)
      const { w, h, s0 } = size.current
      const ins = insets(true)
      const k = Math.min((w - ins.l - ins.r) / (box.w * 1.4), (h - ins.t - ins.b) / (box.h * 1.4)) / s0
      animateTo(centerOn(box.x + box.w / 2, box.y + box.h / 2, Math.min(selectedPark ? 7 : 4, Math.max(1.1, k)), true))
    }
  }, [selectedPoint, selectedZone, selectedPark, selectedRoad, animateTo, centerOn, insets])

  // ---- Gestes : glisser, pincer, molette ----------------------------------
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const dragged = useRef(false)

  useEffect(() => {
    const stage = stageRef.current
    const onWheel = (e) => {
      // Au-dessus d'un panneau ou d'une fiche, la molette fait défiler son contenu.
      if (e.target.closest('.atlas-ui')) return
      e.preventDefault()
      const rect = stage.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016))
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, view.current.k * factor)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest('.atlas-ui')) return
    cancelAnimationFrame(frame.current)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dragged.current = false
    gesture.current = { start: { x: e.clientX, y: e.clientY }, captured: false }
  }

  const onPointerMove = (e) => {
    const previous = pointers.current.get(e.pointerId)
    if (!previous || !gesture.current) return
    const current = { x: e.clientX, y: e.clientY }
    const g = gesture.current
    if (!g.captured) {
      if (Math.hypot(current.x - g.start.x, current.y - g.start.y) < 5 && pointers.current.size < 2) return
      g.captured = true
      dragged.current = true
      stageRef.current.setPointerCapture?.(e.pointerId)
      stageRef.current.classList.add('is-dragging')
    }
    const { s0 } = size.current
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.entries()].map(([id, p]) => (id === e.pointerId ? current : p))
      const [pa, pb] = [...pointers.current.values()]
      const before = Math.hypot(pa.x - pb.x, pa.y - pb.y)
      const after = Math.hypot(a.x - b.x, a.y - b.y)
      const rect = stageRef.current.getBoundingClientRect()
      pointers.current.set(e.pointerId, current)
      if (before > 0) zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, view.current.k * (after / before))
      return
    }
    const v = view.current
    const s = s0 * v.k
    view.current = clampView({ cx: v.cx - (current.x - previous.x) / s, cy: v.cy - (current.y - previous.y) / s, k: v.k })
    pointers.current.set(e.pointerId, current)
    apply()
  }

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      gesture.current = null
      stageRef.current?.classList.remove('is-dragging')
    }
  }

  const onDoubleClick = (e) => {
    if (e.target.closest('.atlas-ui, .atlas-marker')) return
    const rect = stageRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const { w, h, s0 } = size.current
    const v = view.current
    const s = s0 * v.k
    const x = v.cx + (px - w / 2) / s
    const y = v.cy + (py - h / 2) / s
    const k = Math.min(K_MAX, v.k * 2)
    const s2 = s0 * k
    animateTo({ cx: x - (px - w / 2) / s2, cy: y - (py - h / 2) / s2, k }, 500)
  }

  const onKeyDown = (e) => {
    if (e.target !== stageRef.current) return
    const step = 80 / (size.current.s0 * view.current.k)
    const v = view.current
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[e.key]) {
      e.preventDefault()
      animateTo({ cx: v.cx + moves[e.key][0], cy: v.cy + moves[e.key][1], k: v.k }, 250)
    } else if (e.key === '+' || e.key === '=') zoomBy(1.5)
    else if (e.key === '-') zoomBy(1 / 1.5)
  }

  const zoomBy = (f) => {
    const v = view.current
    animateTo({ ...v, k: v.k * f }, 350)
  }

  // ---- Sélection ----------------------------------------------------------
  // Fermer la fiche ou ouvrir autre chose qu'un lieu arrête la visite.
  const stopTourRef = useRef(null)
  const open = useCallback((next) => {
    if (!next.lieu) stopTourRef.current?.()
    const search = new URLSearchParams()
    if (next.lieu) search.set('lieu', next.lieu)
    if (next.region) search.set('region', next.region)
    if (next.route) {
      search.set('route', next.route)
      setShowRoads(true)
    }
    if (next.parc) {
      search.set('parc', next.parc)
      setShowParks(true)
    }
    setParams(search, { replace: true, preventScrollReset: true })
  }, [setParams])

  const close = useCallback(() => {
    stopTourRef.current?.()
    setParams(new URLSearchParams(), { replace: true, preventScrollReset: true })
    const v = view.current
    animateTo(centerOn(...(() => {
      const { w, h, s0 } = size.current
      const ins = insets(true)
      const s = s0 * v.k
      // Point de la carte actuellement au centre de l'espace libre.
      return [v.cx + (ins.l + (w - ins.l - ins.r) / 2 - w / 2) / s, v.cy + (ins.t + (h - ins.t - ins.b) / 2 - h / 2) / s]
    })(), v.k, false), 600)
  }, [setParams, animateTo, centerOn, insets])

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e) => e.key === 'Escape' && !lightbox && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panelOpen, close, lightbox])

  // Un parc, dessiné au-dessus des régions, est prioritaire au clic et au survol.
  const onZoneClick = (e) => {
    if (dragged.current) return
    const road = e.target.closest('[data-road]')?.dataset.road
    if (road) return open({ route: road })
    const park = e.target.closest('[data-park]')?.dataset.park
    if (park) return open({ parc: park })
    const zone = e.target.closest('[data-zone]')?.dataset.zone
    if (zone) open({ region: zone })
  }

  const onZoneHover = (e) => {
    const road = e.target.closest?.('[data-road]')?.dataset.road ?? null
    if (road !== hoverRoad) setHoverRoad(road)
    const park = road ? null : e.target.closest?.('[data-park]')?.dataset.park ?? null
    const zone = park || road ? null : e.target.closest?.('[data-zone]')?.dataset.zone ?? null
    if (zone !== hoverZone) setHoverZone(zone)
    if (park !== hoverPark) setHoverPark(park)
  }

  const toggleCat = (id) =>
    setCats((current) => {
      const next = new Set(current)
      if (next.has(id) && next.size > 1) next.delete(id)
      else next.add(id)
      return next
    })

  const resetView = () => {
    stopTourRef.current?.()
    if (panelOpen) setParams(new URLSearchParams(), { replace: true, preventScrollReset: true })
    animateTo(homeView(false), 900)
  }

  // ---- Visite documentaire ----------------------------------------------
  // Parcours des lieux naturels (catégories affichées), en musique : la
  // caméra glisse d'un lieu à l'autre et chaque fiche s'ouvre à son tour.
  const tourList = useMemo(() => {
    const list = ATLAS_POINTS.filter((p) => TOUR.includes(p.id) && cats.has(p.category))
    return list.length ? list : ATLAS_POINTS.filter((p) => TOUR.includes(p.id))
  }, [cats])
  const tourIndex = selectedPoint ? tourList.findIndex((p) => p.id === selectedPoint.id) : -1

  const stopTour = useCallback(() => {
    narrator.current?.cancel()
    clips.current?.stop()
    music.current?.stop()
    setTour(null)
    setExplorerOpen(explorerBefore.current)
  }, [])

  useEffect(() => {
    stopTourRef.current = () => tourRef.current && stopTour()
  }, [stopTour])

  const startTour = () => {
    if (!music.current) music.current = new AmbientMusic()
    music.current.setMuted(false)
    music.current.start()
    if (!tourRef.current) explorerBefore.current = explorerOpen
    setExplorerOpen(false)
    if (!narrator.current) narrator.current = new Narrator()
    if (!clips.current) clips.current = new ClipPlayer(NARRATION_TIMINGS)
    setTour({ paused: false, muted: false, voice: true })
    step.current.id = null
    open({ lieu: tourList[0].id })
  }

  const finishTour = useCallback(() => {
    stopTour()
    setParams(new URLSearchParams(), { replace: true, preventScrollReset: true })
    animateTo(homeView(false), 2600)
  }, [stopTour, setParams, animateTo, homeView])

  const goStep = useCallback((delta) => {
    const i = tourIndex < 0 ? 0 : tourIndex + delta
    if (i >= tourList.length) return finishTour()
    step.current.id = null
    open({ lieu: tourList[Math.max(0, i)].id })
  }, [tourIndex, tourList, open, finishTour])

  const togglePause = () => {
    if (!tour) return
    if (tour.paused) music.current?.resume()
    else music.current?.pause()
    setTour({ ...tour, paused: !tour.paused })
  }

  const toggleVoice = () => {
    if (!tour) return
    setTour({ ...tour, voice: !tour.voice })
  }

  const toggleMute = () => {
    if (!tour) return
    music.current?.setMuted(!tour.muted)
    setTour({ ...tour, muted: !tour.muted })
  }

  // Déroulé de l'étape en cours. Avec la voix, le commentaire (une trentaine
  // de secondes) donne le rythme : on passe au lieu suivant peu après la
  // dernière phrase. Sans la voix, une minuterie qui tient compte des pauses.
  const touring = Boolean(tour)
  const tourPaused = Boolean(tour?.paused)
  const voiceOn = Boolean(tour?.voice)
  useEffect(() => {
    if (!touring || !selectedPoint) return
    const s = step.current
    const fresh = s.id !== selectedPoint.id
    if (fresh) {
      s.id = selectedPoint.id
      s.remaining = stepDuration(selectedPoint)
      s.sentence = 0
      s.fallback = false
    }
    if (tourPaused) return
    if (voiceOn) {
      const lines = narrationFor(selectedPoint)
      let timer = 0
      // Phrase en cours : la reprise après une pause repart de là.
      const onSentence = (i) => {
        s.sentence = i
      }
      const onEnd = () => {
        s.sentence = lines.length
        music.current?.duck(false)
        timer = setTimeout(() => goStep(1), 2500)
      }
      // Sans fichier audio (ou s'il ne peut être lu) : voix du navigateur.
      const speak = () => {
        if (!narrationSupported) return onEnd()
        narrator.current.speak(lines, Math.max(0, s.sentence), { onSentence, onEnd })
      }
      const begin = () => {
        music.current?.duck(true)
        if (s.fallback) return speak()
        clips.current.play(selectedPoint.id, lines, {
          onSentence,
          onEnd,
          onError: () => {
            s.fallback = true
            clips.current.stop()
            speak()
          },
        })
      }
      // La voix attend que la caméra soit arrivée.
      timer = setTimeout(begin, fresh ? 1800 : 150)
      return () => {
        clearTimeout(timer)
        clips.current?.pause()
        narrator.current?.cancel()
        music.current?.duck(false)
      }
    }
    s.started = performance.now()
    const timer = setTimeout(() => goStep(1), s.remaining)
    return () => {
      clearTimeout(timer)
      s.remaining -= performance.now() - s.started
    }
  }, [touring, tourPaused, voiceOn, selectedPoint, goStep])

  // Durée affichée par la barre de progression.
  const narrationMs = selectedPoint && (NARRATION_TIMINGS[selectedPoint.id]?.duration * 1000 || narrationDuration(narrationFor(selectedPoint)))
  const stepLength = selectedPoint ? (voiceOn ? 1800 + narrationMs + 2500 : stepDuration(selectedPoint)) : 0

  const togglePauseRef = useRef(togglePause)
  useEffect(() => {
    togglePauseRef.current = togglePause
  })

  // Onglet masqué : la visite se met en pause. Barre d'espace : pause ou reprise.
  useEffect(() => {
    if (!tour) return
    const onVisibility = () => {
      if (document.hidden && !tourRef.current?.paused) {
        music.current?.pause()
        setTour((current) => current && { ...current, paused: true })
      }
    }
    const onKey = (e) => {
      if (e.key !== ' ' || e.target.closest?.('input, textarea, select, button, a')) return
      e.preventDefault()
      togglePauseRef.current()
    }
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('keydown', onKey)
    }
  }, [tour])
  useEffect(() => () => music.current?.stop(), [])

  const markerPos = (x, y) => ({ '--px': x, '--py': y })
  const activeZone = selectedZone?.id ?? selectedPoint?.zone ?? null

  return (
    <div
      ref={stageRef}
      className={`atlas-stage level-${level} ${ready ? 'is-ready' : ''} ${tour ? 'is-touring' : ''} ${panelOpen ? 'has-panel' : ''} ${selectedZone ? 'has-zone' : ''} ${explorerOpen ? '' : 'explorer-closed'}`}
      tabIndex={0}
      aria-label={t('atlas.carteInteractiveAide')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <svg
        ref={svgRef}
        className={`atlas-svg ${activeZone ? `focus-${activeZone}` : ''} ${hoverZone ? `hover-${hoverZone}` : ''} ${showParks ? '' : 'no-parks'} ${selectedPark ? `park-focus focus-park-${selectedPark.id}` : ''} ${showRoads ? '' : 'no-roads'} ${selectedRoad ? 'road-focus' : ''}`}
        viewBox={`0 0 ${MW} ${MH}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        onClick={onZoneClick}
        onPointerOver={onZoneHover}
        onPointerLeave={() => {
          setHoverZone(null)
          setHoverPark(null)
          setHoverRoad(null)
        }}
      >
        <MapArt />
        {selectedRoad && <style>{`.atlas-svg .road-${selectedRoad.id} { opacity: 1; } .atlas-svg .road-${selectedRoad.id} .atlas-road-line { stroke: var(--atlas-road-active); }`}</style>}
        {selectedPark && <style>{`.atlas-svg.park-focus .park-${selectedPark.id} .atlas-park-fill { fill-opacity: 0.7; stroke-dasharray: none; stroke-width: 2.6; } .atlas-svg.park-focus .park-${selectedPark.id} .atlas-park-hatch { opacity: 1; }`}</style>}
      </svg>

      {/* Repères, étiquettes et points d'intérêt : positionnés sur la carte, à taille constante. */}
      <div className="atlas-overlay">
        {LABELS_XY.map((z) => (
          <span key={z.id} className={`atlas-zone-label ${hoverZone === z.id || activeZone === z.id ? 'is-active' : ''}`} style={markerPos(...z.xy)} aria-hidden="true">
            {z.name}
          </span>
        ))}
        {showRoads &&
          ROADS.map((road) => (
            <button
              key={road.id}
              type="button"
              className={`atlas-shield atlas-road-shield ${selectedRoad?.id === road.id || hoverRoad === road.id ? 'is-active' : ''}`}
              style={markerPos(...road.anchor)}
              aria-label={road.name}
              onClick={() => open({ route: road.id })}
            >
              {road.ref}
            </button>
          ))}
        {showParks &&
          PARKS.map((park) => (
            <button
              key={park.id}
              type="button"
              className={`atlas-park-label ${selectedPark?.id === park.id || hoverPark === park.id ? 'is-active' : ''}`}
              style={{ ...markerPos(...PARK_SHAPES[park.id].anchor), '--park': park.couleur_carte }}
              tabIndex={level === 0 ? -1 : 0}
              onClick={() => open({ parc: park.id })}
            >
              <Trees size={12} className="icon" aria-hidden="true" />
              {park.nom.replace(/^Parc (national|marin) (de la |de l’|de l'|des |de )/, '')}
            </button>
          ))}
        {CITIES_XY.map((c) => (
          <span key={c.name} className={`atlas-city ${c.capital ? 'is-capital' : ''}`} style={markerPos(...c.xy)} aria-hidden="true">
            <i />
            {c.name}
          </span>
        ))}
        {ATLAS_POINTS.map((p, i) => {
          const Icon = CATEGORY_ICONS[p.category]
          const hidden = !cats.has(p.category)
          const selected = selectedPoint?.id === p.id
          return (
            <button
              key={p.id}
              type="button"
              className={`atlas-marker cat-${p.category} ${hidden ? 'is-hidden' : ''} ${selected ? 'is-selected' : ''} ${p.crowded ? 'is-crowded' : ''}`}
              style={{ ...markerPos(p.x, p.y), '--n': i }}
              tabIndex={hidden ? -1 : 0}
              aria-hidden={hidden || undefined}
              aria-label={`${p.name} — ${CATEGORIES.find((c) => c.id === p.category).label}`}
              onClick={() => open({ lieu: p.id })}
            >
              <span className="atlas-marker-disc">
                {level === 2 && atlasPhoto(p.id) ? <img src={atlasPhoto(p.id).thumb} alt="" loading="lazy" /> : <Icon size={15} className="icon" aria-hidden="true" />}
              </span>
              <span className="atlas-marker-label">{p.name}</span>
            </button>
          )
        })}
      </div>

      {/* Panneau d'exploration */}
      <section ref={explorerRef} className="atlas-ui atlas-explorer" aria-labelledby="atlas-title">
        <div className="atlas-explorer-head">
          <p className="eyebrow">
            <Compass size={14} className="icon" aria-hidden="true" />{t('atlas.atlasVivant')}</p>
          <button
            type="button"
            className="ghost icon-button atlas-explorer-toggle"
            aria-expanded={explorerOpen}
            aria-controls="atlas-explorer-body"
            aria-label={explorerOpen ? t('atlas.replierLePanneau') : t('atlas.deplierLePanneau')}
            onClick={() => setExplorerOpen(!explorerOpen)}
          >
            {explorerOpen ? <ChevronLeft size={18} className="icon" aria-hidden="true" /> : <Layers size={18} className="icon" aria-hidden="true" />}
          </button>
        </div>
        <h1 id="atlas-title">{t('atlas.titre')}</h1>
        <div id="atlas-explorer-body" className="atlas-explorer-body" hidden={!explorerOpen}>
          <p className="atlas-lead">{t('atlas.introduction')}</p>
          <div className="atlas-layers" role="group" aria-label={t('atlas.afficherSurLaCarte')}>
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICONS[c.id]
              const on = cats.has(c.id)
              const count = ATLAS_POINTS.filter((p) => p.category === c.id).length
              return (
                <button key={c.id} type="button" className={`atlas-layer cat-${c.id} ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggleCat(c.id)}>
                  <span className="atlas-layer-icon">
                    <Icon size={15} className="icon" aria-hidden="true" />
                  </span>
                  <span className="atlas-layer-text">
                    {c.plural}
                    <small>{c.hint}</small>
                  </span>
                  <span className="atlas-layer-count">{count}</span>
                </button>
              )
            })}
            <button type="button" className={`atlas-layer cat-parcs ${showParks ? 'is-on' : ''}`} aria-pressed={showParks} onClick={() => setShowParks(!showParks)}>
              <span className="atlas-layer-icon">
                <Trees size={15} className="icon" aria-hidden="true" />
              </span>
              <span className="atlas-layer-text">
                {t('atlas.parcsNationaux')}
                <small>{t('atlas.parcsNationauxHint')}</small>
              </span>
              <span className="atlas-layer-count">{PARKS.length}</span>
            </button>
            <button type="button" className={`atlas-layer cat-routes ${showRoads ? 'is-on' : ''}`} aria-pressed={showRoads} onClick={() => setShowRoads(!showRoads)}>
              <span className="atlas-layer-icon">
                <Car size={15} className="icon" aria-hidden="true" />
              </span>
              <span className="atlas-layer-text">
                {t('atlas.routesNationales')}
                <small>{t('atlas.routesNationalesHint')}</small>
              </span>
              <span className="atlas-layer-count">{ROADS.length}</span>
            </button>
          </div>
          <div className="atlas-regions">
            <h2>{t('atlas.routesNationales')}</h2>
            <ul className="atlas-road-list">
              {ROADS.map((road) => (
                <li key={road.id}>
                  <button
                    type="button"
                    className={`atlas-region ${selectedRoad?.id === road.id ? 'is-active' : ''}`}
                    onClick={() => open({ route: road.id })}
                    onPointerEnter={() => setHoverRoad(road.id)}
                    onPointerLeave={() => setHoverRoad(null)}
                  >
                    <span className="atlas-shield">{road.ref}</span>
                    <span className="atlas-road-towns">{road.towns.length > 1 ? `${road.towns[0]} – ${road.towns.at(-1)}` : road.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="atlas-regions">
            <h2>{t('atlas.parcsNationaux')}</h2>
            <ul>
              {PARKS.map((park) => (
                <li key={park.id}>
                  <button
                    type="button"
                    className={`atlas-region ${selectedPark?.id === park.id ? 'is-active' : ''}`}
                    onClick={() => open({ parc: park.id })}
                    onPointerEnter={() => setHoverPark(park.id)}
                    onPointerLeave={() => setHoverPark(null)}
                  >
                    <span className="atlas-swatch" style={{ background: park.couleur_carte }} aria-hidden="true" />
                    {park.nom}
                    {park.patrimoine_unesco && <Award size={14} className="icon atlas-unesco-icon" aria-label={t('atlas.patrimoineMondialUnesco')} />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="atlas-regions">
            <h2>{t('atlas.regionsNaturelles')}</h2>
            <ul>
              {ZONES.map((z) => (
                <li key={z.id}>
                  <button
                    type="button"
                    className={`atlas-region ${activeZone === z.id ? 'is-active' : ''}`}
                    onClick={() => open({ region: z.id })}
                    onPointerEnter={() => setHoverZone(z.id)}
                    onPointerLeave={() => setHoverZone(null)}
                  >
                    <span className={`atlas-swatch zone-${z.id}`} aria-hidden="true" />
                    {z.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="atlas-tour" onClick={startTour}>
            <Play size={16} className="icon" aria-hidden="true" />
            <span>
              {t('atlas.commencerLaVisite')}
              <small>{t('atlas.visiteHint')}</small>
            </span>
          </button>
        </div>
      </section>

      {/* Visite documentaire : titre façon documentaire et barre de lecture. */}
      {tour && selectedPoint && (
        <>
          <div className="atlas-ui atlas-doc-title" key={selectedPoint.id} aria-hidden="true">
            <small>
              {CATEGORIES.find((c) => c.id === selectedPoint.category).label} · {selectedPoint.province}
            </small>
            <strong>{selectedPoint.name}</strong>
            <em>{selectedPoint.place}</em>
          </div>
          <div className="atlas-ui atlas-tourbar" role="group" aria-label={t('atlas.visiteGuidee')}>
            <button type="button" onClick={() => goStep(-1)} disabled={tourIndex <= 0} aria-label={t('atlas.etapePrecedente')}>
              <SkipBack size={17} className="icon" aria-hidden="true" />
            </button>
            <button type="button" className="atlas-tour-play" onClick={togglePause} aria-label={tour.paused ? t('atlas.reprendre') : t('atlas.pause')}>
              {tour.paused ? <Play size={19} className="icon" aria-hidden="true" /> : <Pause size={19} className="icon" aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => goStep(1)} aria-label={t('atlas.etapeSuivante')}>
              <SkipForward size={17} className="icon" aria-hidden="true" />
            </button>
            <div className="atlas-tour-progress">
              <span className="atlas-tour-step">
                {tourIndex + 1} / {tourList.length}
              </span>
              <span className="atlas-tour-track">
                <i key={selectedPoint.id} className={tour.paused ? 'is-paused' : ''} style={{ '--d': `${stepLength}ms` }} />
              </span>
            </div>
            <button type="button" onClick={toggleVoice} aria-pressed={!tour.voice} aria-label={tour.voice ? t('atlas.couperLaVoix') : t('atlas.activerLaVoix')} title={tour.voice ? t('atlas.couperLaVoix') : t('atlas.activerLaVoix')}>
              {tour.voice ? <Mic size={17} className="icon" aria-hidden="true" /> : <MicOff size={17} className="icon" aria-hidden="true" />}
            </button>
            <button type="button" onClick={toggleMute} aria-pressed={tour.muted} aria-label={tour.muted ? t('atlas.activerLaMusique') : t('atlas.couperLaMusique')}>
              {tour.muted ? <VolumeX size={17} className="icon" aria-hidden="true" /> : <Volume2 size={17} className="icon" aria-hidden="true" />}
            </button>
            <button type="button" onClick={stopTour} aria-label={t('atlas.arreterLaVisite')}>
              <X size={17} className="icon" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {/* Commandes de navigation */}
      <div className="atlas-ui atlas-controls">
        <div className="atlas-scale" aria-hidden="true">
          <span className="atlas-scale-bar" />
          <span ref={scaleRef}>100 km</span>
        </div>
        {!tour && (
          <button type="button" className="atlas-tour-fab" onClick={startTour} title={t('atlas.commencerLaVisite')} aria-label={t('atlas.commencerLaVisite')}>
            <Play size={18} className="icon" aria-hidden="true" />
          </button>
        )}
        <div className="atlas-zoom" role="group" aria-label={t('atlas.navigation')}>
          <button type="button" onClick={() => zoomBy(1.6)} aria-label={t('atlas.zoomer')}>
            <Plus size={18} className="icon" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label={t('atlas.dezoomer')}>
            <Minus size={18} className="icon" aria-hidden="true" />
          </button>
          <button type="button" onClick={resetView} aria-label={t('atlas.vueDEnsemble')} title={t('atlas.vueDEnsemble')}>
            <Compass size={18} className="icon" aria-hidden="true" />
          </button>
        </div>
      </div>

      {hoverZone && !hoverPark && !hoverRoad && !panelOpen && (
        <p className="atlas-ui atlas-hint" aria-hidden="true">
          <span className={`atlas-swatch zone-${hoverZone}`} />
          {ZONES.find((z) => z.id === hoverZone).name}
          <small>{t('atlas.cliquezPourDecouvrir')}</small>
        </p>
      )}
      {hoverRoad && !panelOpen && (
        <p className="atlas-ui atlas-hint" aria-hidden="true">
          <span className="atlas-shield">{ROADS.find((r) => r.id === hoverRoad).ref}</span>
          {ROADS.find((r) => r.id === hoverRoad).name}
          <small>{t('atlas.cliquezPourDecouvrir')}</small>
        </p>
      )}
      {hoverPark && !hoverRoad && !panelOpen && (
        <p className="atlas-ui atlas-hint" aria-hidden="true">
          <span className="atlas-swatch" style={{ background: PARKS.find((p) => p.id === hoverPark).couleur_carte }} />
          {PARKS.find((p) => p.id === hoverPark).nom}
          <small>{t('atlas.cliquezPourDecouvrir')}</small>
        </p>
      )}
      {!tour && !hoverZone && !hoverPark && !hoverRoad && !panelOpen && level === 0 && <p className="atlas-ui atlas-hint is-help">{t('atlas.aideNavigation')}</p>}

      {/* Fiche détaillée */}
      {panelOpen && (
        <aside className="atlas-ui atlas-panel" key={selectedPoint?.id ?? selectedPark?.id ?? selectedRoad?.id ?? selectedZone.id} aria-live="polite">
          <button type="button" className="atlas-panel-close" onClick={close} aria-label={t('atlas.fermerLaFiche')}>
            <X size={18} className="icon" aria-hidden="true" />
          </button>
          {selectedPoint ? (
            <PointSheet point={selectedPoint} position={position} onOpen={open} onClose={close} onExpand={setLightbox} />
          ) : selectedRoad ? (
            <RoadSheet road={selectedRoad} onClose={close} onExpand={setLightbox} />
          ) : selectedPark ? (
            <ParkSheet park={selectedPark} onOpen={open} onClose={close} onExpand={setLightbox} />
          ) : (
            <ZoneSheet zone={selectedZone} onOpen={open} onClose={close} onExpand={setLightbox} />
          )}
        </aside>
      )}

      {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
