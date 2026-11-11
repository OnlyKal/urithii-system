import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { LogIn } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { t } from '../i18n/index.js'
import { translateServerMessage } from '../api.js'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/admin" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedIn = await login(email, password)
      const target = loggedIn.mustChangePassword ? '/compte/mot-de-passe' : location.state?.from || '/admin'
      navigate(target, { replace: true })
    } catch (err) {
      setError(translateServerMessage(err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card narrow">
      <h1>{t('login.connexionContributeur')}</h1>
      <p className="muted">{t('login.lesComptesSontCreesPar')}</p>
      <form onSubmit={handleSubmit} className="form">
        <label>{t('login.adresseEMail')}<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>{t('login.motDePasse')}<input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          <LogIn size={17} className="icon" aria-hidden="true" />
          {submitting ? t('login.connexion') : t('login.seConnecter')}
        </button>
      </form>
    </section>
  )
}
