import { ArrowRight, BookOpen, Calendar, Camera, ChevronRight, FileText, Globe2, Headphones, ImageOff, MapPin, Play, Quote, ScrollText, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DOC_STATUS_LABELS, formatDate, MEDIA_KIND_LABELS, SOURCE_STATUS_LABELS, SOURCE_TYPE_LABELS, VERIFICATION_LABELS } from '../labels.js'
import { categoryIcon } from './icons.js'
import { Modal } from './Modal.jsx'
import { AudioPlayer as ProAudioPlayer, DocumentPreview, VideoPlayer as ProVideoPlayer } from './media/MediaPlayers.jsx'
import { t, tn } from '../i18n/index.js'

function CardCover({ cover, icon: Icon = ImageOff }) {
  return (
    <div className="card-media">
      {cover ? <img src={cover.thumbnailUrl ?? cover.url} alt={cover.alt ?? ''} loading="lazy" /> : <Icon size={30} className="icon" aria-hidden="true" />}
    </div>
  )
}

export function CommunityCard({ community }) {
  const places = community.places?.map((p) => p.name).slice(0, 3).join(', ')
  return (
    <Link to={`/communautes/${community.slug}`} className="card-link">
      <CardCover cover={community.cover} icon={Globe2} />
      <div className="card-body">
        <h3 className="card-title">{community.name}</h3>
        {community.summary && <p className="card-text">{community.summary}</p>}
        <div className="card-meta">
          {places && (
            <span>
              <MapPin size={14} className="icon" aria-hidden="true" />
              {places}
            </span>
          )}
          {community.itemCount > 0 && (
            <span className="meta-published">
              <BookOpen size={14} className="icon" aria-hidden="true" />
              {tn('unit.content', community.itemCount)}
            </span>
          )}
          {!community.itemCount && <span>{DOC_STATUS_LABELS[community.documentationStatus]}</span>}
        </div>
        <span className="card-cta">{t('publicCards.decouvrir')}<ChevronRight size={15} className="icon" aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}

export function CultureContentCard({ item, showCover = true }) {
  const Icon = categoryIcon(item.category?.code)
  return (
    <Link to={`/contenus/${item.slug}`} className="card-link">
      {showCover && <CardCover cover={item.cover} icon={Icon} />}
      <div className="card-body">
        {item.category && <span className="card-kicker">{item.category.name}</span>}
        <h3 className="card-title">{item.title}</h3>
        {item.summary && <p className="card-text">{item.summary}</p>}
        <div className="card-meta">
          {item.communities?.length > 0 && (
            <span>
              <Users size={14} className="icon" aria-hidden="true" />
              {item.communities.map((c) => c.name).join(', ')}
            </span>
          )}
          {(item.updatedAt ?? item.publishedAt) && (
            <span>
              <Calendar size={14} className="icon" aria-hidden="true" />
              <time dateTime={item.updatedAt ?? item.publishedAt}>
                {item.updatedAt && item.publishedAt && item.updatedAt > item.publishedAt ? t('publicCards.misAJourLe') : ''}
                {formatDate(item.updatedAt ?? item.publishedAt)}
              </time>
            </span>
          )}
        </div>
        {item.verificationStatus && <span className={`verif-tag verif-${item.verificationStatus.toLowerCase()}`}>{VERIFICATION_LABELS[item.verificationStatus]}</span>}
      </div>
    </Link>
  )
}

// Ancien nom conservé pour les imports existants.
export const ItemCard = CultureContentCard

export function CollectionCard({ to, icon: Icon, title, description, count, unit }) {
  return (
    <Link to={to} className="collection-card">
      <span className="category-icon">
        <Icon size={21} className="icon" aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
      <span className="collection-count">
        {count > 0 ? tn(`unit.${unit}`, count) : t('publicCards.bientotDisponible')}
        {count > 0 && <ArrowRight size={14} className="icon" aria-hidden="true" style={{ verticalAlign: '-2px', marginLeft: 4 }} />}
      </span>
    </Link>
  )
}

// Entrée d'exploration par domaine. `label`, `icon`, `to` et `count`
// permettent d'afficher une collection (photos, audiovisuel) avec le même style.
export function CategoryItem({ category, label, icon, to, count, unit = 'content' }) {
  const Icon = icon ?? categoryIcon(category?.code)
  const total = count ?? category?.itemCount ?? 0
  return (
    <Link to={to ?? `/themes/${category.slug}`} className={`category-item ${total > 0 ? 'has-content' : 'is-empty'}`}>
      <span className="category-icon">
        <Icon size={20} className="icon" aria-hidden="true" />
      </span>
      <span>
        <strong>{label ?? category.name}</strong>
        <span>{total > 0 ? tn(`unit.${unit}`, total) : t('home.documentationEnCours')}</span>
      </span>
    </Link>
  )
}

function Transcripts({ texts }) {
  if (!texts?.length) return null
  return texts.map((tx) => (
    <details key={tx.id} className="transcript">
      <summary>
        <ScrollText size={15} className="icon" aria-hidden="true" />
        {tx.kind === 'TRANSCRIPTION' ? t('text.transcription') : t('text.traduction')} ({tx.language})
        {tx.verification !== 'VERIFIED' && <span className="badge">{t('publicCards.nonVerifiee')}</span>}
      </summary>
      <pre className="text-content">{tx.content}</pre>
    </details>
  ))
}

function MediaMeta({ media }) {
  return (
    <figcaption>
      <strong>{media.caption ?? media.title}</strong>
      <span className="media-credit">
        {[media.credit, media.dateValue, media.place?.name].filter(Boolean).join(' · ')}
      </span>
      {media.rightsStatement && <span className="media-credit">{t('publicCards.droits')}{' '}{media.rightsStatement}</span>}
    </figcaption>
  )
}

// Lien vers la page de consultation du média dans la médiathèque.
function OpenInLibrary({ media }) {
  return (
    <Link to={`/mediatheque/${media.id}`} className="small action-link">
      {t('mediaLib.ouvrirDansLaMediatheque')}
    </Link>
  )
}

export function AudioPlayer({ media }) {
  return (
    <figure className="media-card" style={{ margin: 0 }}>
      <ProAudioPlayer media={media} compact subtitle={[media.credit, media.dateValue].filter(Boolean).join(' · ')} />
      <Transcripts texts={media.texts} />
      <OpenInLibrary media={media} />
    </figure>
  )
}

export function VideoPlayer({ media }) {
  return (
    <figure className="media-card" style={{ margin: 0 }}>
      <div className="media-video">
        <ProVideoPlayer media={media} />
      </div>
      <MediaMeta media={media} />
      <Transcripts texts={media.texts} />
      <OpenInLibrary media={media} />
    </figure>
  )
}

const KIND_ICONS = { PHOTO: Camera, VIDEO: Play, AUDIO: Headphones, DOCUMENT: FileText }

// Carte média : photo avec agrandissement, lecteurs audio et vidéo, documents.
export function MediaCard({ media }) {
  const [open, setOpen] = useState(false)
  if (media.kind === 'AUDIO') return <AudioPlayer media={media} />
  if (media.kind === 'VIDEO') return <VideoPlayer media={media} />
  const KindIcon = KIND_ICONS[media.kind]
  return (
    <figure className="media-card" style={{ margin: 0 }}>
      <div className="media-frame">
        {media.kind === 'PHOTO' ? (
          <button type="button" onClick={() => setOpen(true)} aria-label={t('publicCards.enlarge', { title: media.caption ?? media.title })}>
            <img src={media.thumbnailUrl ?? media.url} alt={media.caption ?? media.title} loading="lazy" />
          </button>
        ) : (
          <button type="button" onClick={() => setOpen(true)} aria-label={t('publicCards.openDocument', { title: media.caption ?? media.title })} className="thumb placeholder">
            <FileText size={28} className="icon" aria-hidden="true" />
          </button>
        )}
        <span className="media-overlay">
          <KindIcon size={13} className="icon" aria-hidden="true" />
          {MEDIA_KIND_LABELS[media.kind]}
        </span>
      </div>
      <MediaMeta media={media} />
      <Transcripts texts={media.texts} />
      {open && (
        <Modal title={media.caption ?? media.title} onClose={() => setOpen(false)} wide>
          {media.kind === 'PHOTO' ? (
            <div className="lightbox">
              <img src={media.url} alt={media.caption ?? media.title} />
            </div>
          ) : (
            <DocumentViewer media={media} />
          )}
          <MediaMeta media={media} />
        </Modal>
      )}
    </figure>
  )
}

// Visionneuse de documents (aperçu PDF ou texte, sinon ouverture du fichier).
export const DocumentViewer = DocumentPreview

// Ancien nom conservé pour les imports existants.
export const MediaFigure = MediaCard

export function SourceReference({ source }) {
  return (
    <li className="source-ref">
      <div>
        <div className="source-type">{SOURCE_TYPE_LABELS[source.type]}</div>
        <div>
          {source.author && `${source.author}, `}
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer noopener">
              {source.title}
            </a>
          ) : (
            <em>{source.title}</em>
          )}
          {source.publisher && `, ${source.publisher}`}
          {source.date && `, ${source.date}`}
          {source.locator && `, ${source.locator}`}
        </div>
        {source.reference && <div className="source-supports">{source.reference}</div>}
        {source.supports && (
          <div className="source-supports">
            <Quote size={12} className="icon" aria-hidden="true" style={{ verticalAlign: '-1px' }} />{' '}{t('publicCards.etaye')}{' '}{source.supports}
          </div>
        )}
        {source.status !== 'ACTIVE' && <div className="small error">{t('publicCards.source')}{' '}{SOURCE_STATUS_LABELS[source.status].toLowerCase()}</div>}
      </div>
    </li>
  )
}
