import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../../api.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ErrorMessage, Loading, TableWrap, useApi } from '../../components/ui.jsx'
import { formatDateTime } from '../../labels.js'
import { t } from '../../i18n/index.js'

const KIND = { TRANSCRIPTION: t('text.transcription'), TRANSLATION: t('text.traduction') }

export function TextsPage() {
  const [unverified, setUnverified] = useState(true)
  const { data, error, loading } = useApi(`/admin/texts${unverified ? '?unverified=1' : ''}`)
  return (
    <>
      <h1>{t('text.transcriptionsEtTraductions')}</h1>
      <p className="muted">{t('text.lesTranscriptionsAutomatiquesRestentSignalees')}</p>
      <label className="checkbox">
        <input type="checkbox" checked={unverified} onChange={(e) => setUnverified(e.target.checked)} />{t('text.afficherSeulementLesTextesA')}</label>
      <section className="card">
        <Loading loading={loading} error={error}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('text.texte')}</th>
                  <th scope="col">{t('text.rattacheA')}</th>
                  <th scope="col">{t('text.methode')}</th>
                  <th scope="col">{t('text.verification')}</th>
                  <th scope="col">{t('common.version')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.texts.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <Link to={`/admin/textes/${tx.id}`}>
                        {KIND[tx.kind]} — {tx.language.name}
                      </Link>
                    </td>
                    <td>{tx.media?.title ?? tx.item?.title ?? '—'}</td>
                    <td>{tx.method === 'AUTOMATIC' ? t('governance.automatique') : t('text.manuelle')}</td>
                    <td>{tx.verification === 'VERIFIED' ? t('text.verifiee') : t('text.nonVerifiee')}</td>
                    <td>{tx.currentVersion}</td>
                  </tr>
                ))}
                {data?.texts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">{t('text.aucunTexte')}</td>
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

export function TextNewPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const languages = useApi('/admin/lookups').data?.languages ?? []
  const translationOfId = params.get('translationOf')
  const [form, setForm] = useState({
    kind: translationOfId ? 'TRANSLATION' : can('transcription.edit') || can('content.edit') ? 'TRANSCRIPTION' : 'TRANSLATION',
    languageId: '',
    method: 'MANUAL',
    translatorRole: '',
    notes: '',
    content: '',
  })
  const [error, setError] = useState(null)

  async function save(event) {
    event.preventDefault()
    try {
      const res = await api('/admin/texts', {
        method: 'POST',
        body: {
          ...form,
          mediaId: params.get('mediaId'),
          itemId: params.get('itemId'),
          translationOfId,
        },
      })
      // Depuis le dossier d'une fiche, on y revient directement.
      const itemId = params.get('itemId')
      navigate(itemId ? `/admin/fiches/${itemId}?onglet=medias` : `/admin/textes/${res.text.id}`, { replace: true })
    } catch (err) {
      setError(err)
    }
  }

  return (
    <>
      <h1>{t('text.nouveauTexte')}</h1>
      <form className="form card" onSubmit={save}>
        <div className="grid-2">
          <label>{t('common.type')}<select value={form.kind} disabled={Boolean(translationOfId)} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="TRANSCRIPTION">{t('text.transcription')}</option>
              <option value="TRANSLATION">{t('text.traduction')}</option>
            </select>
          </label>
          <label>{t('text.langueDuTexte')}<select required value={form.languageId} onChange={(e) => setForm({ ...form, languageId: e.target.value })}>
              <option value="">{t('common.choose')}</option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>{t('text.methode')}<select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="MANUAL">{t('text.manuelle')}</option>
              <option value="AUTOMATIC">{t('text.outilAutomatiqueNonVerifiee')}</option>
            </select>
          </label>
          <label>{t('text.roleDuTranscripteurOuTraducteur')}<input value={form.translatorRole} onChange={(e) => setForm({ ...form, translatorRole: e.target.value })} />
          </label>
        </div>
        <label>{t('text.texte')}<textarea rows={16} required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <small className="muted">{t('text.reperesTemporelsConseillesPourL')}</small>
        </label>
        <label>{t('text.notesExplicativesTermesSansEquivalent')}<textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <ErrorMessage error={error} />
        <div>
          <button type="submit">{t('common.save')}</button>
        </div>
      </form>
    </>
  )
}

