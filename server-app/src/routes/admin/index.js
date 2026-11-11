import { Router } from 'express';
import { requireAuth, requirePasswordChanged } from '../../middleware/auth.js';
import communities from './communities.js';
import consents from './consents.js';
import dashboard from './dashboard.js';
import games from './games.js';
import dossiers, { sectionsRouter } from './dossiers.js';
import items from './items.js';
import lookups from './lookups.js';
import media from './media.js';
import missions, { questionnairesRouter } from './missions.js';
import persons from './persons.js';
import preservation from './preservation.js';
import references from './references.js';
import settings from './settings.js';
import sources from './sources.js';
import takedowns from './takedowns.js';
import texts from './texts.js';

// Espace de contribution et d'administration : authentification exigée,
// puis permissions vérifiées route par route.
const router = Router();
router.use(requireAuth, requirePasswordChanged);

router.use('/dashboard', dashboard);
router.use('/lookups', lookups);
router.use('/', references);
router.use('/communities', communities);
router.use('/sources', sources);
router.use('/persons', persons);
router.use('/consents', consents);
router.use('/media', media);
router.use('/texts', texts);
router.use('/items', items);
router.use('/dossiers', dossiers);
router.use('/dossier-sections', sectionsRouter);
router.use('/missions', missions);
router.use('/questionnaires', questionnairesRouter);
router.use('/takedowns', takedowns);
router.use('/settings', settings);
router.use('/preservation', preservation);
router.use('/games', games);

export default router;
