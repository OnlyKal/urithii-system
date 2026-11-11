import { Check, Languages } from 'lucide-react'
import { DropdownMenu } from '../components/DropdownMenu.jsx'
import { getLanguage, LANGUAGES, setLanguage, t } from './index.js'

// Sélecteur de langue : menu déroulant accessible au clavier.
export function LanguageSwitcher({ className = '', align = 'right' }) {
  if (LANGUAGES.length < 2) return null
  const current = LANGUAGES.find((l) => l.code === getLanguage())
  return (
    <DropdownMenu
      align={align}
      buttonClassName={`language-button ${className}`}
      ariaLabel={t('language.choose', { language: current.label })}
      label={
        <>
          <Languages size={17} className="icon" aria-hidden="true" />
          <span className="language-code">{current.code.toUpperCase()}</span>
        </>
      }
    >
      {LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          className="dropdown-item"
          lang={language.code}
          aria-current={language.code === current.code ? 'true' : undefined}
          onClick={() => setLanguage(language.code)}
        >
          <span className="language-code-badge">{language.code.toUpperCase()}</span>
          {language.label}
          {language.code === current.code && <Check size={16} className="icon icon-blue" aria-hidden="true" style={{ marginLeft: 'auto' }} />}
        </button>
      ))}
    </DropdownMenu>
  )
}
