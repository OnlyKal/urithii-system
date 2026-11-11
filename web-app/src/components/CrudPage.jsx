import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api.js'
import { useDialog } from './Modal.jsx'
import { useToast } from './Toast.jsx'
import { EmptyState, ErrorMessage, Loading, Pagination, TableWrap, useApi } from './ui.jsx'
import { t } from '../i18n/index.js'

// Page générique de gestion d'un référentiel : liste, création, modification,
// suppression éventuelle. Les champs sont décrits par `fields`.
//   { name, label, type: 'text'|'textarea'|'select'|'checkbox'|'number'|'date'|'lines', options, required, help, default }
function emptyValues(fields) {
  return Object.fromEntries(
    fields.map((f) => [f.name, f.default ?? (f.type === 'checkbox' ? false : f.type === 'lines' ? [] : '')]),
  )
}

function toForm(fields, record) {
  const values = emptyValues(fields)
  for (const f of fields) {
    const v = record[f.name]
    if (v === null || v === undefined) continue
    values[f.name] = f.type === 'date' ? String(v).slice(0, 10) : v
  }
  return values
}

function toPayload(fields, values) {
  const payload = {}
  for (const f of fields) {
    if (f.readOnlyOnEdit && values.__editing) continue
    let v = values[f.name]
    if (f.type === 'number') v = v === '' ? null : Number(v)
    if (f.type === 'lines') v = (Array.isArray(v) ? v : String(v).split('\n')).map((s) => s.trim()).filter(Boolean)
    // Liste déroulante laissée vide : une référence (…Id) est effacée, une
    // valeur d'énumération n'est pas envoyée (le serveur garde sa valeur).
    if (f.type === 'select' && v === '') {
      if (f.name.endsWith('Id')) v = null
      else continue
    }
    payload[f.name] = v
  }
  return payload
}

export function FormFields({ fields, values, setValues, errors = {} }) {
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))
  return fields.map((f) => {
    if (f.hidden?.(values)) return null
    const common = { required: f.required, value: values[f.name] ?? '', onChange: (e) => set(f.name, e.target.value) }
    let input
    if (f.type === 'textarea') input = <textarea rows={f.rows ?? 4} {...common} />
    else if (f.type === 'lines')
      input = (
        <textarea
          rows={f.rows ?? 8}
          required={f.required}
          value={Array.isArray(values[f.name]) ? values[f.name].join('\n') : values[f.name]}
          onChange={(e) => set(f.name, e.target.value.split('\n'))}
        />
      )
    else if (f.type === 'select')
      input = (
        <select {...common}>
          {!f.required && <option value="">—</option>}
          {f.required && !values[f.name] && <option value="">{t('common.choose')}</option>}
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    else if (f.type === 'checkbox')
      return (
        <label key={f.name} className="checkbox">
          <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
          {f.label}
        </label>
      )
    else input = <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} {...common} aria-invalid={Boolean(errors[f.name])} />
    return (
      <label key={f.name}>
        {f.label}
        {input}
        {f.help && <small className="muted">{f.help}</small>}
        {errors[f.name] && <small className="field-error">{errors[f.name]}</small>}
      </label>
    )
  })
}

export default function CrudPage({ title, intro, endpoint, listKey, fields, columns, canEdit = true, canDelete = false, transform, extraActions }) {
  const { data, error, loading, reload } = useApi(endpoint)
  const [editing, setEditing] = useState(null)
  const [values, setValues] = useState(emptyValues(fields))
  const [actionError, setActionError] = useState(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const dialog = useDialog()
  const toast = useToast()
  const PAGE_SIZE = 25

  const records = data?.[listKey] ?? []
  const filtered = query
    ? records.filter((r) => columns.some((c) => String(c.value(r) ?? '').toLowerCase().includes(query.toLowerCase())))
    : records
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  // Erreurs de validation renvoyées par le serveur, affichées sous les champs concernés.
  const fieldErrors = Object.fromEntries((actionError?.details ?? []).filter((d) => d.field).map((d) => [d.field, d.message]))

  function startCreate() {
    setEditing('new')
    setValues(emptyValues(fields))
    setActionError(null)
  }

  function startEdit(record) {
    setEditing(record.id)
    setValues({ ...toForm(fields, record), __editing: true })
    setActionError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setActionError(null)
    setSaving(true)
    try {
      let payload = toPayload(fields, values)
      if (transform) payload = transform(payload)
      if (editing === 'new') await api(endpoint.split('?')[0], { method: 'POST', body: payload })
      else await api(`${endpoint.split('?')[0]}/${editing}`, { method: 'PATCH', body: payload })
      toast.success(editing === 'new' ? t('crud.elementAjoute') : t('communities.modificationsEnregistrees'))
      setEditing(null)
      await reload()
    } catch (err) {
      setActionError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(record) {
    const ok = await dialog.confirm({
      title: t('crud.supprimerCetElement'),
      message: t('crud.laSuppressionEstRefuseeS'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    try {
      await api(`${endpoint.split('?')[0]}/${record.id}`, { method: 'DELETE' })
      toast.success(t('crud.elementSupprime'))
      await reload()
    } catch (err) {
      setActionError(err)
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>{title}</h1>
        {canEdit && (
          <button type="button" onClick={startCreate}>
            <Plus size={17} className="icon" aria-hidden="true" />{t('common.add')}</button>
        )}
      </div>
      {intro && <p className="muted">{intro}</p>}
      <ErrorMessage error={actionError} />

      {editing && (
        <section className="card">
          <h2>{editing === 'new' ? t('crud.nouvelElement') : t('common.edit')}</h2>
          <form className="form" onSubmit={handleSubmit}>
            <FormFields fields={fields} values={values} setValues={setValues} errors={fieldErrors} />
            <div className="actions">
              <button type="submit" disabled={saving}>
                {saving ? t('crud.enregistrement') : t('common.save')}
              </button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <div className="search-bar table-filter">
          <Search size={16} className="icon" aria-hidden="true" />
          <input
            type="search"
            placeholder={t('crud.filtrerLaListe')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            aria-label={t('crud.filtrerLaListe2')}
          />
        </div>
        <Loading loading={loading} error={error}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.label} scope="col">
                      {c.label}
                    </th>
                  ))}
                  {(canEdit || canDelete || extraActions) && <th scope="col">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    {columns.map((c) => (
                      <td key={c.label}>{c.render ? c.render(r) : c.value(r) ?? '—'}</td>
                    ))}
                    {(canEdit || canDelete || extraActions) && (
                      <td className="actions">
                        {canEdit && (
                          <button type="button" className="secondary icon-button" onClick={() => startEdit(r)} aria-label={t('common.edit')} title={t('common.edit')}>
                            <Pencil size={16} className="icon" aria-hidden="true" />
                          </button>
                        )}
                        {extraActions?.(r, { reload, setError: setActionError })}
                        {canDelete && (
                          <button type="button" className="danger icon-button" onClick={() => handleDelete(r)} aria-label={t('common.delete')} title={t('common.delete')}>
                            <Trash2 size={16} className="icon" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          {filtered.length === 0 && (
            <EmptyState title={query ? t('crud.aucunResultatPourCeFiltre') : t('crud.aucunElementPourLeMoment')}>
              {!query && canEdit && t('crud.utilisezLeBoutonAjouterPour')}
            </EmptyState>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
        </Loading>
      </section>
    </>
  )
}
