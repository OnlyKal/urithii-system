import { Archive, BookMarked, BookOpen, Calendar, Camera, Crown, Filter, Globe, Globe2, Languages, Library, MapPin, Minus, Plus, RotateCcw, Search, Tags, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import AuthorityExplorer from '../../components/AuthorityTree.jsx'
import Prose from '../../components/Prose.jsx'
import { CategoryItem, CollectionCard, CommunityCard, CultureContentCard, MediaCard } from '../../components/PublicCards.jsx'
import { SearchBar } from '../../components/SearchBar.jsx'
import { Breadcrumbs, EmptyState, Loading, LoadingSkeleton, Pagination, SectionHeader, useApi } from '../../components/ui.jsx'
import { DOC_STATUS_LABELS, formatDate, MEDIA_KIND_LABELS, NAME_KIND_LABELS, PLACE_TYPE_LABELS, VERIFICATION_LABELS } from '../../labels.js'
import { categoryIcon } from '../../components/icons.js'
import { COLLECTIONS } from '../../components/collections.js'
import { t, tn } from '../../i18n/index.js'
import { normalizeText } from '../../data/rdcDivisions.js'

export function CommunitiesPage() {
  const [q, setQ] = useState('')
  const { data, error, loading } = useApi(`/public/communities${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  return (
    <>
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('common.communities') }]} />
      <header className="article-head">
        <h1>{t('browse.repertoireDesCommunautes')}</h1>
        <p className="lead">{t('browse.chaqueCommunautePresenteeATravers')}</p>
      </header>
      <SearchBar
        onSearch={setQ}
        defaultValue={q}
        placeholder={t('browse.rechercherUneCommunauteOuUne')}
        className="filters"
      />
      <div style={{ marginTop: '1.5rem' }}>
        <Loading loading={loading && !data} error={error} variant="cards">
          {data?.communities.length ? (
            <div className="card-grid">
              {data.communities.map((c) => (
                <CommunityCard key={c.slug} community={c} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title={q ? t('browse.aucuneCommunautePour', { 0: q }) : t('browse.aucuneCommunautePublieePourLe')}>
              {q ? t('browse.essayezUneAutreOrthographeOu') : t('browse.laDocumentationDeLaCommunaute')}
            </EmptyState>
          )}
        </Loading>
      </div>
    </>
  )
}

export function CommunityPage() {
  const { slug } = useParams()
  const { data, error, loading } = useApi(`/public/communities/${slug}`)
  const { data: dynasties } = useApi(`/public/communities/${slug}/authorities`)
  const [searchParams] = useSearchParams()
  if (!data) return <Loading loading={loading} error={error} />
  const { community, media, cover } = data
  // Les fiches des autorités sont présentées dans l'arbre, pas en cartes.
  const authorities = dynasties?.authorities ?? []
  const inTree = new Set([...authorities.map((a) => a.slug), ...(authorities.length && dynasties.overview ? [dynasties.overview.slug] : [])])
  const items = data.items.filter((item) => !inTree.has(item.slug))
  const sources = [...new Set([...community.names, ...community.places].map((x) => x.source).filter(Boolean))]
  const byCategory = items.reduce((groups, item) => {
    const key = item.category?.name ?? t('browse.autres')
    ;(groups[key] ??= { code: item.category?.code, items: [] }).items.push(item)
    return groups
  }, {})

  return (
    <article>
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('common.communities'), to: '/communautes' }, { label: community.name }]} />
      <header className={`community-hero ${cover ? 'has-cover' : ''}`}>
        <div>
          <p className="eyebrow">{t('common.community')}</p>
          <h1>{community.name}</h1>
          <div className="actions" style={{ marginBottom: '0.9rem' }}>
            <span className={`doc-status doc-${community.documentationStatus?.toLowerCase()}`} style={{ margin: 0 }}>{DOC_STATUS_LABELS[community.documentationStatus]}</span>
            <span className="small muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={14} className="icon" aria-hidden="true" />{t('browse.misAJourLe')}{' '}{formatDate(community.updatedAt)}
            </span>
          </div>
          {community.summary && <p className="lead">{community.summary}</p>}
          {community.documentationNote && <p className="muted">{community.documentationNote}</p>}
        </div>
        {cover && (
          <div className="cover">
            <img src={cover.url} alt={cover.alt} />
          </div>
        )}
      </header>

      <div className="facts">
        {community.names.length > 0 && (
          <div>
            <h2>
              <Tags size={15} className="icon" aria-hidden="true" />{t('browse.denominations')}</h2>
            <ul className="plain-list">
              {community.names.map((n) => (
                <li key={n.name}>
                  <strong>{n.name}</strong> <span className="muted small">— {NAME_KIND_LABELS[n.kind]}</span>
                  {n.source && <div className="small muted">{t('browse.source')}{' '}{n.source}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {community.places.length > 0 && (
          <div>
            <h2>
              <MapPin size={15} className="icon" aria-hidden="true" />{t('browse.localisationConnue')}</h2>
            <ul className="plain-list">
              {community.places.map((p) => (
                <li key={p.name}>
                  {p.name} <span className="muted small">— {PLACE_TYPE_LABELS[p.type]}{p.parent && `, ${p.parent}`}</span>
                  {p.notes && <div className="small muted">{p.notes}</div>}
                  {p.source && <div className="small muted">{t('browse.source')}{' '}{p.source}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {community.languages.length > 0 && (
          <div>
            <h2>
              <Languages size={15} className="icon" aria-hidden="true" />{t('browse.langues')}</h2>
            <ul className="plain-list">
              {community.languages.map((l) => (
                <li key={l.name}>
                  {l.name}
                  {l.isoCode && <span className="muted small"> ({l.isoCode})</span>}
                  {l.notes && <div className="small muted">{l.notes}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="article-main">
        {community.description && (
          <section>
            <h2>{t('browse.presentation')}</h2>
            <div className="reading">
              <Prose text={community.description} />
            </div>
          </section>
        )}
        {community.history && (
          <section>
            <h2>{t('browse.elementsHistoriques')}</h2>
            <div className="reading">
              <Prose text={community.history} />
            </div>
          </section>
        )}

        {authorities.length > 0 && (
          <section id="autorites" style={{ scrollMarginTop: 84 }}>
            <h2>
              <Crown size={20} className="icon icon-blue" aria-hidden="true" />{t('authority.titre')}</h2>
            <p className="muted">{t('authority.intro')}</p>
            <AuthorityExplorer authorities={authorities} overview={dynasties.overview} initialSlug={searchParams.get('autorite')} linkItems />
          </section>
        )}

        <section id="patrimoine">
          <h2>
            <BookOpen size={20} className="icon icon-blue" aria-hidden="true" />{t('browse.patrimoineDocumente')}</h2>
          {Object.keys(byCategory).length > 1 && (
            <nav className="chip-list" aria-label={t('browse.categoriesCulturellesDocumentees')}>
              {Object.entries(byCategory).map(([category, group]) => (
                <a key={category} href={`#cat-${group.code ?? 'autres'}`} className="chip">
                  {category}
                  <span className="chip-count">{group.items.length}</span>
                </a>
              ))}
            </nav>
          )}
          {items.length === 0 && (
            <EmptyState icon={BookOpen} title={t('browse.documentationEnCours')}>{t('browse.aucunContenuNEstEncore')}</EmptyState>
          )}
          {Object.entries(byCategory).map(([category, group]) => {
            const Icon = categoryIcon(group.code)
            return (
              <div key={category} id={`cat-${group.code ?? 'autres'}`} style={{ scrollMarginTop: 84 }}>
                <h3 className="group-title">
                  <Icon size={18} className="icon icon-blue" aria-hidden="true" />
                  {category}
                </h3>
                <div className="card-grid">
                  {group.items.map((item) => (
                    <CultureContentCard key={item.slug} item={item} />
                  ))}
                </div>
              </div>
            )
          })}
        </section>

        {media.length > 0 && (
          <section>
            <SectionHeader title={t('browse.photographiesVideosEtEnregistrements')} link={`/mediatheque?community=${community.slug}`} linkLabel={t('browse.touteLaMediatheque')} />
            <div className="media-grid">
              {media.map((m) => (
                <MediaCard key={m.id} media={m} />
              ))}
            </div>
          </section>
        )}

        {sources.length > 0 && (
          <section>
            <h2>
              <BookMarked size={20} className="icon icon-blue" aria-hidden="true" />{t('browse.sourcesEtReferences')}</h2>
            <ol className="source-list">
              {sources.map((title) => (
                <li key={title} className="source-ref">
                  <div>{title}</div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <p className="small muted">{t('browse.ficheCreeeLe')}{' '}{formatDate(community.createdAt)}{t('browse.miseAJourLe')}{' '}{formatDate(community.updatedAt)}.
      </p>
    </article>
  )
}

export function ThemesPage() {
  const { data, error, loading } = useApi('/public/categories')
  return (
    <>
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('browse.themesCulturels') }]} />
      <header className="article-head">
        <h1>{t('browse.themesCulturels')}</h1>
        <p className="lead">{t('browse.lesDomainesDuPatrimoineDocumentes')}</p>
      </header>
      <Loading loading={loading} error={error}>
        <div className="card-grid">
          {data?.categories
            .filter((c) => !c.parentId)
            .map((c) => {
              const Icon = categoryIcon(c.code)
              return (
                <Link key={c.slug} to={`/themes/${c.slug}`} className="collection-card">
                  <span className="category-icon">
                    <Icon size={21} className="icon" aria-hidden="true" />
                  </span>
                  <strong>{c.name}</strong>
                  {c.description && <p>{c.description}</p>}
                  <span className="collection-count">{c.itemCount > 0 ? tn('unit.content', c.itemCount) : t('home.documentationEnCours')}</span>
                </Link>
              )
            })}
        </div>
      </Loading>
    </>
  )
}

