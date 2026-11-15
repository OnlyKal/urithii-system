import { loadRolePermissions } from './auth/permissions.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { ensureGameMissions } from './data/gameMissions.js';
import { prisma } from './db.js';
import { ensureSectionDefs } from './services/dossierSchema.js';
import { ensureAdminPlaces, linkPublishedCommunities } from './services/rdcDivisions.js';
import { backfillVideoPosters } from './services/media.js';
import { startScheduler } from './services/scheduler.js';

await loadRolePermissions(prisma);
await ensureSectionDefs(prisma);
await ensureAdminPlaces(prisma);
await linkPublishedCommunities(prisma);
await ensureGameMissions(prisma);

const server = createApp().listen(config.port, () => {
  console.log(`Serveur URITHI démarré sur http://localhost:${config.port}`);
  startScheduler();
  // Couvertures des vidéos téléversées avant cette fonction (arrière-plan).
  backfillVideoPosters().catch((err) => console.error('Couvertures vidéo :', err.message));
});
// Téléversements longs (vidéos) : pas de coupure à 5 minutes.
server.requestTimeout = config.requestTimeoutMs;
