import { atlasPhoto, CATEGORIES, IUCN, POINTS } from '../../data/atlasContent.js'

// Contenus affichés par le jeu, tous issus d'URITHI :
// - faune et flore : fiches de l'atlas vivant (texte, photographie, crédit) ;
// - culture : fiches culturelles publiées, lues par l'API publique
//   (voir platform.js).
// Le jeu ne rédige aucune documentation propre.

const BY_ID = new Map(POINTS.map((p) => [p.id, p]))

export function natureCard(id) {
  const p = BY_ID.get(id)
  if (!p) return null
  return {
    kind: 'nature',
    id,
    name: p.name,
    latin: p.latin,
    category: CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category,
    categoryId: p.category,
    photo: atlasPhoto(id),
    photoNote: p.photoNote,
    summary: p.summary,
    text: p.text,
    facts: p.facts ?? [],
    iucn: p.iucn ? { code: p.iucn, label: IUCN[p.iucn] } : null,
    endemic: Boolean(p.endemic),
    place: p.place,
    province: p.province,
    link: `/atlas?lieu=${id}`,
  }
}

export const contentName = (id) => BY_ID.get(id)?.name ?? id

// Paragraphe d'une fiche, avec sa référence (pour les récits des personnages).
export function contentParagraph(id, index) {
  const p = BY_ID.get(id)
  return p?.text?.[index] ? { text: p.text[index], source: { id, name: p.name, link: `/atlas?lieu=${id}` } } : null
}

// Source d'une question de quiz : fiche de l'atlas, sinon fiche culturelle.
export function sourceRef(id) {
  const p = BY_ID.get(id)
  if (p) return { name: p.name, link: `/atlas?lieu=${id}` }
  return { name: id, link: `/contenus/${id}` }
}
