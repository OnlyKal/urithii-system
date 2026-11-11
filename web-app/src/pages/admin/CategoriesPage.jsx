import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ErrorMessage, Loading, TableWrap, useApi } from '../../components/ui.jsx'
import { t } from '../../i18n/index.js'

const FIELD_TYPES = { text: t('categories.texteCourt'), longtext: t('categories.texteLong'), list: t('categories.liste') }
const empty = { name: '', code: '', description: '', parentId: '', position: 0, isActive: true, fieldsSchema: [] }

export default function CategoriesPage() {
  const { can } = useAuth()
  const editable = can('categories.manage')
  const { data, error, loading, reload } = useApi('/admin/categories')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [actionError, setActionError] = useState(null)
  const categories = data?.categories ?? []
  const roots = categories.filter((c) => !c.parentId)

  function edit(category) {
    setEditing(category?.id ?? 'new')
    setForm(category ? { ...empty, ...category, parentId: category.parentId ?? '', code: category.code ?? '', description: category.description ?? '' } : empty)
    setActionError(null)
  }

  const setField = (index, patch) =>
    setForm((f) => ({ ...f, fieldsSchema: f.fieldsSchema.map((field, i) => (i === index ? { ...field, ...patch } : field)) }))

  async function save(event) {
    event.preventDefault()
    const body = {
      name: form.name,
      code: form.code,
      description: form.description,
      parentId: form.parentId || null,
      position: Number(form.position) || 0,
      isActive: form.isActive,
      fieldsSchema: form.fieldsSchema.map(({ key, label, type, help }) => ({ key, label, type, help: help || null })),
    }
    try {
      if (editing === 'new') await api('/admin/categories', { method: 'POST', body })
      else await api(`/admin/categories/${editing}`, { method: 'PATCH', body })
      setEditing(null)
      reload()
    } catch (err) {
      setActionError(err)
    }
  }

  const renderRow = (c, depth = 0) => [
    <tr key={c.id} className={c.isActive ? '' : 'inactive'}>
      <td style={{ paddingLeft: `${0.5 + depth * 1.5}rem` }}>
        {c.code && <strong>{c.code}. </strong>}
        {c.name}
      </td>
      <td>{c.fieldsSchema.length || '—'}</td>
      <td>{c._count.items}</td>
      <td>{c.isActive ? t('labels.active') : t('categories.desactivee')}</td>
      <td className="actions">
        {editable && (
          <button type="button" className="secondary" onClick={() => edit(c)}>{t('common.edit')}</button>
        )}
      </td>
    </tr>,
    ...categories.filter((child) => child.parentId === c.id).flatMap((child) => renderRow(child, depth + 1)),
  ]

  return (
    <>
      <div className="page-head">
        <h1>{t('categories.categoriesCulturelles')}</h1>
        {editable && (
          <button type="button" onClick={() => edit(null)}>
            <Plus size={17} className="icon" aria-hidden="true" />{t('common.add')}</button>
        )}
      </div>
      <p className="muted">{t('categories.baseInitialeExtensibleChaqueCategorie')}</p>
      <ErrorMessage error={actionError} />

      {editing && (
        <section className="card">
          <h2>{editing === 'new' ? t('categories.nouvelleCategorie') : t('categories.modifierLaCategorie')}</h2>
          <form className="form" onSubmit={save}>
            <div className="grid-2">
              <label>{t('common.name')}<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>{t('categories.code')}<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </label>
              <label>{t('categories.categorieParente')}<select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">{t('categories.categoriePrincipale')}</option>
                  {categories
                    .filter((c) => c.id !== editing)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>{t('categories.ordreDAffichage')}<input type="number" min="0" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </label>
            </div>
            <label>{t('common.description')}<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />{t('categories.categorieActive')}</label>

            <fieldset className="fields-editor">
              <legend>{t('categories.champsSpecialises')}</legend>
              {form.fieldsSchema.map((field, i) => (
                <div key={i} className="field-row">
                  <input
                    aria-label={t('categories.cle')}
                    placeholder={t('categories.cle2')}
                    required
                    pattern="[a-z][a-zA-Z0-9]*"
                    value={field.key}
                    onChange={(e) => setField(i, { key: e.target.value })}
                  />
                  <input aria-label={t('categories.libelle')} placeholder={t('categories.libelle')} required value={field.label} onChange={(e) => setField(i, { label: e.target.value })} />
                  <select aria-label={t('common.type')} value={field.type} onChange={(e) => setField(i, { type: e.target.value })}>
                    {Object.entries(FIELD_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="secondary danger"
                    onClick={() => setForm((f) => ({ ...f, fieldsSchema: f.fieldsSchema.filter((_, j) => j !== i) }))}
                  >{t('common.remove')}</button>
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                onClick={() => setForm((f) => ({ ...f, fieldsSchema: [...f.fieldsSchema, { key: '', label: '', type: 'text' }] }))}
              >{t('categories.ajouterUnChamp')}</button>
            </fieldset>

            <div className="actions">
              <button type="submit">{t('common.save')}</button>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <Loading loading={loading} error={error}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('common.category')}</th>
                  <th scope="col">{t('categories.champsSpecialises')}</th>
                  <th scope="col">{t('categories.fiches')}</th>
                  <th scope="col">{t('categories.etat')}</th>
                  <th scope="col">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>{roots.flatMap((c) => renderRow(c))}</tbody>
            </table>
          </TableWrap>
        </Loading>
      </section>
    </>
  )
}
