import {
  Archive,
  BookMarked,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderOpen,
  Gamepad2,
  BarChart3,
  Globe2,
  HardDrive,
  Image,
  Languages,
  LayoutDashboard,
  Library,
  ListChecks,
  Map as MapIcon,
  MapPinned,
  MessageSquareWarning,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Tags,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { t } from '../../i18n/index.js'

const REVIEW = 'dossiers.review'

// Organisation de l'espace contributeur en espaces de travail, adaptés au
// rôle : l'administrateur voit tout ; le collecteur voit son tableau de bord,
// ses collectes et les communautés. Un espace regroupe des pages liées en
// onglets ; il n'apparaît que si l'utilisateur a accès à l'un d'eux.
//   tabs : [chemin, libellé, icône, permissions (l'une suffit)]
export const WORKSPACES = [
  { id: 'accueil', to: '/admin', end: true, icon: LayoutDashboard, label: t('ws.tableauDeBord') },
  {
    id: 'collectes',
    to: '/admin/collectes',
    icon: FolderOpen,
    label: t('dossier.collectes'),
    collectorLabel: t('dossier.mesCollectes'),
    perms: ['dossiers.collect', REVIEW],
  },
  {
    id: 'validations',
    icon: ClipboardCheck,
    label: t('validations.validations'),
    tabs: [
      ['/admin/validations', t('dossier.dossiersAValider'), ListChecks, [REVIEW]],
      ['/admin/fiches', t('items.fichesCulturelles'), FileText, [REVIEW, 'content.edit']],
      ['/admin/signalements', t('adminLayout.demandesDeCorrection'), MessageSquareWarning, ['reports.manage']],
    ],
  },
  { id: 'communautes', to: '/admin/communautes', icon: Globe2, label: t('common.communities') },
  {
    id: 'collecteurs',
    icon: UsersRound,
    label: t('ws.collecteurs'),
    tabs: [
      ['/admin/collecteurs', t('dossier.suiviDesCollecteurs'), ClipboardList, [REVIEW]],
      ['/admin/utilisateurs', t('ws.comptes'), UsersRound, ['users.manage']],
      ['/admin/missions', t('mission.missionsDeCollecte'), MapIcon, ['missions.manage']],
      ['/admin/questionnaires', t('mission.questionnaires'), ClipboardList, ['missions.manage']],
    ],
  },
  {
    id: 'mediatheque',
    icon: Image,
    label: t('publicLayout.mediatheque'),
    tabs: [['/admin/medias', t('publicLayout.mediatheque'), Image, [REVIEW, 'content.edit']]],
  },
  {
    id: 'sources',
    icon: Library,
    label: t('ws.sourcesEtArchives'),
    tabs: [
      ['/admin/sources', t('adminLayout.sourcesDocumentaires'), BookMarked, [REVIEW, 'content.edit']],
      ['/admin/textes', t('text.transcriptionsEtTraductions'), ScrollText, [REVIEW, 'content.edit', 'transcription.edit', 'translation.edit']],
      ['/admin/personnes', t('reference.personnesRessources'), UserRound, [REVIEW]],
      ['/admin/conservation', t('adminLayout.archivesEtSauvegardes'), HardDrive, ['backups.manage']],
    ],
  },
  {
    id: 'jeux',
    icon: Gamepad2,
    label: t('ws.jeux'),
    tabs: [
      ['/admin/jeux/missions', t('ws.missionsDuJeu'), Gamepad2, ['games.manage']],
      ['/admin/jeux/statistiques', t('ws.statistiquesDuJeu'), BarChart3, ['games.manage']],
    ],
  },
  {
    id: 'parametres',
    icon: Settings,
    label: t('ws.parametres'),
    tabs: [
      ['/admin/formulaire', t('dossier.formulaireDeCollecte'), SlidersHorizontal, [REVIEW, 'settings.manage']],
      ['/admin/categories', t('mission.categories'), Tags, ['categories.manage']],
      ['/admin/lieux', t('common.places'), MapPinned, ['communities.manage']],
      ['/admin/langues', t('browse.langues'), Languages, ['communities.manage']],
      ['/admin/permissions', t('governance.rolesEtPermissions'), Settings, ['settings.manage']],
      ['/admin/journal', t('audit.journalDAudit'), Archive, ['audit.read']],
    ],
  },
]

// Espaces visibles pour l'utilisateur, avec leurs onglets autorisés.
export function visibleWorkspaces(can) {
  const reviewer = can(REVIEW)
  return WORKSPACES.map((ws) => {
    if (ws.perms && !ws.perms.some(can)) return null
    const label = !reviewer && ws.collectorLabel ? ws.collectorLabel : ws.label
    if (!ws.tabs) return { ...ws, label }
    const tabs = ws.tabs.filter(([, , , perms]) => !perms || perms.some(can))
    return tabs.length ? { ...ws, label, tabs, to: tabs[0][0], match: tabs.map(([to]) => to) } : null
  }).filter(Boolean)
}

const matches = (pathname, prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)

export function currentWorkspace(workspaces, pathname) {
  if (pathname === '/admin') return workspaces[0]
  return workspaces.find((ws) => !ws.end && (ws.match ?? [ws.to]).some((p) => matches(pathname, p))) ?? null
}

export const currentTab = (ws, pathname) => ws?.tabs?.find(([to]) => matches(pathname, to)) ?? null
