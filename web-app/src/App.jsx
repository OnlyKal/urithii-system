import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthContext.jsx'
import { RequireAuth } from './auth/RequireAuth.jsx'
import { LoadingSkeleton } from './components/ui.jsx'
import ChangePasswordPage from './pages/ChangePasswordPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import {
  CollectionsPage,
  CommunitiesPage,
  CommunityPage,
  ExplorePage,
  ItemsBrowsePage,
  SearchPage,
  ThemesPage,
} from './pages/public/BrowsePages.jsx'
import HomePage from './pages/public/HomePage.jsx'
import { AboutPage, PrivacyPage, ReportPage } from './pages/public/InfoPages.jsx'
import ItemPage from './pages/public/ItemPage.jsx'
import { MediaLibraryPage, MediaWatchPage } from './pages/public/MediaPages.jsx'
import PublicLayout from './pages/public/PublicLayout.jsx'
import { t } from './i18n/index.js'

// L'espace contributeur est chargé à la demande : les visiteurs du site
// public ne téléchargent pas son code.
// L'atlas (carte, tracés, photographies) n'est chargé que sur sa page.
const AtlasPage = lazy(() => import('./pages/public/AtlasPage.jsx'))
// Module Jeux : chargé à la demande ; la scène 3D (Three.js) ne l'est qu'au
// lancement de la partie.
const GamesHomePage = lazy(() => import('./games/pages/GamesHomePage.jsx'))
const DefiPage = lazy(() => import('./games/pages/DefiPage.jsx'))
const GardiensPage = lazy(() => import('./games/pages/GardiensPage.jsx'))
const GameMissionsPage = lazy(() => import('./games/admin/GameAdminPages.jsx').then((m) => ({ default: m.GameMissionsPage })))
const GameMissionEditPage = lazy(() => import('./games/admin/GameAdminPages.jsx').then((m) => ({ default: m.GameMissionEditPage })))
const GameStatsPage = lazy(() => import('./games/admin/GameAdminPages.jsx').then((m) => ({ default: m.GameStatsPage })))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const AuditPage = lazy(() => import('./pages/admin/AuditPage.jsx'))
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage.jsx'))
const AdminCommunitiesPage = lazy(() => import('./pages/admin/CommunitiesPage.jsx').then((m) => ({ default: m.CommunitiesPage })))
const CommunityEditPage = lazy(() => import('./pages/admin/CommunitiesPage.jsx').then((m) => ({ default: m.CommunityEditPage })))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage.jsx'))
const PermissionsPage = lazy(() => import('./pages/admin/GovernancePages.jsx').then((m) => ({ default: m.PermissionsPage })))
const PreservationPage = lazy(() => import('./pages/admin/GovernancePages.jsx').then((m) => ({ default: m.PreservationPage })))
const TakedownsWorkspace = lazy(() => import('./pages/admin/ItemsPage.jsx').then((m) => ({ default: m.TakedownsWorkspace })))
const ItemDetailPage = lazy(() => import('./pages/admin/ItemDetailPage.jsx'))
const ItemEditorPage = lazy(() => import('./pages/admin/ItemEditorPage.jsx'))
const ItemsPage = lazy(() => import('./pages/admin/ItemsPage.jsx'))
const MediaDetailPage = lazy(() => import('./pages/admin/MediaPages.jsx').then((m) => ({ default: m.MediaDetailPage })))
const MediaListPage = lazy(() => import('./pages/admin/MediaPages.jsx').then((m) => ({ default: m.MediaListPage })))
const MissionDetailPage = lazy(() => import('./pages/admin/MissionPages.jsx').then((m) => ({ default: m.MissionDetailPage })))
const MissionNewPage = lazy(() => import('./pages/admin/MissionPages.jsx').then((m) => ({ default: m.MissionNewPage })))
const MissionsPage = lazy(() => import('./pages/admin/MissionPages.jsx').then((m) => ({ default: m.MissionsPage })))
const TextDetailPage = lazy(() => import('./pages/admin/TextPages.jsx').then((m) => ({ default: m.TextDetailPage })))
const TextNewPage = lazy(() => import('./pages/admin/TextPages.jsx').then((m) => ({ default: m.TextNewPage })))
const TextsPage = lazy(() => import('./pages/admin/TextPages.jsx').then((m) => ({ default: m.TextsPage })))
const UsersPage = lazy(() => import('./pages/admin/UsersPage.jsx'))
const DossierPage = lazy(() => import('./pages/admin/dossier/DossierPage.jsx'))
const DossierListPage = lazy(() => import('./pages/admin/dossier/DossierListPage.jsx'))
const NewDossierPage = lazy(() => import('./pages/admin/dossier/DossierListPage.jsx').then((m) => ({ default: m.NewDossierPage })))
const DossierValidationsPage = lazy(() => import('./pages/admin/dossier/DossierListPage.jsx').then((m) => ({ default: m.DossierValidationsPage })))
const CollectorsPage = lazy(() => import('./pages/admin/dossier/AdminPages.jsx').then((m) => ({ default: m.CollectorsPage })))
const SectionDefsPage = lazy(() => import('./pages/admin/dossier/AdminPages.jsx').then((m) => ({ default: m.SectionDefsPage })))
const ConsentsPage = lazy(() => import('./pages/admin/ReferencePages.jsx').then((m) => ({ default: m.ConsentsPage })))
const LanguagesPage = lazy(() => import('./pages/admin/ReferencePages.jsx').then((m) => ({ default: m.LanguagesPage })))
const PersonsPage = lazy(() => import('./pages/admin/ReferencePages.jsx').then((m) => ({ default: m.PersonsPage })))
const PlacesPage = lazy(() => import('./pages/admin/ReferencePages.jsx').then((m) => ({ default: m.PlacesPage })))
const QuestionnairesPage = lazy(() => import('./pages/admin/ReferencePages.jsx').then((m) => ({ default: m.QuestionnairesPage })))
const SourcesPage = lazy(() => import('./pages/admin/ReferencePages.jsx').then((m) => ({ default: m.SourcesPage })))

