import { ShieldAlert } from 'lucide-react'
import { MEDIA_KIND_LABELS } from '../../../labels.js'
import { t } from '../../../i18n/index.js'
import { CONTENT_KINDS, defTitle, FIELD_STATUS_LABELS, fieldLabel, isFilled, optionLabel, REVIEW_LABELS, sectionHasContent, tDef } from './dossierLogic.js'

function Value({ def, field, value, ctx, siblings = [] }) {
  const nameOf = (id) => siblings.find((e) => e.id === id)?.values?.[def.entry?.titleField] || '—'
  if (field.type === 'entryRef') return <span>{nameOf(value)}</span>
  if (field.type === 'entryRefs') return <span>{(value ?? []).map(nameOf).join(', ')}</span>
  if (field.type === 'links') return <ul>{value.filter((l) => l?.target).map((l, i) => <li key={i}>{l.kind ? `${optionLabel(def, l.kind)} : ` : ''}{nameOf(l.target)}</li>)}</ul>
  if (field.type === 'events') {
    return (
      <ul>
        {value.filter((ev) => ev?.title).map((ev, i) => (
          <li key={i}>{[ev.date, optionLabel(def, ev.type)].filter(Boolean).join(' · ')}{ev.date || ev.type ? ' — ' : ''}{ev.title}{ev.nature ? ` (${optionLabel(def, ev.nature)})` : ''}{ev.description ? ` : ${ev.description}` : ''}</li>
        ))}
      </ul>
    )
  }
  if (field.type === 'territories' || field.type === 'province') return <span>{Array.isArray(value) ? value.filter((v) => String(v).trim()).join(', ') : value}</span>
  if (field.type === 'list') return <ul>{value.filter((v) => String(v).trim()).map((v, i) => <li key={i}>{v}</li>)}</ul>
  if (field.type === 'select') return <span>{optionLabel(def, value)}</span>
  if (field.type === 'person') return <span>{ctx.persons.find((p) => p.id === value)?.fullName ?? '—'}</span>
  if (field.type === 'media') return <span>{ctx.media.find((m) => m.id === value)?.title ?? '—'}</span>
  if (field.type === 'sections') return <span>{(value ?? []).map((k) => ctx.defs.find((d) => d.key === k)).filter(Boolean).map(defTitle).join(', ')}</span>
  return <span className="preserve-lines">{value}</span>
}

function Fields({ def, fields, values = {}, statuses = {}, ctx, inEntry, siblings }) {
  const rows = fields.filter((f) => f.type !== 'consent' && (isFilled(values[f.key]) || statuses[f.key]))
  if (!rows.length) return null
  return (
    <dl className="details">
      {rows.map((field) => (
        <div key={field.key} className="details-row">
          <dt>{fieldLabel(def, field, inEntry)}</dt>
          <dd>
            {isFilled(values[field.key]) ? <Value def={def} field={field} value={values[field.key]} ctx={ctx} siblings={siblings} /> : null}
            {statuses[field.key] && <span className="badge">{FIELD_STATUS_LABELS[statuses[field.key]]}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Refs({ part, ctx }) {
  const media = part.media ?? []
  const sources = (part.sources ?? []).filter((s) => s.sourceId)
  if (!media.length && !sources.length) return null
  return (
    <div className="preview-refs small">
      {media.length > 0 && (
        <p>
          <strong>{t('common.media')} : </strong>
          {media.map((m) => {
            const asset = ctx.media.find((x) => x.id === m.mediaId)
            return asset ? `${asset.title} (${MEDIA_KIND_LABELS[asset.kind]})` : '?'
          }).join(' · ')}
        </p>
      )}
      {sources.length > 0 && (
        <p>
          <strong>{t('common.sources')} : </strong>
          {sources.map((s) => `${ctx.sources.find((x) => x.id === s.sourceId)?.title ?? '?'}${s.relation === 'CONTRADICTS' ? ` (${t('dossier.contredit')})` : ''}`).join(' · ')}
        </p>
      )}
    </div>
  )
}

// Aperçu en lecture seule de tout le dossier.
export function DossierPreview({ defs, data, ctx, reviews = {}, onGoTo }) {
  const shown = defs.filter((d) => (CONTENT_KINDS.includes(d.kind) || d.kind === 'testimonies') && (sectionHasContent(data.sections[d.key]) || data.sections[d.key]?.notDocumented))
  if (!shown.length) return <p className="muted">{t('dossier.apercuVide')}</p>
  return (
    <div className="dossier-preview">
      {shown.map((def) => {
        const section = data.sections[def.key] ?? {}
        const review = reviews[def.key]
        return (
          <section key={def.key} className="card preview-section">
            <div className="section-header" style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>{defTitle(def)}</h3>
              <span>
                {section.sensitive && (
                  <span className="badge status-suspended">
                    <ShieldAlert size={13} aria-hidden="true" />{t('dossier.sensible')}</span>
                )}
                {review && <span className={`badge review-${review.status.toLowerCase()}`}>{REVIEW_LABELS[review.status]}</span>}
                {onGoTo && (
                  <button type="button" className="link-button small" onClick={() => onGoTo(def.key)}>{t('common.edit')}</button>
                )}
              </span>
            </div>
            {section.notDocumented && <p className="muted small">{t('dossier.sectionNonDocumentee')}</p>}
            {section.sensitiveNote && <p className="notice warning small">{section.sensitiveNote}</p>}
            <Fields def={def} fields={def.fields} values={section.values} statuses={section.fieldStatus} ctx={ctx} />
            <Refs part={section} ctx={ctx} />
            {(section.entries ?? []).length > 0 && (
              <div className="preview-entries">
                <h4>{tDef(def, 'entry.plural', def.entry?.plural || def.entry?.label)}</h4>
                {section.entries.map((e, i) => (
                  <div key={e.id} className="preview-entry">
                    <strong>
                      {e.values?.[def.entry.titleField] || `${def.entry.label} ${i + 1}`}
                      {e.sensitive && <span className="badge status-suspended">{t('dossier.sensible')}</span>}
                    </strong>
                    <Fields def={def} fields={def.entry.fields.filter((f) => f.key !== def.entry.titleField)} values={e.values} statuses={e.fieldStatus} ctx={ctx} inEntry siblings={section.entries} />
                    <Refs part={e} ctx={ctx} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
