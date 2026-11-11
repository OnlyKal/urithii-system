import PARKS_DATA from './parks.json'
import { POINTS } from './atlasContent.js'

// Parcs nationaux et parc marin de l'atlas. Les fiches viennent de
// parks.json (données du projet, modifiables sans toucher au code) ; ce module
// y ajoute la photographie de chaque parc et ses liens avec les fiches de
// l'atlas. La couleur de chaque parc est celle de « couleur_carte ».

// Photographie (clé de atlasPhoto) et fiches de l'atlas situées dans le parc.
const EXTRAS = {
  virunga: { photo: 'parc-virunga', points: ['gorille-montagnes', 'nyiragongo', 'hippopotame', 'rwenzori'] },
  kahuzi_biega: { photo: 'parc-kahuzi', points: ['gorille-grauer'] },
  salonga: { photo: 'foret-cuvette', points: ['foret-cuvette', 'paon-congo'] },
  garamba: { photo: 'girafe-kordofan', points: ['girafe-kordofan'] },
  maiko: { photo: 'parc-maiko', points: [] },
  upemba: { photo: 'parc-upemba', points: ['bec-en-sabot'] },
  kundelungu: { photo: 'chutes-lofoi', points: ['chutes-lofoi'] },
  lomami: { photo: 'lesula', points: ['elephant-foret', 'lesula'] },
  mangroves: { photo: 'mangroves', points: ['mangroves'] },
}

export const PARKS = PARKS_DATA.parcs.map((park) => ({ ...park, ...EXTRAS[park.id] }))

// Parc auquel appartient chaque fiche de l'atlas.
export const PARK_OF_POINT = new Map(PARKS.flatMap((park) => park.points.map((id) => [id, park.id])))

// Éléments cités dans les fiches des parcs qui ont leur propre fiche sur
// l'atlas : noms des fiches, plus les variantes employées dans parks.json.
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim()
const ALIASES = {
  'gorilles de montagne': 'gorille-montagnes',
  'gorille de grauer': 'gorille-grauer',
  'gorilles de grauer': 'gorille-grauer',
  'girafe de kordofan': 'girafe-kordofan',
  'girafes de kordofan': 'girafe-kordofan',
  'volcan nyiragongo': 'nyiragongo',
  'montagnes rwenzori': 'rwenzori',
  'chutes de lofoi': 'chutes-lofoi',
  'mangroves de muanda': 'mangroves',
  'fleuve congo': 'fleuve-congo',
}
const LINKS = new Map([...POINTS.map((p) => [norm(p.name), p.id]), ...Object.entries(ALIASES)])
export const pointForTag = (tag) => LINKS.get(norm(tag)) ?? null
