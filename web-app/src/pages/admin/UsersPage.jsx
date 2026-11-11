import { useCallback, useEffect, useId, useState } from 'react'
import { api, translateServerMessage } from '../../api.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { KeyRound, MoreHorizontal, ShieldCheck, UserCheck, UserPlus, UserX } from 'lucide-react'
import { DropdownMenu } from '../../components/DropdownMenu.jsx'
import { useDialog } from '../../components/Modal.jsx'
import { ACCOUNT_TYPES, roleLabel } from '../../roles.js'
import { TableWrap } from '../../components/ui.jsx'
import { locale, t } from '../../i18n/index.js'

// Deux types de comptes : administrateur (tout le système) et collecteur.
// Les anciens rôles éventuels d'un compte sont rappelés et remplacés au
// prochain changement de type.
function AccountType({ selected, onChange }) {
  const legacy = selected.filter((r) => !ACCOUNT_TYPES.includes(r))
  const name = useId()
  return (
    <fieldset className="roles account-types">
      <legend>{t('ws.typeDeCompte')}</legend>
      {ACCOUNT_TYPES.map((role) => (
        <label key={role} className="checkbox account-type">
          <input type="radio" name={name} checked={selected.includes(role)} onChange={() => onChange([role])} />
          <span>
            <strong>{roleLabel(role)}</strong>
            <small className="muted">{role === 'SUPER_ADMIN' ? t('ws.typeAdministrateur') : t('ws.typeCollecteur')}</small>
          </span>
        </label>
      ))}
      {legacy.length > 0 && <small className="muted">{t('ws.ancienRole', { roles: legacy.map(roleLabel).join(', ') })}</small>}
    </fieldset>
  )
}

function TemporaryPassword({ email, password, onClose }) {
  return (
    <div role="status" className="secret">
      <p>{t('users.motDePasseTemporairePour')}{' '}<strong>{email}</strong> : <code>{password}</code>
      </p>
      <p className="muted">{t('users.ilNeSeraPlusAffiche')}</p>
      <button type="button" onClick={onClose}>{t('users.jAiTransmisLeMot')}</button>
    </div>
  )
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const dialog = useDialog()
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [secret, setSecret] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editRoles, setEditRoles] = useState([])
  const [form, setForm] = useState({ email: '', displayName: '', roles: ['COLLECTEUR'] })

  const load = useCallback(async () => {
    const data = await api('/users')
    setUsers(data.users)
  }, [])

  useEffect(() => {
    load().catch((err) => setError(translateServerMessage(err.message)))
  }, [load])

  async function run(action) {
    setError(null)
    try {
      await action()
      await load()
    } catch (err) {
      setError(translateServerMessage(err.details?.[0]?.message || err.message))
    }
  }

  function handleCreate(event) {
    event.preventDefault()
    run(async () => {
      const data = await api('/users', { method: 'POST', body: form })
      setSecret({ email: data.user.email, password: data.temporaryPassword })
      setForm({ email: '', displayName: '', roles: ['COLLECTEUR'] })
    })
  }

  async function handleResetPassword(target) {
    const ok = await dialog.confirm({
      title: t('users.reinitialiserLeMotDePasse'),
      message: t('users.unNouveauMotDePasse', { 0: target.email }),
      confirmLabel: t('users.reinitialiser'),
    })
    if (!ok) return
    run(async () => {
      const data = await api(`/users/${target.id}/reset-password`, { method: 'POST' })
      setSecret({ email: target.email, password: data.temporaryPassword })
    })
  }

  async function handleToggleActive(target) {
    const action = target.isActive ? 'deactivate' : 'reactivate'
    if (target.isActive) {
      const ok = await dialog.confirm({
        title: t('users.desactiverLeCompte'),
        message: t('users.nePourraPlusSeConnecter', { 0: target.email }),
        confirmLabel: t('users.desactiver'),
        danger: true,
      })
      if (!ok) return
    }
    run(() => api(`/users/${target.id}/${action}`, { method: 'POST' }))
  }

  function handleSaveRoles(target) {
    run(async () => {
      await api(`/users/${target.id}`, { method: 'PATCH', body: { roles: editRoles } })
      setEditingId(null)
    })
  }

  return (
    <>
      <h1>{t('users.utilisateurs')}</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {secret && <TemporaryPassword {...secret} onClose={() => setSecret(null)} />}

      <section className="card">
        <h2>{t('users.creerUnCompte')}</h2>
        <form onSubmit={handleCreate} className="form">
          <label>{t('users.nomAffiche')}<input
              required
              minLength={2}
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </label>
          <label>{t('users.adresseEMail')}<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <AccountType selected={form.roles} onChange={(r) => setForm({ ...form, roles: r })} />
          <button type="submit" disabled={form.roles.length === 0}>
            <UserPlus size={17} className="icon" aria-hidden="true" />{t('users.creerLeCompte')}</button>
        </form>
      </section>

      <section className="card">
        <h2>{t('users.comptes')}{users.length})</h2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('common.name')}</th>
                <th scope="col">{t('users.eMail')}</th>
                <th scope="col">{t('ws.typeDeCompte')}</th>
                <th scope="col">{t('users.etat')}</th>
                <th scope="col">{t('users.derniereConnexion')}</th>
                <th scope="col">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>
                    {editingId === u.id ? (
                      <>
                        <AccountType selected={editRoles} onChange={setEditRoles} />
                        <button type="button" disabled={editRoles.length === 0} onClick={() => handleSaveRoles(u)}>{t('common.save')}</button>{' '}
                        <button type="button" className="secondary" onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
                      </>
                    ) : (
                      u.roles.map(roleLabel).join(', ')
                    )}
                  </td>
                  <td>
                    {u.isActive ? t('reference.actif') : t('users.desactive')}
                    {u.mustChangePassword && <span className="badge">{t('users.motDePasseTemporaire')}</span>}
                  </td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString(locale()) : '—'}</td>
                  <td className="actions">
                    <DropdownMenu
                      align="right"
                      showChevron={false}
                      buttonClassName="secondary icon-button"
                      ariaLabel={t('users.actionsPour', { 0: u.displayName })}
                      label={<MoreHorizontal size={17} className="icon" aria-hidden="true" />}
                    >
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setEditingId(u.id)
                          setEditRoles(u.roles)
                        }}
                      >
                        <ShieldCheck size={16} className="icon icon-muted" aria-hidden="true" />{t('ws.changerLeType')}</button>
                      <button type="button" className="dropdown-item" onClick={() => handleResetPassword(u)}>
                        <KeyRound size={16} className="icon icon-muted" aria-hidden="true" />{t('users.reinitialiserLeMotDePasse')}</button>
                      {u.id !== me.id && (
                        <button type="button" className="dropdown-item" onClick={() => handleToggleActive(u)}>
                          {u.isActive ? (
                            <UserX size={16} className="icon icon-muted" aria-hidden="true" />
                          ) : (
                            <UserCheck size={16} className="icon icon-muted" aria-hidden="true" />
                          )}
                          {u.isActive ? t('users.desactiverLeCompte') : t('users.reactiverLeCompte')}
                        </button>
                      )}
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </section>
    </>
  )
}
