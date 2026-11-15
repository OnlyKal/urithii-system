import { BadgeCheck, BookOpenText, ChevronRight, ExternalLink, Film, Headphones, Image, Info, Languages, Library, Lock, MapPin, Mountain, Sparkles, Telescope, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AudioPlayer, VideoPlayer } from '../../components/media/MediaPlayers.jsx'
import Prose from '../../components/Prose.jsx'
import { atlasPhoto, CATEGORIES, POINTS } from '../../data/atlasContent.js'
import { DOC_STATUS_LABELS, MEDIA_KIND_LABELS, VERIFICATION_LABELS } from '../../labels.js'
import { fetchCommunity, fetchItem, fetchItems, fetchMedia, usePlatform } from '../core/platform.js'
import { g } from '../i18n.js'
import { LANDSCAPE_CATEGORIES, SUBJECTS, TRACES } from '../world/ituri/catalog.js'
import { GameWindow } from './Dialogs.jsx'

// Fenêtres qui donnent accès, dans le jeu, à tout ce que publie la
// plateforme : fiches culturelles complètes (champs du référentiel, médias,
// sources), thèmes, communautés, lieux, langues, médiathèque et atlas.
// Tout est lu par l'API publique : un contenu publié demain y apparaît.

const VERIFIED = ['SOURCED', 'CORROBORATED']

// Champs du référentiel affichables tels quels (texte ou liste de textes).
const plain = (v) => typeof v === 'string' || typeof v === 'number'
const readableFields = (fields) => fields.filter((f) => plain(f.value) || (Array.isArray(f.value) && f.value.every(plain)))

