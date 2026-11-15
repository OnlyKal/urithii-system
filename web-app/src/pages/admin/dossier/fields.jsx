import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, ShieldAlert, Trash2, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { MultiSelect } from '../../../components/ui.jsx'
import { MEDIA_KIND_LABELS } from '../../../labels.js'
import { findProvince, normalizeText, PROVINCES, provincesOf, territoriesInText } from '../../../data/rdcDivisions.js'
import { t } from '../../../i18n/index.js'
import { CONTENT_KINDS, defTitle, FIELD_STATUS_LABELS, fieldHelp, fieldLabel, isFilled, newEntryId, optionLabel, tDef } from './dossierLogic.js'

// Champs du formulaire de collecte, décrits par les étapes enregistrées en
// base (voir server-app/src/services/dossierSchema.js).

export function FieldInput({ def, field, value, onChange, ctx, inEntry = false, values, onValue, fields }) {
  const label = fieldLabel(def, field, inEntry)
  const help = fieldHelp(def, field, inEntry)
  let input
  switch (field.type) {
    case 'longtext':
      input = <textarea rows={4} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={ctx.readOnly} />
      break
    case 'list':
      input = (
        <textarea
          rows={4}
          value={Array.isArray(value) ? value.join('\n') : value ?? ''}
          onChange={(e) => onChange(e.target.value.split('\n'))}
          disabled={ctx.readOnly}
        />
      )
      break
    case 'select':
      input = (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={ctx.readOnly}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {optionLabel(def, o)}
            </option>
          ))}
        </select>
      )
      break
    case 'date':
      input = <input value={value ?? ''} placeholder={t('dossier.exempleDate')} onChange={(e) => onChange(e.target.value)} disabled={ctx.readOnly} />
      break
    case 'person':
      return (
        <div className="field-with-action">
          <label>
            {label}
            <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={ctx.readOnly}>
              <option value="">—</option>
              {ctx.persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </label>
          {!ctx.readOnly && ctx.canManagePersons && (
            <button type="button" className="secondary" onClick={() => ctx.openModal({ kind: 'person', onCreated: (p) => onChange(p.id) })}>
              <Plus size={16} className="icon" aria-hidden="true" />{t('ws.nouvellePersonne')}</button>
          )}
        </div>
      )
    case 'media':
      return (
        <div className="field-with-action">
          <label>
            {label}
            <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={ctx.readOnly}>
              <option value="">—</option>
              {ctx.media.map((m) => (
                <option key={m.id} value={m.id}>
                  {MEDIA_KIND_LABELS[m.kind]} — {m.title}
                </option>
              ))}
            </select>
          </label>
          {!ctx.readOnly && ctx.canUpload && (
            <button type="button" className="secondary" onClick={() => ctx.openModal({ kind: 'media', onCreated: (m) => onChange(m.id) })}>
              <Upload size={16} className="icon" aria-hidden="true" />{t('ws.televerserUnFichier')}</button>
          )}
        </div>
      )
    case 'province':
    case 'territories':
      return <AdminDivisionInput field={field} label={label} help={help} value={value} values={values ?? {}} onValue={onValue} fields={fields ?? []} ctx={ctx} />
    case 'entryRef':
    case 'entryRefs':
    case 'links':
    case 'events':
      return <RelationInput def={def} field={field} label={label} help={help} value={value} onChange={onChange} ctx={ctx} />
    case 'sections':
      return (
        <MultiSelect
          label={label}
          options={ctx.defs.filter((d) => CONTENT_KINDS.includes(d.kind) && d.isActive).map((d) => ({ value: d.key, label: defTitle(d) }))}
          value={Array.isArray(value) ? value : []}
          onChange={(v) => !ctx.readOnly && onChange(v)}
        />
      )
    default:
      input = <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={ctx.readOnly} />
  }
  return (
    <label>
      {label}
      {field.required && <span className="required-mark" aria-hidden="true"> *</span>}
      {input}
      {help && <small className="muted">{help}</small>}
    </label>
  )
}

// Champs des autorités : liens vers les autres éléments de la même étape et
// événements datés. `ctx.siblings` : éléments de l'étape ; `ctx.selfId` :
// l'élément en cours.
const NATURE_OPTIONS = ['Fait vérifié', 'Tradition orale', 'À confirmer']

