import { Link } from 'react-router'
import { StatusBadge, TableWrap } from '../ui.jsx'
import { ACCESS_LABELS, formatDateTime } from '../../labels.js'
import { t } from '../../i18n/index.js'

// Liste de fiches commune aux files de travail, au tableau de bord et aux
// dossiers de communauté.
export function ItemTable({ items, showCommunities = true, empty }) {
  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th scope="col">{t('common.title')}</th>
            <th scope="col">{t('common.category')}</th>
            {showCommunities && <th scope="col">{t('common.communities')}</th>}
            <th scope="col">{t('common.status')}</th>
            <th scope="col">{t('common.author')}</th>
            <th scope="col">{t('items.modifiee')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <Link to={`/admin/fiches/${item.id}`} className="item-title-link">{item.title}</Link>
                {item.isSensitive && <span className="badge">{t('items.sensible')}</span>}
                {item.publishedVersionId && <span className="badge ok-badge">{t('items.enLigne')}</span>}
                {item.accessLevel !== 'PUBLIC' && <span className="badge">{ACCESS_LABELS[item.accessLevel]}</span>}
              </td>
              <td>{item.category.name}</td>
              {showCommunities && <td>{item.communities.map((c) => c.community.name).join(', ') || '—'}</td>}
              <td>
                <StatusBadge status={item.status} />
              </td>
              <td>{item.createdBy.displayName}</td>
              <td>{formatDateTime(item.updatedAt)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={showCommunities ? 6 : 5} className="muted">{empty ?? t('items.aucuneFiche')}</td>
            </tr>
          )}
        </tbody>
      </table>
    </TableWrap>
  )
}

// Barre d'onglets d'un espace de travail. Chaque onglet est un lien.
export function WorkspaceTabs({ tabs, label }) {
  return (
    <nav className="workspace-tabs" aria-label={label}>
      {tabs.map((tab) => (
        <Link key={tab.id} to={tab.to} className={`workspace-tab ${tab.active ? 'active' : ''}`} aria-current={tab.active ? 'page' : undefined}>
          {tab.icon && <tab.icon size={16} className="icon" aria-hidden="true" />}
          <span>{tab.label}</span>
          {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  )
}
