import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, translateServerMessage } from '../api.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { t } from '../i18n/index.js'

const MIN_LENGTH = 12

export default function ChangePasswordPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    if (newPassword !== confirmation) return setError(t('changePassword.lesDeuxNouveauxMotsDe'))
    setSubmitting(true)
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
      await refresh()
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(translateServerMessage(err.details?.[0]?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card narrow">
      <h1>{t('changePassword.changerLeMotDePasse')}</h1>
      {user.mustChangePassword && (
        <p className="muted">{t('changePassword.pourSecuriserVotreCompteRemplacez')}</p>
      )}
      <form onSubmit={handleSubmit} className="form">
        <label>{t('changePassword.motDePasseActuel')}<input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label>{t('changePassword.nouveauMotDePasse')}{MIN_LENGTH}{' '}{t('changePassword.caracteresMinimum')}<input
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label>{t('changePassword.confirmerLeNouveauMotDe')}<input
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? t('crud.enregistrement') : t('common.save')}
        </button>
      </form>
    </section>
  )
}