const guard = (permission, element) => <RequireAuth permission={permission}>{element}</RequireAuth>
const lazyPage = (element) => <Suspense fallback={<div className="page-status"><LoadingSkeleton /></div>}>{element}</Suspense>

function App() {
  const { can } = useAuth()
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="communautes" element={<CommunitiesPage />} />
        <Route path="communautes/:slug" element={<CommunityPage />} />
        <Route path="contenus" element={<ItemsBrowsePage />} />
        <Route path="contenus/:slug" element={<ItemPage />} />
        <Route path="themes" element={<ThemesPage />} />
        <Route path="themes/:slug" element={<ItemsBrowsePage />} />
        <Route path="explorer" element={<ExplorePage />} />
        <Route path="atlas" element={<Suspense fallback={<div className="page-status"><LoadingSkeleton /></div>}><AtlasPage /></Suspense>} />
        <Route path="jeux" element={lazyPage(<GamesHomePage />)} />
        <Route path="jeux/defi" element={lazyPage(<DefiPage />)} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="mediatheque" element={<MediaLibraryPage />} />
        <Route path="mediatheque/:id" element={<MediaWatchPage />} />
        <Route path="recherche" element={<SearchPage />} />
        <Route path="a-propos" element={<AboutPage />} />
        <Route path="confidentialite" element={<PrivacyPage />} />
        <Route path="signaler" element={<ReportPage />} />
        <Route path="connexion" element={<LoginPage />} />
        <Route path="compte/mot-de-passe" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
        <Route path="*" element={<p className="page-status">{t('app.pageIntrouvable')}</p>} />
      </Route>
      {/* Partie en plein écran, hors de la mise en page du site. */}
      <Route path="jeux/gardiens" element={<Suspense fallback={<div className="game-boot" />}><GardiensPage /></Suspense>} />
      <Route path="admin" element={<RequireAuth><Suspense fallback={<div className="page-status"><LoadingSkeleton /></div>}><AdminLayout /></Suspense></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="fiches" element={<ItemsPage />} />
        <Route path="fiches/nouvelle" element={<ItemEditorPage />} />
        <Route path="fiches/:id" element={<ItemDetailPage />} />
        <Route path="fiches/:id/modifier" element={<ItemEditorPage />} />
        <Route path="validations" element={can('dossiers.review') ? <DossierValidationsPage /> : <Navigate to="/admin/fiches?vue=a-traiter" replace />} />
        <Route path="collectes" element={<DossierListPage />} />
        <Route path="collectes/nouvelle" element={<NewDossierPage />} />
        <Route path="collectes/:id" element={<DossierPage />} />
        <Route path="collecteurs" element={guard('dossiers.review', <CollectorsPage />)} />
        <Route path="formulaire" element={guard('dossiers.review', <SectionDefsPage />)} />
        <Route path="medias" element={<MediaListPage />} />
        <Route path="medias/:id" element={<MediaDetailPage />} />
        <Route path="textes" element={<TextsPage />} />
        <Route path="textes/nouveau" element={<TextNewPage />} />
        <Route path="textes/:id" element={<TextDetailPage />} />
        <Route path="missions" element={<MissionsPage />} />
        <Route path="missions/nouvelle" element={guard('missions.manage', <MissionNewPage />)} />
        <Route path="missions/:id" element={<MissionDetailPage />} />
        <Route path="questionnaires" element={<QuestionnairesPage />} />
        <Route path="communautes" element={<AdminCommunitiesPage />} />
        <Route path="communautes/:id" element={<CommunityEditPage />} />
        <Route path="lieux" element={<PlacesPage />} />
        <Route path="langues" element={<LanguagesPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="personnes" element={guard('persons.manage', <PersonsPage />)} />
        <Route path="consentements" element={guard('consents.manage', <ConsentsPage />)} />
        <Route path="signalements" element={guard('reports.manage', <TakedownsWorkspace />)} />
        <Route path="utilisateurs" element={guard('users.manage', <UsersPage />)} />
        <Route path="permissions" element={guard('settings.manage', <PermissionsPage />)} />
        <Route path="conservation" element={guard('backups.manage', <PreservationPage canExport={can('export.full')} />)} />
        <Route path="journal" element={guard('audit.read', <AuditPage />)} />
        <Route path="jeux/missions" element={guard('games.manage', <GameMissionsPage />)} />
        <Route path="jeux/missions/nouvelle" element={guard('games.manage', <GameMissionEditPage />)} />
        <Route path="jeux/missions/:id" element={guard('games.manage', <GameMissionEditPage />)} />
        <Route path="jeux/statistiques" element={guard('games.manage', <GameStatsPage />)} />
      </Route>
    </Routes>
  )
}

export default App
