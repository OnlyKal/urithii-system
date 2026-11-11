import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../../api.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { MediaUploadForm } from '../../components/admin/QuickCreate.jsx'
import { ErrorMessage, Loading, Pagination, TableWrap, placeLabel, useApi } from '../../components/ui.jsx'
import { ACCESS_LABELS, DATE_KIND_LABELS, formatBytes, formatDateTime, MEDIA_KIND_LABELS } from '../../labels.js'
import { t, tn } from '../../i18n/index.js'

function MediaPreview({ media, variant = 'thumbnail' }) {
  const src = `/api/admin/media/${media.id}/file?variant=${variant}`
  if (media.kind === 'PHOTO') return <img src={src} alt={media.title} className={variant === 'thumbnail' ? 'thumb' : 'preview'} loading="lazy" />
  if (variant === 'thumbnail') return <span className="thumb placeholder">{MEDIA_KIND_LABELS[media.kind]}</span>
  if (media.kind === 'AUDIO') return <audio controls preload="none" src={`/api/admin/media/${media.id}/file`} />
  if (media.kind === 'VIDEO') return <video controls preload="none" className="preview" src={`/api/admin/media/${media.id}/file`} />
  return (
    <a href={`/api/admin/media/${media.id}/file`} target="_blank" rel="noreferrer">{t('media.ouvrirLeDocument')}</a>
  )
}

