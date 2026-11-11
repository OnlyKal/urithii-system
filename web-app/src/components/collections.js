import { Archive, Camera, Feather, Headphones, MessageSquareQuote, Video } from 'lucide-react'

import { t } from '../i18n/index.js'
// Grandes collections du site public ; les effectifs viennent de /api/public/collections.
export const COLLECTIONS = [
  { id: 'archives', to: '/themes/patrimoine-materiel-et-archives', icon: Archive, title: t('collections.archivesEtPhotographiesHistoriques'), description: t('collections.documentsAnciensObjetsCartesEt'), unit: 'document' },
  { id: 'testimonies', to: '/contenus?verification=TESTIMONY', icon: MessageSquareQuote, title: t('collections.temoignages'), description: t('collections.laParoleDesAnciensEt'), unit: 'testimony' },
  { id: 'oralTraditions', to: '/contenus?verification=ORAL_TRADITION', icon: Feather, title: t('collections.traditionsOrales'), description: t('collections.recitsTransmisDeGenerationEn'), unit: 'story' },
  { id: 'photos', to: '/mediatheque?kind=PHOTO', icon: Camera, title: t('collections.photographies'), description: t('collections.pratiquesObjetsLieuxEtMoments'), unit: 'photo' },
  { id: 'videos', to: '/mediatheque?kind=VIDEO', icon: Video, title: t('collections.videosCulturelles'), description: t('collections.dansesGestesPreparationsEtCeremonies'), unit: 'video' },
  { id: 'audios', to: '/mediatheque?kind=AUDIO', icon: Headphones, title: t('collections.enregistrementsSonores'), description: t('collections.contesChantsPrononciationsEtEntretiens'), unit: 'recording' },
]
