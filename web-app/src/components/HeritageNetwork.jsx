import { ArrowRight, BookOpen, Info, Languages, Link2, MapPin, MousePointerClick, Share2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { t, tn } from '../i18n/index.js'
import { DOC_STATUS_LABELS, RELATION_LABELS } from '../labels.js'
import { useApi } from './ui.jsx'

// Réseau du patrimoine (accueil) : les communautés publiées et les liens
// documentés entre elles. Chaque lien affiché provient des données publiques
// d'URITHI (voir GET /api/public/network) ; rien n'est déduit ici.

// Types de liens, du plus fort au plus faible. Le voisinage géographique n'est
// pas une ressemblance culturelle : il est présenté comme tel.
const TYPES = [
  { key: 'relations', label: t('network.typeRelations'), help: t('network.typeRelationsAide'), icon: Link2, weight: 3 },
  { key: 'sharedItems', label: t('network.typePartage'), help: t('network.typePartageAide'), icon: Share2, weight: 3 },
  { key: 'languages', label: t('network.typeLangue'), help: t('network.typeLangueAide'), icon: Languages, weight: 2 },
  { key: 'provinces', label: t('network.typeProvince'), help: t('network.typeProvinceAide'), icon: MapPin, weight: 0.5 },
]
const TYPE_BY_KEY = Object.fromEntries(TYPES.map((x) => [x.key, x]))
const MAX_DUST = 240

const linkKey = (l) => `${l.source}|${l.target}`
const evidenceCount = (l, types) => types.reduce((n, k) => n + l[k].length, 0)

// Générateur pseudo-aléatoire déterministe : la constellation garde la même
// forme d'une visite à l'autre.
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (text) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0

const radiusFor = (count, scale) => (20 + Math.sqrt(Math.min(count, 60)) * 5) * scale

function arcPath(r, a0, a1) {
  const x0 = Math.cos(a0) * r
  const y0 = Math.sin(a0) * r
  const x1 = Math.cos(a1) * r
  const y1 = Math.sin(a1) * r
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// Un pas de la simulation : répulsion, collisions, liens élastiques et
// rappel vers le centre. Quelques dizaines de nœuds : le calcul direct suffit.
function step(state, links, w, h) {
  const nodes = [...state.nodes.values()]
  const a = state.alpha
  const k = Math.min(300 * state.scale * state.scale, (w * h) / (Math.max(nodes.length, 1) * 30))
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i]
    for (let j = i + 1; j < nodes.length; j++) {
      const q = nodes[j]
      let dx = q.x - p.x
      let dy = q.y - p.y
      let d = Math.hypot(dx, dy)
      if (d < 0.01) {
        dx = 0.5 - Math.random()
        dy = 0.5 - Math.random()
        d = Math.hypot(dx, dy)
      }
      const push = (k * a) / d
      const min = p.r + q.r + 30 * state.scale
      const overlap = d < min ? (min - d) * 0.25 : 0
      const fx = (dx / d) * (push + overlap)
      const fy = (dy / d) * (push + overlap)
      p.vx -= fx
      p.vy -= fy
      q.vx += fx
      q.vy += fy
    }
  }
  for (const l of links) {
    const p = state.nodes.get(l.source)
    const q = state.nodes.get(l.target)
    if (!p || !q) continue
    const dx = q.x - p.x
    const dy = q.y - p.y
    const d = Math.hypot(dx, dy) || 1
    const target = p.r + q.r + 120 * state.scale
    const f = ((d - target) / d) * 0.03 * Math.min(l.weight, 4) * a
    p.vx += dx * f
    p.vy += dy * f
    q.vx -= dx * f
    q.vy -= dy * f
  }
  for (const n of nodes) {
    if (n.fx != null) {
      n.x = n.fx
      n.y = n.fy
      n.vx = n.vy = 0
      continue
    }
    n.vx += (w / 2 - n.x) * 0.02 * a
    n.vy += (h / 2 - n.y) * 0.03 * a
    n.vx *= 0.55
    n.vy *= 0.55
    n.x = Math.min(w - n.r - 8, Math.max(n.r + 8, n.x + n.vx))
    n.y = Math.min(h - n.r - 30 * state.scale, Math.max(n.r + 8, n.y + n.vy))
  }
  state.alpha *= 0.985
}