export function MediaListPage() {
  const { can } = useAuth()
  const [filters, setFilters] = useState({ q: '', kind: '', accessLevel: '' })
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({ page, pageSize: 24 })
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v)
  const { data, error, loading, reload } = useApi(`/admin/media?${params}`)
  return (
    <>
      <h1>{t('media.mediatheque')}</h1>
      {can('files.upload') && (
        <section className="card">
          <h2>{t('media.televerserUnOriginal')}</h2>
          <MediaUploadForm onUploaded={reload} />
        </section>
      )}

      <section className="card filters">
        <input type="search" placeholder={t('media.rechercher')} value={filters.q} onChange={(e) => (setFilters({ ...filters, q: e.target.value }), setPage(1))} aria-label={t('common.search')} />
        <select value={filters.kind} onChange={(e) => (setFilters({ ...filters, kind: e.target.value }), setPage(1))} aria-label={t('common.type')}>
          <option value="">{t('media.tousLesTypes')}</option>
          {Object.entries(MEDIA_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={filters.accessLevel} onChange={(e) => (setFilters({ ...filters, accessLevel: e.target.value }), setPage(1))} aria-label={t('media.acces')}>
          <option value="">{t('media.tousLesNiveauxDAcces')}</option>
          {Object.entries(ACCESS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </section>

      <Loading loading={loading && !data} error={error}>
        <div className="media-grid">
          {data?.media.map((m) => (
            <Link key={m.id} to={`/admin/medias/${m.id}`} className="media-card">
              <MediaPreview media={m} />
              <strong>{m.title}</strong>
              <span className="muted">
                {MEDIA_KIND_LABELS[m.kind]} · {formatBytes(m.originalFile.sizeBytes)} · {ACCESS_LABELS[m.accessLevel]}
              </span>
              {m.originalFile.integrityStatus !== 'OK' && m.originalFile.integrityStatus !== 'UNCHECKED' && (
                <span className="error">{t('media.integrite')}{' '}{m.originalFile.integrityStatus}</span>
              )}
            </Link>
          ))}
        </div>
        {data?.media.length === 0 && <p className="muted">{t('media.aucunMedia')}</p>}
        {data && <Pagination page={page} pageSize={24} total={data.total} onChange={setPage} />}
      </Loading>
    </>
  )
}

export function MediaDetailPage() {
  const { id } = useParams()
  const { user, can } = useAuth()
  const { data, error, loading, reload } = useApi(`/admin/media/${id}`)
  const lookups = useApi('/admin/lookups').data
  const [form, setForm] = useState(null)
  const [actionError, setActionError] = useState(null)
  const toast = useToast()

  useEffect(() => {
    if (!data) return
    const m = data.media
    setForm({
      title: m.title,
      description: m.description ?? '',
      accessLevel: m.accessLevel,
      consentId: m.consentId ?? '',
      publicationCleared: m.publicationCleared,
      rightsStatement: m.rightsStatement ?? '',
      dateKind: m.dateKind,
      dateValue: m.dateValue ?? '',
      placeId: m.placeId ?? '',
      peopleDepicted: m.peopleDepicted ?? '',
      context: m.context ?? '',
      provenance: m.provenance ?? '',
    })
  }, [data])

  if (!data || !form || !lookups) return <Loading loading={loading || !lookups} error={error} />
  const media = data.media
  const editable = media.createdBy.id === user.id || can('content.edit')
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  async function save(event) {
    event.preventDefault()
    setActionError(null)
    const clean = (v) => (v === '' ? null : v)
    try {
      await api(`/admin/media/${id}`, {
        method: 'PATCH',
        body: { ...form, consentId: clean(form.consentId), placeId: clean(form.placeId) },
      })
      toast.success(t('media.metadonneesEnregistrees'))
      reload()
    } catch (err) {
      setActionError(err)
    }
  }

  async function checkIntegrity() {
    try {
      const res = await api(`/admin/media/${id}/check-integrity`, { method: 'POST' })
      const ok = res.files.every((f) => f.integrityStatus === 'OK')
      if (ok) toast.success(tn('media.integrityOk', res.files.length))
      else toast.error(t('media.controleDIntegrite', { 0: res.files.map((f) => f.integrityStatus).join(', ') }))
      reload()
    } catch (err) {
      setActionError(err)
    }
  }

  const files = [
    [t('media.original'), media.originalFile],
    [t('media.versionWeb'), media.webFile],
    [t('media.miniature'), media.thumbnailFile],
  ].filter(([, f]) => f)

  return (
    <>
      <p>
        <Link to="/admin/medias">{t('media.mediatheque2')}</Link>
      </p>
      <h1>{media.title}</h1>
      <section className="card">
        <MediaPreview media={media} variant="web" />
        <p>
          <a href={`/api/admin/media/${id}/file?download=1`}>{t('media.telechargerLOriginal')}</a>
        </p>
      </section>

      <section className="card">
        <h2>{t('media.fichiersConserves')}</h2>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('media.fichier')}</th>
                <th scope="col">{t('common.type')}</th>
                <th scope="col">{t('media.taille')}</th>
                <th scope="col">{t('media.empreinteSha256')}</th>
                <th scope="col">{t('media.integrite2')}</th>
              </tr>
            </thead>
            <tbody>
              {files.map(([label, f]) => (
                <tr key={f.id}>
                  <td>
                    {label}
                    {f.transformation && <div className="muted">{f.transformation}</div>}
                  </td>
                  <td>{f.mimeType}</td>
                  <td>{formatBytes(f.sizeBytes)}</td>
                  <td>
                    <code>{f.sha256}</code>
                  </td>
                  <td>
                    {f.integrityStatus}
                    {f.lastCheckedAt && <div className="muted">{formatDateTime(f.lastCheckedAt)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <button type="button" className="secondary" onClick={checkIntegrity}>{t('media.verifierLIntegrite')}</button>
      </section>

      <form className="form" onSubmit={save}>
        <fieldset disabled={!editable} className="plain">
          <section className="card">
            <h2>{t('media.descriptionEtProvenance')}</h2>
            <label>{t('common.title')}<input required value={form.title} onChange={(e) => set({ title: e.target.value })} />
            </label>
            <label>{t('common.description')}<textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </label>
            <div className="grid-2">
              <label>{t('common.place')}<select value={form.placeId} onChange={(e) => set({ placeId: e.target.value })}>
                  <option value="">—</option>
                  {lookups.places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {placeLabel(p, lookups.places)}
                    </option>
                  ))}
                </select>
              </label>
              <label>{t('common.date')}<select value={form.dateKind} onChange={(e) => set({ dateKind: e.target.value })}>
                  {Object.entries(DATE_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {form.dateKind !== 'UNKNOWN' && (
                <label>{t('media.valeur')}<input value={form.dateValue} onChange={(e) => set({ dateValue: e.target.value })} />
                </label>
              )}
            </div>
            <label>{t('media.personnesRepresenteesSiIdentificationFiable')}<textarea rows={2} value={form.peopleDepicted} onChange={(e) => set({ peopleDepicted: e.target.value })} />
            </label>
            <label>{t('media.contexte')}<textarea rows={2} value={form.context} onChange={(e) => set({ context: e.target.value })} />
            </label>
            <label>{t('media.provenance')}<textarea rows={2} value={form.provenance} onChange={(e) => set({ provenance: e.target.value })} />
            </label>
          </section>

          <section className="card">
            <h2>{t('media.droitsEtDiffusion')}</h2>
            <label>{t('media.niveauDAcces')}<select value={form.accessLevel} onChange={(e) => set({ accessLevel: e.target.value })}>
                {Object.entries(ACCESS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={form.publicationCleared} onChange={(e) => set({ publicationCleared: e.target.checked })} />{t('media.lesDroitsDeDiffusionPublique')}</label>
            <small className="muted">{t('media.aideDroitsPublic')}</small>
            <label>{t('media.droitsEtConditionsDeReutilisation')}<textarea rows={2} value={form.rightsStatement} onChange={(e) => set({ rightsStatement: e.target.value })} />
            </label>
          </section>
        </fieldset>
        <ErrorMessage error={actionError} />
        {editable && (
          <div>
            <button type="submit">{t('common.save')}</button>
          </div>
        )}
      </form>

      <section className="card">
        <h2>{t('media.utilisation')}</h2>
        <ul className="plain-list">
          {media.items.map(({ item }) => (
            <li key={item.id}>
              <Link to={`/admin/fiches/${item.id}`}>{item.title}</Link>
            </li>
          ))}
          {media.items.length === 0 && <li className="muted">{t('media.associeAAucuneFiche')}</li>}
        </ul>
        <h3>{t('media.transcriptionsEtTraductions')}</h3>
        <ul className="plain-list">
          {media.texts.map((tx) => (
            <li key={tx.id}>
              <Link to={`/admin/textes/${tx.id}`}>
                {tx.kind === 'TRANSCRIPTION' ? t('text.transcription') : t('text.traduction')} — {tx.language.name}
              </Link>
            </li>
          ))}
        </ul>
        {(can('transcription.edit') || can('translation.edit') || can('content.edit')) && (
          <Link to={`/admin/textes/nouveau?mediaId=${media.id}`} className="action-link">{t('media.ajouterUneTranscriptionOuUne')}</Link>
        )}
      </section>
    </>
  )
}
