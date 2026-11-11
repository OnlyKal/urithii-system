import { ChevronRight, ExternalLink, KeyRound, LogOut, Menu, Plus, Search, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext.jsx'
import { WorkspaceTabs } from '../../components/admin/ItemTable.jsx'
import { DropdownMenu } from '../../components/DropdownMenu.jsx'
import { Logo } from '../../components/Logo.jsx'
import { LoadingSkeleton } from '../../components/ui.jsx'
import { roleLabel } from '../../roles.js'
import { t } from '../../i18n/index.js'
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher.jsx'
import { currentTab, currentWorkspace, visibleWorkspaces } from './workspaces.js'

const initials = (name) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

// Recherche rapide d'une fiche depuis n'importe quelle page.
function QuickSearch() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [q, setQ] = useState('')
  // L'administrateur cherche dans les fiches, le collecteur dans ses dossiers.
  const searchItems = can('dossiers.review') || can('content.edit')
  return (
    <form
      className="admin-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (!q.trim()) return
        navigate(searchItems ? `/admin/fiches?vue=tous&q=${encodeURIComponent(q.trim())}` : `/admin/collectes?q=${encodeURIComponent(q.trim())}`)
      }}
    >
      <Search size={16} className="icon" aria-hidden="true" />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchItems ? t('ws.rechercherUneFiche') : t('dossier.rechercherUnDossier')} aria-label={searchItems ? t('ws.rechercherUneFiche') : t('dossier.rechercherUnDossier')} />
    </form>
  )
}

export default function AdminLayout() {
  const { user, can, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const workspaces = visibleWorkspaces(can)
  const workspace = currentWorkspace(workspaces, location.pathname)
  const tab = currentTab(workspace, location.pathname)
  const isListPage = workspace && (location.pathname === workspace.to || (tab && location.pathname === tab[0]))
  const canCollect = can('dossiers.collect') || can('dossiers.review')

  useEffect(() => setOpen(false), [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="admin">
      <aside className={`admin-sidebar ${open ? 'open' : ''}`} aria-label={t('adminLayout.espaceContributeur')}>
        <div className="admin-sidebar-head">
          <Logo to="/admin" inverse />
          <button type="button" className="ghost icon-button mobile-only" onClick={() => setOpen(false)} aria-label={t('adminLayout.fermerLeMenu')}>
            <X size={18} className="icon" aria-hidden="true" />
          </button>
        </div>
        {canCollect && (
          <div className="sidebar-cta">
            <Link to="/admin/collectes/nouvelle" className="button">
              <Plus size={17} className="icon" aria-hidden="true" />{t('dossier.nouvelleCollecte')}</Link>
          </div>
        )}
        <nav>
          {workspaces.map((ws) => (
            <NavLink key={ws.id} to={ws.to} end={ws.end} className={() => (workspace?.id === ws.id ? 'active' : '')}>
              <ws.icon size={18} className="icon" aria-hidden="true" />
              {ws.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className="admin-body">
        <header className="admin-topbar">
          <button type="button" className="ghost icon-button mobile-only" onClick={() => setOpen(true)} aria-label={t('adminLayout.ouvrirLeMenu')} aria-expanded={open}>
            <Menu size={20} className="icon" aria-hidden="true" />
          </button>
          <nav aria-label={t('adminLayout.filDAriane')} className="breadcrumbs topbar-crumbs desktop-only">
            <ol>
              <li>
                {workspace && workspace.id !== 'accueil' ? <Link to="/admin">{t('adminLayout.espaceContributeur')}</Link> : <span aria-current="page">{t('ws.tableauDeBord')}</span>}
              </li>
              {workspace && workspace.id !== 'accueil' && (
                <li>
                  <ChevronRight size={14} className="icon" aria-hidden="true" />
                  {isListPage ? <span aria-current="page">{tab ? tab[1] : workspace.label}</span> : <Link to={tab ? tab[0] : workspace.to}>{tab ? tab[1] : workspace.label}</Link>}
                </li>
              )}
              {workspace && !isListPage && workspace.id !== 'accueil' && (
                <li>
                  <ChevronRight size={14} className="icon" aria-hidden="true" />
                  <span aria-current="page">{/\/(nouvelle|nouveau)$/.test(location.pathname) ? t('adminLayout.creation') : location.pathname.endsWith('/modifier') ? t('adminLayout.modification') : t('adminLayout.detail')}</span>
                </li>
              )}
            </ol>
          </nav>
          <QuickSearch />
          <div className="spacer" />
          <LanguageSwitcher />
          <Link to="/" className="button ghost">
            <ExternalLink size={16} className="icon" aria-hidden="true" />
            <span className="desktop-only">{t('adminLayout.voirLeSite')}</span>
          </Link>
          <DropdownMenu
            align="right"
            buttonClassName="user-button"
            ariaLabel={t('adminLayout.compteDe', { 0: user.displayName })}
            label={
              <>
                <span className="avatar" aria-hidden="true">
                  {initials(user.displayName)}
                </span>
                <span className="desktop-only" style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 550 }}>{user.displayName}</span>
                  <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{roleLabel(user.roles[0])}</span>
                </span>
              </>
            }
          >
            <Link to="/compte/mot-de-passe" className="dropdown-item">
              <KeyRound size={16} className="icon icon-muted" aria-hidden="true" />{t('adminLayout.changerLeMotDePasse')}</Link>
            <button type="button" className="dropdown-item" onClick={handleLogout}>
              <LogOut size={16} className="icon icon-muted" aria-hidden="true" />{t('adminLayout.seDeconnecter')}</button>
          </DropdownMenu>
        </header>
        <main className="admin-main">
          {/* Onglets de l'espace de travail, sur ses pages de liste. */}
          {workspace?.tabs?.length > 1 && isListPage && (
            <WorkspaceTabs
              label={workspace.label}
              tabs={workspace.tabs.map(([to, label, icon]) => ({ id: to, to, label, icon, active: tab?.[0] === to }))}
            />
          )}
          <Suspense fallback={<LoadingSkeleton />}>
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
