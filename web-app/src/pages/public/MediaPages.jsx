import {
  ArrowRight,
  BookOpen,
  Calendar,
  Camera,
  Check,
  Download,
  FileText,
  Film,
  Globe2,
  Headphones,
  Image,
  LayoutGrid,
  Link2,
  Play,
  RotateCcw,
  ScrollText,
  Search,
  SkipForward,
  Tags,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { AudioPlayer, DocumentPreview, ImageViewer, VideoPlayer } from '../../components/media/MediaPlayers.jsx'
import { formatLabel, formatSize, formatTime } from '../../components/media/mediaFormat.js'
import { Breadcrumbs, EmptyState, ErrorMessage, Pagination, useApi } from '../../components/ui.jsx'
import { formatDate, MEDIA_KIND_LABELS } from '../../labels.js'
import { t, tn } from '../../i18n/index.js'

// Médiathèque publique : grille de médias avec recherche et filtres, puis page
// de consultation (lecteur, contexte culturel, médias associés). Seuls les
// médias « Public » rattachés à une fiche publiée sont renvoyés par l'API.

const KIND_ICONS = { VIDEO: Film, AUDIO: Headphones, PHOTO: Camera, DOCUMENT: FileText }
const KIND_TABS = [
  ['', () => t('browse.tout'), LayoutGrid],
  ['VIDEO', () => t('mediaLib.videos'), Film],
  ['AUDIO', () => t('mediaLib.audios'), Headphones],
  ['PHOTO', () => t('mediaLib.photos'), Camera],
  ['DOCUMENT', () => t('mediaLib.documents'), FileText],
]
const PAGE_SIZE = 24

// Ligne de contexte d'un média : communauté · thème.
function contextLine(m) {
  return [m.communities?.[0]?.name, m.categories?.[0]?.name].filter(Boolean).join(' · ')
}

// ----- Miniatures ------------------------------------------------------------

export function MediaThumb({ media, eager = false }) {
  const [duration, setDuration] = useState(null)
  const [failed, setFailed] = useState(false)
  const Icon = KIND_ICONS[media.kind] ?? FileText
  let visual
  if (media.kind === 'PHOTO' && !failed) {
    visual = <img src={media.thumbnailUrl ?? media.url} alt="" loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
  } else if (media.kind === 'VIDEO' && !failed) {
    // Première image de la vidéo, chargée à partir des seules métadonnées.
    visual = (
      <video
        src={`${media.url}#t=1`}
        poster={media.posterUrl ?? undefined}
        preload="metadata"
        muted
        playsInline
        tabIndex={-1}
        aria-hidden="true"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />
    )
  } else if (media.kind === 'AUDIO') {
    visual = (
      <span className="thumb-panel audio">
        <Headphones size={30} aria-hidden="true" />
        <span className="thumb-bars" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ '--i': i }} />
          ))}
        </span>
        <audio src={media.url} preload="metadata" onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} aria-hidden="true" />
      </span>
    )
  } else {
    visual = (
      <span className={`thumb-panel ${media.kind === 'DOCUMENT' ? 'doc' : ''}`}>
        <Icon size={30} aria-hidden="true" />
        {media.kind === 'DOCUMENT' && <span className="thumb-format">{formatLabel(media.mimeType)}</span>}
      </span>
    )
  }
  return (
    <span className={`mthumb kind-${media.kind.toLowerCase()}`}>
      {visual}
      <span className="mthumb-kind">
        <Icon size={13} aria-hidden="true" />
        {MEDIA_KIND_LABELS[media.kind]}
      </span>
      {Number.isFinite(duration) && duration > 0 && <span className="duration-badge">{formatTime(duration)}</span>}
      {(media.kind === 'VIDEO' || media.kind === 'AUDIO') && (
        <span className="mthumb-play" aria-hidden="true">
          <Play size={22} fill="currentColor" />
        </span>
      )}
    </span>
  )
}

