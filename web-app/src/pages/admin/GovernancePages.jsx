import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api.js'
import { useDialog } from '../../components/Modal.jsx'
import { useToast } from '../../components/Toast.jsx'
import { ErrorMessage, Loading, TableWrap, useApi } from '../../components/ui.jsx'
import { formatDateTime, TAKEDOWN_REASON_LABELS, TAKEDOWN_STATUS_LABELS } from '../../labels.js'
import { ACCOUNT_TYPES, roleLabel } from '../../roles.js'
import { t } from '../../i18n/index.js'

export function TakedownsPage({ embedded = false }) {
  const dialog = useDialog()
  const [status, setStatus] = useState('')
  const { data, error, loading, reload } = useApi(`/admin/takedowns${status ? `?status=${status}` : ''}`)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ status: 'UNDER_REVIEW', resolution: '' })
  const [actionError, setActionError] = useState(null)

  async function run(fn) {
    setActionError(null)
    try {
      await fn()
      await reload()
      setSelected(null)
    } catch (err) {
      setActionError(err)
    }
  }

  return (
    <>
      {!embedded && <h1>{t('governance.signalementsEtDemandesDeRetrait')}</h1>}
      <p className="muted">{t('governance.enCasDeRisqueSerieux')}</p>
      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('governance.filtrerParStatut')}>
        <option value="">{t('governance.toutesLesDemandes')}</option>
        {Object.entries(TAKEDOWN_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <ErrorMessage error={actionError} />
      <Loading loading={loading} error={error}>
        {data?.takedowns.map((tx) => (
          <section className="card" key={tx.id}>
            <h2>
              {TAKEDOWN_REASON_LABELS[tx.reason]} — <span className="muted">{TAKEDOWN_STATUS_LABELS[tx.status]}</span>
            </h2>
            <p className="muted">{t('governance.recueLe')}{' '}{formatDateTime(tx.createdAt)}</p>
            <p>
              <strong>{t('governance.contenuVise')}</strong>{' '}
              {tx.item ? <Link to={`/admin/fiches/${tx.item.id}`}>{tx.item.title}</Link> : tx.media ? tx.media.title : tx.pageUrl ?? t('governance.nonPrecise')}
            </p>
            <p>
              <strong>{t('governance.demandeur')}</strong> {tx.requesterName} ({tx.requesterContact}){tx.requesterRelation && ` — ${tx.requesterRelation}`}
            </p>
            <p className="prose">{tx.description}</p>
            {tx.resolution && (
              <p>
                <strong>{t('governance.decision')}</strong> {tx.resolution} {tx.handledBy && <span className="muted">({tx.handledBy.displayName})</span>}
              </p>
            )}
            <div className="actions">
              {(tx.item || tx.media) && tx.status !== 'CONTENT_SUSPENDED' && (
                <button
                  type="button"
                  className="secondary danger"
                  onClick={async () => {
                    const reason = await dialog.prompt({
                      title: t('governance.suspendreLaDiffusion'),
                      message: t('governance.leContenuSeraRetireDu'),
                      label: t('governance.motifDeLaSuspensionProvisoire'),
                      confirmLabel: t('governance.suspendre'),
                      danger: true,
                    })
                    if (reason) run(() => api(`/admin/takedowns/${tx.id}/suspend`, { method: 'POST', body: { reason } }))
                  }}
                >{t('governance.suspendreLaDiffusion')}</button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSelected(tx.id)
                  setForm({ status: tx.status, resolution: tx.resolution ?? '' })
                }}
              >{t('governance.traiter')}</button>
            </div>
            {selected === tx.id && (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(() => api(`/admin/takedowns/${tx.id}`, { method: 'PATCH', body: form }))
                }}
              >
                <label>{t('common.status')}<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {Object.entries(TAKEDOWN_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>{t('governance.decisionEtJustification')}<textarea rows={3} value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
                </label>
                <div>
                  <button type="submit">{t('common.save')}</button>
                </div>
              </form>
            )}
          </section>
        ))}
        {data?.takedowns.length === 0 && <p className="muted">{t('governance.aucuneDemande')}</p>}
      </Loading>
    </>
  )
}

