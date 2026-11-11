import { AlertCircle, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api, errorText } from '../api.js'
import { STATUS_LABELS } from '../labels.js'
import { t } from '../i18n/index.js'

// Chargement de données avec rechargement manuel. Les données ne sont
// renvoyées que si elles correspondent à la requête courante : on n'affiche
// jamais un résultat périmé pendant un changement de page ou de filtre.
export function useApi(path) {
  const [state, setState] = useState({ path: null, data: null, error: null })
  const [loading, setLoading] = useState(Boolean(path))

  const reload = useCallback(async () => {
    if (!path) return
    setLoading(true)
    try {
      const data = await api(path)
      setState({ path, data, error: null })
    } catch (error) {
      setState({ path, data: null, error })
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    reload()
  }, [reload])

  const current = state.path === path
  const setData = useCallback((data) => setState((s) => ({ ...s, data: typeof data === 'function' ? data(s.data) : data })), [])
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: Boolean(path) && (loading || !current),
    reload,
    setData,
  }
}

export function ErrorMessage({ error }) {
  if (!error) return null
  return (
    <p role="alert" className="error">
      <AlertCircle size={18} className="icon" aria-hidden="true" />
      <span>{typeof error === 'string' ? error : errorText(error)}</span>
    </p>
  )
}

// Squelettes de chargement : formes sobres, sans animation envahissante.
export function LoadingSkeleton({ variant = 'lines', count = 3 }) {
  if (variant === 'cards') {
    return (
      <div className="card-grid" aria-busy="true" aria-label={t('ui.chargement')}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    )
  }
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label={t('ui.chargement')}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton skeleton-line" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  )
}

export function Loading({ loading, error, children, variant }) {
  if (error) return <ErrorMessage error={error} />
  if (loading) return <LoadingSkeleton variant={variant} />
  return children
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="empty-state">
      <Icon size={24} className="icon" aria-hidden="true" />
      {title && <strong>{title}</strong>}
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function SectionHeader({ icon: Icon, title, description, link, linkLabel, as: Heading = 'h2', id }) {
  return (
    <div className="section-header">
      <div>
        <Heading id={id}>
          {Icon && <Icon size={21} className="icon icon-blue" aria-hidden="true" />}
          {title}
        </Heading>
        {description && <p>{description}</p>}
      </div>
      {link && (
        <Link to={link} className="section-link">
          {linkLabel}
          <ChevronRight size={16} className="icon" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export function Breadcrumbs({ items }) {
  return (
    <nav aria-label={t('ui.filDAriane')} className="breadcrumbs">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`}>
              {i > 0 && <ChevronRight size={14} className="icon" aria-hidden="true" />}
              {last || !item.to ? (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              ) : (
                <Link to={item.to}>{item.label}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge status-${status?.toLowerCase()}`}>{STATUS_LABELS[status] ?? status}</span>
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <div className="pagination">
      <button type="button" className="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} className="icon" aria-hidden="true" />{t('common.previous')}</button>
      <span>{t('ui.page')}{' '}{page}{' '}{t('ui.sur')}{' '}{pages} · {total}{' '}{t('ui.resultats')}</span>
      <button type="button" className="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>{t('common.next')}<ChevronRight size={16} className="icon" aria-hidden="true" />
      </button>
    </div>
  )
}

// Liste de cases à cocher filtrable, pour les sélections multiples.
export function MultiSelect({ label, options, value, onChange, placeholder = t('ui.filtrer') }) {
  const [filter, setFilter] = useState('')
  const visible = options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
  return (
    <fieldset className="multiselect">
      <legend>{label}</legend>
      {options.length > 8 && (
        <input type="search" placeholder={placeholder} value={filter} onChange={(e) => setFilter(e.target.value)} />
      )}
      <div className="multiselect-options">
        {visible.map((o) => (
          <label key={o.value} className="checkbox">
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
            />
            {o.label}
          </label>
        ))}
        {visible.length === 0 && <span className="muted">{t('ui.aucunElement')}</span>}
      </div>
    </fieldset>
  )
}

export function Select({ label, value, onChange, options, empty = '—', required }) {
  return (
    <label>
      {label}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} required={required}>
        {!required && <option value="">{empty}</option>}
        {required && !value && <option value="">{t('common.choose')}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// Libellé hiérarchique d'un lieu : « Idjwi (Sud-Kivu) ».
export function placeLabel(place, places) {
  const parent = places.find((p) => p.id === place.parentId)
  return parent && parent.type !== 'COUNTRY' ? `${place.name} (${parent.name})` : place.name
}

// Champ de formulaire avec libellé persistant, aide et message d'erreur.
export function FormField({ label, children, help, error }) {
  return (
    <label className="field">
      {label}
      {children}
      {help && <small className="help">{help}</small>}
      {error && <small className="error">{error}</small>}
    </label>
  )
}

export const Field = FormField

// Conteneur de tableau responsive : défilement horizontal sur tablette, et
// sur téléphone chaque ligne devient une carte où chaque valeur est précédée
// de l'intitulé de sa colonne (recopié automatiquement depuis l'en-tête).
export function TableWrap({ children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = () => {
      for (const table of el.querySelectorAll('table')) {
        const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
        for (const row of table.querySelectorAll('tbody tr')) {
          ;[...row.children].forEach((cell, i) => {
            const label = heads[i] ?? ''
            if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label)
          })
        }
      }
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className={`table-wrap table-cards ${className}`}>
      {children}
    </div>
  )
}