export function HeritageNetwork() {
  const { data, error } = useApi('/public/network')
  if (error) return null
  if (!data) return <div className="hnet-skeleton" aria-busy="true" aria-label={t('network.chargement')} />
  return <NetworkView data={data} />
}

function NetworkView({ data }) {
  const { communities, links, domains, totals } = data
  const reduced = useReducedMotion()
  const [active, setActive] = useState(() => new Set(TYPES.map((x) => x.key)))
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [size, setSize] = useState({ w: 800, h: 520 })

  const stageRef = useRef(null)
  const svgRef = useRef(null)
  const panelRef = useRef(null)
  const nodeEls = useRef(new Map())
  const linkEls = useRef(new Map())
  const sim = useRef({ nodes: new Map(), alpha: 1, scale: 1 })
  const linksRef = useRef([])
  const wakeRef = useRef(() => {})
  const drawRef = useRef(() => {})
  const drag = useRef(null)
  const suppressClick = useRef(false)

  const bySlug = useMemo(() => new Map(communities.map((c) => [c.slug, c])), [communities])
  const domainName = useMemo(() => new Map(domains.map((d) => [d.slug, d.name])), [domains])
  const counts = useMemo(() => Object.fromEntries(TYPES.map((x) => [x.key, links.filter((l) => l[x.key].length).length])), [links])

  const visibleLinks = useMemo(
    () =>
      links
        .map((l) => {
          const types = TYPES.filter((x) => active.has(x.key) && l[x.key].length).map((x) => x.key)
          if (!types.length) return null
          return { ...l, key: linkKey(l), types, main: types[0], count: evidenceCount(l, types), weight: types.reduce((w, k) => w + TYPE_BY_KEY[k].weight * l[k].length, 0) }
        })
        .filter(Boolean),
    [links, active],
  )

  const focus = useMemo(() => {
    const target = selected ?? (hovered ? { kind: 'community', id: hovered } : null)
    if (!target) return null
    if (target.kind === 'link') {
      const [source, other] = target.id.split('|')
      return { nodes: new Set([source, other]), links: new Set([target.id]) }
    }
    const own = visibleLinks.filter((l) => l.source === target.id || l.target === target.id)
    return { nodes: new Set([target.id, ...own.flatMap((l) => [l.source, l.target])]), links: new Set(own.map((l) => l.key)) }
  }, [selected, hovered, visibleLinks])

  // Taille réelle de la scène : le repère SVG suit les pixels, le texte garde
  // donc une taille lisible sur mobile.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (!w) return
      setSize((s) => (s.w === w ? s : { w, h: w < 640 ? 440 : 520 }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Nœuds de la simulation : créés une fois, ajustés au redimensionnement.
  useEffect(() => {
    const s = sim.current
    s.scale = Math.min(1, Math.max(0.68, size.w / 900))
    const seen = new Set()
    communities.forEach((c, i) => {
      seen.add(c.slug)
      let n = s.nodes.get(c.slug)
      if (!n) {
        const rand = seeded(hash(c.slug))
        const angle = i * 2.399963
        const dist = 30 + 46 * Math.sqrt(i)
        n = { x: size.w / 2 + Math.cos(angle) * dist, y: size.h / 2 + Math.sin(angle) * dist * 0.7, vx: 0, vy: 0, fx: null, fy: null, phase: rand() * Math.PI * 2 }
        s.nodes.set(c.slug, n)
      }
      n.r = radiusFor(c.itemCount, s.scale)
      n.x = Math.min(size.w - n.r - 8, Math.max(n.r + 8, n.x))
      n.y = Math.min(size.h - n.r - 30 * s.scale, Math.max(n.r + 8, n.y))
    })
    for (const slug of [...s.nodes.keys()]) if (!seen.has(slug)) s.nodes.delete(slug)
    s.alpha = Math.max(s.alpha, 0.5)
    s.w = size.w
    s.h = size.h
    wakeRef.current()
  }, [communities, size])

  useEffect(() => {
    linksRef.current = visibleLinks
    sim.current.alpha = Math.max(sim.current.alpha, 0.35)
    wakeRef.current()
  }, [visibleLinks])

  // Boucle d'animation : simulation puis léger flottement. Elle s'arrête hors
  // de l'écran, onglet masqué, et n'existe pas si le mouvement est réduit.
  useEffect(() => {
    const s = sim.current
    let raf = 0
    let visible = false

    const draw = (time) => {
      const amp = reduced ? 0 : 5 * s.scale
      for (const [slug, n] of s.nodes) {
        n.rx = n.x + (amp && n.fx == null ? Math.sin(time / 2600 + n.phase) * amp : 0)
        n.ry = n.y + (amp && n.fx == null ? Math.cos(time / 3100 + n.phase * 1.3) * amp : 0)
        nodeEls.current.get(slug)?.setAttribute('transform', `translate(${n.rx.toFixed(1)} ${n.ry.toFixed(1)})`)
      }
      for (const l of linksRef.current) {
        const p = s.nodes.get(l.source)
        const q = s.nodes.get(l.target)
        if (!p || !q) continue
        for (const el of Object.values(linkEls.current.get(l.key) ?? {})) {
          el.setAttribute('x1', p.rx.toFixed(1))
          el.setAttribute('y1', p.ry.toFixed(1))
          el.setAttribute('x2', q.rx.toFixed(1))
          el.setAttribute('y2', q.ry.toFixed(1))
        }
      }
    }

    const frame = (time) => {
      raf = 0
      if (s.alpha > 0.004) step(s, linksRef.current, s.w, s.h)
      draw(time)
      if (visible && !document.hidden) raf = requestAnimationFrame(frame)
    }

    const wake = () => {
      if (reduced) {
        for (let i = 0; i < 400 && s.alpha > 0.004; i++) step(s, linksRef.current, s.w, s.h)
        draw(0)
        return
      }
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame)
    }
    wakeRef.current = wake
    drawRef.current = () => draw(performance.now())

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) wake()
      else if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    })
    if (stageRef.current) observer.observe(stageRef.current)
    const onVisibility = () => wake()
    document.addEventListener('visibilitychange', onVisibility)
    wake()
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      if (raf) cancelAnimationFrame(raf)
      wakeRef.current = () => {}
    }
  }, [reduced])

  // Les éléments nouvellement affichés reçoivent aussitôt leur position.
  useLayoutEffect(() => {
    drawRef.current()
  })

  const select = useCallback(
    (next) => {
      setSelected(next)
      if (next && window.matchMedia('(max-width: 900px)').matches) {
        requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' }))
      }
    },
    [reduced],
  )

  const toggleType = (key) =>
    setActive((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Glisser une communauté pour réorganiser le réseau.
  const toSvg = (e) => {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!m) return null
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return pt.matrixTransform(m.inverse())
  }
  const onPointerDown = (e, slug) => {
    if (e.button !== 0) return
    drag.current = { slug, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return
      d.moved = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    const p = toSvg(e)
    const n = sim.current.nodes.get(d.slug)
    if (!p || !n) return
    n.fx = n.x = Math.min(sim.current.w - n.r, Math.max(n.r, p.x))
    n.fy = n.y = Math.min(sim.current.h - n.r, Math.max(n.r, p.y))
    sim.current.alpha = Math.max(sim.current.alpha, 0.3)
    wakeRef.current()
  }
  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const n = sim.current.nodes.get(d.slug)
    if (n) n.fx = n.fy = null
    if (d.moved) {
      suppressClick.current = true
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      sim.current.alpha = Math.max(sim.current.alpha, 0.2)
      wakeRef.current()
    }
  }
  const onNodeClick = (slug) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    select(selected?.kind === 'community' && selected.id === slug ? null : { kind: 'community', id: slug })
  }

  // Communautés recensées mais pas encore publiées : de simples points,
  // sans nom, qui montrent l'étendue du travail de documentation.
  const dust = useMemo(() => {
    const rand = seeded(20261027)
    const count = Math.max(0, Math.min(MAX_DUST, totals.recorded - totals.published))
    return Array.from({ length: count }, (_, i) => ({ u: 0.02 + rand() * 0.96, v: 0.03 + rand() * 0.9, r: 1.6 + rand() * 1.4, twinkle: i % 6 === 0, delay: (rand() * 4.8).toFixed(2) }))
  }, [totals])

  const segment = (Math.PI * 2) / Math.max(domains.length, 1)
  const gap = Math.min(0.08, segment * 0.25)
  const scale = Math.min(1, Math.max(0.68, size.w / 900))
  const remaining = totals.recorded - totals.published

  return (
    <div className="hnet">
      <div className="hnet-toolbar">
        <div className="hnet-filters" role="group" aria-label={t('network.typesDeLiens')}>
          {TYPES.map((type) => (
            <button key={type.key} type="button" className="hnet-chip" aria-pressed={active.has(type.key)} onClick={() => toggleType(type.key)} title={type.help}>
              <LineSample type={type.key} />
              {type.label}
              <span className="hnet-chip-count">{counts[type.key]}</span>
            </button>
          ))}
        </div>
        <p className="hnet-totals">{t('network.totaux', { published: totals.published, recorded: totals.recorded })}</p>
      </div>

      <div className="hnet-body">
        <div
          className="hnet-stage"
          ref={stageRef}
          onKeyDown={(e) => {
            if (e.key === 'Escape') select(null)
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size.w} ${size.h}`}
            width={size.w}
            height={size.h}
            className={focus ? 'has-focus' : ''}
            role="group"
            aria-label={t('network.descriptionScene', { n: communities.length, links: visibleLinks.length })}
            onClick={(e) => {
              if (e.target === e.currentTarget) select(null)
            }}
          >
            <g className="hnet-dust" aria-hidden="true">
              {dust.map((d, i) => (
                <circle key={i} cx={(d.u * size.w).toFixed(1)} cy={(d.v * size.h).toFixed(1)} r={d.r} className={d.twinkle ? 'tw' : undefined} style={d.twinkle ? { '--d': `${d.delay}s` } : undefined} />
              ))}
            </g>

            <g aria-hidden="true">
              {visibleLinks.map((l) => {
                const related = focus?.links.has(l.key)
                const current = selected?.kind === 'link' && selected.id === l.key
                return (
                  <g key={l.key}>
                    <line
                      ref={(el) => registerLink(linkEls, l.key, 0, el)}
                      className={`hnet-link t-${l.main}${related ? ' is-related' : ''}${current ? ' is-current' : ''}`}
                      strokeWidth={(1.6 + Math.min(l.count, 6) * 0.45).toFixed(2)}
                    />
                    <line
                      ref={(el) => registerLink(linkEls, l.key, 1, el)}
                      className="hnet-hit"
                      onClick={() => select(current ? null : { kind: 'link', id: l.key })}
                    />
                  </g>
                )
              })}
            </g>

            <g>
              {communities.map((c) => {
                const r = radiusFor(c.itemCount, scale)
                const owned = new Set(c.domains.map((d) => d.slug))
                const isSelected = selected?.kind === 'community' && selected.id === c.slug
                const linkCount = visibleLinks.filter((l) => l.source === c.slug || l.target === c.slug).length
                return (
                  <g
                    key={c.slug}
                    ref={(el) => (el ? nodeEls.current.set(c.slug, el) : nodeEls.current.delete(c.slug))}
                    className={`hnet-node${focus?.nodes.has(c.slug) ? ' is-related' : ''}${isSelected ? ' is-selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={t('network.noeudAria', { name: c.name, items: tn('unit.content', c.itemCount), links: tn('network.unitLien', linkCount) })}
                    onClick={() => onNodeClick(c.slug)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        select(isSelected ? null : { kind: 'community', id: c.slug })
                      }
                    }}
                    onPointerEnter={() => setHovered(c.slug)}
                    onPointerLeave={() => setHovered((h) => (h === c.slug ? null : h))}
                    onPointerDown={(e) => onPointerDown(e, c.slug)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  >
                    <circle className="hnet-halo" r={r + 10 * scale} />
                    <g className="hnet-ring">
                      {domains.map((d, i) => {
                        const a0 = -Math.PI / 2 + i * segment + gap / 2
                        return (
                          <path key={d.slug} d={arcPath(r + 6 * scale, a0, a0 + segment - gap)} className={owned.has(d.slug) ? 'on' : undefined}>
                            <title>{d.name}</title>
                          </path>
                        )
                      })}
                    </g>
                    <circle className="hnet-core" r={r} />
                    <text className="hnet-count" fontSize={Math.round(r * 0.62)}>
                      {c.itemCount}
                    </text>
                    <text className="hnet-label" y={r + 22 * scale} fontSize={Math.round(14 * Math.max(scale, 0.86))}>
                      {c.name}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>

          {remaining > 0 && (
            <p className="hnet-stage-note">
              <i aria-hidden="true" />
              {tn('network.enAttente', remaining)}
            </p>
          )}
          <p className="hnet-stage-hint hide-xs" aria-hidden="true">
            <MousePointerClick size={14} className="icon" />
            {t('network.astuce')}
          </p>
        </div>

        <aside className="hnet-panel" ref={panelRef} aria-live="polite">
          {selected?.kind === 'community' && bySlug.has(selected.id) ? (
            <CommunityPanel key={selected.id} community={bySlug.get(selected.id)} links={visibleLinks} bySlug={bySlug} domainName={domainName} onSelect={select} />
          ) : selected?.kind === 'link' && links.some((l) => linkKey(l) === selected.id) ? (
            <LinkPanel key={selected.id} link={links.find((l) => linkKey(l) === selected.id)} bySlug={bySlug} domainName={domainName} onSelect={select} />
          ) : (
            <IntroPanel communities={communities} hasLinks={links.length > 0} onSelect={select} />
          )}
        </aside>
      </div>

      {visibleLinks.length > 0 && (
        <details className="hnet-list">
          <summary>{t('network.listeDesLiens', { n: visibleLinks.length })}</summary>
          <ul>
            {visibleLinks.map((l) => (
              <li key={l.key}>
                <button type="button" className="hnet-row" onClick={() => select({ kind: 'link', id: l.key })}>
                  <span>
                    {bySlug.get(l.source)?.name} ↔ {bySlug.get(l.target)?.name}
                  </span>
                  <small>{l.types.map((k) => TYPE_BY_KEY[k].label).join(' · ')}</small>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function registerLink(store, key, slot, el) {
  const entry = store.current.get(key) ?? {}
  if (el) entry[slot] = el
  else delete entry[slot]
  if (Object.keys(entry).length) store.current.set(key, entry)
  else store.current.delete(key)
}

function LineSample({ type }) {
  return (
    <svg className="hnet-sample" width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
      <line x1="1" y1="4" x2="21" y2="4" className={`hnet-link t-${type}`} strokeWidth="2.4" />
    </svg>
  )
}

function PanelHead({ title, kicker, onClose }) {
  return (
    <div className="hnet-panel-head">
      <div>
        {kicker && <p className="hnet-kicker">{kicker}</p>}
        <h3>{title}</h3>
      </div>
      {onClose && (
        <button type="button" className="hnet-close" onClick={onClose} aria-label={t('network.fermer')}>
          <X size={18} className="icon" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function IntroPanel({ communities, hasLinks, onSelect }) {
  return (
    <div className="hnet-panel-inner">
      <PanelHead title={t('network.explorer')} />
      <p className="hnet-text">{t('network.introPanneau')}</p>

      <ul className="hnet-legend">
        {TYPES.map((type) => (
          <li key={type.key}>
            <LineSample type={type.key} />
            <span>
              <strong>{type.label}</strong>
              <small>{type.help}</small>
            </span>
          </li>
        ))}
        <li>
          <svg className="hnet-sample" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
            <path d="M3 9A8 8 0 0 1 11 2" className="hnet-ring-sample" />
            <path d="M12 2A8 8 0 0 1 19 9" className="hnet-ring-sample off" />
          </svg>
          <span>
            <strong>{t('network.couronne')}</strong>
            <small>{t('network.couronneAide')}</small>
          </span>
        </li>
      </ul>

      {!hasLinks && (
        <p className="hnet-notice">
          <Info size={17} className="icon" aria-hidden="true" />
          <span>{t('network.aucunLien')}</span>
        </p>
      )}

      {communities.length > 0 ? (
        <div className="hnet-block">
          <h4>{t('network.choisirCommunaute')}</h4>
          <ul className="hnet-rows">
            {communities.map((c) => (
              <li key={c.slug}>
                <button type="button" className="hnet-row" onClick={() => onSelect({ kind: 'community', id: c.slug })}>
                  <span>{c.name}</span>
                  <small>{tn('unit.content', c.itemCount)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="hnet-notice">
          <Info size={17} className="icon" aria-hidden="true" />
          <span>{t('network.aucuneCommunaute')}</span>
        </p>
      )}
    </div>
  )
}

function DomainTags({ slugs, domainName, tone }) {
  if (!slugs.length) return <p className="hnet-muted">{t('network.aucun')}</p>
  return (
    <div className="hnet-tags">
      {slugs.map((slug) => (
        <Link key={slug} to={`/themes/${slug}`} className={`hnet-tag${tone ? ` ${tone}` : ''}`}>
          {domainName.get(slug) ?? slug}
        </Link>
      ))}
    </div>
  )
}

function CommunityPanel({ community: c, links, bySlug, domainName, onSelect }) {
  const own = links.filter((l) => l.source === c.slug || l.target === c.slug)
  const neighbourDomains = new Set(own.flatMap((l) => bySlug.get(l.source === c.slug ? l.target : l.source)?.domains.map((d) => d.slug) ?? []))
  const domains = c.domains.map((d) => d.slug)
  const specific = own.length ? domains.filter((d) => !neighbourDomains.has(d)) : domains

  return (
    <div className="hnet-panel-inner">
      <PanelHead title={c.name} kicker={DOC_STATUS_LABELS[c.documentationStatus]} onClose={() => onSelect(null)} />
      <p className="hnet-meta">
        <BookOpen size={15} className="icon" aria-hidden="true" />
        {tn('unit.content', c.itemCount)}
      </p>
      {c.summary && <p className="hnet-text clamp">{c.summary}</p>}

      <div className="hnet-block">
        <h4>
          <Languages size={14} className="icon" aria-hidden="true" />
          {t('network.langues')}
        </h4>
        {c.languages.length ? (
          <div className="hnet-tags">
            {c.languages.map((l) => (
              <span key={l} className="hnet-tag">
                {l}
              </span>
            ))}
          </div>
        ) : (
          <p className="hnet-muted">{t('network.nonRenseigne')}</p>
        )}
      </div>

      <div className="hnet-block">
        <h4>
          <MapPin size={14} className="icon" aria-hidden="true" />
          {t('network.provinces')}
        </h4>
        {c.provinces.length ? (
          <div className="hnet-tags">
            {c.provinces.map((p) => (
              <span key={p} className="hnet-tag">
                {p}
              </span>
            ))}
          </div>
        ) : (
          <p className="hnet-muted">{t('network.nonRenseigne')}</p>
        )}
      </div>

      <div className="hnet-block">
        <h4>{own.length ? t('network.ceQuiLuiEstPropre') : t('network.domainesDocumentes')}</h4>
        <DomainTags slugs={specific} domainName={domainName} tone="blue" />
        {own.length > 0 && <p className="hnet-caution">{t('network.proprePrecision')}</p>}
      </div>

      <div className="hnet-block">
        <h4>
          <Link2 size={14} className="icon" aria-hidden="true" />
          {t('network.enCommunAvec')}
        </h4>
        {own.length ? (
          <ul className="hnet-rows">
            {own.map((l) => {
              const other = bySlug.get(l.source === c.slug ? l.target : l.source)
              return (
                <li key={l.key}>
                  <button type="button" className="hnet-row" onClick={() => onSelect({ kind: 'link', id: l.key })}>
                    <span>{other?.name}</span>
                    <small>{l.types.map((k) => `${l[k].length} × ${TYPE_BY_KEY[k].label.toLowerCase()}`).join(' · ')}</small>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="hnet-muted">{t('network.aucunLienCommunaute')}</p>
        )}
      </div>

      <Link to={`/communautes/${c.slug}`} className="button hnet-cta">
        {t('network.voirLaCommunaute')}
        <ArrowRight size={16} className="icon" aria-hidden="true" />
      </Link>
    </div>
  )
}

function FicheLink({ fiche }) {
  return (
    <Link to={`/contenus/${fiche.slug}`} className="hnet-fiche">
      {fiche.title}
    </Link>
  )
}

function LinkPanel({ link: l, bySlug, domainName, onSelect }) {
  const a = bySlug.get(l.source)
  const b = bySlug.get(l.target)
  const aDomains = new Set(a?.domains.map((d) => d.slug) ?? [])
  const bDomains = new Set(b?.domains.map((d) => d.slug) ?? [])
  const both = [...aDomains].filter((d) => bDomains.has(d))
  const onlyA = [...aDomains].filter((d) => !bDomains.has(d))
  const onlyB = [...bDomains].filter((d) => !aDomains.has(d))
  const name = (c) => (
    <button type="button" className="hnet-name" onClick={() => onSelect({ kind: 'community', id: c.slug })}>
      {c.name}
    </button>
  )

  return (
    <div className="hnet-panel-inner">
      <div className="hnet-panel-head">
        <div>
          <p className="hnet-kicker">{t('network.lienDocumente')}</p>
          <h3 className="hnet-pair">
            {a && name(a)}
            <span aria-hidden="true">↔</span>
            {b && name(b)}
          </h3>
        </div>
        <button type="button" className="hnet-close" onClick={() => onSelect(null)} aria-label={t('network.fermer')}>
          <X size={18} className="icon" aria-hidden="true" />
        </button>
      </div>

      {l.relations.length > 0 && (
        <div className="hnet-block">
          <h4>
            <LineSample type="relations" />
            {TYPE_BY_KEY.relations.label}
          </h4>
          <ul className="hnet-evidence">
            {l.relations.map((r, i) => {
              const [from, to] = r.source.outgoing ? [r.source, r.target] : [r.target, r.source]
              return (
                <li key={i}>
                  <FicheLink fiche={from} /> <span className="hnet-rel">{(RELATION_LABELS[r.type] ?? r.type).toLowerCase()}</span> <FicheLink fiche={to} />
                  {r.notes && <q>{r.notes}</q>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {l.sharedItems.length > 0 && (
        <div className="hnet-block">
          <h4>
            <LineSample type="sharedItems" />
            {TYPE_BY_KEY.sharedItems.label}
          </h4>
          <ul className="hnet-evidence">
            {l.sharedItems.map((f) => (
              <li key={f.slug}>
                <FicheLink fiche={f} />
                {f.domain && <small>{domainName.get(f.domain)}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {l.languages.length > 0 && (
        <div className="hnet-block">
          <h4>
            <LineSample type="languages" />
            {TYPE_BY_KEY.languages.label}
          </h4>
          <div className="hnet-tags">
            {l.languages.map((x) => (
              <span key={x} className="hnet-tag blue">
                {x}
              </span>
            ))}
          </div>
        </div>
      )}

      {l.provinces.length > 0 && (
        <div className="hnet-block">
          <h4>
            <LineSample type="provinces" />
            {TYPE_BY_KEY.provinces.label}
          </h4>
          <div className="hnet-tags">
            {l.provinces.map((x) => (
              <span key={x} className="hnet-tag">
                {x}
              </span>
            ))}
          </div>
          <p className="hnet-caution">{t('network.provincePrecision')}</p>
        </div>
      )}

      <div className="hnet-block hnet-compare">
        <h4>{t('network.particularites')}</h4>
        <div>
          <strong>{t('network.seulementChez', { name: a?.name })}</strong>
          <DomainTags slugs={onlyA} domainName={domainName} />
        </div>
        <div>
          <strong>{t('network.seulementChez', { name: b?.name })}</strong>
          <DomainTags slugs={onlyB} domainName={domainName} />
        </div>
        {both.length > 0 && (
          <div>
            <strong>{t('network.documentesChezLesDeux')}</strong>
            <DomainTags slugs={both} domainName={domainName} tone="blue" />
          </div>
        )}
        <p className="hnet-caution">{t('network.comparePrecision')}</p>
      </div>
    </div>
  )
}
