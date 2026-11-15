import { useSyncExternalStore } from 'react'
import { api } from '../../api.js'

// Registre de la plateforme vu par le jeu : référentiel des catégories,
// communautés, langues et lieux publiés, lus par l'API publique au lancement
// de la partie. Tout ce que la plateforme publie (aujourd'hui ou plus tard,
// selon la structure établie) apparaît donc dans le jeu sans modification du
// code : une catégorie ajoutée au référentiel obtient son espace dans le
// village, une communauté publiée rejoint l'arbre à palabres, etc.

const empty = { ready: false, error: false, categories: [], roots: [], communities: [], languages: [], provinces: [], totals: { items: 0 } }

let state = empty
let loading = null
const listeners = new Set()

function set(next) {
  state = next
  listeners.forEach((l) => l())
}

// Catégories racines avec le nombre de fiches publiées de toute leur branche.
function buildTree(categories) {
  const byId = new Map(categories.map((c) => [c.id, { ...c, children: [] }]))
  for (const c of byId.values()) if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).children.push(c)
  const total = (c) => c.itemCount + c.children.reduce((n, child) => n + total(child), 0)
  const rootOf = (c) => {
    let cur = c
    while (cur.parentId && byId.has(cur.parentId)) cur = byId.get(cur.parentId)
    return cur
  }
  const roots = [...byId.values()].filter((c) => !c.parentId || !byId.has(c.parentId)).map((c) => ({ ...c, total: total(c) }))
  const rootSlug = new Map([...byId.values()].map((c) => [c.slug, rootOf(c).slug]))
  return { roots, rootSlug }
}

let rootSlugs = new Map()
// Catégorie racine d'une catégorie (par son slug).
export const rootCategory = (slug) => rootSlugs.get(slug) ?? slug

export function loadPlatform() {
  loading ??= Promise.all([
    api('/public/categories'),
    api('/public/communities'),
    api('/public/languages'),
    api('/public/places'),
  ])
    .then(([c, com, lang, places]) => {
      const { roots, rootSlug } = buildTree(c.categories)
      rootSlugs = rootSlug
      set({
        ready: true,
        error: false,
        categories: c.categories,
        roots,
        communities: com.communities,
        languages: lang.languages,
        provinces: places.places.filter((p) => p.type === 'PROVINCE'),
        totals: { items: roots.reduce((n, r) => n + r.total, 0) },
      })
      return state
    })
    .catch((error) => {
      loading = null
      set({ ...empty, error: true })
      throw error
    })
  return loading
}

export const getPlatform = () => state
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))
export const usePlatform = () => useSyncExternalStore(subscribe, getPlatform)

// Requêtes de contenus, mises en cache le temps de la partie.
const cache = new Map()
export function cached(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      api(path).catch((error) => {
        cache.delete(path)
        throw error
      }),
    )
  }
  return cache.get(path)
}

export const fetchItems = (params) => cached(`/public/items?${new URLSearchParams({ pageSize: 50, ...params })}`)
export const fetchItem = (slug) => cached(`/public/items/${encodeURIComponent(slug)}`).then((r) => r.item)
export const fetchCommunity = (slug) => cached(`/public/communities/${encodeURIComponent(slug)}`)
export const fetchMedia = (params) => cached(`/public/media?${new URLSearchParams({ pageSize: 24, ...params })}`)
