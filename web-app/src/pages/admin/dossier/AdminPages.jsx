import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../../api.js'
import { Modal } from '../../../components/Modal.jsx'
import { useToast } from '../../../components/Toast.jsx'
import { ErrorMessage, Loading, TableWrap, useApi } from '../../../components/ui.jsx'
import { formatDateTime } from '../../../labels.js'
import { t } from '../../../i18n/index.js'
import { defTitle } from './dossierLogic.js'

// --- Suivi des collecteurs ---------------------------------------------------

const COLUMNS = [
  ['enCours', ['DRAFT', 'IN_PROGRESS']],
  ['soumis', ['SUBMITTED', 'UNDER_REVIEW']],
  ['corrections', ['CHANGES_REQUESTED']],
  ['valides', ['VALIDATED']],
  ['publies', ['PUBLISHED']],
]

export function CollectorsPage() {
  const { data, error, loading } = useApi('/admin/dossiers/stats')
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('dossier.suiviDesCollecteurs')}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('dossier.suiviIntro')}</p>
        </div>
        <Link to="/admin/utilisateurs" className="button secondary">{t('ws.gererLesComptes')}</Link>
      </div>
      <section className="card">
        <Loading loading={loading} error={error}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('mission.collecteur')}</th>
                  {COLUMNS.map(([key]) => (
                    <th key={key} scope="col">{t(`dossier.view.${key}`)}</th>
                  ))}
                  <th scope="col">{t('dossier.derniereActivite')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.collectors.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/admin/collectes?collecteur=${c.id}`}>{c.displayName}</Link>
                      <div className="small muted">{c.email}</div>
                      {!c.isActive && <span className="badge">{t('users.desactive')}</span>}
                    </td>
                    {COLUMNS.map(([key, statuses]) => {
                      const n = statuses.reduce((sum, s) => sum + (c.counts[s] ?? 0), 0)
                      return (
                        <td key={key}>
                          {n ? <Link to={`/admin/collectes?collecteur=${c.id}&vue=${key === 'enCours' ? 'en-cours' : key}`}>{n}</Link> : <span className="muted">0</span>}
                        </td>
                      )
                    })}
                    <td>{c.lastActivity ? formatDateTime(c.lastActivity) : '—'}</td>
                  </tr>
                ))}
                {data?.collectors.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} className="muted">{t('dossier.aucunCollecteur')}</td>
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

// --- Formulaire de collecte : étapes ---------------------------------------

const FIELD_TYPES = ['text', 'longtext', 'list', 'select', 'date']
// Le type « consent » n'est plus proposé : les consentements ont été retirés
// (les anciens champs restent en base mais sont masqués).
const SPECIAL_TYPES = ['person', 'media', 'sections', 'province', 'territories']

function FieldsEditor({ fields, onChange, allowSpecial }) {
  const set = (i, patch) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const move = (i, delta) => {
    const next = [...fields]
    const [m] = next.splice(i, 1)
    next.splice(i + delta, 0, m)
    onChange(next)
  }
  return (
    <div className="fields-editor">
      {fields.map((f, i) => f.type === 'consent' ? null : (
        <div key={i} className="field-def">
          <div className="row-editor">
            <input aria-label={t('categories.libelle')} placeholder={t('categories.libelle')} value={f.label} onChange={(e) => set(i, { label: e.target.value })} />
            <input aria-label={t('categories.cle')} placeholder={t('categories.cle2')} value={f.key} disabled={f.locked} onChange={(e) => set(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} />
            <select aria-label={t('common.type')} value={f.type} onChange={(e) => set(i, { type: e.target.value })}>
              {[...FIELD_TYPES, ...(allowSpecial || SPECIAL_TYPES.includes(f.type) ? SPECIAL_TYPES : [])].map((type) => (
                <option key={type} value={type}>
                  {t(`dossier.fieldType.${type}`)}
                </option>
              ))}
            </select>
            <button type="button" className="ghost icon-button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('dossier.monter')}>
              <ArrowUp size={16} className="icon" aria-hidden="true" />
            </button>
            <button type="button" className="ghost icon-button" disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label={t('dossier.descendre')}>
              <ArrowDown size={16} className="icon" aria-hidden="true" />
            </button>
            <button type="button" className="ghost icon-button" onClick={() => onChange(fields.filter((_, j) => j !== i))} aria-label={t('common.remove')}>
              <Trash2 size={16} className="icon" aria-hidden="true" />
            </button>
          </div>
          {f.type === 'select' && (
            <input
              aria-label={t('dossier.optionsDuChamp')}
              placeholder={t('dossier.optionsDuChamp')}
              value={(f.options ?? []).join(' ; ')}
              onChange={(e) => set(i, { options: e.target.value.split(';').map((o) => o.trim()).filter(Boolean) })}
            />
          )}
          <input aria-label={t('dossier.aideDuChamp')} placeholder={t('dossier.aideDuChamp')} value={f.help ?? ''} onChange={(e) => set(i, { help: e.target.value || undefined })} />
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => onChange([...fields, { key: `champ${fields.length + 1}`, label: '', type: 'longtext' }])}>
        <Plus size={16} className="icon" aria-hidden="true" />{t('categories.ajouterUnChamp')}</button>
    </div>
  )
}

function SectionDefModal({ initial, categories, onClose, onSaved }) {
  const isNew = !initial.id
  const special = !['standard', 'identification'].includes(initial.kind ?? 'standard')
  const lock = (fields) => (fields ?? []).map((f) => ({ ...f, locked: !isNew }))
  const [form, setForm] = useState({
    key: initial.key ?? '',
    title: initial.title ?? '',
    description: initial.description ?? '',
    categoryId: initial.categoryId ?? '',
    mediaHint: initial.mediaHint ?? '',
    sensitiveNotice: Boolean(initial.sensitiveNotice),
    isActive: initial.isActive ?? true,
    fields: lock(initial.fields),
    entry: initial.entry ? { ...initial.entry, fields: lock(initial.entry.fields) } : null,
  })
  const [error, setError] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  // `locked` ne sert qu'à l'affichage : il n'est pas enregistré.
  const strip = (fields) => fields.map(({ locked: _locked, ...f }) => f)

  async function save(e) {
    e.preventDefault()
    setError(null)
    const body = {
      title: form.title,
      description: form.description || null,
      isActive: form.isActive,
      ...(special
        ? {}
        : {
            categoryId: form.categoryId || null,
            mediaHint: form.mediaHint || null,
            sensitiveNotice: form.sensitiveNotice,
            fields: strip(form.fields),
            entry: form.entry ? { ...form.entry, fields: strip(form.entry.fields) } : null,
          }),
      ...(isNew ? { key: form.key } : {}),
    }
    try {
      const res = await api(isNew ? '/admin/dossier-sections' : `/admin/dossier-sections/${initial.id}`, { method: isNew ? 'POST' : 'PATCH', body })
      onSaved(res.section)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <Modal title={isNew ? t('dossier.nouvelleEtape') : t('dossier.modifierEtape')} onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <div className="grid-2">
          <label>{t('common.title')}<input required value={form.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label>{t('categories.code')}<input required disabled={!isNew} value={form.key} onChange={(e) => set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
            <small className="muted">{t('dossier.aideCodeEtape')}</small>
          </label>
        </div>
        <label>{t('common.description')}<textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        {!special && (
          <>
            <div className="grid-2">
              <label>{t('dossier.categorieDePublication')}<select value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  <option value="">{t('dossier.nonPubliee')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `${c.code}. ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>{t('dossier.suggestionMedias')}<input value={form.mediaHint} onChange={(e) => set({ mediaHint: e.target.value })} />
              </label>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={form.sensitiveNotice} onChange={(e) => set({ sensitiveNotice: e.target.checked })} />
              {t('dossier.etapeSensible')}
            </label>
            <fieldset className="subsection">
              <legend>{t('dossier.champsDeLEtape')}</legend>
              <FieldsEditor fields={form.fields} onChange={(fields) => set({ fields })} />
            </fieldset>
            <fieldset className="subsection">
              <legend>{t('dossier.elementsRepetables')}</legend>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(form.entry)}
                  onChange={(e) => set({ entry: e.target.checked ? { label: '', plural: '', titleField: 'nom', fields: [{ key: 'nom', label: t('common.name'), type: 'text', required: true }] } : null })}
                />
                {t('dossier.activerElements')}
              </label>
              {form.entry && (
                <>
                  <div className="grid-2">
                    <label>{t('dossier.nomDUnElement')}<input required value={form.entry.label} onChange={(e) => set({ entry: { ...form.entry, label: e.target.value } })} />
                    </label>
                    <label>{t('dossier.nomAuPluriel')}<input value={form.entry.plural ?? ''} onChange={(e) => set({ entry: { ...form.entry, plural: e.target.value } })} />
                    </label>
                  </div>
                  <label>{t('dossier.champTitre')}<select value={form.entry.titleField} onChange={(e) => set({ entry: { ...form.entry, titleField: e.target.value } })}>
                      {form.entry.fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label || f.key}
                        </option>
                      ))}
                    </select>
                  </label>
                  <FieldsEditor fields={form.entry.fields} onChange={(fields) => set({ entry: { ...form.entry, fields } })} />
                </>
              )}
            </fieldset>
          </>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
          {t('categories.categorieActive')}
        </label>
        <ErrorMessage error={error} />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit">{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  )
}

