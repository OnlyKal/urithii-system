import { prisma } from '../db.js';
import { parseJson } from '../lib/text.js';
import { publicItemWhere } from './access.js';
import { hydratePublicItem } from './publicContent.js';

// Exports documentés (§73). L'export public ne contient que des données
// publiées ; l'export complet sert aux migrations et reste réservé.

export const EXPORT_FORMAT_VERSION = 2;

export async function exportPublic() {
  const items = await prisma.culturalItem.findMany({
    where: publicItemWhere,
    include: { publishedVersion: true },
    orderBy: { publishedAt: 'asc' },
  });
  const communities = await prisma.community.findMany({
    where: { isPublished: true },
    include: { names: true, places: { include: { place: true } }, languages: { include: { language: true } } },
  });
  return {
    format: 'urithi-export-public',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    communities: communities.map((c) => ({
      slug: c.slug,
      name: c.name,
      summary: c.summary,
      description: c.description,
      history: c.history,
      documentationStatus: c.documentationStatus,
      names: c.names.map((n) => ({ name: n.name, kind: n.kind })),
      places: c.places.map((p) => p.place.name),
      languages: c.languages.map((l) => l.language.name),
    })),
    categories: (await prisma.category.findMany({ where: { isActive: true } })).map((c) => ({
      slug: c.slug,
      name: c.name,
      code: c.code,
      fieldsSchema: parseJson(c.fieldsSchema, []),
    })),
    items: await Promise.all(items.map(hydratePublicItem)),
  };
}

// Export complet : toutes les tables, sans les secrets (mots de passe,
// jetons de session). Les liens entre enregistrements sont conservés par
// leurs identifiants stables.
export async function exportFull() {
  const tables = {
    users: prisma.user.findMany({
      select: { id: true, email: true, displayName: true, isActive: true, createdAt: true, roles: { select: { role: true } } },
    }),
    rolePermissions: prisma.rolePermission.findMany(),
    places: prisma.place.findMany(),
    languages: prisma.language.findMany(),
    categories: prisma.category.findMany(),
    communities: prisma.community.findMany(),
    communityNames: prisma.communityName.findMany(),
    communityPlaces: prisma.communityPlace.findMany(),
    communityLanguages: prisma.communityLanguage.findMany(),
    sources: prisma.source.findMany(),
    resourcePersons: prisma.resourcePerson.findMany(),
    consents: prisma.consent.findMany(),
    items: prisma.culturalItem.findMany(),
    itemVersions: prisma.itemVersion.findMany(),
    itemCommunities: prisma.itemCommunity.findMany(),
    itemPlaces: prisma.itemPlace.findMany(),
    itemSources: prisma.itemSource.findMany(),
    itemMedia: prisma.itemMedia.findMany(),
    itemConsents: prisma.itemConsent.findMany(),
    itemRelations: prisma.itemRelation.findMany(),
    accessGrants: prisma.accessGrant.findMany(),
    validationDecisions: prisma.validationDecision.findMany(),
    storedFiles: prisma.storedFile.findMany(),
    media: prisma.mediaAsset.findMany(),
    texts: prisma.textDocument.findMany(),
    textRevisions: prisma.textRevision.findMany(),
    missions: prisma.mission.findMany(),
    missionMembers: prisma.missionMember.findMany(),
    missionResourcePersons: prisma.missionResourcePerson.findMany(),
    questionnaires: prisma.questionnaire.findMany(),
    missionQuestionnaires: prisma.missionQuestionnaire.findMany(),
    fieldNotes: prisma.fieldNote.findMany(),
    missionReports: prisma.missionReport.findMany(),
    takedownRequests: prisma.takedownRequest.findMany(),
    dossierSectionDefs: prisma.dossierSectionDef.findMany(),
    dossiers: prisma.collectionDossier.findMany(),
    dossierEvents: prisma.dossierEvent.findMany(),
    dossierVersions: prisma.dossierVersion.findMany(),
    backupRuns: prisma.backupRun.findMany(),
    auditLogs: prisma.auditLog.findMany({ orderBy: { id: 'asc' } }),
  };
  const data = {};
  for (const [name, query] of Object.entries(tables)) data[name] = await query;
  return { format: 'urithi-export-full', version: EXPORT_FORMAT_VERSION, exportedAt: new Date().toISOString(), data };
}
