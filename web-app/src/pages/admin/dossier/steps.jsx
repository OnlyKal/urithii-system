import { AlertCircle, CheckCircle2, Circle, CircleDashed, CircleDot, ShieldAlert, Upload } from 'lucide-react'
import { useState } from 'react'
import { TableWrap } from '../../../components/ui.jsx'
import { MEDIA_KIND_LABELS } from '../../../labels.js'
import { t } from '../../../i18n/index.js'
import { DossierPreview } from './DossierPreview.jsx'
import {
  attentionPoints,
  CONTENT_KINDS,
  defTitle,
  REVIEW_LABELS,
  sectionCompletion,
  sectionState,
  submissionProblems,
} from './dossierLogic.js'
import { SourceRefs } from './fields.jsx'

const contentDefs = (defs) => defs.filter((d) => (CONTENT_KINDS.includes(d.kind) || d.kind === 'testimonies') && d.isActive)

// Toutes les références d'un type, avec l'étape et l'élément concernés.
function allRefs(defs, data, kind) {
  const rows = []
  for (const def of contentDefs(defs)) {
    const section = data.sections[def.key] ?? {}
    for (const ref of section[kind] ?? []) rows.push({ def, ref })
    for (const entry of section.entries ?? []) {
      for (const ref of entry[kind] ?? []) rows.push({ def, entry, ref })
    }
  }
  return rows
}

export const STATE_ICONS = {
  complete: CheckCircle2,
  partial: CircleDot,
  empty: Circle,
  'not-documented': CircleDashed,
  neutral: Circle,
}

