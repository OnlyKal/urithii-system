import { CalendarRange, ChevronRight, ChevronsDownUp, ChevronsUpDown, ExternalLink, Flag, ListTree, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import Prose from './Prose.jsx'
import { getLanguage, t } from '../i18n/index.js'
import SECTION_TRANSLATIONS from '../i18n/sections.js'

// Autorités et dynasties d'une communauté : arbre des lignées et des
// successions, frise des règnes et fiche détaillée. Les mêmes composants
// servent au site public (fiches publiées) et à l'aperçu du collecteur
// (éléments du dossier, voir authoritiesFromEntries).

// Valeurs enregistrées en français (options du formulaire), traduites si
// possible.
const tValue = (value) => (value ? SECTION_TRANSLATIONS[getLanguage()]?.[value] ?? value : value)

export const NATURES = {
  'Fait vérifié': 'verified',
  'Tradition orale': 'oral',
  'À confirmer': 'confirm',
}
const natureClass = (nature) => NATURES[nature] ?? 'unknown'
const natureLabel = (nature) => t(`authority.nature.${natureClass(nature)}`)

// Année lisible dans une date libre (« vers 1850 », « 1885 », « 1850 ? »).
const APPROX = /vers|env|circa|\bc\.|~|\?|approx|début|fin |milieu|avant|après|around|about|karibu|pene/i
export function parseYear(text) {
  if (!text) return null
  const m = String(text).match(/(?:^|\D)(\d{3,4})(?!\d)/)
  if (!m) return null
  return { year: Number(m[1]), approx: APPROX.test(String(text)) }
}

export function periodLabel(a) {
  if (!a.start && !a.end) return null
  return `${a.start || '?'} – ${a.end || '?'}`
}

// Éléments d'un dossier de collecte → autorités (aperçu du collecteur).
export function authoritiesFromEntries(entries = []) {
  const str = (v) => String(v ?? '').trim()
  return entries
    .filter((e) => str(e.values?.nom))
    .map((e, i) => {
      const v = e.values ?? {}
      return {
        slug: e.id,
        name: str(v.nom),
        title: str(v.titre) || null,
        type: str(v.type) || null,
        lineage: str(v.lignee) || null,
        start: str(v.debut) || null,
        end: str(v.fin) || null,
        nature: str(v.nature) || null,
        order: i,
        predecessor: str(v.predecesseur) || null,
        parents: Array.isArray(v.parents) ? v.parents : [],
        links: (Array.isArray(v.liens) ? v.liens : []).filter((l) => l?.target).map((l) => ({ slug: l.target, kind: l.kind || null })),
        events: (Array.isArray(v.evenements) ? v.evenements : []).filter((ev) => str(ev?.title)),
        otherNames: (Array.isArray(v.autresNoms) ? v.autresNoms : []).map(str).filter(Boolean),
        biography: str(v.biographie) || null,
        accession: str(v.accession) || null,
        achievements: str(v.realisations) || null,
        impact: str(v.impact) || null,
        relations: str(v.relationsExterieures) || null,
        legacy: str(v.heritage) || null,
        toConfirm: Object.entries(e.fieldStatus ?? {}).filter(([, s]) => s === 'TO_CONFIRM').map(([k]) => k),
        media: [],
        sources: [],
      }
    })
}

// Relations calculées : parent dans l'arbre (premier parent connu), enfants,
// successeurs, liens réciproques.
function buildModel(authorities) {
  const bySlug = new Map(authorities.map((a) => [a.slug, a]))
  const sortKey = (a) => [parseYear(a.start)?.year ?? parseYear(a.end)?.year ?? Infinity, a.order ?? 0]
  const compare = (x, y) => {
    const [a1, b1] = sortKey(x)
    const [a2, b2] = sortKey(y)
    return a1 - a2 || b1 - b2
  }
  const parentOf = new Map()
  const children = new Map()
  const successors = new Map()
  const linked = new Map()
  for (const a of authorities) {
    const parent = a.parents.find((p) => p !== a.slug && bySlug.has(p))
    if (parent) parentOf.set(a.slug, parent)
    if (a.predecessor && bySlug.has(a.predecessor) && a.predecessor !== a.slug) {
      successors.set(a.predecessor, [...(successors.get(a.predecessor) ?? []), a.slug])
    }
    for (const l of a.links) {
      if (!bySlug.has(l.slug) || l.slug === a.slug) continue
      linked.set(l.slug, [...(linked.get(l.slug) ?? []), { slug: a.slug, kind: l.kind }])
    }
  }
  // Un cycle dans les parents (saisie erronée) ne doit pas bloquer l'arbre.
  for (const slug of parentOf.keys()) {
    const seen = new Set([slug])
    let p = parentOf.get(slug)
    while (p) {
      if (seen.has(p)) {
        parentOf.delete(slug)
        break
      }
      seen.add(p)
      p = parentOf.get(p)
    }
  }
  for (const [child, parent] of parentOf) children.set(parent, [...(children.get(parent) ?? []), child])
  for (const list of children.values()) list.sort((x, y) => compare(bySlug.get(x), bySlug.get(y)))
  const lineages = []
  for (const a of [...authorities].sort(compare)) {
    const key = a.lineage ?? ''
    if (!lineages.includes(key)) lineages.push(key)
  }
  return { bySlug, parentOf, children, successors, linked, compare, lineages }
}

function ancestors(model, slug) {
  const list = []
  let p = model.parentOf.get(slug)
  while (p) {
    list.unshift(p)
    p = model.parentOf.get(p)
  }
  return list
}

const lineageLabel = (key) => key || t('authority.sansLignee')

// ---------------------------------------------------------------------------
// Explorateur : barre d'outils, arbre ou frise, fiche détaillée.
// ---------------------------------------------------------------------------

export default function AuthorityExplorer({ authorities, overview, initialSlug, linkItems = false, compact = false }) {
  const model = useMemo(() => buildModel(authorities), [authorities])
  const [view, setView] = useState('tree')
  const [lineage, setLineage] = useState('*')
  const [selected, setSelected] = useState(null)
  const [expanded, setExpanded] = useState(() => defaultExpanded(model))
  const nodeRefs = useRef(new Map())
  const sectionRef = useRef(null)

  const visibleSet = useMemo(
    () => authorities.filter((a) => lineage === '*' || (a.lineage ?? '') === lineage),
    [authorities, lineage],
  )

  // Affiche une autorité dans l'arbre : lignée, branches parentes ouvertes.
  const reveal = useCallback(
    (slug, { scroll = true } = {}) => {
      const a = model.bySlug.get(slug)
      if (!a) return
      setSelected(slug)
      if (lineage !== '*' && (a.lineage ?? '') !== lineage) setLineage('*')
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(`l:${a.lineage ?? ''}`)
        for (const p of ancestors(model, slug)) {
          next.add(p)
          next.add(`l:${model.bySlug.get(p)?.lineage ?? ''}`)
        }
        return next
      })
      if (scroll) requestAnimationFrame(() => nodeRefs.current.get(slug)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    },
    [model, lineage],
  )

  // Lien direct vers une autorité (?autorite=…), depuis sa fiche.
  useEffect(() => {
    if (!initialSlug || !model.bySlug.has(initialSlug)) return
    reveal(initialSlug, { scroll: false })
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ block: 'start' }))
    // Seulement à l'arrivée sur la page.
  }, [initialSlug, model])

  // Fermeture de la fiche (mobile) : retour à l'autorité dans l'arbre.
  const close = () => {
    const slug = selected
    setSelected(null)
    if (slug) requestAnimationFrame(() => nodeRefs.current.get(slug)?.focus({ preventScroll: false }))
  }

  useEffect(() => {
    if (!selected) return
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const current = selected ? model.bySlug.get(selected) : null
  const multiLineage = model.lineages.length > 1
  const allKeys = () => new Set([...model.lineages.map((l) => `l:${l}`), ...model.children.keys()])

  return (
    <div className={`authority-explorer ${compact ? 'is-compact' : ''}`} ref={sectionRef}>
      {overview && (overview.organisation || overview.summary) && (
        <p className="authority-intro">
          {overview.organisation && <span className="chip">{tValue(overview.organisation)}</span>}
          {overview.summary && <span className="muted">{overview.summary}</span>}
          {linkItems && overview.slug && (
            <Link to={`/contenus/${overview.slug}`} className="small">{t('authority.lirePresentation')}</Link>
          )}
        </p>
      )}

      <div className="authority-toolbar">
        <div className="at-switch" role="group" aria-label={t('authority.affichage')}>
          <button type="button" className={view === 'tree' ? 'is-active' : ''} aria-pressed={view === 'tree'} onClick={() => setView('tree')}>
            <ListTree size={16} className="icon" aria-hidden="true" />{t('authority.arbre')}</button>
          <button type="button" className={view === 'timeline' ? 'is-active' : ''} aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}>
            <CalendarRange size={16} className="icon" aria-hidden="true" />{t('authority.frise')}</button>
        </div>
        {multiLineage && (
          <label className="authority-lineage">
            <span className="visually-hidden">{t('authority.lignee')}</span>
            <select value={lineage} onChange={(e) => setLineage(e.target.value)}>
              <option value="*">{t('authority.toutesLesLignees', { n: model.lineages.length })}</option>
              {model.lineages.map((l) => (
                <option key={l} value={l}>{lineageLabel(l)}</option>
              ))}
            </select>
          </label>
        )}
        {view === 'tree' && model.children.size > 0 && (
          <div className="authority-tools">
            <button type="button" className="ghost small" onClick={() => setExpanded(allKeys())}>
              <ChevronsUpDown size={15} className="icon" aria-hidden="true" />{t('authority.toutDevelopper')}</button>
            <button type="button" className="ghost small" onClick={() => setExpanded(new Set(model.lineages.map((l) => `l:${l}`)))}>
              <ChevronsDownUp size={15} className="icon" aria-hidden="true" />{t('authority.toutReduire')}</button>
          </div>
        )}
      </div>

      <ul className="authority-legend" aria-label={t('authority.legende')}>
        {['verified', 'oral', 'confirm'].map((k) => (
          <li key={k}><i className={`nature-dot nature-${k}`} aria-hidden="true" />{t(`authority.nature.${k}`)}</li>
        ))}
      </ul>

      <div className={`authority-layout ${current ? 'has-detail' : ''}`}>
        <div className="authority-main">
          {view === 'tree' ? (
            <AuthorityTreeView
              model={model}
              authorities={visibleSet}
              grouped={lineage === '*' && multiLineage}
              expanded={expanded}
              setExpanded={setExpanded}
              selected={selected}
              onSelect={setSelected}
              nodeRefs={nodeRefs}
            />
          ) : (
            <AuthorityTimeline model={model} authorities={visibleSet} grouped={lineage === '*' && multiLineage} selected={selected} onSelect={setSelected} />
          )}
        </div>
        {current ? (
          <>
            <button type="button" className="authority-backdrop" aria-label={t('common.close')} onClick={close} tabIndex={-1} />
            <AuthorityDetail key={current.slug} authority={current} model={model} onSelect={(slug) => reveal(slug)} onClose={close} linkItems={linkItems} />
          </>
        ) : (
          <aside className="authority-detail is-empty">
            <p className="muted small">{t('authority.choisirUneAutorite')}</p>
          </aside>
        )}
      </div>
    </div>
  )
}