function useLoad(load, deps) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    let alive = true
    setState({ loading: true })
    load()
      .then((data) => alive && setState({ loading: false, data }))
      .catch(() => alive && setState({ loading: false, error: true }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

function Status({ state, empty }) {
  if (state.loading) return <p className="game-muted">{g('chargementFiches')}</p>
  if (state.error) return <p className="game-feedback is-wrong">{g('fichesIndisponibles')}</p>
  if (empty)
    return (
      <div className="game-empty">
        <Sparkles size={22} aria-hidden="true" />
        <p>{empty}</p>
      </div>
    )
  return null
}

function VerificationTag({ status }) {
  const verified = VERIFIED.includes(status)
  return (
    <span className={`game-tag ${verified ? 'is-mint' : 'is-orange'}`}>
      {verified ? <BadgeCheck size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}
      {VERIFICATION_LABELS[status] ?? status}
    </span>
  )
}

// Liste de fiches publiées (par thème, communauté, lieu ou langue).
export function ItemList({ items, onOpenItem, read = {} }) {
  return (
    <ul className="culture-list">
      {items.map((item) => (
        <li key={item.slug}>
          <button type="button" onClick={() => onOpenItem(item.slug)} className={`culture-item ${read[item.slug] ? 'is-read' : ''}`}>
            {item.cover ? (
              <img src={item.cover.url} alt="" />
            ) : (
              <span className="culture-thumb" aria-hidden="true">
                <BookOpenText size={20} />
              </span>
            )}
            <span className="culture-text">
              <strong>{item.title}</strong>
              {item.communities?.length > 0 && <small>{item.communities.map((c) => c.name).join(', ')}</small>}
              {item.summary && <span className="culture-summary">{item.summary}</span>}
              <VerificationTag status={item.verificationStatus} />
            </span>
            <ChevronRight size={16} className="culture-open" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

// Fiches d'une sélection (paramètres de /public/items).
export function ItemsWindow({ title, eyebrow, params, intro, moreLink, onOpenItem, read, onBack, onClose, children }) {
  const state = useLoad(() => fetchItems(params), [JSON.stringify(params)])
  const items = state.data?.items ?? []
  return (
    <GameWindow title={title} eyebrow={eyebrow} icon={BookOpenText} onClose={onClose} onBack={onBack} wide>
      {intro && <p className="game-lead">{intro}</p>}
      {children}
      <Status state={state} empty={!state.loading && !state.error && items.length === 0 ? g('aucuneFiche') : null} />
      {items.length > 0 && <ItemList items={items} onOpenItem={onOpenItem} read={read} />}
      {state.data?.total > items.length && moreLink && (
        <a className="game-link" href={moreLink} target="_blank" rel="noreferrer">
          {g('voirToutes', { n: state.data.total })} <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      <p className="game-note">{g('noteCulture')}</p>
    </GameWindow>
  )
}

// Espace d'un thème du village : fiches de la catégorie (et de ses
// sous-catégories), plus les langues documentées pour la place des paroles.
export function CultureCard({ station, onOpenItem, onOpenLanguage, read, onBack, onClose }) {
  const platform = usePlatform()
  return (
    <ItemsWindow
      title={station.name}
      eyebrow={station.theme}
      params={{ category: station.category }}
      intro={g('espaceIntro', { theme: station.theme.toLowerCase() })}
      moreLink={`/themes/${station.category}`}
      onOpenItem={onOpenItem}
      read={read}
      onBack={onBack}
      onClose={onClose}
    >
      {station.languages && platform.languages.length > 0 && (
        <div className="pf-chips">
          <small>
            <Languages size={14} aria-hidden="true" /> {g('pf.languesDocumentees')}
          </small>
          {platform.languages.map((l) => (
            <button key={l.id} type="button" className="game-tag pf-chip" onClick={() => onOpenLanguage(l)}>
              {l.name}
              {l.isoCode ? ` (${l.isoCode})` : ''}
            </button>
          ))}
        </div>
      )}
    </ItemsWindow>
  )
}

// Fiche culturelle complète, lue dans le jeu.
export function ItemCard({ slug, onRead, onOpenItem, onBack, onClose }) {
  const state = useLoad(() => fetchItem(slug), [slug])
  const item = state.data
  useEffect(() => {
    if (item) onRead?.(item)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])
  const photos = item?.media.filter((m) => m.kind === 'PHOTO') ?? []
  const players = item?.media.filter((m) => m.kind === 'AUDIO' || m.kind === 'VIDEO') ?? []
  return (
    <GameWindow title={item?.title ?? g('chargementFiches')} eyebrow={item?.category?.name} icon={BookOpenText} onClose={onClose} onBack={onBack} wide className="pf-item">
      <Status state={state} />
      {item && (
        <div className="pf-item-body">
          <div className="nature-tags">
            <VerificationTag status={item.verificationStatus} />
            {item.communities.map((c) => (
              <span key={c.name} className="game-tag">
                <Users size={13} aria-hidden="true" /> {c.name}
              </span>
            ))}
            {item.places.map((p) => (
              <span key={p.name} className="game-tag">
                <MapPin size={13} aria-hidden="true" /> {p.name}
              </span>
            ))}
            {item.originalLanguage && (
              <span className="game-tag">
                <Languages size={13} aria-hidden="true" /> {item.originalLanguage}
              </span>
            )}
          </div>
          {item.originalTitle && <p className="nature-latin">{item.originalTitle}</p>}
          {item.summary && <p className="nature-summary">{item.summary}</p>}
          {photos.length > 0 && (
            <div className="pf-photos">
              {photos.slice(0, 6).map((m) => (
                <figure key={m.id}>
                  <img src={m.thumbnailUrl ?? m.url} alt={m.title} loading="lazy" />
                  <figcaption>
                    {m.caption ?? m.title}
                    {m.credit ? ` · © ${m.credit}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {players.map((m) => (
            <div key={m.id} className="pf-player">
              <small>
                {m.kind === 'AUDIO' ? <Headphones size={14} aria-hidden="true" /> : <Film size={14} aria-hidden="true" />} {m.caption ?? m.title}
              </small>
              {m.kind === 'AUDIO' ? <AudioPlayer media={m} compact /> : <VideoPlayer media={m} />}
            </div>
          ))}
          {item.body && <Prose text={item.body} />}
          {readableFields(item.fields).length > 0 && (
            <dl className="nature-facts pf-fields">
              {readableFields(item.fields).map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{Array.isArray(f.value) ? f.value.join(' · ') : <Prose text={String(f.value)} />}</dd>
                </div>
              ))}
            </dl>
          )}
          {item.narrator && (
            <p className="game-muted">
              {g('pf.recit')} : {typeof item.narrator === 'string' ? item.narrator : item.narrator.name}
            </p>
          )}
          {item.sources.length > 0 && (
            <div className="pf-sources">
              <h3>{g('pf.sources')}</h3>
              <ul>
                {item.sources.map((s, i) => (
                  <li key={i}>
                    {s.title}
                    {s.author ? ` · ${s.author}` : ''}
                    {s.date ? ` · ${s.date}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {item.relations.length > 0 && (
            <div className="pf-sources">
              <h3>{g('pf.fichesLiees')}</h3>
              <ul>
                {item.relations.map((r) => (
                  <li key={r.slug}>
                    <button type="button" className="game-link" onClick={() => onOpenItem(r.slug)}>
                      {r.title} <ChevronRight size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a className="game-link" href={`/contenus/${item.slug}`} target="_blank" rel="noreferrer">
            <BookOpenText size={16} aria-hidden="true" /> {g('ficheUrithi')} <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      )}
    </GameWindow>
  )
}

// Maison des savoirs : tout le référentiel, y compris les thèmes à venir.
export function SavoirsWindow({ onOpenTheme, onClose }) {
  const platform = usePlatform()
  return (
    <GameWindow title={g('pf.maisonSavoirs')} eyebrow={g('pf.referentiel')} icon={Library} onClose={onClose} wide>
      <p className="game-lead">{g('pf.savoirsIntro', { n: platform.totals.items })}</p>
      {!platform.ready && <Status state={{ loading: !platform.error, error: platform.error }} />}
      <ul className="pf-grid">
        {platform.roots.map((c) => (
          <li key={c.slug}>
            <button type="button" className="pf-tile" onClick={() => onOpenTheme(c)}>
              <strong>{c.name}</strong>
              {c.description && <small>{c.description}</small>}
              <span className={`game-tag ${c.total ? 'is-mint' : ''}`}>{c.total ? g('pf.nFiches', { n: c.total }) : g('pf.aVenir')}</span>
            </button>
          </li>
        ))}
      </ul>
    </GameWindow>
  )
}

// Arbre à palabres : communautés, provinces et langues publiées.
export function CommunitiesWindow({ met = {}, onOpenCommunity, onOpenPlace, onOpenLanguage, onClose }) {
  const platform = usePlatform()
  const [tab, setTab] = useState('communautes')
  const tabs = [
    ['communautes', g('pf.communautes'), Users],
    ['provinces', g('pf.provinces'), MapPin],
    ['langues', g('pf.langues'), Languages],
  ]
  return (
    <GameWindow title={g('pf.arbrePalabres')} eyebrow={g('pf.communautesLieuxLangues')} icon={Users} onClose={onClose} wide>
      <p className="game-lead">{g('pf.palabresIntro')}</p>
      <div className="pf-tabs" role="tablist">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      {!platform.ready && <Status state={{ loading: !platform.error, error: platform.error }} />}
      {platform.ready && tab === 'communautes' && (
        <>
          {platform.communities.length === 0 && <Status state={{}} empty={g('pf.aucuneCommunaute')} />}
          <ul className="culture-list">
            {platform.communities.map((c) => (
              <li key={c.slug}>
                <button type="button" className={`culture-item ${met[c.slug] ? 'is-read' : ''}`} onClick={() => onOpenCommunity(c.slug)}>
                  {c.cover ? (
                    <img src={c.cover.url} alt="" />
                  ) : (
                    <span className="culture-thumb" aria-hidden="true">
                      <Users size={20} />
                    </span>
                  )}
                  <span className="culture-text">
                    <strong>{c.name}</strong>
                    {c.places?.length > 0 && <small>{c.places.map((p) => p.name).join(', ')}</small>}
                    {c.summary && <span className="culture-summary">{c.summary}</span>}
                    <span className="game-tag">{g('pf.nFiches', { n: c.itemCount })}</span>
                  </span>
                  <ChevronRight size={16} className="culture-open" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {platform.ready && tab === 'provinces' && (
        <ul className="pf-grid is-small">
          {platform.provinces.map((p) => (
            <li key={p.id}>
              <button type="button" className="pf-tile" onClick={() => onOpenPlace(p)}>
                <strong>{p.name}</strong>
                <small>
                  {p.communityCount || p.itemCount ? g('pf.provinceCompte', { c: p.communityCount, n: p.itemCount }) : g('pf.documentationAVenir')}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {platform.ready && tab === 'langues' && (
        <>
          {platform.languages.length === 0 && <Status state={{}} empty={g('pf.aucuneLangue')} />}
          <div className="pf-chips">
            {platform.languages.map((l) => (
              <button key={l.id} type="button" className="game-tag pf-chip" onClick={() => onOpenLanguage(l)}>
                {l.name}
                {l.isoCode ? ` (${l.isoCode})` : ''}
              </button>
            ))}
          </div>
        </>
      )}
    </GameWindow>
  )
}

// Communauté : présentation, noms, lieux, langues, fiches et médias.
export function CommunityWindow({ slug, onMeet, onOpenItem, onBack, onClose }) {
  const state = useLoad(() => fetchCommunity(slug), [slug])
  const data = state.data
  useEffect(() => {
    if (data) onMeet?.(data.community)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  const c = data?.community
  const audios = data?.media.filter((m) => m.kind === 'AUDIO' || m.kind === 'VIDEO') ?? []
  return (
    <GameWindow title={c?.name ?? g('chargementFiches')} eyebrow={g('pf.communaute')} icon={Users} onClose={onClose} onBack={onBack} wide>
      <Status state={state} />
      {c && (
        <div className="pf-item-body">
          <div className="nature-tags">
            {c.documentationStatus && <span className="game-tag is-orange">{DOC_STATUS_LABELS[c.documentationStatus] ?? c.documentationStatus}</span>}
            {c.places.map((p) => (
              <span key={p.name} className="game-tag">
                <MapPin size={13} aria-hidden="true" /> {p.name}
                {p.parent ? `, ${p.parent}` : ''}
              </span>
            ))}
            {c.languages.map((l) => (
              <span key={l.name} className="game-tag">
                <Languages size={13} aria-hidden="true" /> {l.name}
              </span>
            ))}
          </div>
          {c.names.length > 0 && <p className="nature-latin">{c.names.map((n) => n.name).join(' · ')}</p>}
          {c.summary && <p className="nature-summary">{c.summary}</p>}
          {c.description && <Prose text={c.description} />}
          {c.history && <Prose text={c.history} />}
          {c.documentationNote && <p className="game-note">{c.documentationNote}</p>}
          {audios.slice(0, 4).map((m) => (
            <div key={m.id} className="pf-player">
              <small>{m.title}</small>
              {m.kind === 'AUDIO' ? <AudioPlayer media={m} compact /> : <VideoPlayer media={m} />}
            </div>
          ))}
          <h3 className="inventory-title">{g('pf.fichesCommunaute', { n: data.items.length })}</h3>
          {data.items.length === 0 ? <p className="game-muted">{g('aucuneFiche')}</p> : <ItemList items={data.items} onOpenItem={onOpenItem} />}
          <a className="game-link" href={`/communautes/${slug}`} target="_blank" rel="noreferrer">
            {g('pf.pageCommunaute')} <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      )}
    </GameWindow>
  )
}

// Case des sons et des images : médiathèque publique.
export function MediathequeWindow({ onOpenItem, onClose }) {
  const [kind, setKind] = useState('')
  const state = useLoad(() => fetchMedia(kind ? { kind } : {}), [kind])
  const media = state.data?.media ?? []
  const kinds = [
    ['', g('pf.tout'), Sparkles],
    ['AUDIO', MEDIA_KIND_LABELS.AUDIO, Headphones],
    ['VIDEO', MEDIA_KIND_LABELS.VIDEO, Film],
    ['PHOTO', MEDIA_KIND_LABELS.PHOTO, Image],
  ]
  return (
    <GameWindow title={g('pf.caseSons')} eyebrow={g('pf.mediatheque')} icon={Headphones} onClose={onClose} wide>
      <p className="game-lead">{g('pf.mediathequeIntro')}</p>
      <div className="pf-tabs" role="tablist">
        {kinds.map(([id, label, Icon]) => (
          <button key={id || 'tout'} type="button" role="tab" aria-selected={kind === id} className={kind === id ? 'is-active' : ''} onClick={() => setKind(id)}>
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      <Status state={state} empty={!state.loading && !state.error && media.length === 0 ? g('pf.aucunMedia') : null} />
      <ul className="pf-media">
        {media.map((m) => (
          <li key={m.id}>
            <strong>{m.title}</strong>
            {m.kind === 'PHOTO' && <img src={m.thumbnailUrl ?? m.url} alt={m.title} loading="lazy" />}
            {m.kind === 'AUDIO' && <AudioPlayer media={m} compact />}
            {m.kind === 'VIDEO' && <VideoPlayer media={m} />}
            {m.kind === 'DOCUMENT' && (
              <a className="game-link" href={m.url} target="_blank" rel="noreferrer">
                {MEDIA_KIND_LABELS.DOCUMENT} <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
            <small>
              {[m.communities?.map((c) => c.name).join(', '), m.credit && `© ${m.credit}`].filter(Boolean).join(' · ')}
            </small>
            {m.items?.[0] && (
              <button type="button" className="game-link" onClick={() => onOpenItem(m.items[0].slug)}>
                {m.items[0].title} <ChevronRight size={13} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {state.data?.total > media.length && (
        <a className="game-link" href="/mediatheque" target="_blank" rel="noreferrer">
          {g('voirToutes', { n: state.data.total })} <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </GameWindow>
  )
}

const IN_WORLD = new Set([...SUBJECTS.map((s) => s.id), ...TRACES.map((t) => t.id)])

// Longue-vue du belvédère : tout l'atlas vivant. Les paysages (eaux,
// reliefs, barrages) se découvrent d'ici ; faune et flore se trouvent sur le
// terrain, puis se relisent ici.
export function PanoramaWindow({ discoveries, onOpenLandscape, onOpenCard, onClose }) {
  const [category, setCategory] = useState(CATEGORIES[0].id)
  const points = POINTS.filter((p) => p.category === category)
  const landscape = LANDSCAPE_CATEGORIES.includes(category)
  const found = POINTS.filter((p) => discoveries[p.id]).length
  return (
    <GameWindow title={g('pf.longueVue')} eyebrow={g('pf.atlasProgression', { n: found, total: POINTS.length })} icon={Telescope} onClose={onClose} wide>
      <p className="game-lead">{g('pf.longueVueIntro')}</p>
      <div className="pf-tabs" role="tablist">
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={category === c.id ? 'is-active' : ''} onClick={() => setCategory(c.id)}>
            {LANDSCAPE_CATEGORIES.includes(c.id) && <Mountain size={14} aria-hidden="true" />} {c.plural} <small>{POINTS.filter((p) => p.category === c.id && discoveries[p.id]).length}/{POINTS.filter((p) => p.category === c.id).length}</small>
          </button>
        ))}
      </div>
      <ul className="pf-grid">
        {points.map((p) => {
          const known = discoveries[p.id]
          const photo = atlasPhoto(p.id)
          const open = landscape || known
          return (
            <li key={p.id}>
              <button type="button" className={`pf-tile pf-atlas ${known ? 'is-read' : ''}`} disabled={!open} onClick={() => (landscape && !known ? onOpenLandscape(p) : onOpenCard(p.id))}>
                {photo && open ? <img src={photo.thumb} alt="" loading="lazy" /> : <span className="culture-thumb">{open ? <Mountain size={18} /> : <Lock size={16} />}</span>}
                <strong>{open ? p.name : g('pf.especeATrouver')}</strong>
                <small>{open ? p.province : IN_WORLD.has(p.id) ? g('pf.indiceTerrain') : p.province}</small>
              </button>
            </li>
          )
        })}
      </ul>
    </GameWindow>
  )
}
