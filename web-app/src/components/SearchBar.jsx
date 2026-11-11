import { Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { t } from '../i18n/index.js'

// Barre de recherche générale. `large` : version flottante de l'accueil.
export function SearchBar({ large = false, defaultValue = '', placeholder = t('searchBar.rechercherUneCommunauteUnPlat'), onSearch, className = '' }) {
  const [q, setQ] = useState(defaultValue)
  const navigate = useNavigate()

  function submit(e) {
    e.preventDefault()
    if (onSearch) onSearch(q)
    else navigate(`/recherche?q=${encodeURIComponent(q)}`)
  }

  return (
    <form role="search" onSubmit={submit} className={`search-bar ${large ? 'large elevated' : ''} ${className}`}>
      <Search size={large ? 20 : 17} className="icon" aria-hidden="true" />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={t('searchBar.rechercherDansUrithi')} />
      {large && (
        <button type="submit">
          <Search size={18} className="icon mobile-only" aria-hidden="true" />
          <span>{t('common.search')}</span>
        </button>
      )}
    </form>
  )
}
