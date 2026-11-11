import { useGLTF } from '@react-three/drei'
import { createContext, useContext } from 'react'

// Pack HD (modèles réalistes produits dans Blender, voir game-assets/).
// Il n'est téléchargé qu'en qualité « Haute » : environ 25 Mo, trop lourd
// pour les connexions mobiles. Les autres qualités gardent les modèles
// stylisés générés par le code.

const BASE = '/games/hd/'

export const HD = {
  arbre: `${BASE}arbre_geant.glb`,
  arbre_v2: `${BASE}arbre_v2.glb`,
  arbre_v3: `${BASE}arbre_v3.glb`,
  fougere: `${BASE}plante_fougere.glb`,
  anthurium: `${BASE}plante_anthurium.glb`,
  calathea: `${BASE}plante_calathea.glb`,
  herbe: `${BASE}plante_herbe.glb`,
  pachira: `${BASE}plante_pachira.glb`,
  case: `${BASE}case_ronde.glb`,
  maison: `${BASE}maison.glb`,
  grenier: `${BASE}grenier.glb`,
  okapi: `${BASE}okapi.glb`,
  'elephant-foret': `${BASE}elephant.glb`,
  'paon-congo': `${BASE}paon.glb`,
  ecogarde: `${BASE}ecogarde.glb`,
  'guide-village': `${BASE}guide.glb`,
  joueur: `${BASE}joueur.glb`,
  joueuse: `${BASE}joueuse.glb`,
}

export const HDRI = `${BASE}ciel_foret.hdr`

export const AVATARS = ['joueur', 'joueuse']

// Les modèles n'utilisent pas la compression Draco : aucun décodeur externe
// n'est téléchargé (le jeu fonctionne sans accès à un CDN).
export function useHdModel(key) {
  return useGLTF(HD[key], false)
}

export function preloadHd(avatar = 'joueur') {
  for (const key of Object.keys(HD)) {
    if (AVATARS.includes(key) && key !== avatar) continue
    useGLTF.preload(HD[key], false)
  }
}

export const HdContext = createContext(false)
export const useHd = () => useContext(HdContext)