export function PermissionsPage() {
  const dialog = useDialog()
  const toast = useToast()
  const { data, error, loading, reload } = useApi('/admin/settings/permissions')
  const [draft, setDraft] = useState({})
  const [actionError, setActionError] = useState(null)

  if (!data) return <Loading loading={loading} error={error} />
  const current = (role) => draft[role.role] ?? role.permissions
  // Les deux types de comptes, plus les anciens rôles encore attribués.
  const roles = data.roles.filter((r) => ACCOUNT_TYPES.includes(r.role) || r.users > 0)
  const permLabel = (p) => t(`perm.${p.key}`)

  async function save(role) {
    setActionError(null)
    try {
      await api(`/admin/settings/permissions/${role.role}`, { method: 'PUT', body: { permissions: current(role) } })
      setDraft((d) => ({ ...d, [role.role]: undefined }))
      toast.success(t('governance.permissionsDuRoleEnregistrees', { 0: roleLabel(role.role) }))
      reload()
    } catch (err) {
      setActionError(err)
    }
  }

  async function reset(role) {
    const ok = await dialog.confirm({ title: t('governance.retablirLesPermissionsParDefaut'), message: t('governance.leRoleRetrouveraSaConfiguration', { 0: roleLabel(role.role) }) })
    if (!ok) return
    await api(`/admin/settings/permissions/${role.role}`, { method: 'DELETE' }).catch(setActionError)
    setDraft((d) => ({ ...d, [role.role]: undefined }))
    reload()
  }

  return (
    <>
      <h1>{t('governance.rolesEtPermissions')}</h1>
      <p className="muted">{t('governance.lesPermissionsSontVerifieesPar')}</p>
      <ErrorMessage error={actionError} />
      <TableWrap className="card">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col">{t('governance.permission')}</th>
              {roles.map((r) => (
                <th scope="col" key={r.role}>
                  {roleLabel(r.role)}
                  {r.customized && <div className="badge">{t('governance.personnalise')}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.permissions.map((p) => (
              <tr key={p.key}>
                <th scope="row">{permLabel(p)}</th>
                {roles.map((r) => (
                  <td key={r.role}>
                    <input
                      type="checkbox"
                      aria-label={`${permLabel(p)} — ${roleLabel(r.role)}`}
                      disabled={r.locked}
                      checked={current(r).includes(p.key)}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [r.role]: e.target.checked ? [...current(r), p.key] : current(r).filter((x) => x !== p.key),
                        }))
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" />
              {roles.map((r) => (
                <td key={r.role} className="actions">
                  {!r.locked && (
                    <>
                      <button type="button" disabled={!draft[r.role]} onClick={() => save(r)}>{t('common.save')}</button>
                      {r.customized && (
                        <button type="button" className="secondary" onClick={() => reset(r)}>{t('governance.parDefaut')}</button>
                      )}
                    </>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </TableWrap>
    </>
  )
}

const RUN_KIND = { BACKUP: t('audit.sauvegarde'), RESTORE_TEST: t('audit.testDeRestauration'), INTEGRITY_CHECK: t('audit.controleDIntegrite') }
const RUN_STATUS = { RUNNING: t('labels.enCours'), SUCCESS: t('governance.reussi'), FAILED: t('governance.echec') }

export function PreservationPage({ canExport }) {
  const { data, error, loading, reload } = useApi('/admin/preservation/runs')
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function run(kind, path) {
    setBusy(kind)
    setActionError(null)
    try {
      await api(`/admin/preservation/${path}`, { method: 'POST' })
    } catch (err) {
      setActionError(err)
    } finally {
      setBusy(null)
      reload()
    }
  }

  return (
    <>
      <h1>{t('governance.conservationEtSauvegardes')}</h1>
      <p className="muted">{t('governance.uneSauvegardeContientLaBase')}</p>
      <div className="actions">
        <button type="button" disabled={Boolean(busy)} onClick={() => run('backup', 'backup')}>
          {busy === 'backup' ? t('governance.sauvegarde') : t('governance.lancerUneSauvegarde')}
        </button>
        <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => run('restore', 'restore-test')}>
          {busy === 'restore' ? t('governance.testEnCours') : t('governance.testerLaRestauration')}
        </button>
        <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => run('integrity', 'integrity-check')}>
          {busy === 'integrity' ? t('governance.controleEnCours') : t('governance.controlerLIntegriteDesFichiers')}
        </button>
        {canExport && (
          <a className="button secondary" href="/api/admin/preservation/export">{t('governance.exportCompletJson')}</a>
        )}
        <a className="button secondary" href="/api/public/export">{t('governance.exportPublicJson')}</a>
      </div>
      <ErrorMessage error={actionError} />
      <section className="card">
        <h2>{t('governance.historique')}</h2>
        <Loading loading={loading} error={error}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('governance.operation')}</th>
                  <th scope="col">{t('governance.debut')}</th>
                  <th scope="col">{t('common.status')}</th>
                  <th scope="col">{t('governance.details')}</th>
                  <th scope="col">{t('governance.par')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.runs.map((r) => (
                  <tr key={r.id}>
                    <td>{RUN_KIND[r.kind]}</td>
                    <td>{formatDateTime(r.startedAt)}</td>
                    <td className={r.status === 'FAILED' ? 'error' : r.status === 'SUCCESS' ? 'ok' : ''}>{RUN_STATUS[r.status]}</td>
                    <td>
                      {r.location && <code>{r.location}</code>}
                      {r.summary && <div className="muted small">{JSON.stringify(r.summary.counts ?? r.summary)}</div>}
                      {r.error && <div className="error">{r.error}</div>}
                    </td>
                    <td>{r.triggeredBy?.displayName ?? t('governance.automatique')}</td>
                  </tr>
                ))}
                {data?.runs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">{t('governance.aucuneOperationPourLeMoment')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrap>
        </Loading>
      </section>
    </>
  )
}