// Étape « Sources et références » : vue d'ensemble et sources par étape.
export function SourcesStep({ defs, data, ctx, updateSection, goTo }) {
  const rows = allRefs(defs, data, 'sources').filter((r) => r.ref.sourceId)
  const entryTitle = (def, entry) => entry?.values?.[def.entry?.titleField]
  return (
    <>
      <section className="card">
        <h3>{t('dossier.toutesLesSources', { n: rows.length })}</h3>
        {rows.length ? (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('itemEditor.source')}</th>
                  <th scope="col">{t('dossier.etapeConcernee')}</th>
                  <th scope="col">{t('dossier.relationSource')}</th>
                  <th scope="col">{t('itemEditor.ceQueLaSourceEtaye')}</th>
                  <th scope="col">{t('itemEditor.pageOuMinutage')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ def, entry, ref }, i) => {
                  const source = ctx.sources.find((s) => s.id === ref.sourceId)
                  return (
                    <tr key={i}>
                      <td>
                        {source?.title ?? '?'}
                        {source?.status && source.status !== 'ACTIVE' && <span className="badge">{source.status}</span>}
                      </td>
                      <td>
                        <button type="button" className="link-button" onClick={() => goTo(def.key)}>{defTitle(def)}</button>
                        {entry && <span className="muted"> — {entryTitle(def, entry) || '—'}</span>}
                      </td>
                      <td>{ref.relation === 'CONTRADICTS' ? <span className="badge status-needs_completion">{t('dossier.contredit')}</span> : t('dossier.etaye')}</td>
                      <td>{ref.supports || '—'}</td>
                      <td>{ref.locator || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <p className="muted small">{t('dossier.aucuneSource')}</p>
        )}
        <p className="muted small">{t('dossier.aideSourcesContradictoires')}</p>
      </section>
      <section className="card">
        <h3>{t('dossier.sourcesParEtape')}</h3>
        {contentDefs(defs)
          .filter((d) => d.kind !== 'testimonies')
          .map((def) => {
            const section = data.sections[def.key] ?? {}
            const count = (section.sources ?? []).filter((s) => s.sourceId).length
            return (
              <details key={def.key} className="attachments" open={count > 0 || undefined}>
                <summary>
                  {defTitle(def)} <span className="tab-count">{count}</span>
                </summary>
                <SourceRefs refs={section.sources ?? []} onChange={(sources) => updateSection(def.key, (s) => ({ ...s, sources }))} ctx={ctx} />
              </details>
            )
          })}
      </section>
    </>
  )
}

// Étape « Médias » : bibliothèque du dossier. Un fichier peut être rattaché à
// plusieurs étapes sans être téléversé de nouveau.
export function MediaStep({ defs, data, ctx, updateSection, libraryKey }) {
  const [adding, setAdding] = useState('')
  const library = data.sections[libraryKey]?.media ?? []
  const used = allRefs(defs, data, 'media')
  const ids = [...new Set([...library.map((m) => m.mediaId), ...used.map((u) => u.ref.mediaId)])]
  const sectionDefs = contentDefs(defs).filter((d) => d.kind !== 'testimonies')
  const addToLibrary = (mediaId) =>
    updateSection(libraryKey, (s) => ({ ...s, media: [...(s.media ?? []).filter((m) => m.mediaId !== mediaId), { mediaId, caption: '' }] }))
  const toggle = (def, mediaId, on) =>
    updateSection(def.key, (s) => ({
      ...s,
      media: on ? [...(s.media ?? []), { mediaId, caption: '' }] : (s.media ?? []).filter((m) => m.mediaId !== mediaId),
    }))

  return (
    <>
      <section className="card">
        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>{t('dossier.bibliotheque', { n: ids.length })}</h3>
          {!ctx.readOnly && ctx.canUpload && (
            <button type="button" onClick={() => ctx.openModal({ kind: 'media', onCreated: (m) => addToLibrary(m.id) })}>
              <Upload size={16} className="icon" aria-hidden="true" />{t('ws.televerserUnFichier')}</button>
          )}
        </div>
        <p className="muted small">{t('dossier.aideBibliotheque')} {t('dossier.tailleMaximale')}</p>
        {!ctx.readOnly && (
          <div className="actions" style={{ marginBottom: '1rem' }}>
            <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label={t('ws.associerUnMediaExistant')}>
              <option value="">{t('ws.associerUnMediaExistant')}</option>
              {ctx.media.filter((m) => !ids.includes(m.id)).map((m) => (
                <option key={m.id} value={m.id}>
                  {MEDIA_KIND_LABELS[m.kind]} — {m.title}
                </option>
              ))}
            </select>
            <button type="button" className="secondary" disabled={!adding} onClick={() => (addToLibrary(adding), setAdding(''))}>{t('common.add')}</button>
          </div>
        )}
        {ids.length === 0 && <p className="muted">{t('ws.aucunMediaAssocie')}</p>}
        <div className="library-grid">
          {ids.map((id) => {
            const m = ctx.media.find((x) => x.id === id)
            const inEntries = used.filter((u) => u.ref.mediaId === id && u.entry)
            return (
              <article key={id} className="library-card">
                {m?.kind === 'PHOTO' || (m?.kind === 'VIDEO' && m.thumbnailFileId) ? (
                  <img src={`/api/admin/media/${id}/file?variant=thumbnail`} alt="" className="thumb" loading="lazy" />
                ) : (
                  <span className="thumb placeholder">{m ? MEDIA_KIND_LABELS[m.kind] : '?'}</span>
                )}
                <div className="library-body">
                  <strong>{m?.title ?? id}</strong>
                  <span className="small muted">
                    {m ? MEDIA_KIND_LABELS[m.kind] : ''}
                    {m?.credit ? ` · ${m.credit}` : ''}
                  </span>
                  {m && m.accessLevel !== 'PUBLIC' && <span className="small muted">{t('dossier.nonPublicMedia')}</span>}
                  <fieldset className="library-sections">
                    <legend className="small">{t('dossier.rattacheAuxEtapes')}</legend>
                    {sectionDefs.map((def) => (
                      <label key={def.key} className="checkbox small">
                        <input
                          type="checkbox"
                          checked={(data.sections[def.key]?.media ?? []).some((r) => r.mediaId === id)}
                          onChange={(e) => toggle(def, id, e.target.checked)}
                          disabled={ctx.readOnly}
                        />
                        {defTitle(def)}
                      </label>
                    ))}
                  </fieldset>
                  {inEntries.length > 0 && (
                    <span className="small muted">
                      {t('dossier.utiliseDans')} {inEntries.map((u) => u.entry.values?.[u.def.entry?.titleField] || defTitle(u.def)).join(', ')}
                    </span>
                  )}
                  <a href={`/admin/medias/${id}`} target="_blank" rel="noreferrer" className="small">{t('dossier.detailsEtDroits')}</a>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}

// Étape finale : récapitulatif, points d'attention, aperçu et soumission.
export function ReviewStep({ defs, data, ctx, dossier, reviews, goTo, onSubmit, canSubmit }) {
  const problems = submissionProblems(defs, dossier, data)
  const attention = attentionPoints(defs, data)
  const sources = allRefs(defs, data, 'sources').filter((r) => r.ref.sourceId).length
  const media = new Set(allRefs(defs, data, 'media').map((r) => r.ref.mediaId)).size
  const rows = contentDefs(defs)
  const counts = rows.reduce(
    (acc, def) => {
      const state = sectionState(def, data.sections[def.key])
      acc[state] = (acc[state] ?? 0) + 1
      return acc
    },
    {},
  )
  return (
    <>
      <section className="card">
        <h3>{t('dossier.recapitulatif')}</h3>
        <div className="recap-stats">
          <span><strong>{(counts.complete ?? 0) + (counts['not-documented'] ?? 0)}</strong> {t('dossier.etapesCompletes')}</span>
          <span><strong>{counts.partial ?? 0}</strong> {t('dossier.etapesPartielles')}</span>
          <span><strong>{counts.empty ?? 0}</strong> {t('dossier.etapesVides')}</span>
          <span><strong>{sources}</strong> {t('common.sources').toLowerCase()}</span>
          <span><strong>{media}</strong> {t('common.media').toLowerCase()}</span>
        </div>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('dossier.etape')}</th>
                <th scope="col">{t('common.status')}</th>
                <th scope="col">{t('dossier.elements')}</th>
                <th scope="col">{t('common.media')}</th>
                <th scope="col">{t('common.sources')}</th>
                <th scope="col">{t('dossier.verificationAdmin')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((def) => {
                const section = data.sections[def.key] ?? {}
                const state = sectionState(def, section)
                const Icon = STATE_ICONS[state]
                const c = sectionCompletion(def, section)
                const review = reviews[def.key]
                return (
                  <tr key={def.key}>
                    <td>
                      <button type="button" className="link-button" onClick={() => goTo(def.key)}>{defTitle(def)}</button>
                      {section.sensitive && <ShieldAlert size={14} className="icon warning-text" aria-label={t('dossier.sensible')} />}
                    </td>
                    <td>
                      <span className={`state state-${state}`}>
                        <Icon size={15} aria-hidden="true" />
                        {t(`dossier.state.${state}`)}
                        {c && state !== 'not-documented' ? ` (${c.done}/${c.total})` : ''}
                      </span>
                    </td>
                    <td>{(section.entries ?? []).length || '—'}</td>
                    <td>{(section.media ?? []).length + (section.entries ?? []).reduce((n, e) => n + (e.media ?? []).length, 0) || '—'}</td>
                    <td>{(section.sources ?? []).filter((s) => s.sourceId).length + (section.entries ?? []).reduce((n, e) => n + (e.sources ?? []).length, 0) || '—'}</td>
                    <td>{review ? <span className={`badge review-${review.status.toLowerCase()}`}>{REVIEW_LABELS[review.status]}</span> : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      </section>

      {(problems.length > 0 || attention.length > 0) && (
        <section className="card">
          <h3>{t('dossier.aVerifier')}</h3>
          <ul className="checklist">
            {problems.map((p, i) => (
              <li key={`p${i}`} className="todo">
                <AlertCircle size={18} className="icon" aria-hidden="true" />
                <span>
                  {p.message}
                  <small className="muted"> — {t('ws.requisPourSoumettre')}</small>
                </span>
                {p.step && <button type="button" className="link-button" onClick={() => goTo(p.step)}>{t('ws.completer')}</button>}
              </li>
            ))}
            {attention.map((p, i) => (
              <li key={`a${i}`} className="publish">
                <AlertCircle size={18} className="icon" aria-hidden="true" />
                <span>
                  {p.message}
                  <small className="muted"> — {t(`dossier.attention.${p.kind}`)}</small>
                </span>
                <button type="button" className="link-button" onClick={() => goTo(p.step)}>{t('dossier.voir')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canSubmit && (
        <section className="card submit-card">
          <h3>{t('dossier.soumettreTitre')}</h3>
          <p className="muted small">{t('dossier.soumettreAide')}</p>
          <button type="button" disabled={problems.length > 0} onClick={onSubmit}>{t('dossier.action.SUBMITTED')}</button>
        </section>
      )}

      <h3>{t('dossier.apercuComplet')}</h3>
      <DossierPreview defs={defs} data={data} ctx={ctx} reviews={reviews} onGoTo={goTo} />
    </>
  )
}
