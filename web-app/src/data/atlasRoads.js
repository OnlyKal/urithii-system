import { ROADS as ROAD_SHAPES } from '../components/atlasRoadsData.js'

// Principales routes nationales de l'atlas. Le tracé, la longueur
// cartographiée, les provinces et les villes desservies sont calculés à partir
// d'OpenStreetMap (atlasRoadsData.js) ; ce module y ajoute les vues
// (photographies) et une courte présentation lorsqu'elle est disponible.

const INFO = {
  rn1: {
    photos: ['route-rn1-matadi', 'route-rn1-kikwit', 'route-rn1-paysage'],
    intro: 'Principale artère routière du pays, la RN1 relie la façade atlantique à Kinshasa, puis traverse le Kwilu et les Kasaï jusqu’au Katanga et à la frontière zambienne. Le tronçon Matadi–Kinshasa, asphalté, est le grand corridor d’approvisionnement de la capitale.',
  },
  rn2: {
    intro: 'Grand axe de l’est, la RN2 longe la région des Grands Lacs entre Beni, Butembo, Goma et Bukavu, avant de s’enfoncer vers l’ouest à travers le Maniema et la Lomami.',
  },
  rn4: {
    photos: ['route-rn4'],
    intro: 'La RN4 relie Kisangani à l’Ituri à travers la grande forêt. Souvent en latérite, elle devient difficile à la saison des pluies : camions et motos y affrontent ornières et bourbiers.',
  },
  rn27: {
    photos: ['route-rn27'],
    intro: 'La RN27 dessert l’Ituri et traverse la ville de Bunia, carrefour commercial du nord-est.',
  },
}

export const ROADS = ROAD_SHAPES.map((road) => ({ ...road, photos: [], ...INFO[road.id], name: `Route nationale ${road.ref.slice(2)}` }))