// Lignées ouvertes et deux premières générations visibles.
function defaultExpanded(model) {
  const open = new Set(model.lineages.map((l) => `l:${l}`))
  for (const [slug] of model.children) if (!model.parentOf.has(slug)) open.add(slug)
  return open
}

// ---------------------------------------------------------------------------
// Arbre (motif ARIA « tree » : flèches, Entrée, Début, Fin).
// ---------------------------------------------------------------------------

function AuthorityTreeView({ model, authorities, grouped, expanded, setExpanded, selected, onSelect, nodeRefs }) {
  const inSet = useMemo(() => new Set(authorities.map((a) => a.slug)), [authorities])
  const kids = (slug) => (model.children.get(slug) ?? []).filter((c) => inSet.has(c))
  const roots = authorities.filter((a) => !inSet.has(model.parentOf.get(a.slug))).sort(model.compare)
  const [focusKey, setFocusKey] = useState(null)

  // Ordre des nœuds visibles, pour la navigation au clavier.
  const visible = []
  const walk = (slug, parentKey, level) => {
    visible.push({ key: slug, parentKey, level, hasKids: kids(slug).length > 0 })
    if (expanded.has(slug)) for (const c of kids(slug)) walk(c, slug, level + 1)
  }
  const groups = grouped ? model.lineages.map((l) => ({ key: `l:${l}`, lineage: l, roots: roots.filter((a) => (a.lineage ?? '') === l) })).filter((g) => g.roots.length) : null
  if (groups) {
    for (const g of groups) {
      visible.push({ key: g.key, parentKey: null, level: 1, hasKids: true })
      if (expanded.has(g.key)) for (const r of g.roots) walk(r.slug, g.key, 2)
    }
  } else {
    for (const r of roots) walk(r.slug, null, 1)
  }
  const active = visible.some((v) => v.key === focusKey) ? focusKey : visible.find((v) => v.key === selected)?.key ?? visible[0]?.key

  const toggle = (key, open) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (open ?? !next.has(key)) next.add(key)
      else next.delete(key)
      return next
    })
  const focus = (key) => {
    setFocusKey(key)
    nodeRefs.current.get(key)?.focus()
  }

  function onKeyDown(e) {
    const i = visible.findIndex((v) => v.key === active)
    if (i < 0) return
    const node = visible[i]
    const isGroup = node.key.startsWith('l:')
    const handled = {
      ArrowDown: () => visible[i + 1] && focus(visible[i + 1].key),
      ArrowUp: () => visible[i - 1] && focus(visible[i - 1].key),
      Home: () => focus(visible[0].key),
      End: () => focus(visible[visible.length - 1].key),
      ArrowRight: () => {
        if (!node.hasKids) return
        if (!expanded.has(node.key)) toggle(node.key, true)
        else if (visible[i + 1]?.parentKey === node.key) focus(visible[i + 1].key)
      },
      ArrowLeft: () => {
        if (node.hasKids && expanded.has(node.key)) toggle(node.key, false)
        else if (node.parentKey) focus(node.parentKey)
      },
      Enter: () => (isGroup ? toggle(node.key) : onSelect(node.key)),
      ' ': () => (isGroup ? toggle(node.key) : onSelect(node.key)),
    }[e.key]
    if (!handled) return
    e.preventDefault()
    handled()
  }

  const common = { model, kids, expanded, toggle, selected, onSelect, active, setFocusKey, nodeRefs }
  if (!authorities.length) return <p className="muted">{t('authority.aucuneAutorite')}</p>
  return (
    <ul className="authority-tree" role="tree" aria-label={t('authority.arbreDesAutorites')} onKeyDown={onKeyDown}>
      {groups
        ? groups.map((g) => (
            <li
              key={g.key}
              role="treeitem"
              aria-expanded={expanded.has(g.key)}
              aria-level={1}
              aria-selected={false}
              tabIndex={active === g.key ? 0 : -1}
              ref={(el) => (el ? nodeRefs.current.set(g.key, el) : nodeRefs.current.delete(g.key))}
              onFocus={(e) => e.target === e.currentTarget && setFocusKey(g.key)}
              className="at-item at-lineage"
            >
              <div className="at-row" onClick={() => toggle(g.key)}>
                <ChevronRight size={16} className={`at-chevron ${expanded.has(g.key) ? 'is-open' : ''}`} aria-hidden="true" />
                <strong>{lineageLabel(g.lineage)}</strong>
                <span className="tab-count">{authorities.filter((a) => (a.lineage ?? '') === g.lineage).length}</span>
              </div>
              {expanded.has(g.key) && (
                <ul role="group">
                  {g.roots.map((a) => (
                    <TreeNode key={a.slug} authority={a} level={2} groupLineage={g.lineage} {...common} />
                  ))}
                </ul>
              )}
            </li>
          ))
        : roots.map((a) => <TreeNode key={a.slug} authority={a} level={1} groupLineage={null} {...common} />)}
    </ul>
  )
}

