import { Navigate, useLocation } from 'react-router'
import { useAuth } from './AuthContext.jsx'
import { t } from '../i18n/index.js'

export function RequireAuth({ children, permission }) {
  const { user, loading, can } = useAuth()
  const location = useLocation()

  if (loading) return <p className="page-status">{t('requireAuth.chargement')}</p>
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword && location.pathname !== '/compte/mot-de-passe') {
    return <Navigate to="/compte/mot-de-passe" replace />
  }
  if (permission && !can(permission)) {
    return <p className="page-status">{t('requireAuth.vousNAvezPasAcces')}</p>
  }
  return children
}