function RelationInput({ def, field, label, help, value, onChange, ctx }) {
  const others = (ctx.siblings ?? []).filter((e) => e.id !== ctx.selfId)
  const nameOf = (e) => String(e.values?.[ctx.titleField] ?? '').trim() || t('authority.sansNom')
  const rows = Array.isArray(value) ? value : []
  const setRow = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const removeRow = (i) => onChange(rows.filter((_, j) => j !== i))
  const noOthers = !others.length && <small className="muted">{t('authority.ajoutezDAutres')}</small>
  const removeButton = (i) =>
    !ctx.readOnly && (
      <button type="button" className="ghost icon-button" aria-label={t('common.remove')} onClick={() => removeRow(i)}>
        <Trash2 size={16} className="icon" aria-hidden="true" />
      </button>
    )

  if (field.type === 'entryRef') {
    return (
      <label>
        {label}
        <select value={others.some((e) => e.id === value) ? value : ''} onChange={(e) => onChange(e.target.value)} disabled={ctx.readOnly || !others.length}>
          <option value="">—</option>
          {others.map((e) => (
            <option key={e.id} value={e.id}>{nameOf(e)}</option>
          ))}
        </select>
        {noOthers || (help && <small className="muted">{help}</small>)}
      </label>
    )
  }
  if (field.type === 'entryRefs') {
    if (!others.length) {
      return (
        <div className="row-list">
          <span className="small">{label}</span> {noOthers}
        </div>
      )
    }
    return (
      <MultiSelect
        label={label}
        options={others.map((e) => ({ value: e.id, label: nameOf(e) }))}
        value={(Array.isArray(value) ? value : []).filter((id) => others.some((e) => e.id === id))}
        onChange={(v) => !ctx.readOnly && onChange(v)}
      />
    )
  }
  if (field.type === 'links') {
    return (
      <fieldset className="row-list">
        <legend>{label}</legend>
        {rows.map((r, i) => (
          <div key={i} className="row-editor">
            <select aria-label={t('authority.autoriteLiee')} value={r.target ?? ''} onChange={(e) => setRow(i, { target: e.target.value })} disabled={ctx.readOnly}>
              <option value="">{t('authority.autoriteLiee')}</option>
              {others.map((e) => (
                <option key={e.id} value={e.id}>{nameOf(e)}</option>
              ))}
            </select>
            <select aria-label={t('authority.natureDuLien')} value={r.kind ?? ''} onChange={(e) => setRow(i, { kind: e.target.value })} disabled={ctx.readOnly}>
              <option value="">{t('authority.natureDuLien')}</option>
              {(field.options ?? []).map((o) => (
                <option key={o} value={o}>{optionLabel(def, o)}</option>
              ))}
            </select>
            {removeButton(i)}
          </div>
        ))}
        {!ctx.readOnly && (
          <button type="button" className="secondary" disabled={!others.length} onClick={() => onChange([...rows, { target: '', kind: '' }])}>
            <Plus size={16} className="icon" aria-hidden="true" />{t('authority.ajouterUnLien')}</button>
        )}
        {noOthers}
      </fieldset>
    )
  }
  // Événements : titre, date, type, nature et description courte.
  return (
    <fieldset className="row-list">
      <legend>{label}</legend>
      {rows.map((r, i) => (
        <div key={i} className="event-editor">
          <div className="event-editor-head">
            <span>{t('authority.evenementN', { n: i + 1 })}</span>
            {removeButton(i)}
          </div>
          <div className="grid-2">
            <label>{t('authority.evenement')}<input value={r.title ?? ''} onChange={(e) => setRow(i, { title: e.target.value })} disabled={ctx.readOnly} /></label>
            <label>{t('authority.dateOuPeriode')}<input value={r.date ?? ''} placeholder={t('dossier.exempleDate')} onChange={(e) => setRow(i, { date: e.target.value })} disabled={ctx.readOnly} /></label>
          </div>
          <div className="grid-2">
            <label>{t('common.type')}
              <select value={r.type ?? ''} onChange={(e) => setRow(i, { type: e.target.value })} disabled={ctx.readOnly}>
                <option value="">—</option>
                {(field.options ?? []).map((o) => (
                  <option key={o} value={o}>{optionLabel(def, o)}</option>
                ))}
              </select>
            </label>
            <label>{t('authority.natureInformation')}
              <select value={r.nature ?? ''} onChange={(e) => setRow(i, { nature: e.target.value })} disabled={ctx.readOnly}>
                <option value="">—</option>
                {NATURE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{optionLabel(def, o)}</option>
                ))}
              </select>
            </label>
          </div>
          <label>{t('common.description')}<textarea rows={2} value={r.description ?? ''} onChange={(e) => setRow(i, { description: e.target.value })} disabled={ctx.readOnly} /></label>
        </div>
      ))}
      {!ctx.readOnly && (
        <button type="button" className="secondary" onClick={() => onChange([...rows, { title: '', date: '', type: '', nature: '', description: '' }])}>
          <Plus size={16} className="icon" aria-hidden="true" />{t('authority.ajouterUnEvenement')}</button>
      )}
      {help && <small className="muted">{help}</small>}
    </fieldset>
  )
}