function TreeNode({ authority: a, level, groupLineage, model, kids, expanded, toggle, selected, onSelect, active, setFocusKey, nodeRefs }) {
  const children = kids(a.slug)
  const open = expanded.has(a.slug)
  const predecessor = a.predecessor && model.bySlug.get(a.predecessor)
  const parent = model.bySlug.get(model.parentOf.get(a.slug))
  const showPredecessor = predecessor && predecessor.slug !== parent?.slug
  const period = periodLabel(a)
  const otherLineage = groupLineage !== null && a.lineage && a.lineage !== groupLineage
  return (
    <li
      role="treeitem"
      aria-level={level}
      aria-selected={selected === a.slug}
      aria-expanded={children.length ? open : undefined}
      tabIndex={active === a.slug ? 0 : -1}
      ref={(el) => (el ? nodeRefs.current.set(a.slug, el) : nodeRefs.current.delete(a.slug))}
      onFocus={(e) => e.target === e.currentTarget && setFocusKey(a.slug)}
      className="at-item"
    >
      <div className={`at-row ${selected === a.slug ? 'is-selected' : ''}`} onClick={() => (onSelect(a.slug), setFocusKey(a.slug))}>
        {children.length ? (
          <span
            className="at-toggle"
            onClick={(e) => {
              e.stopPropagation()
              toggle(a.slug)
            }}
            title={open ? t('authority.reduire') : t('authority.developper')}
          >
            <ChevronRight size={16} className={`at-chevron ${open ? 'is-open' : ''}`} aria-hidden="true" />
          </span>
        ) : (
          <span className="at-toggle is-leaf" aria-hidden="true" />
        )}
        <i className={`nature-dot nature-${natureClass(a.nature)}`} title={natureLabel(a.nature)} aria-hidden="true" />
        <span className="at-text">
          <span className="at-name">
            {a.name}
            {a.title && <span className="at-title"> · {a.title}</span>}
          </span>
          <span className="at-meta">
            {[tValue(a.type), period, otherLineage ? a.lineage : null].filter(Boolean).join(' · ')}
            {showPredecessor && <span className="at-succession">{t('authority.succedeA', { name: predecessor.name })}</span>}
          </span>
        </span>
        <span className="visually-hidden">{natureLabel(a.nature)}</span>
        {a.events.length > 0 && (
          <span className="at-events" title={t('authority.nEvenements', { n: a.events.length })}>
            <Flag size={13} aria-hidden="true" />{a.events.length}
          </span>
        )}
        {children.length > 0 && !open && <span className="at-hidden-count">+{children.length}</span>}
      </div>
      {children.length > 0 && open && (
        <ul role="group">
          {children.map((slug) => (
            <TreeNode
              key={slug}
              authority={model.bySlug.get(slug)}
              level={level + 1}
              groupLineage={groupLineage}
              {...{ model, kids, expanded, toggle, selected, onSelect, active, setFocusKey, nodeRefs }}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Frise chronologique des règnes et des événements.
// ---------------------------------------------------------------------------

function niceStep(span) {
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]) if (span / step <= 6) return step
  return 1000
}

function AuthorityTimeline({ model, authorities, grouped, selected, onSelect }) {
  const rows = []
  const undated = []
  for (const a of [...authorities].sort(model.compare)) {
    const s = parseYear(a.start)
    const e = parseYear(a.end)
    if (!s && !e) {
      undated.push(a)
      continue
    }
    const events = a.events.map((ev) => ({ ...ev, y: parseYear(ev.date) })).filter((ev) => ev.y)
    rows.push({ a, from: (s ?? e).year, to: (e ?? s).year, approx: Boolean(s?.approx || e?.approx), openEnd: !e, openStart: !s, events })
  }
  if (!rows.length) {
    return (
      <div className="authority-timeline">
        <p className="muted">{t('authority.aucuneDate')}</p>
        <Undated list={undated} onSelect={onSelect} />
      </div>
    )
  }
  const years = rows.flatMap((r) => [r.from, r.to, ...r.events.map((ev) => ev.y.year)])
  let min = Math.min(...years)
  let max = Math.max(...years)
  if (max - min < 10) {
    min -= 5
    max += 5
  }
  const step = niceStep(max - min)
  min = Math.floor(min / step) * step
  max = Math.ceil(max / step) * step
  const pos = (y) => ((y - min) / (max - min)) * 100
  const ticks = []
  for (let y = min; y <= max; y += step) ticks.push(y)

  const sections = grouped ? model.lineages.map((l) => ({ l, rows: rows.filter((r) => (r.a.lineage ?? '') === l) })).filter((g) => g.rows.length) : [{ l: null, rows }]
  return (
    <div className="authority-timeline">
      <div className="tl-axis" aria-hidden="true">
        <span />
        <span className="tl-track">
          {ticks.map((y) => (
            <span key={y} className="tl-tick" style={{ left: `${pos(y)}%` }}>{y}</span>
          ))}
        </span>
      </div>
      {sections.map((g) => (
        <div key={g.l ?? 'all'} className="tl-group">
          {g.l !== null && <p className="tl-group-title">{lineageLabel(g.l)}</p>}
          {g.rows.map((r) => (
            <button
              key={r.a.slug}
              type="button"
              className={`tl-row ${selected === r.a.slug ? 'is-selected' : ''}`}
              onClick={() => onSelect(r.a.slug)}
              aria-pressed={selected === r.a.slug}
            >
              <span className="tl-label">
                <strong>{r.a.name}</strong>
                <span className="muted small">{periodLabel(r.a)}</span>
              </span>
              <span className="tl-track">
                {ticks.map((y) => (
                  <span key={y} className="tl-grid" style={{ left: `${pos(y)}%` }} aria-hidden="true" />
                ))}
                <span
                  className={`tl-bar nature-${natureClass(r.a.nature)} ${r.approx ? 'is-approx' : ''} ${r.openEnd ? 'open-end' : ''} ${r.openStart ? 'open-start' : ''}`}
                  style={{ left: `${pos(r.from)}%`, width: `max(8px, ${pos(r.to) - pos(r.from)}%)` }}
                  title={`${r.a.name} — ${periodLabel(r.a)}${r.approx ? ` (${t('authority.approximatif')})` : ''}`}
                />
                {r.events.map((ev, i) => (
                  <span key={i} className="tl-event" style={{ left: `${pos(ev.y.year)}%` }} title={`${ev.date} — ${ev.title}`} aria-hidden="true" />
                ))}
              </span>
            </button>
          ))}
        </div>
      ))}
      <p className="tl-note small muted">
        <span className="tl-bar-sample is-approx" aria-hidden="true" />{t('authority.dateApproximative')}
        <span className="tl-event-sample" aria-hidden="true" />{t('authority.evenement')}
      </p>
      <Undated list={undated} onSelect={onSelect} />
    </div>
  )
}

function Undated({ list, onSelect }) {
  if (!list.length) return null
  return (
    <div className="tl-undated">
      <p className="small muted">{t('authority.sansDates', { n: list.length })}</p>
      <div className="chip-list">
        {list.map((a) => (
          <button key={a.slug} type="button" className="chip" onClick={() => onSelect(a.slug)}>{a.name}</button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fiche détaillée d'une autorité.
// ---------------------------------------------------------------------------

const TEXT_SECTIONS = [
  ['biography', 'biographie'],
  ['accession', 'accession'],
  ['achievements', 'realisations'],
  ['impact', 'impact'],
  ['relations', 'relationsExterieures'],
  ['legacy', 'heritage'],
]

function AuthorityDetail({ authority: a, model, onSelect, onClose, linkItems }) {
  const ref = useRef(null)
  useEffect(() => {
    // Sur mobile, la fiche s'ouvre par-dessus l'arbre : le focus y entre.
    if (window.matchMedia('(max-width: 900px)').matches) ref.current?.focus()
  }, [])
  const person = (slug) => model.bySlug.get(slug)
  const relation = (key, slug, kind) => {
    const p = person(slug)
    if (!p) return null
    return (
      <li key={key}>
        <button type="button" className="link-button" onClick={() => onSelect(slug)}>{p.name}</button>
        {kind && <span className="muted small"> — {kind}</span>}
        {periodLabel(p) && <span className="muted small"> ({periodLabel(p)})</span>}
      </li>
    )
  }
  const parents = a.parents.filter(person)
  const children = model.children.get(a.slug) ?? []
  const successors = model.successors.get(a.slug) ?? []
  const links = [...a.links.filter((l) => person(l.slug)), ...(model.linked.get(a.slug) ?? []).filter((l) => !a.links.some((x) => x.slug === l.slug))]
  // Une même autorité peut être à la fois parent et prédécesseur : une seule ligne.
  const related = new Map()
  const relate = (slug, kind) => person(slug) && related.set(slug, [...new Set([...(related.get(slug) ?? []), kind])])
  parents.forEach((slug) => relate(slug, t('authority.parent')))
  if (a.predecessor) relate(a.predecessor, t('authority.predecesseur'))
  successors.forEach((slug) => relate(slug, t('authority.successeur')))
  children.forEach((slug) => relate(slug, t('authority.enfant')))
  links.forEach((l) => relate(l.slug, tValue(l.kind) ?? t('authority.lien')))
  const confirm = (key) => a.toConfirm.includes(key) && <span className="badge badge-confirm">{t('authority.nature.confirm')}</span>
  const s = parseYear(a.start)
  const e = parseYear(a.end)
  const photos = a.media.filter((m) => m.thumbnailUrl)
  const others = a.media.filter((m) => !m.thumbnailUrl)

  return (
    <aside className="authority-detail is-open" ref={ref} tabIndex={-1} aria-labelledby={`authority-${a.slug}`}>
      <header className="ad-head">
        <div>
          {a.type && <p className="eyebrow">{tValue(a.type)}</p>}
          <h3 id={`authority-${a.slug}`}>{a.name}</h3>
          {a.title && <p className="ad-title">{a.title}</p>}
        </div>
        <button type="button" className="ghost icon-button" onClick={onClose} aria-label={t('common.close')}>
          <X size={18} className="icon" aria-hidden="true" />
        </button>
      </header>

      <div className="ad-tags">
        <span className={`nature-tag nature-${natureClass(a.nature)}`}>{natureLabel(a.nature)}</span>
        {a.lineage && <span className="chip">{a.lineage}</span>}
      </div>

      <dl className="ad-facts">
        <div>
          <dt>{t('authority.periode')}</dt>
          <dd>
            {periodLabel(a) ?? t('authority.inconnue')}
            {(s?.approx || e?.approx) && <span className="muted small"> · {t('authority.approximatif')}</span>}
            {(a.toConfirm.includes('debut') || a.toConfirm.includes('fin')) && <> {confirm('debut') || confirm('fin')}</>}
          </dd>
        </div>
        {a.otherNames.length > 0 && (
          <div>
            <dt>{t('authority.autresNoms')}</dt>
            <dd>{a.otherNames.join(', ')}</dd>
          </div>
        )}
      </dl>

      {related.size > 0 && (
        <section className="ad-relations">
          <h4>{t('authority.liens')}</h4>
          <ul className="plain-list">
            {[...related].map(([slug, kinds]) => relation(slug, slug, kinds.join(', ')))}
          </ul>
        </section>
      )}

      {TEXT_SECTIONS.filter(([k]) => a[k]).map(([k, field]) => (
        <section key={k}>
          <h4>{t(`authority.champ.${k}`)} {confirm(field)}</h4>
          <Prose text={a[k]} />
        </section>
      ))}

      {a.events.length > 0 && (
        <section>
          <h4>{t('authority.evenementsMarquants')} {confirm('evenements')}</h4>
          <ol className="ad-events">
            {a.events.map((ev, i) => (
              <li key={i}>
                <span className="ad-event-date">{ev.date || '—'}</span>
                <div>
                  <strong>{ev.title}</strong>
                  <span className="muted small">
                    {[tValue(ev.type), ev.nature && ev.nature !== 'Fait vérifié' ? natureLabel(ev.nature) : null].filter(Boolean).join(' · ')}
                  </span>
                  {ev.description && <p className="small">{ev.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {a.media.length > 0 && (
        <section>
          <h4>{t('common.media')}</h4>
          {photos.length > 0 && (
            <div className="ad-photos">
              {photos.map((m) => (
                <Link key={m.id} to={`/mediatheque/${m.id}`} title={m.caption || m.title}>
                  <img src={m.thumbnailUrl} alt={m.caption || m.title} loading="lazy" />
                </Link>
              ))}
            </div>
          )}
          {others.length > 0 && (
            <ul className="plain-list small">
              {others.map((m) => (
                <li key={m.id}><Link to={`/mediatheque/${m.id}`}>{m.title}</Link></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {a.sources.length > 0 && (
        <section>
          <h4>{t('common.sources')}</h4>
          <ul className="plain-list small">
            {a.sources.map((src, i) => (
              <li key={i}>
                {src.url ? <a href={src.url} target="_blank" rel="noreferrer">{src.title}</a> : src.title}
                {(src.author || src.date) && <span className="muted"> — {[src.author, src.date].filter(Boolean).join(', ')}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {linkItems && (
        <Link to={`/contenus/${a.slug}`} className="ad-more">
          {t('authority.voirLaFiche')}<ExternalLink size={14} className="icon" aria-hidden="true" />
        </Link>
      )}
    </aside>
  )
}