export function SectionDefsPage() {
  const { data, error, loading, reload } = useApi('/admin/dossier-sections')
  const categories = useApi('/admin/lookups').data?.categories.filter((c) => !c.parentId) ?? []
  const [editing, setEditing] = useState(null)
  const [moveError, setMoveError] = useState(null)
  const toast = useToast()
  const sections = data?.sections ?? []

  async function move(i, delta) {
    setMoveError(null)
    const a = sections[i]
    const b = sections[i + delta]
    try {
      await api(`/admin/dossier-sections/${a.id}`, { method: 'PATCH', body: { position: b.position } })
      await api(`/admin/dossier-sections/${b.id}`, { method: 'PATCH', body: { position: a.position } })
      reload()
    } catch (err) {
      setMoveError(err)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t('dossier.formulaireDeCollecte')}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('dossier.formulaireIntro')}</p>
        </div>
        <button type="button" onClick={() => setEditing({ kind: 'standard', fields: [] })}>
          <Plus size={17} className="icon" aria-hidden="true" />{t('dossier.nouvelleEtape')}</button>
      </div>
      <ErrorMessage error={moveError} />
      <section className="card">
        <Loading loading={loading} error={error}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{t('dossier.etape')}</th>
                  <th scope="col">{t('dossier.categorieDePublication')}</th>
                  <th scope="col">{t('dossier.champs')}</th>
                  <th scope="col">{t('categories.etat')}</th>
                  <th scope="col">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{defTitle(s)}</strong>
                      <div className="small muted">
                        {s.key}
                        {s.isDefault ? ` · ${t('dossier.etapeDeReference')}` : ''}
                      </div>
                    </td>
                    <td>{s.category ? s.category.name : '—'}</td>
                    <td>
                      {s.fields.length}
                      {s.entry ? ` + ${s.entry.fields.length} (${s.entry.label})` : ''}
                    </td>
                    <td>{s.isActive ? t('reference.actif') : <span className="muted">{t('categories.desactivee')}</span>}</td>
                    <td className="actions">
                      <button type="button" className="ghost icon-button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('dossier.monter')}>
                        <ArrowUp size={16} className="icon" aria-hidden="true" />
                      </button>
                      <button type="button" className="ghost icon-button" disabled={i === sections.length - 1} onClick={() => move(i, 1)} aria-label={t('dossier.descendre')}>
                        <ArrowDown size={16} className="icon" aria-hidden="true" />
                      </button>
                      <button type="button" className="secondary" onClick={() => setEditing(s)}>
                        <Pencil size={15} className="icon" aria-hidden="true" />{t('common.edit')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Loading>
      </section>
      {editing && (
        <SectionDefModal
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast.success(t('communities.modificationsEnregistrees'))
            reload()
          }}
        />
      )}
    </>
  )
}
