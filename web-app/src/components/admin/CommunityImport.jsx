import { CheckCircle2, Download, FileJson, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, translateServerMessage } from '../../api.js'
import { Modal } from '../Modal.jsx'
import { ErrorMessage, TableWrap } from '../ui.jsx'
import { t } from '../../i18n/index.js'

// Modèle téléchargeable : structure seulement, aucune donnée culturelle.
const TEMPLATE = {
  communities: [
    {
      name: 'Nom principal de la communauté',
      otherNames: ['Autre nom', { name: 'Nom historique', kind: 'HISTORICAL', notes: 'Source ou précision' }],
      summary: 'Résumé (facultatif)',
      description: 'Présentation générale (facultatif)',
      history: 'Éléments historiques (facultatif)',
      documentationStatus: 'IN_PROGRESS',
      documentationNote: 'Note sur la documentation (facultatif)',
      places: ['Nom d’un lieu existant', { name: 'Nom d’un lieu', type: 'TERRITORY', parent: 'Nom du lieu parent' }],
      languages: ['Nom d’une langue existante', { isoCode: 'code ISO 639-3' }],
    },
  ],
}

function downloadTemplate() {
  const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modele-communautes.json'
  a.click()
  URL.revokeObjectURL(url)
}

const ACTION_CLASS = { create: 'ok-badge', update: 'badge-blue', skip: '', error: 'status-suspended' }

export function CommunityImportModal({ onClose, onImported }) {
  const [data, setData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [mode, setMode] = useState('skip')
  const [report, setReport] = useState(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function readFile(event) {
    const file = event.target.files[0]
    setReport(null)
    setDone(false)
    setError(null)
    if (!file) return
    setFileName(file.name)
    try {
      setData(JSON.parse(await file.text()))
    } catch {
      setData(null)
      setError(new Error(t('import.fichierIllisible')))
    }
  }

  async function run(dryRun) {
    setBusy(true)
    setError(null)
    try {
      const res = await api('/admin/communities/import', { method: 'POST', body: { data, mode, dryRun } })
      setReport(res)
      if (!dryRun) {
        setDone(true)
        onImported()
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const counts = report?.counts
  const writable = counts && counts.create + counts.update > 0

  return (
    <Modal
      title={t('import.titre')}
      onClose={onClose}
      wide
      actions={
        done ? (
          <button type="button" onClick={onClose}>{t('reference.compris')}</button>
        ) : (
          <>
            <button type="button" className="secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="button" className="secondary" disabled={!data || busy} onClick={() => run(true)}>{t('import.analyser')}</button>
            <button type="button" disabled={!report || report.dryRun === false || !writable || busy} onClick={() => run(false)}>
              <Upload size={16} className="icon" aria-hidden="true" />{t('import.importer')}</button>
          </>
        )
      }
    >
      <p className="muted small">{t('import.intro')}</p>
      <div className="actions" style={{ marginBottom: '0.75rem' }}>
        <button type="button" className="secondary" onClick={downloadTemplate}>
          <Download size={16} className="icon" aria-hidden="true" />{t('import.telechargerModele')}</button>
        <Link to="/admin/lieux" target="_blank" rel="noreferrer" className="small">{t('import.voirLesLieux')}</Link>
      </div>
      <label>{t('import.fichierJson')}<input type="file" accept=".json,application/json" onChange={readFile} />
      </label>
      {fileName && data && (
        <p className="small muted">
          <FileJson size={14} className="icon" aria-hidden="true" /> {fileName} — {t('import.entrees', { n: (Array.isArray(data) ? data : data.communities ?? []).length })}
        </p>
      )}
      <fieldset className="import-modes">
        <legend>{t('import.communautesExistantes')}</legend>
        <label className="checkbox">
          <input type="radio" name="import-mode" checked={mode === 'skip'} onChange={() => (setMode('skip'), setReport(null))} />
          {t('import.modeIgnorer')}
        </label>
        <label className="checkbox">
          <input type="radio" name="import-mode" checked={mode === 'update'} onChange={() => (setMode('update'), setReport(null))} />
          {t('import.modeCompleter')}
        </label>
      </fieldset>
      <p className="muted small">{t('import.regles')}</p>
      <ErrorMessage error={error} />

      {report && (
        <section className="import-report">
          {done ? (
            <p className="ok">
              <CheckCircle2 size={16} className="icon" aria-hidden="true" /> {t('import.termine')}
            </p>
          ) : (
            <p className="small">{t('import.analyseAide')}</p>
          )}
          <div className="recap-stats">
            <span><strong>{counts.create}</strong> {t('import.action.create')}</span>
            <span><strong>{counts.update}</strong> {t('import.action.update')}</span>
            <span><strong>{counts.skip}</strong> {t('import.action.skip')}</span>
            <span><strong>{counts.error}</strong> {t('import.action.error')}</span>
          </div>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{t('common.community')}</th>
                  <th scope="col">{t('import.operation')}</th>
                  <th scope="col">{t('import.remarques')}</th>
                </tr>
              </thead>
              <tbody>
                {report.results.map((r) => (
                  <tr key={r.index}>
                    <td>{r.index + 1}</td>
                    <td>
                      {r.communityId ? <Link to={`/admin/communautes/${r.communityId}`}>{r.name}</Link> : r.name}
                      {r.existing && r.existing.name !== r.name && <div className="small muted">→ {r.existing.name}</div>}
                    </td>
                    <td>
                      <span className={`badge ${ACTION_CLASS[r.action]}`}>{t(`import.ligne.${r.action}`)}</span>
                    </td>
                    <td className="small">{r.messages.length ? r.messages.map(translateServerMessage).join(' · ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </section>
      )}
    </Modal>
  )
}