function LibraryCard({ media, queue }) {
  const context = contextLine(media)
  return (
    <Link to={`/mediatheque/${media.id}`} state={{ queue }} className="mcard">
      <MediaThumb media={media} />
      <span className="mcard-body">
        <strong className="mcard-title">{media.caption ?? media.title}</strong>
        {context && <span className="mcard-context">{context}</span>}
        <span className="mcard-meta">
          {[media.credit, formatDate(media.createdAt)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </Link>
  )
}

function SkeletonGrid({ count = 8 }) {
  return (
    <div className="mgrid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="mcard skeleton-mcard">
          <span className="mthumb skeleton" />
          <span className="skeleton" style={{ height: 14, width: '85%' }} />
          <span className="skeleton" style={{ height: 12, width: '55%' }} />
        </div>
      ))}
    </div>
  )
}

// ----- Médiathèque -------------------------------------------------------------

export function MediaLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const get = (k) => searchParams.get(k) ?? ''
  const page = Number(searchParams.get('page') ?? 1)
  const [query, setQuery] = useState(get('q'))
  const apiParams = new URLSearchParams()
  for (const k of ['q', 'kind', 'community', 'category', 'added', 'sort', 'page']) if (get(k)) apiParams.set(k, get(k))
  apiParams.set('pageSize', String(PAGE_SIZE))
  const { data, error, loading } = useApi(`/public/media?${apiParams}`)
  const communities = useApi('/public/communities').data?.communities ?? []
  const categories = useApi('/public/categories').data?.categories ?? []

  // On garde les résultats précédents pendant le chargement des suivants :
  // la grille reste en place au lieu de clignoter.
  const lastData = useRef(null)
  if (data) lastData.current = data
  const shown = data ?? lastData.current

  const update = (changes) => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setSearchParams(next)
  }
  // Recherche instantanée, avec un léger délai pendant la frappe.
  useEffect(() => {
    if (query === get('q')) return undefined
    const timer = setTimeout(() => update({ q: query.trim() }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const filters = ['community', 'category', 'added', 'sort'].filter((k) => get(k))
  const hasCriteria = filters.length > 0 || get('q') || get('kind')
  const reset = () => {
    setQuery('')
    setSearchParams({})
  }
  const queue = shown?.media.map((m) => ({ id: m.id, kind: m.kind })) ?? []

  return (
    <>
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('browse.archives'), to: '/collections' }, { label: t('browse.mediatheque') }]} />
      <header className="mlib-head">
        <div>
          <h1>{t('browse.mediatheque')}</h1>
          <p className="lead">{t('mediaLib.intro')}</p>
        </div>
        <label className="mlib-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('mediaLib.rechercher')} aria-label={t('mediaLib.rechercher')} />
          {query && (
            <button type="button" className="ghost icon-button" onClick={() => setQuery('')} aria-label={t('mediaLib.effacer')}>
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
      </header>

      <div className="mlib-toolbar">
        <div className="mlib-tabs" role="tablist" aria-label={t('browse.typeDeMedia')}>
          {KIND_TABS.map(([value, label, Icon]) => (
            <button key={value || 'all'} type="button" role="tab" aria-selected={get('kind') === value} className={get('kind') === value ? 'active' : ''} onClick={() => update({ kind: value })}>
              <Icon size={16} aria-hidden="true" />
              {label()}
            </button>
          ))}
        </div>
        <div className="mlib-filters">
          <select value={get('community')} onChange={(e) => update({ community: e.target.value })} aria-label={t('common.community')} className={get('community') ? 'set' : ''}>
            <option value="">{t('mediaLib.toutesLesCommunautes')}</option>
            {communities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={get('category')} onChange={(e) => update({ category: e.target.value })} aria-label={t('mediaLib.theme')} className={get('category') ? 'set' : ''}>
            <option value="">{t('mediaLib.tousLesThemes')}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={get('added')} onChange={(e) => update({ added: e.target.value })} aria-label={t('mediaLib.dateDAjout')} className={get('added') ? 'set' : ''}>
            <option value="">{t('mediaLib.toutesLesDates')}</option>
            <option value="month">{t('mediaLib.ceMois')}</option>
            <option value="year">{t('mediaLib.cetteAnnee')}</option>
          </select>
          <select value={get('sort')} onChange={(e) => update({ sort: e.target.value })} aria-label={t('mediaLib.trier')}>
            <option value="">{t('mediaLib.plusRecents')}</option>
            <option value="oldest">{t('mediaLib.plusAnciens')}</option>
            <option value="title">{t('mediaLib.titreAZ')}</option>
          </select>
          {hasCriteria && (
            <button type="button" className="ghost" onClick={reset}>
              <RotateCcw size={15} className="icon" aria-hidden="true" />
              {t('browse.reinitialiserLesFiltres')}
            </button>
          )}
        </div>
      </div>

      {error && <ErrorMessage error={error} />}
      {!shown && loading && <SkeletonGrid count={12} />}
      {shown && (
        <div className={`mlib-results ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
          <p className="mlib-count" aria-live="polite">
            {tn('unit.media', shown.total)}
          </p>
          {shown.media.length ? (
            <div className="mgrid">
              {shown.media.map((m) => (
                <LibraryCard key={m.id} media={m} queue={queue} />
              ))}
            </div>
          ) : hasCriteria ? (
            <EmptyState icon={Search} title={t('mediaLib.aucunResultat')} action={<button type="button" className="secondary" onClick={reset}>{t('browse.reinitialiserLesFiltres')}</button>}>
              {t('mediaLib.aucunResultatAide')}
            </EmptyState>
          ) : (
            <EmptyState icon={Camera} title={t('browse.aucunMediaPubliePourLe')}>{t('browse.lesMediasApparaissentIciLorsqu')}</EmptyState>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={shown.total} onChange={(p) => update({ page: String(p) })} />
        </div>
      )}
    </>
  )
}

// ----- Consultation d'un média --------------------------------------------------

function readAutoplay() {
  try {
    return localStorage.getItem('urithi.player.autoplay') !== 'false'
  } catch {
    return true
  }
}

function Transcript({ texts, onClose }) {
  const [index, setIndex] = useState(0)
  const text = texts[index] ?? texts[0]
  return (
    <section className="mwatch-transcript" aria-label={t('player.transcription')}>
      <header>
        <ScrollText size={17} aria-hidden="true" />
        <div className="mwatch-transcript-tabs" role="tablist">
          {texts.map((tx, i) => (
            <button key={tx.id} type="button" role="tab" aria-selected={i === index} className={i === index ? 'active' : ''} onClick={() => setIndex(i)}>
              {tx.kind === 'TRANSCRIPTION' ? t('text.transcription') : t('text.traduction')}
              {tx.language && ` · ${tx.language}`}
            </button>
          ))}
        </div>
        {onClose && (
          <button type="button" className="ghost icon-button" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </header>
      {text.verification !== 'VERIFIED' && <p className="small muted">{t('publicCards.nonVerifiee')}</p>}
      <pre className="text-content">{text.content}</pre>
    </section>
  )
}

function Description({ text }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 420 || text.split('\n').length > 6
  return (
    <div className={`mwatch-desc ${long && !open ? 'clamped' : ''}`}>
      <p className="preserve-lines">{text}</p>
      {long && (
        <button type="button" className="link-button" onClick={() => setOpen(!open)}>
          {open ? t('mediaLib.afficherMoins') : t('mediaLib.afficherPlus')}
        </button>
      )}
    </div>
  )
}

function RelatedItem({ media, queue, active }) {
  const context = contextLine(media)
  return (
    <Link to={`/mediatheque/${media.id}`} state={{ queue }} className={`mrelated ${active ? 'active' : ''}`}>
      <MediaThumb media={media} />
      <span className="mrelated-body">
        <strong>{media.caption ?? media.title}</strong>
        {context && <span>{context}</span>}
        <span>{MEDIA_KIND_LABELS[media.kind]}</span>
      </span>
    </Link>
  )
}

export function MediaWatchPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, error, loading } = useApi(`/public/media/${id}`)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [autoplay, setAutoplay] = useState(readAutoplay)
  const [copied, setCopied] = useState(false)

  const media = data?.media
  const startPlaying = Boolean(location.state?.autoplay)
  const related = useMemo(() => data?.related ?? [], [data])
  // File de lecture : ordre de la médiathèque si l'on vient de la grille,
  // sinon les médias associés. Une vidéo ou un audio enchaîne sur le
  // prochain média lisible ; la visionneuse passe d'une photo à l'autre.
  const fromLibrary = Array.isArray(location.state?.queue) && location.state.queue.some((q) => q.id === id)
  const queue = fromLibrary ? location.state.queue : media ? [{ id, kind: media.kind }, ...related.map((m) => ({ id: m.id, kind: m.kind }))] : []
  const playable = (k) => k === 'VIDEO' || k === 'AUDIO'
  const fits = (q) => (media?.kind === 'PHOTO' ? q.kind === 'PHOTO' : playable(media?.kind) && playable(q.kind))
  const position = queue.findIndex((q) => q.id === id)
  // En fin de file, on continue avec un média associé du même genre.
  const nextId = queue.slice(position + 1).find(fits)?.id ?? related.find((m) => fits(m) && m.id !== id)?.id ?? null
  const prevId = position > 0 ? [...queue.slice(0, position)].reverse().find(fits)?.id ?? null : null
  const nextMedia = playable(media?.kind) ? related.find((m) => m.id === nextId) ?? (nextId ? { id: nextId } : null) : null

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [id])
  useEffect(() => {
    if (media) document.title = `${media.title} · ${t('browse.mediatheque')} · URITHI`
  }, [media])

  const go = (target, play = false) => {
    if (!target) return
    setTranscriptOpen(false)
    // L'intention de lecture passe par l'état de navigation : la page est
    // remontée à chaque changement d'adresse.
    navigate(`/mediatheque/${target}`, { state: { queue, autoplay: play } })
  }
  const toggleAutoplay = () => {
    setAutoplay((a) => {
      try {
        localStorage.setItem('urithi.player.autoplay', String(!a))
      } catch {
        // préférence non mémorisée
      }
      return !a
    })
  }
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // presse-papiers indisponible
    }
  }

  if (error) {
    return (
      <>
        <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('browse.mediatheque'), to: '/mediatheque' }]} />
        <EmptyState icon={Camera} title={t('mediaLib.mediaIndisponible')} action={<Link className="button secondary" to="/mediatheque">{t('mediaLib.retourMediatheque')}</Link>}>
          {t('mediaLib.mediaIndisponibleAide')}
        </EmptyState>
      </>
    )
  }
  if (!media) {
    return (
      <div className="mwatch" aria-busy={loading}>
        <div className="mwatch-main">
          <div className="mwatch-stage skeleton" />
          <span className="skeleton" style={{ height: 26, width: '60%', display: 'block', marginTop: '1rem' }} />
        </div>
      </div>
    )
  }

  const texts = media.texts ?? []
  const onEnded = autoplay && nextId ? () => go(nextId, true) : undefined
  const subtitle = [media.credit, media.communities[0]?.name].filter(Boolean).join(' · ')
  const details = [
    [t('mediaLib.type'), [MEDIA_KIND_LABELS[media.kind], formatLabel(media.mimeType), formatSize(media.sizeBytes)].filter(Boolean).join(' · ')],
    [t('mediaLib.dateDuDocument'), media.dateValue],
    [t('mediaLib.lieu'), media.place?.name],
    [t('mediaLib.credit'), media.credit],
    [t('mediaLib.contexte'), media.context],
    [t('mediaLib.provenance'), media.provenance],
    [t('mediaLib.droits'), media.rightsStatement],
    [t('mediaLib.ajouteLe'), formatDate(media.createdAt)],
  ].filter(([, v]) => v)

  return (
    <>
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('browse.mediatheque'), to: '/mediatheque' }, { label: media.title }]} />
      <div className="mwatch">
        <div className="mwatch-main">
          <div className={`mwatch-stage kind-${media.kind.toLowerCase()}`} key={media.id}>
            {media.kind === 'VIDEO' && (
              <VideoPlayer
                media={media}
                autoPlay={startPlaying}
                onEnded={onEnded}
                transcriptOpen={transcriptOpen}
                onToggleTranscript={texts.length ? () => setTranscriptOpen((o) => !o) : undefined}
              />
            )}
            {media.kind === 'AUDIO' && <AudioPlayer media={media} autoPlay={startPlaying} onEnded={onEnded} waveform subtitle={subtitle} />}
            {media.kind === 'PHOTO' && <ImageViewer media={media} onPrev={prevId ? () => go(prevId) : undefined} onNext={nextId ? () => go(nextId) : undefined} />}
            {media.kind === 'DOCUMENT' && <DocumentPreview media={media} />}
          </div>

          {transcriptOpen && texts.length > 0 && <Transcript texts={texts} onClose={() => setTranscriptOpen(false)} />}

          <h1 className="mwatch-title">{media.caption ?? media.title}</h1>
          <div className="mwatch-bar">
            <div className="mwatch-tags">
              {media.communities.map((c) => (
                <Link key={c.slug} to={`/communautes/${c.slug}`} className="mtag community">
                  <Globe2 size={14} aria-hidden="true" />
                  {c.name}
                </Link>
              ))}
              {media.categories.map((c) => (
                <Link key={c.slug} to={`/themes/${c.slug}`} className="mtag">
                  <Tags size={14} aria-hidden="true" />
                  {c.name}
                </Link>
              ))}
            </div>
            <div className="mwatch-actions">
              {texts.length > 0 && media.kind !== 'VIDEO' && (
                <button type="button" className={`secondary ${transcriptOpen ? 'active' : ''}`} aria-pressed={transcriptOpen} onClick={() => setTranscriptOpen((o) => !o)}>
                  <ScrollText size={16} className="icon" aria-hidden="true" />
                  {t('player.transcription')}
                </button>
              )}
              <button type="button" className="secondary" onClick={share}>
                {copied ? <Check size={16} className="icon" aria-hidden="true" /> : <Link2 size={16} className="icon" aria-hidden="true" />}
                {copied ? t('mediaLib.lienCopie') : t('mediaLib.partager')}
              </button>
              {media.downloadUrl && (
                <a className="button secondary" href={media.downloadUrl}>
                  <Download size={16} className="icon" aria-hidden="true" />
                  {t('player.telecharger')}
                </a>
              )}
            </div>
          </div>

          <div className="mwatch-info">
            <p className="mwatch-meta">
              <Calendar size={14} aria-hidden="true" />
              {[formatDate(media.createdAt), media.dateValue, media.place?.name].filter(Boolean).join(' · ')}
            </p>
            {media.description ? <Description text={media.description} /> : <p className="muted small">{t('mediaLib.pasDeDescription')}</p>}
          </div>

          {media.items.length > 0 && (
            <section className="mwatch-section">
              <h2>
                <BookOpen size={18} aria-hidden="true" />
                {t('mediaLib.fichesLiees')}
              </h2>
              <ul className="mwatch-items">
                {media.items.map((i) => (
                  <li key={i.slug}>
                    <Link to={`/contenus/${i.slug}`}>
                      {i.title}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mwatch-section">
            <h2>
              <Image size={18} aria-hidden="true" />
              {t('mediaLib.informationsDocumentaires')}
            </h2>
            <dl className="mwatch-details">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className="preserve-lines">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="mwatch-aside" aria-label={t('mediaLib.aDecouvrir')}>
          {nextMedia && (
            <div className="mwatch-next">
              <div className="mwatch-next-head">
                <span>
                  <SkipForward size={15} aria-hidden="true" />
                  {t('mediaLib.aSuivre')}
                </span>
                <label className="switch">
                  <input type="checkbox" checked={autoplay} onChange={toggleAutoplay} />
                  <span>{t('mediaLib.lectureAuto')}</span>
                </label>
              </div>
            </div>
          )}
          {related.length > 0 ? (
            <>
              <h2>{t('mediaLib.aDecouvrir')}</h2>
              <div className="mrelated-list">
                {related.map((m) => (
                  <RelatedItem key={m.id} media={m} queue={queue} active={m.id === nextId} />
                ))}
              </div>
            </>
          ) : (
            <p className="muted small">{t('mediaLib.aucunMediaAssocie')}</p>
          )}
          <Link to="/mediatheque" className="button secondary mwatch-back">
            <LayoutGrid size={16} className="icon" aria-hidden="true" />
            {t('mediaLib.retourMediatheque')}
          </Link>
        </aside>
      </div>
    </>
  )
}
