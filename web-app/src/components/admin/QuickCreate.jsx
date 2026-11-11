import { useState } from 'react'
import { api, upload } from '../../api.js'
import { FormFields } from '../CrudPage.jsx'
import { Modal } from '../Modal.jsx'
import { ErrorMessage } from '../ui.jsx'
import { ACCESS_LABELS } from '../../labels.js'
import { t } from '../../i18n/index.js'

export const MEDIA_ACCEPT = '.jpg,.jpeg,.png,.webp,.tif,.tiff,.mp3,.wav,.m4a,.mp4,.pdf,.txt'

const initialValues = (fields) =>
  Object.fromEntries(fields.map((f) => [f.name, f.default ?? (f.type === 'checkbox' ? false : '')]))

// Fenêtre de création rapide d'un élément de référentiel (source, personne,
// consentement…) sans quitter le formulaire en cours.
export function QuickCreateModal({ title, intro, fields, endpoint, responseKey, transform = (p) => p, onCreated, onClose }) {
  const [values, setValues] = useState(() => initialValues(fields))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const fieldErrors = Object.fromEntries((error?.details ?? []).filter((d) => d.field).map((d) => [d.field, d.message]))

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {}
    for (const f of fields) {
      let v = values[f.name]
      if (f.type === 'number') v = v === '' ? null : Number(v)
      if (f.type === 'select' && v === '') {
        if (f.name.endsWith('Id')) v = null
        else continue
      }
      payload[f.name] = v
    }
    try {
      const res = await api(endpoint, { method: 'POST', body: transform(payload) })
      onCreated(res[responseKey])
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        {intro && <p className="muted small">{intro}</p>}
        <FormFields fields={fields} values={values} setValues={setValues} errors={fieldErrors} />
        <ErrorMessage error={error} />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving}>{saving ? t('crud.enregistrement') : t('ws.creerEtAssocier')}</button>
        </div>
      </form>
    </Modal>
  )
}

const emptyMedia = { title: '', description: '', accessLevel: 'PRIVATE', publicationCleared: false, dateValue: '', context: '', rightsStatement: '', provenance: '' }

// Formulaire de téléversement d'un original, utilisé par la médiathèque et
// par l'éditeur de fiche.
export function MediaUploadForm({ onUploaded, onCancel, submitLabel = t('media.televerser'), extended = false }) {
  const [form, setForm] = useState(emptyMedia)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(event) {
    event.preventDefault()
    const file = event.target.elements.file.files[0]
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    for (const [k, v] of Object.entries(form)) if (v) body.append(k, String(v))
    if (form.dateValue) body.append('dateKind', 'APPROXIMATE')
    setUploading(true)
    setError(null)
    try {
      const res = await upload('/admin/media', body)
      event.target.reset()
      setForm(emptyMedia)
      onUploaded(res.media)
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <form className="form" onSubmit={handleUpload}>
      <p className="muted small">{t('media.leFichierEstConserveTel')} {t('dossier.tailleMaximale')}</p>
      <label>{t('media.fichier')}<input name="file" type="file" required accept={MEDIA_ACCEPT} />
      </label>
      <label>{t('common.title')}<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>
      <label>{t('common.description')}<textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </label>
      {extended && (
        <>
          <div className="grid-2">
            <label>{t('dossier.dateDePriseDeVue')}<input value={form.dateValue} placeholder={t('dossier.exempleDate')} onChange={(e) => setForm({ ...form, dateValue: e.target.value })} />
            </label>
            <label>{t('dossier.lieuEtContexte')}<input value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
            </label>
          </div>
          <label>{t('media.droitsEtConditionsDeReutilisation')}<textarea rows={2} value={form.rightsStatement} onChange={(e) => setForm({ ...form, rightsStatement: e.target.value })} />
          </label>
          <label>{t('media.provenance')}<input value={form.provenance} onChange={(e) => setForm({ ...form, provenance: e.target.value })} />
          </label>
        </>
      )}
      <label>{t('media.niveauDAcces')}<select value={form.accessLevel} onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}>
          {Object.entries(ACCESS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {/* Information facultative : un média « Public » s'affiche avec sa fiche publiée. */}
      <label className="checkbox">
        <input type="checkbox" checked={form.publicationCleared} onChange={(e) => setForm({ ...form, publicationCleared: e.target.checked })} />
        {t('media.lesDroitsDeDiffusionPublique')}
      </label>
      <ErrorMessage error={error} />
      <div className="actions">
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>{t('common.cancel')}</button>}
        <button type="submit" disabled={uploading}>
          {uploading ? t('media.envoiEnCours') : submitLabel}
        </button>
      </div>
    </form>
  )
}

export function MediaUploadModal({ onUploaded, onClose, extended = false }) {
  return (
    <Modal title={t('media.televerserUnOriginal')} onClose={onClose} wide>
      <MediaUploadForm onUploaded={onUploaded} onCancel={onClose} submitLabel={t('ws.televerserEtAssocier')} extended={extended} />
    </Modal>
  )
}
