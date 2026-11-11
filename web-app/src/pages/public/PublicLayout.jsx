import { Archive, ArrowUp, Compass, Gamepad2, Globe2, Home, Info, Leaf, Library, LogIn, Map, Menu, MessageSquare, Search, Tags, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../auth/AuthContext.jsx'
import { DropdownMenu } from '../../components/DropdownMenu.jsx'
import { Logo } from '../../components/Logo.jsx'
import { getLanguage, LANGUAGES, setLanguage, t } from '../../i18n/index.js'
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher.jsx'

const YEAR = new Date().getFullYear()

const EXPLORE = [
  ['/themes', Tags, t('publicLayout.themesCulturels'), t('publicLayout.gastronomieContesDansesSavoirFaire')],
  ['/explorer', Map, t('publicLayout.parProvinceEtLocalite'), t('publicLayout.parcourirLeTerritoire')],
  ['/contenus', Library, t('home.tousLesContenus'), t('publicLayout.fichesPublieesAvecFiltres')],
  ['/atlas', Leaf, t('publicLayout.atlasVivant'), t('publicLayout.atlasVivantHint')],
]

export default function PublicLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const exploring = ['/themes', '/explorer', '/contenus', '/atlas'].some((p) => location.pathname.startsWith(p))
  const archives = ['/collections', '/mediatheque'].some((p) => location.pathname.startsWith(p))

  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="public">
      <a href="#contenu" className="skip-link">{t('publicLayout.allerAuContenu')}</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Logo inverse />
          <nav aria-label={t('publicLayout.navigationPrincipale')} className="main-nav">
            <NavLink to="/" end>{t('common.home')}</NavLink>
            <NavLink to="/communautes">{t('common.communities')}</NavLink>
            <DropdownMenu label={t('publicLayout.patrimoineCulturel')} active={exploring}>
              {EXPLORE.map(([to, Icon, label, hint]) => (
                <Link key={to} to={to} className="dropdown-item">
                  <Icon size={18} className="icon icon-blue" aria-hidden="true" />
                  <span>
                    {label}
                    <small>{hint}</small>
                  </span>
                </Link>
              ))}
            </DropdownMenu>
            <NavLink to="/collections" className={archives ? 'active' : undefined}>{t('publicLayout.archives')}</NavLink>
            <NavLink to="/jeux">{t('publicLayout.jeux')}</NavLink>
            <NavLink to="/a-propos">{t('publicLayout.aPropos')}</NavLink>
          </nav>
          <div className="header-actions">
            <LanguageSwitcher className="on-dark" />
            <NavLink to="/recherche" className="button ghost search-entry" aria-label={t('common.search')}>
              <Search size={18} className="icon" aria-hidden="true" />
              <span className="desktop-only">{t('common.search')}</span>
            </NavLink>
            <Link to="/themes" className="button header-cta desktop-only">
              <Compass size={17} className="icon" aria-hidden="true" />{t('publicLayout.explorerLePatrimoine')}</Link>
            <button
              type="button"
              className="ghost icon-button menu-toggle mobile-only"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? t('adminLayout.fermerLeMenu') : t('adminLayout.ouvrirLeMenu')}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} className="icon" aria-hidden="true" /> : <Menu size={20} className="icon" aria-hidden="true" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label={t('publicLayout.navigationPrincipale')} className="mobile-nav mobile-only">
            <NavLink to="/" end>
              <Home size={18} className="icon icon-muted" aria-hidden="true" />{t('common.home')}</NavLink>
            <NavLink to="/communautes">
              <Globe2 size={18} className="icon icon-muted" aria-hidden="true" />{t('common.communities')}</NavLink>
            <span className="nav-title">{t('publicLayout.patrimoineCulturel')}</span>
            {EXPLORE.map(([to, Icon, label]) => (
              <NavLink key={to} to={to}>
                <Icon size={18} className="icon icon-muted" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
            <NavLink to="/jeux">
              <Gamepad2 size={18} className="icon icon-muted" aria-hidden="true" />{t('publicLayout.jeux')}</NavLink>
            <span className="nav-title">{t('publicLayout.plus')}</span>
            <NavLink to="/collections">
              <Archive size={18} className="icon icon-muted" aria-hidden="true" />{t('publicLayout.archives')}</NavLink>
            <NavLink to="/recherche">
              <Search size={18} className="icon icon-muted" aria-hidden="true" />{t('publicLayout.recherche')}</NavLink>
            <NavLink to="/a-propos">
              <Info size={18} className="icon icon-muted" aria-hidden="true" />{t('publicLayout.aPropos')}</NavLink>
            <NavLink to={user ? '/admin' : '/connexion'}>
              <LogIn size={18} className="icon icon-muted" aria-hidden="true" />
              {user ? t('publicLayout.espaceContributeur') : t('info.contributeurs')}
            </NavLink>
            {LANGUAGES.length > 1 && (
              <>
                <span className="nav-title">{t('language.label')}</span>
                <div className="mobile-languages" role="group" aria-label={t('language.label')}>
                  {LANGUAGES.map((language) => (
                    <button
                      key={language.code}
                      type="button"
                      lang={language.code}
                      className={language.code === getLanguage() ? 'active' : ''}
                      aria-pressed={language.code === getLanguage()}
                      onClick={() => setLanguage(language.code)}
                    >
                      {language.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </nav>
        )}
      </header>

      <main id="contenu" className={`site-main ${location.pathname === '/atlas' || location.pathname === '/jeux' ? 'site-main-wide' : ''}`}>
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-mission">
              <Logo inverse />
              <p>
                <em>{t('publicLayout.urithi')}</em>{' '}{t('publicLayout.signifieHeritageEnSwahiliUrithi')}</p>
              <Link to="/themes" className="button footer-cta">
                <Compass size={17} className="icon" aria-hidden="true" />{t('publicLayout.explorerLePatrimoine')}</Link>
            </div>
            <nav aria-labelledby="footer-decouvrir">
              <h2 id="footer-decouvrir">{t('publicLayout.decouvrir')}</h2>
              <ul>
                <li><Link to="/communautes">{t('common.communities')}</Link></li>
                <li><Link to="/themes">{t('publicLayout.themesCulturels')}</Link></li>
                <li><Link to="/explorer">{t('publicLayout.explorerParLieu')}</Link></li>
                <li><Link to="/collections">{t('publicLayout.archivesEtCollections')}</Link></li>
                <li><Link to="/mediatheque">{t('publicLayout.mediatheque')}</Link></li>
                <li><Link to="/jeux">{t('publicLayout.jeux')}</Link></li>
              </ul>
            </nav>
            <nav aria-labelledby="footer-infos">
              <h2 id="footer-infos">{t('publicLayout.informations')}</h2>
              <ul>
                <li><Link to="/a-propos">{t('publicLayout.aProposDUrithi')}</Link></li>
                <li><Link to="/confidentialite">{t('publicLayout.confidentialite')}</Link></li>
                <li><Link to="/signaler">{t('publicLayout.signalerUnContenu')}</Link></li>
                <li><a href="/api/public/export">{t('publicLayout.donneesOuvertesJson')}</a></li>
              </ul>
            </nav>
            <nav aria-labelledby="footer-contact">
              <h2 id="footer-contact">{t('publicLayout.contact')}</h2>
              <ul>
                <li>
                  <Link to="/signaler" className="footer-icon-link">
                    <MessageSquare size={16} className="icon" aria-hidden="true" />{t('publicLayout.ecrireALEquipeUrithi')}</Link>
                </li>
                <li>
                  <Link to="/connexion" className="footer-icon-link">
                    <LogIn size={16} className="icon" aria-hidden="true" />{t('publicLayout.espaceContributeur')}</Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>© {YEAR}{' '}{t('publicLayout.urithiPatrimoineCulturelDeLa')}</span>
            <span className="footer-tagline">{t('publicLayout.lesContenusRestentLaMemoire')}</span>
            <button type="button" className="footer-top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>
              <ArrowUp size={16} className="icon" aria-hidden="true" />{t('publicLayout.hautDePage')}</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