// Provinces (une ou plusieurs parmi les 26) et territoires de ces provinces
// (cases à cocher, regroupées par province). Une seule province est
// enregistrée comme un texte, comme avant ; plusieurs, comme une liste.
// Retirer une province demande confirmation avant de décocher ses
// territoires ; un ancien texte libre reste affiché jusqu'à ce que le
// collecteur le remplace.
const provinceValue = (list) => (list.length > 1 ? list.map((p) => p.name) : list[0]?.name ?? '')

function AdminDivisionInput({ field, label, help, value, values, onValue, fields, ctx }) {
  const provinceField = fields.find((f) => f.type === 'province')
  const territoriesField = fields.find((f) => f.type === 'territories')
  const provinces = provincesOf(provinceField ? values[provinceField.key] : '')
  const territories = territoriesField ? values[territoriesField.key] : null
  const checked = Array.isArray(territories) ? territories.filter((x) => String(x).trim()) : []
  const legacy = typeof territories === 'string' && territories.trim() ? territories.trim() : null
  const [query, setQuery] = useState('')

  if (field.type === 'province') {
    const unknown = (Array.isArray(value) ? value : [value]).map((v) => String(v ?? '').trim()).filter((v) => v && !findProvince(v))
    const add = (name) => {
      const next = findProvince(name)
      if (next && !provinces.includes(next)) onValue(field.key, provinceValue([...provinces, next]))
    }
    const remove = async (province) => {
      const lost = checked.filter((name) => province.territories.includes(name))
      // Dernière province retirée : un ancien texte de territoires n'a plus de sens.
      const lostLegacy = provinces.length === 1 && legacy
      if (territoriesField && (lost.length || lostLegacy)) {
        const ok = await ctx.confirm({
          title: t('rdc.retirerProvince', { name: province.name }),
          message: t('rdc.retirerProvinceAide', { list: lost.length ? lost.join(', ') : legacy }),
          confirmLabel: t('rdc.retirerEtDecocher'),
        })
        if (!ok) return
        onValue(territoriesField.key, lostLegacy ? [] : checked.filter((name) => !lost.includes(name)))
      }
      onValue(field.key, provinceValue(provinces.filter((p) => p !== province)))
    }
    return (
      <div className="province-picker">
        <label>
          {label}
          <select value="" onChange={(e) => add(e.target.value)} disabled={ctx.readOnly}>
            <option value="">{provinces.length ? t('rdc.ajouterUneProvince') : t('rdc.choisirUneProvince')}</option>
            {PROVINCES.filter((p) => !provinces.includes(p)).map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </label>
        {provinces.length > 0 && (
          <div className="territory-selected" aria-live="polite">
            {provinces.map((p) => (
              <span key={p.name} className="territory-chip">
                {p.name}
                {!ctx.readOnly && (
                  <button type="button" className="ghost icon-button" aria-label={t('rdc.retirer', { name: p.name })} onClick={() => remove(p)}>
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {unknown.length > 0 && <small className="notice warning">{t('rdc.anciennePrecision', { text: unknown.join(', ') })}</small>}
        {help && <small className="muted">{help}</small>}
      </div>
    )
  }

  const set = (list) => onValue(field.key, list)
  const toggle = async (name, on) => {
    if (legacy) {
      const ok = await ctx.confirm({ title: t('rdc.remplacerSaisie'), message: t('rdc.remplacerSaisieAide', { text: legacy }), confirmLabel: t('rdc.remplacer') })
      if (!ok) return
      return set(on ? [name] : [])
    }
    set(on ? [...checked, name].sort((a, b) => a.localeCompare(b, 'fr')) : checked.filter((x) => x !== name))
  }
  const recognised = legacy ? territoriesInText(provinces, legacy) : []
  const total = provinces.reduce((n, p) => n + p.territories.length, 0)
  const match = (name) => normalizeText(name).includes(normalizeText(query))
  const unitLabel = provinces.length && provinces.every((p) => p.unit === 'commune') ? t('rdc.communes') : label
  return (
    <fieldset className="territory-picker">
      <legend>
        {unitLabel}
        {provinces.length > 0 && <span className="muted small"> — {provinces.map((p) => p.name).join(', ')}</span>}
      </legend>
      {!provinces.length ? (
        <p className="muted small">{t('rdc.choisirDAbord')}</p>
      ) : (
        <>
          {legacy && (
            <div className="notice warning small">
              <p>{t('rdc.saisiePrecedente', { text: legacy })}</p>
              {recognised.length > 0 && !ctx.readOnly && (
                <button type="button" className="secondary" onClick={() => set(recognised)}>{t('rdc.cocherReconnus', { list: recognised.join(', ') })}</button>
              )}
            </div>
          )}
          {checked.length > 0 && (
            <div className="territory-selected" aria-live="polite">
              <span className="small">{t('rdc.nSelectionnes', { n: checked.length })}</span>
              {checked.map((name) => (
                <span key={name} className="territory-chip">
                  {name}
                  {!ctx.readOnly && (
                    <button type="button" className="ghost icon-button" aria-label={t('rdc.retirer', { name })} onClick={() => toggle(name, false)}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {total > 8 && (
            <input type="search" className="territory-search" placeholder={t('rdc.rechercher', { n: total })} aria-label={t('rdc.rechercher', { n: total })} value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          {provinces.map((province) => {
            const options = province.territories.filter(match)
            return (
              <div key={province.name} className="territory-group">
                {provinces.length > 1 && (
                  <p className="small territory-group-title">
                    {province.name}
                    {province.unit === 'commune' && <span className="muted"> — {t('rdc.communes')}</span>}
                  </p>
                )}
                <div className="territory-options">
                  {options.map((name) => (
                    <label key={name} className="checkbox">
                      <input type="checkbox" checked={checked.includes(name)} onChange={(e) => toggle(name, e.target.checked)} disabled={ctx.readOnly} />
                      {name}
                    </label>
                  ))}
                  {options.length === 0 && <span className="muted small">{t('ui.aucunElement')}</span>}
                </div>
              </div>
            )
          })}
        </>
      )}
      {help && provinces.length > 0 && <small className="muted">{help}</small>}
    </fieldset>
  )
}

// Statut d'un champ sans réponse : on ne force jamais à inventer.
export function FieldStatus({ value, onChange, disabled }) {
  return (
    <select className="field-status" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={t('dossier.statutDuChamp')}>
      <option value="">{t('dossier.renseigne')}</option>
      {Object.entries(FIELD_STATUS_LABELS).map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  )
}

// Champs d'une étape ou d'un élément, avec leur statut éventuel.
export function FieldList({ def, fields, values = {}, statuses = {}, onValue, onStatus, ctx, inEntry = false }) {
  return fields.filter((field) => field.type !== 'consent').map((field) => {
    const withStatus = onStatus && ['text', 'longtext', 'list', 'select', 'date', 'province', 'territories'].includes(field.type)
    const status = statuses[field.key]
    return (
      <div key={field.key} className={`dossier-field ${status ? `has-status status-${status.toLowerCase()}` : ''}`}>
        <FieldInput def={def} field={field} value={values[field.key]} onChange={(v) => onValue(field.key, v)} ctx={ctx} inEntry={inEntry} values={values} onValue={onValue} fields={fields} />
        {withStatus && !isFilled(values[field.key]) && <FieldStatus value={status} onChange={(v) => onStatus(field.key, v)} disabled={ctx.readOnly} />}
        {withStatus && isFilled(values[field.key]) && status === 'TO_CONFIRM' && <span className="badge">{FIELD_STATUS_LABELS.TO_CONFIRM}</span>}
        {withStatus && isFilled(values[field.key]) && (
          <label className="checkbox confirm-toggle">
            <input type="checkbox" checked={status === 'TO_CONFIRM'} onChange={(e) => onStatus(field.key, e.target.checked ? 'TO_CONFIRM' : '')} disabled={ctx.readOnly} />
            {t('dossier.aConfirmer')}
          </label>
        )}
      </div>
    )
  })
}

// Médias associés à une étape ou à un élément.
export function MediaRefs({ refs = [], onChange, ctx }) {
  const [adding, setAdding] = useState('')
  const byId = Object.fromEntries(ctx.media.map((m) => [m.id, m]))
  const available = ctx.media.filter((m) => !refs.some((r) => r.mediaId === m.id))
  return (
    <div className="ref-panel">
      {refs.length > 0 && (
        <ul className="media-refs">
          {refs.map((r, i) => {
            const m = byId[r.mediaId]
            return (
              <li key={r.mediaId}>
                {m?.kind === 'PHOTO' || (m?.kind === 'VIDEO' && m.thumbnailFileId) ? (
                  <img src={`/api/admin/media/${r.mediaId}/file?variant=thumbnail`} alt="" className="thumb" loading="lazy" />
                ) : (
                  <span className="thumb placeholder">{m ? MEDIA_KIND_LABELS[m.kind] : '?'}</span>
                )}
                <div>
                  <strong>{m?.title ?? r.mediaId}</strong>
                  <input
                    placeholder={t('itemEditor.legende')}
                    aria-label={t('itemEditor.legende')}
                    value={r.caption ?? ''}
                    onChange={(e) => onChange(refs.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
                    disabled={ctx.readOnly}
                  />
                </div>
                {!ctx.readOnly && (
                  <button type="button" className="ghost icon-button" aria-label={t('common.remove')} onClick={() => onChange(refs.filter((_, j) => j !== i))}>
                    <Trash2 size={16} className="icon" aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!ctx.readOnly && (
        <div className="actions">
          <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label={t('itemEditor.choisirUnMedia')}>
            <option value="">{t('itemEditor.choisirUnMedia')}</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {MEDIA_KIND_LABELS[m.kind]} — {m.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            disabled={!adding}
            onClick={() => {
              onChange([...refs, { mediaId: adding, caption: '' }])
              setAdding('')
            }}
          >
            <Plus size={16} className="icon" aria-hidden="true" />{t('common.add')}</button>
          {ctx.canUpload && (
            <button type="button" className="secondary" onClick={() => ctx.openModal({ kind: 'media', onCreated: (m) => onChange([...refs, { mediaId: m.id, caption: '' }]) })}>
              <Upload size={16} className="icon" aria-hidden="true" />{t('ws.televerserUnFichier')}</button>
          )}
        </div>
      )}
    </div>
  )
}

// Sources associées à une étape ou à un élément.
export function SourceRefs({ refs = [], onChange, ctx }) {
  const set = (i, patch) => onChange(refs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="ref-panel">
      {refs.map((r, i) => (
        <div key={i} className="row-editor">
          <select aria-label={t('itemEditor.source')} value={r.sourceId} onChange={(e) => set(i, { sourceId: e.target.value })} disabled={ctx.readOnly}>
            <option value="">{t('itemEditor.choisirUneSource')}</option>
            {ctx.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <input placeholder={t('itemEditor.ceQueLaSourceEtaye')} aria-label={t('itemEditor.ceQueLaSourceEtaye')} value={r.supports ?? ''} onChange={(e) => set(i, { supports: e.target.value })} disabled={ctx.readOnly} />
          <input placeholder={t('itemEditor.pageMinutage')} aria-label={t('itemEditor.pageOuMinutage')} value={r.locator ?? ''} onChange={(e) => set(i, { locator: e.target.value })} disabled={ctx.readOnly} />
          <select aria-label={t('dossier.relationSource')} value={r.relation ?? 'SUPPORTS'} onChange={(e) => set(i, { relation: e.target.value })} disabled={ctx.readOnly}>
            <option value="SUPPORTS">{t('dossier.etaye')}</option>
            <option value="CONTRADICTS">{t('dossier.contredit')}</option>
          </select>
          {!ctx.readOnly && (
            <button type="button" className="ghost icon-button" aria-label={t('common.remove')} onClick={() => onChange(refs.filter((_, j) => j !== i))}>
              <Trash2 size={16} className="icon" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {!ctx.readOnly && (
        <div className="actions">
          <button type="button" className="secondary" onClick={() => onChange([...refs, { sourceId: '', supports: '', locator: '', relation: 'SUPPORTS' }])}>
            <Plus size={16} className="icon" aria-hidden="true" />{t('ws.associerUneSourceExistante')}</button>
          {ctx.canManageSources && (
            <button
              type="button"
              className="secondary"
              onClick={() => ctx.openModal({ kind: 'source', onCreated: (s) => onChange([...refs.filter((r) => r.sourceId), { sourceId: s.id, supports: '', locator: '', relation: 'SUPPORTS' }]) })}
            >
              <Plus size={16} className="icon" aria-hidden="true" />{t('ws.nouvelleSource')}</button>
          )}
        </div>
      )}
    </div>
  )
}

// Volet repliable « Médias et sources ».
export function Attachments({ part, onPatch, ctx, label }) {
  const media = part.media ?? []
  const sources = (part.sources ?? []).filter((s) => s.sourceId)
  return (
    <details className="attachments" open={media.length + sources.length > 0 || undefined}>
      <summary>
        <ChevronDown size={16} className="icon" aria-hidden="true" />
        {label}
        <span className="tab-count">{media.length}</span>
        <span className="small muted">{t('common.media')}</span>
        <span className="tab-count">{sources.length}</span>
        <span className="small muted">{t('common.sources')}</span>
      </summary>
      <h4>{t('common.media')}</h4>
      <MediaRefs refs={media} onChange={(m) => onPatch({ media: m })} ctx={ctx} />
      <h4>{t('common.sources')}</h4>
      <SourceRefs refs={part.sources ?? []} onChange={(s) => onPatch({ sources: s })} ctx={ctx} />
    </details>
  )
}

// Volet repliable dont l'état d'ouverture appartient à l'utilisateur : il ne
// se referme pas pendant la saisie (par exemple quand l'élément reçoit un nom).
function Disclosure({ initialOpen, className, children }) {
  const [open, setOpen] = useState(Boolean(initialOpen))
  return (
    <details className={className} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {children}
    </details>
  )
}

// Éléments répétables d'une étape (plats, danses, lieux, témoignages…).
export function EntryList({ def, entries = [], onChange, ctx, withAttachments = true }) {
  const entry = def.entry
  const titleOf = (e) => e.values?.[entry.titleField]
  const update = (i, patch) => onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  const move = (i, delta) => {
    const next = [...entries]
    const [moved] = next.splice(i, 1)
    next.splice(i + delta, 0, moved)
    onChange(next)
  }
  const label = tDefEntry(def, 'label', entry.label)
  // Champs essentiels d'abord ; les autres dans des volets repliables.
  const essentials = entry.fields.filter((f) => !f.group)
  const groups = [...new Set(entry.fields.map((f) => f.group).filter(Boolean))]
  // Supprimer un élément retire aussi les liens qui pointent vers lui.
  const REF_TYPES = ['entryRef', 'entryRefs', 'links']
  const refFields = entry.fields.filter((f) => REF_TYPES.includes(f.type))
  const remove = (i) => {
    const gone = entries[i].id
    const strip = (field, v) =>
      field.type === 'entryRef' ? (v === gone ? '' : v) : field.type === 'entryRefs' ? (v ?? []).filter((x) => x !== gone) : (v ?? []).filter((x) => x?.target !== gone)
    onChange(
      entries
        .filter((_, j) => j !== i)
        .map((e) => (refFields.length ? { ...e, values: { ...e.values, ...Object.fromEntries(refFields.filter((f) => e.values?.[f.key] !== undefined).map((f) => [f.key, strip(f, e.values[f.key])])) } } : e)),
    )
  }
  const subtitle = (e) => (def.kind === 'authorities' ? [optionLabel(def, e.values?.type), [e.values?.debut, e.values?.fin].filter(Boolean).join(' – ')].filter(Boolean).join(' · ') : '')
  return (
    <section className="entries">
      <h3>{tDefEntry(def, 'plural', entry.plural || entry.label)}</h3>
      {entries.length === 0 && <p className="muted small">{t('dossier.aucunElement', { label: label.toLowerCase() })}</p>}
      {entries.map((e, i) => (
        <Disclosure key={e.id} className="entry-card" initialOpen={!titleOf(e) || entries.length === 1}>
          <summary>
            <ChevronDown size={16} className="icon" aria-hidden="true" />
            <strong>{titleOf(e) || `${label} ${i + 1}`}</strong>
            {subtitle(e) && <span className="entry-subtitle">{subtitle(e)}</span>}
            {e.sensitive && (
              <span className="badge status-suspended">
                <ShieldAlert size={13} aria-hidden="true" />{t('dossier.sensible')}</span>
            )}
          </summary>
          <div className="entry-body">
            {[null, ...groups].map((group) => {
              const fields = group ? entry.fields.filter((f) => f.group === group) : essentials
              const list = (
                <FieldList
                  def={def}
                  fields={fields}
                  values={e.values}
                  statuses={e.fieldStatus}
                  onValue={(k, v) => update(i, { values: { ...e.values, [k]: v } })}
                  onStatus={(k, v) => update(i, { fieldStatus: { ...(e.fieldStatus ?? {}), [k]: v || undefined } })}
                  ctx={{ ...ctx, siblings: entries, selfId: e.id, titleField: entry.titleField }}
                  inEntry
                />
              )
              if (!group) return <div key="essentials" className="entry-group-body" style={{ padding: 0 }}>{list}</div>
              const filled = fields.filter((f) => isFilled(e.values?.[f.key])).length
              return (
                <Disclosure key={group} className="entry-group" initialOpen={filled > 0}>
                  <summary>
                    <ChevronDown size={16} className="icon" aria-hidden="true" />
                    {tDefEntry(def, `group.${group}`, entry.groups?.[group] ?? group)}
                    <span className="tab-count">{filled}</span>
                    <span className="small muted">{t('authority.facultatif')}</span>
                  </summary>
                  <div className="entry-group-body">{list}</div>
                </Disclosure>
              )
            })}
            <label className="checkbox">
              <input type="checkbox" checked={Boolean(e.sensitive)} onChange={(ev) => update(i, { sensitive: ev.target.checked })} disabled={ctx.readOnly} />
              {t('dossier.elementSensible')}
            </label>
            {withAttachments && <Attachments part={e} onPatch={(patch) => update(i, patch)} ctx={ctx} label={t('dossier.mediasEtSourcesElement')} />}
            {!ctx.readOnly && (
              <div className="actions entry-actions">
                <button type="button" className="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('dossier.monter')}>
                  <ArrowUp size={16} className="icon" aria-hidden="true" />
                </button>
                <button type="button" className="ghost" disabled={i === entries.length - 1} onClick={() => move(i, 1)} aria-label={t('dossier.descendre')}>
                  <ArrowDown size={16} className="icon" aria-hidden="true" />
                </button>
                <button type="button" className="secondary" onClick={() => onChange([...entries.slice(0, i + 1), { ...structuredClone(e), id: newEntryId() }, ...entries.slice(i + 1)])}>
                  <Copy size={16} className="icon" aria-hidden="true" />{t('dossier.dupliquer')}</button>
                <button type="button" className="secondary danger" onClick={() => ctx.confirmRemove(() => remove(i))}>
                  <Trash2 size={16} className="icon" aria-hidden="true" />{t('common.delete')}</button>
              </div>
            )}
          </div>
        </Disclosure>
      ))}
      {!ctx.readOnly && (
        <button type="button" className="secondary" onClick={() => onChange([...entries, { id: newEntryId(), values: {}, fieldStatus: {}, media: [], sources: [] }])}>
          <Plus size={16} className="icon" aria-hidden="true" />{t('dossier.ajouterUn', { label: label.toLowerCase() })}</button>
      )}
    </section>
  )
}

// Libellés des éléments répétables (traduits si possible).
const tDefEntry = (def, key, fallback) => tDef(def, `entry.${key}`, fallback)