export function TextDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const { data, error, loading, reload } = useApi(`/admin/texts/${id}`)
  const [content, setContent] = useState('')
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState(null)
  const [viewVersion, setViewVersion] = useState(null)

  useEffect(() => {
    if (data) setContent(data.text.revisions[0]?.content ?? '')
  }, [data])

  if (!data) return <Loading loading={loading} error={error} />
  const text = data.text
  const editable = can(text.kind === 'TRANSCRIPTION' ? 'transcription.edit' : 'translation.edit') || can('content.edit')

  async function run(fn) {
    setActionError(null)
    try {
      await fn()
      reload()
    } catch (err) {
      setActionError(err)
    }
  }

  const shown = viewVersion ? text.revisions.find((r) => r.version === viewVersion) : null

  return (
    <>
      <p>
        <Link to="/admin/textes">{t('text.textes')}</Link>
      </p>
      <h1>
        {KIND[text.kind]} — {text.language.name}
      </h1>
      <p>
        {text.media && (
          <>{t('text.media')}{' '}<Link to={`/admin/medias/${text.media.id}`}>{text.media.title}</Link>.{' '}
          </>
        )}
        {text.item && (
          <>{t('text.fiche')}{' '}<Link to={`/admin/fiches/${text.item.id}`}>{text.item.title}</Link>.{' '}
          </>
        )}
        {text.translationOf && <>{t('text.traductionDUne')}{' '}{KIND[text.translationOf.kind].toLowerCase()}{' '}{t('text.en')}{' '}{text.translationOf.language.name}. </>}
      </p>
      <p>
        <span className="badge">{text.method === 'AUTOMATIC' ? t('governance.automatique') : t('text.manuelle')}</span>{' '}
        <span className={`badge ${text.verification === 'VERIFIED' ? 'ok-badge' : ''}`}>
          {text.verification === 'VERIFIED' ? t('text.verifieePar', { 0: text.verifiedBy?.displayName }) : t('text.nonVerifiee')}
        </span>{' '}
        <span className="badge">{text.isPublic ? t('text.afficheeSurLeSite') : t('text.nonAfficheeSurLeSite')}</span>
      </p>
      <ErrorMessage error={actionError} />
      <div className="actions">
        {editable && text.verification !== 'VERIFIED' && (
          <button type="button" className="secondary" onClick={() => run(() => api(`/admin/texts/${id}/verify`, { method: 'POST' }))}>{t('text.marquerCommeVerifiee')}</button>
        )}
        {can('content.edit') && (
          <button
            type="button"
            className="secondary"
            onClick={() => run(() => api(`/admin/texts/${id}/visibility`, { method: 'PATCH', body: { isPublic: !text.isPublic } }))}
          >
            {text.isPublic ? t('text.retirerDuSitePublic') : t('text.afficherSurLeSitePublic')}
          </button>
        )}
        {text.kind === 'TRANSCRIPTION' && (can('translation.edit') || can('content.edit')) && (
          <Link className="button secondary" to={`/admin/textes/nouveau?translationOf=${text.id}`}>{t('text.traduireCeTexte')}</Link>
        )}
      </div>

      <section className="card">
        <h2>{t('common.version')}{' '}{text.currentVersion}</h2>
        {editable ? (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => api(`/admin/texts/${id}/revisions`, { method: 'POST', body: { content, reason } })).then(() => setReason(''))
            }}
          >
            <textarea rows={18} value={content} onChange={(e) => setContent(e.target.value)} />
            <label>{t('text.motifDeLaRevision')}<input required value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div>
              <button type="submit">{t('text.enregistrerUneNouvelleVersion')}</button>
            </div>
          </form>
        ) : (
          <pre className="text-content">{content}</pre>
        )}
        {text.notes && (
          <p>
            <strong>{t('text.notes')}</strong> {text.notes}
          </p>
        )}
      </section>

      <section className="card">
        <h2>{t('text.historique')}</h2>
        <ul className="plain-list">
          {text.revisions.map((r) => (
            <li key={r.id}>
              <button type="button" className="link-button" onClick={() => setViewVersion(r.version === viewVersion ? null : r.version)}>{t('common.version')}{' '}{r.version}
              </button>{' '}
              — {r.author.displayName}, {formatDateTime(r.createdAt)} — {r.reason}
            </li>
          ))}
        </ul>
        {shown && <pre className="text-content">{shown.content}</pre>}
      </section>
    </>
  )
}