// Liste filtrable de contenus publiés (thème, communauté, langue, type de média, nature de l'information).
export function ItemsBrowsePage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? 1)
  const categories = useApi('/public/categories').data?.categories ?? []
  const communities = useApi('/public/communities').data?.communities ?? []
  const languages = useApi('/public/languages').data?.languages ?? []
  const params = new URLSearchParams(searchParams)
  if (slug) params.set('category', slug)
  params.set('pageSize', '24')
  const { data, error, loading } = useApi(`/public/items?${params}`)
  const category = categories.find((c) => c.slug === slug)
  const verification = searchParams.get('verification')
  const title = category?.name ?? (verification ? VERIFICATION_LABELS[verification] : t('home.tousLesContenus'))

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: t('common.home'), to: '/' },
          slug ? { label: t('browse.themesCulturels'), to: '/themes' } : { label: t('browse.contenus'), to: '/contenus' },
          ...(slug || verification ? [{ label: title }] : []),
        ]}
      />
      <header className="article-head">
        {category && (
          <p className="eyebrow">
            {(() => {
              const Icon = categoryIcon(category.code)
              return <Icon size={15} className="icon" aria-hidden="true" />
            })()}{t('browse.themeCulturel')}</p>
        )}
        <h1>{title}</h1>
        {category?.description && <p className="lead">{category.description}</p>}
      </header>
      {categories.some((c) => c.parentId === category?.id) && (
        <div className="chip-list">
          {categories
            .filter((c) => c.parentId === category.id)
            .map((c) => (
              <Link key={c.slug} to={`/themes/${c.slug}`} className="chip">
                {c.name}
              </Link>
            ))}
        </div>
      )}
      <section className="filters card" aria-label={t('browse.filtres')}>
        <SearchBar
          defaultValue={searchParams.get('q') ?? ''}
          onSearch={(q) => setParam('q', q)}
          placeholder={category ? t('browse.rechercherDansCeTheme') : t('media.rechercher')}
        />
        <select value={searchParams.get('community') ?? ''} onChange={(e) => setParam('community', e.target.value)} aria-label={t('common.community')}>
          <option value="">{t('browse.toutesLesCommunautes')}</option>
          {communities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={searchParams.get('languageId') ?? ''} onChange={(e) => setParam('languageId', e.target.value)} aria-label={t('common.language')}>
          <option value="">{t('browse.toutesLesLangues')}</option>
          {languages.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select value={searchParams.get('mediaKind') ?? ''} onChange={(e) => setParam('mediaKind', e.target.value)} aria-label={t('browse.typeDeMedia')}>
          <option value="">{t('browse.avecOuSansMedia')}</option>
          {Object.entries(MEDIA_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{t('browse.avec')}{' '}{label.toLowerCase()}
            </option>
          ))}
        </select>
        <select value={verification ?? ''} onChange={(e) => setParam('verification', e.target.value)} aria-label={t('browse.natureDeLInformation')}>
          <option value="">{t('browse.touteNatureDInformation')}</option>
          {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </section>
      <Loading loading={loading && !data} error={error} variant="cards">
        {data?.items.length ? (
          <div className="card-grid">
            {data.items.map((item) => (
              <CultureContentCard key={item.slug} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Library} title={t('browse.aucunContenuPublieNeCorrespond')}>{t('browse.modifiezLesFiltresOuRevenez')}</EmptyState>
        )}
        {data && (
          <Pagination
            page={page}
            pageSize={24}
            total={data.total}
            onChange={(p) => setSearchParams(new URLSearchParams({ ...Object.fromEntries(searchParams), page: p }))}
          />
        )}
      </Loading>
    </>
  )
}

export function ExplorePage() {
  const { data, error, loading } = useApi('/public/places')
  const [searchParams] = useSearchParams()
  const [selected, setSelected] = useState(searchParams.get('lieu'))
  const [query, setQuery] = useState('')
  // Lieux dépliés par le visiteur ; null tant qu'il n'a rien touché (le
  // pays et le chemin du lieu sélectionné sont alors dépliés).
  const [expanded, setExpanded] = useState(null)
  const communities = useApi(selected ? `/public/communities?placeId=${selected}` : null)
  const items = useApi(selected ? `/public/items?placeId=${selected}&pageSize=24` : null)

  const tree = useMemo(() => {
    const places = data?.places ?? []
    const byId = new Map(places.map((p) => [p.id, p]))
    const childrenOf = new Map()
    for (const p of places) {
      const key = p.parentId && byId.has(p.parentId) ? p.parentId : null
      if (!childrenOf.has(key)) childrenOf.set(key, [])
      childrenOf.get(key).push(p)
    }
    for (const list of childrenOf.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    const ancestors = (id) => {
      const chain = []
      for (let p = byId.get(byId.get(id)?.parentId); p; p = byId.get(p.parentId)) chain.push(p.id)
      return chain
    }
    return { byId, childrenOf, ancestors }
  }, [data])

  if (!data) return <Loading loading={loading} error={error} />

  const { byId, childrenOf, ancestors } = tree
  const children = (id) => childrenOf.get(id) ?? []
  const roots = children(null)
  const current = byId.get(selected)

  // Recherche : un lieu reste visible s'il correspond ou si l'un de ses
  // descendants correspond ; les branches concernées sont dépliées.
  const needle = normalizeText(query.trim())
  let visible = null
  if (needle) {
    visible = new Set()
    for (const p of byId.values()) {
      if (normalizeText(p.name).includes(needle)) {
        visible.add(p.id)
        for (const a of ancestors(p.id)) visible.add(a)
      }
    }
  }
  const defaultOpen = new Set([...roots.map((r) => r.id), ...(selected ? ancestors(selected) : [])])
  const openSet = expanded ?? defaultOpen
  const isOpen = (id) => (visible ? visible.has(id) : openSet.has(id))
  const toggle = (id) => {
    const next = new Set(openSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }
  const expandAll = () => setExpanded(new Set([...byId.values()].filter((p) => children(p.id).length).map((p) => p.id)))
  const collapseAll = () => setExpanded(new Set(roots.map((r) => r.id)))

  const highlight = (name) => {
    if (!needle) return name
    const start = normalizeText(name).indexOf(needle)
    if (start < 0) return name
    return (
      <>
        {name.slice(0, start)}
        <mark>{name.slice(start, start + needle.length)}</mark>
        {name.slice(start + needle.length)}
      </>
    )
  }

  const renderTree = (place, depth = 0) => {
    if (visible && !visible.has(place.id)) return null
    const kids = depth < 4 ? children(place.id) : []
    const open = kids.length > 0 && isOpen(place.id)
    return (
      <li key={place.id} role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={selected === place.id}>
        <div className="place-row">
          {kids.length > 0 ? (
            <button
              type="button"
              className="place-toggle"
              onClick={() => toggle(place.id)}
              disabled={Boolean(visible)}
              aria-label={t(open ? 'browse.replierLieu' : 'browse.deplierLieu', { lieu: place.name })}
            >
              {open ? <Minus size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
            </button>
          ) : (
            <span className="place-toggle-spacer" aria-hidden="true" />
          )}
          <button type="button" className={selected === place.id ? 'active' : ''} onClick={() => setSelected(place.id)} aria-pressed={selected === place.id}>
            {depth === 0 ? <Globe size={14} className="icon" aria-hidden="true" /> : <MapPin size={13} className="icon icon-muted" aria-hidden="true" />}
            <span>{highlight(place.name)}</span>
            {(place.communityCount > 0 || place.itemCount > 0) && <span className="chip-count">{place.communityCount + place.itemCount}</span>}
          </button>
        </div>
        {open && <ul role="group">{kids.map((c) => renderTree(c, depth + 1))}</ul>}
      </li>
    )
  }
  const visibleCount = visible ? [...visible].filter((id) => normalizeText(byId.get(id).name).includes(needle)).length : null

  return (
    <>
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('browse.explorerParLieu') }]} />
      <header className="article-head">
        <h1>{t('browse.explorerParProvinceEtLocalite')}</h1>
        <p className="lead">{t('browse.uneCommunautePeutEtrePresente')}</p>
      </header>
      <div className="explore">
        <nav aria-label={t('common.places')} className="place-tree">
          <div className="place-tree-search">
            <Search size={15} className="icon icon-muted" aria-hidden="true" />
            <input
              type="text"
              role="searchbox"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('browse.rechercherUneProvinceOuUn')}
              aria-label={t('browse.rechercherUneProvinceOuUn')}
            />
            {query && (
              <button type="button" className="place-tree-clear" onClick={() => setQuery('')} aria-label={t('browse.effacerLaRecherche')}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {visible ? (
            <p className="muted small place-tree-status" role="status">
              {visibleCount ? tn('browse.lieuxTrouves', visibleCount) : t('browse.aucunLieuNeCorrespond')}
            </p>
          ) : (
            <div className="place-tree-actions">
              <button type="button" onClick={expandAll}>
                <Plus size={13} aria-hidden="true" />{t('browse.toutDeplier')}</button>
              <button type="button" onClick={collapseAll}>
                <Minus size={13} aria-hidden="true" />{t('browse.toutReplier')}</button>
            </div>
          )}
          <ul role="tree" aria-label={t('common.places')}>{roots.map((p) => renderTree(p))}</ul>
        </nav>
        <div>
          {!current && (
            <EmptyState icon={MapPin} title={t('browse.choisissezUnLieu')}>{t('browse.selectionnezUneProvinceUnTerritoire')}</EmptyState>
          )}
          {current && (
            <>
              <h2>
                {current.name} <span className="muted small">· {PLACE_TYPE_LABELS[current.type]}</span>
              </h2>
              <h3 className="group-title">
                <Users size={18} className="icon icon-blue" aria-hidden="true" />{t('common.communities')}</h3>
              {communities.loading ? (
                <LoadingSkeleton variant="cards" count={2} />
              ) : communities.data?.communities.length ? (
                <div className="card-grid">
                  {communities.data.communities.map((c) => (
                    <CommunityCard key={c.slug} community={c} />
                  ))}
                </div>
              ) : (
                <p className="muted">{t('browse.aucuneCommunautePublieeRattacheeA')}</p>
              )}
              <h3 className="group-title">
                <BookOpen size={18} className="icon icon-blue" aria-hidden="true" />{t('browse.contenus')}</h3>
              {items.loading ? (
                <LoadingSkeleton variant="cards" count={2} />
              ) : items.data?.items.length ? (
                <div className="card-grid">
                  {items.data.items.map((i) => (
                    <CultureContentCard key={i.slug} item={i} />
                  ))}
                </div>
              ) : (
                <p className="muted">{t('browse.aucunContenuPublieRattacheA')}</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

export function CollectionsPage() {
  const { data, error, loading } = useApi('/public/collections')
  const archives = useApi('/public/items?category=patrimoine-materiel-et-archives&pageSize=6').data?.items ?? []
  return (
    <>
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('browse.archives') }]} />
      <header className="article-head">
        <h1>{t('browse.archivesEtCollections')}</h1>
        <p className="lead">{t('browse.archivesTemoignagesTraditionsOralesPhotographies')}</p>
      </header>
      <Loading loading={loading} error={error}>
        <div className="card-grid">
          {COLLECTIONS.map((c) => (
            <CollectionCard key={c.id} {...c} count={data?.collections[c.id] ?? 0} />
          ))}
        </div>
      </Loading>
      {archives.length > 0 && (
        <section className="section">
          <SectionHeader icon={Archive} title={t('browse.dansLesArchives')} link="/themes/patrimoine-materiel-et-archives" linkLabel={t('browse.toutesLesArchives')} />
          <div className="card-grid">
            {archives.map((item) => (
              <CultureContentCard key={item.slug} item={item} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

const SEARCH_TYPES = [
  ['all', t('browse.tout'), Search],
  ['contenus', t('item.contenus'), BookOpen],
  ['communautes', t('common.communities'), Globe2],
  ['medias', t('common.media'), Camera],
]
const CONTENT_FILTERS = ['category', 'community', 'languageId', 'mediaKind', 'verification']

// Recherche : type de résultat, filtres visibles, réinitialisation, pagination.
// S'appuie sur les routes publiques existantes (/search, /items, /communities, /media).
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type') ?? 'all'
  const page = Number(searchParams.get('page') ?? 1)
  const [showFilters, setShowFilters] = useState(true)
  const activeFilters = CONTENT_FILTERS.filter((f) => searchParams.get(f))
  const mode = type === 'all' && activeFilters.length === 0 ? 'overview' : type === 'all' ? 'contenus' : type

  const categories = useApi('/public/categories').data?.categories ?? []
  const communities = useApi('/public/communities').data?.communities ?? []
  const languages = useApi('/public/languages').data?.languages ?? []

  let path = null
  if (q || activeFilters.length) {
    const params = new URLSearchParams({ q, page: String(page), pageSize: '24' })
    if (mode === 'overview') path = `/public/search?q=${encodeURIComponent(q)}`
    else if (mode === 'contenus') {
      for (const f of activeFilters) params.set(f, searchParams.get(f))
      path = `/public/items?${params}`
    } else if (mode === 'communautes') path = `/public/communities?q=${encodeURIComponent(q)}`
    else if (mode === 'medias') {
      if (searchParams.get('mediaKind')) params.set('kind', searchParams.get('mediaKind'))
      if (searchParams.get('community')) params.set('community', searchParams.get('community'))
      path = `/public/media?${params}`
    }
  }
  const { data, error, loading } = useApi(path)

  const update = (changes) => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in changes)) next.delete('page')
    setSearchParams(next)
  }
  const reset = () => setSearchParams(q ? { q } : {})

  const total =
    mode === 'overview' && data ? data.items.length + data.communities.length + data.media.length
    : mode === 'communautes' ? data?.communities?.length ?? 0
    : data?.total ?? 0

  return (
    <>
      <Breadcrumbs items={[{ label: t('common.home'), to: '/' }, { label: t('browse.recherche') }]} />
      <header className="article-head">
        <h1>{t('browse.recherche')}</h1>
        <p className="lead">{t('browse.uneCommunauteUneLangueUn')}</p>
      </header>
      <SearchBar key={q} large defaultValue={q} onSearch={(value) => update({ q: value })} />
      <p className="small muted" style={{ marginTop: '0.6rem' }}>{t('browse.laRechercheIgnoreLesAccents')}</p>

      <div className="search-toolbar">
        <div className="chip-list" role="tablist" aria-label={t('browse.typeDeResultat')} style={{ margin: 0 }}>
          {SEARCH_TYPES.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={type === value}
              className={`chip ${type === value ? 'active' : ''}`}
              onClick={() => update({ type: value === 'all' ? null : value })}
            >
              <Icon size={15} className="icon" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div className="actions">
          {mode !== 'communautes' && (
            <button type="button" className="secondary" aria-expanded={showFilters} aria-controls="search-filters" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} className="icon" aria-hidden="true" />{t('browse.filtres')}{activeFilters.length > 0 && ` (${activeFilters.length})`}
            </button>
          )}
          {activeFilters.length > 0 && (
            <button type="button" className="ghost" onClick={reset}>
              <RotateCcw size={16} className="icon" aria-hidden="true" />{t('browse.reinitialiserLesFiltres')}</button>
          )}
        </div>
      </div>

      {showFilters && mode !== 'communautes' && (
        <section id="search-filters" className="filters card filters-panel" aria-label={t('browse.filtres')}>
          {mode !== 'medias' && (
            <select value={searchParams.get('category') ?? ''} onChange={(e) => update({ category: e.target.value })} aria-label={t('browse.theme')}>
              <option value="">{t('browse.tousLesThemes')}</option>
              {categories
                .filter((c) => !c.parentId)
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}
          <select value={searchParams.get('community') ?? ''} onChange={(e) => update({ community: e.target.value })} aria-label={t('common.community')}>
            <option value="">{t('browse.toutesLesCommunautes')}</option>
            {communities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          {mode !== 'medias' && (
            <select value={searchParams.get('languageId') ?? ''} onChange={(e) => update({ languageId: e.target.value })} aria-label={t('common.language')}>
              <option value="">{t('browse.toutesLesLangues')}</option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <select value={searchParams.get('mediaKind') ?? ''} onChange={(e) => update({ mediaKind: e.target.value })} aria-label={t('browse.typeDeMedia')}>
            <option value="">{mode === 'medias' ? t('browse.tousLesMedias') : t('browse.avecOuSansMedia')}</option>
            {Object.entries(MEDIA_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {mode === 'medias' ? label : t('browse.avec2', { 0: label.toLowerCase() })}
              </option>
            ))}
          </select>
          {mode !== 'medias' && (
            <select value={searchParams.get('verification') ?? ''} onChange={(e) => update({ verification: e.target.value })} aria-label={t('browse.natureDeLInformation')}>
              <option value="">{t('browse.touteNatureDInformation')}</option>
              {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </section>
      )}

      {!path && (
        <section className="section">
          <SectionHeader icon={Tags} title={t('browse.ouExplorezParTheme')} />
          <div className="category-grid">
            {categories
              .filter((c) => !c.parentId)
              .map((c) => (
                <CategoryItem key={c.slug} category={c} />
              ))}
          </div>
        </section>
      )}

      {path && (
        <div className="section" aria-live="polite">
          <Loading loading={loading} error={error} variant="cards">
            {data && (
              <p className="small muted results-count">
                {tn('search.results', total)}
                {q && <>{' '}{t('browse.pour')}{' '}{q} »</>}
              </p>
            )}
            {data && total === 0 && (
              <EmptyState
                icon={Search}
                title={t('browse.aucunResultat')}
                action={
                  activeFilters.length > 0 && (
                    <button type="button" className="secondary" onClick={reset}>
                      <RotateCcw size={16} className="icon" aria-hidden="true" />{t('browse.reinitialiserLesFiltres')}</button>
                  )
                }
              >{t('browse.verifiezLOrthographeEssayezUn')}</EmptyState>
            )}

            {mode === 'overview' && data && (
              <>
                {data.communities.length > 0 && (
                  <section className="section">
                    <SectionHeader icon={Globe2} title={t('browse.communautes', { 0: data.communities.length })} />
                    <div className="card-grid">
                      {data.communities.map((c) => (
                        <CommunityCard key={c.slug} community={c} />
                      ))}
                    </div>
                  </section>
                )}
                {data.items.length > 0 && (
                  <section className="section">
                    <SectionHeader icon={BookOpen} title={t('browse.contenus2', { 0: data.items.length })} />
                    <div className="card-grid">
                      {data.items.map((i) => (
                        <CultureContentCard key={i.slug} item={i} />
                      ))}
                    </div>
                  </section>
                )}
                {data.media.length > 0 && (
                  <section className="section">
                    <SectionHeader icon={Camera} title={t('browse.medias', { 0: data.media.length })} />
                    <div className="media-grid">
                      {data.media.map((m) => (
                        <MediaCard key={m.id} media={m} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {mode === 'contenus' && data?.items && (
              <div className="card-grid">
                {data.items.map((i) => (
                  <CultureContentCard key={i.slug} item={i} />
                ))}
              </div>
            )}
            {mode === 'communautes' && data?.communities && (
              <div className="card-grid">
                {data.communities.map((c) => (
                  <CommunityCard key={c.slug} community={c} />
                ))}
              </div>
            )}
            {mode === 'medias' && data?.media && (
              <div className="media-grid">
                {data.media.map((m) => (
                  <MediaCard key={m.id} media={m} />
                ))}
              </div>
            )}
            {(mode === 'contenus' || mode === 'medias') && data?.total !== undefined && (
              <Pagination page={page} pageSize={24} total={data.total} onChange={(p) => update({ page: String(p) })} />
            )}
          </Loading>
        </div>
      )}
    </>
  )
}
