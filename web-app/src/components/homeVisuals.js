// Visuels d'ambiance de la page d'accueil.
//
// Ce sont des illustrations, pas des documents patrimoniaux : ils ne sont pas
// présentés comme la représentation d'une communauté précise. Avant toute mise
// en ligne publique, les droits de chaque image doivent être confirmés (§46).
// Pour remplacer une image (par exemple par une photo issue d'une mission de
// collecte, avec consentement), il suffit de modifier l'entrée correspondante.
//
// Images écartées volontairement parmi celles fournies le 25/10/2026 :
// - marche en forêt avec paniers : porte la mention « Copyright © Nicolas
//   Marino 2015 », publication impossible sans l'autorisation du photographe ;
// - danse autour d'un feu (vue aérienne) : costumes ne correspondant pas aux
//   traditions congolaises, risque d'induire le public en erreur.
// Parmi les images fournies ensuite (même jour) :
// - masques et statuettes : la mention « MOZAMBIQUE » y est peinte ;
// - peintures exposées dans la rue : sujets et style d'Afrique de l'Est ;
// - papillotes de maïs : pamonhas brésiliennes, sans rapport avec la chikwangue.
import causerieFull from '../assets/home/causerie-full.webp'
import causerie480 from '../assets/home/causerie-480.webp'
import foretFull from '../assets/home/foret-full.webp'
import foufouFull from '../assets/home/foufou-full.webp'
import foret480 from '../assets/home/foret-480.webp'
import grilladesFull from '../assets/home/grillades-full.webp'
import grillades480 from '../assets/home/grillades-480.webp'
import maisFull from '../assets/home/mais-full.webp'
import mais480 from '../assets/home/mais-480.webp'
import marcheFull from '../assets/home/marche-full.webp'
import pecheursFull from '../assets/home/pecheurs-full.webp'
import pecheurs480 from '../assets/home/pecheurs-480.webp'
import riviereFull from '../assets/home/riviere-full.webp'
import tambourFull from '../assets/home/tambour-full.webp'
import tambour480 from '../assets/home/tambour-480.webp'

import { t } from '../i18n/index.js'
const SUPPLIED = 'Image fournie par le porteur du projet (25 octobre 2026)'

export const HOME_VISUALS = {
  tambour: {
    src: tambourFull,
    srcSet: `${tambour480} 480w, ${tambourFull} 736w`,
    width: 736,
    height: 736,
    alt: t('homeVisuals.mainsFrappantUnTambourTraditionnel'),
    source: SUPPLIED,
    rights: 'À vérifier — rendu évoquant une image générée par IA',
  },
  pecheurs: {
    src: pecheursFull,
    srcSet: `${pecheurs480} 480w, ${pecheursFull} 736w`,
    width: 736,
    height: 1308,
    alt: t('homeVisuals.pecheursEnPirogueLancantUn'),
    source: SUPPLIED,
    rights: 'À vérifier — rendu évoquant une image générée par IA',
  },
  marche: {
    src: marcheFull,
    srcSet: `${marcheFull} 426w`,
    width: 426,
    height: 640,
    alt: t('homeVisuals.etalsDUnMarcheArachides'),
    source: SUPPLIED,
    rights: 'À vérifier — photographie de personnes, accord à confirmer',
  },
  causerie: {
    src: causerieFull,
    srcSet: `${causerie480} 480w, ${causerieFull} 720w`,
    width: 720,
    height: 719,
    alt: t('homeVisuals.groupeAssisALOmbre'),
    source: SUPPLIED,
    rights: 'À vérifier — rendu évoquant une image générée par IA',
  },
  foret: {
    src: foretFull,
    srcSet: `${foret480} 480w, ${foretFull} 736w`,
    width: 736,
    height: 732,
    alt: t('homeVisuals.jeuneHommeTenantUnArc'),
    source: SUPPLIED,
    rights: 'À vérifier — photographie de personne, accord à confirmer',
  },
  riviere: {
    src: riviereFull,
    srcSet: `${riviereFull} 400w`,
    width: 400,
    height: 600,
    alt: t('homeVisuals.femmesPuisantDeLEau'),
    source: SUPPLIED,
    rights: 'À vérifier — photographie de personnes, accord à confirmer',
  },
  mais: {
    src: maisFull,
    srcSet: `${mais480} 480w, ${maisFull} 736w`,
    width: 736,
    height: 1158,
    alt: t('homeVisuals.episDeMaisGrillesPoses'),
    source: SUPPLIED,
    rights: 'À vérifier — rendu évoquant une image retouchée ou générée par IA',
  },
  grillades: {
    src: grilladesFull,
    srcSet: `${grillades480} 480w, ${grilladesFull} 735w`,
    width: 735,
    height: 440,
    alt: t('homeVisuals.etalDeGrilladesDeRue'),
    source: `${SUPPLIED} — fichier intitulé « Congolese Food, Kinshasa République Démocratique du Congo » ; bande inférieure (publicité pour une bière) recadrée`,
    rights: 'À vérifier — photographie d’une personne, auteur et accord inconnus',
  },
  foufou: {
    src: foufouFull,
    srcSet: `${foufouFull} 405w`,
    width: 405,
    height: 340,
    alt: t('homeVisuals.boulesDePateDeManioc'),
    source: `${SUPPLIED} — recadrage d’un montage de plusieurs photographies`,
    rights: 'À vérifier — source de la photographie inconnue',
  },
}

// Image réactive optimisée (WebP, tailles multiples, dimensions déclarées).
export function visualProps(key, sizes, { eager = false } = {}) {
  const v = HOME_VISUALS[key]
  return {
    src: v.src,
    srcSet: v.srcSet,
    sizes,
    width: v.width,
    height: v.height,
    alt: v.alt,
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    ...(eager && { fetchPriority: 'high' }),
  }
}
