import { mkdirSync } from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { optionalDate, optionalId, optionalText, paginate, paginationSchema, parseQuery } from '../../lib/http.js';
import { validateBody } from '../../middleware/validate.js';
import { isSuperAdmin } from '../../services/access.js';
import { createMediaFromUpload, isAcceptedType } from '../../services/media.js';
import { checkIntegrity, resolveKey, tempDir } from '../../services/storage.js';
import { audit, can, need } from './shared.js';

// Médiathèque interne (§17, §28, §68).
const router = Router();
const P = PERMISSIONS;

const ACCESS_LEVELS = ['PUBLIC', 'CONTRIBUTORS', 'TEAM', 'SPECIAL', 'PRIVATE'];

const metadataSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalText(),
  accessLevel: z.enum(ACCESS_LEVELS).optional(),
  consentId: optionalId,
  publicationCleared: z.coerce.boolean().optional(),
  rightsStatement: optionalText(2000),
  credit: optionalText(500),
  dateKind: z.enum(['EXACT', 'APPROXIMATE', 'PERIOD', 'UNKNOWN']).optional(),
  dateValue: optionalText(100),
  placeId: optionalId,
  peopleDepicted: optionalText(2000),
  context: optionalText(),
  provenance: optionalText(2000),
  missionId: optionalId,
  collectedAt: optionalDate,
});

// Accès interne aux médias : PRIVATE réservé à l'auteur et au super
// administrateur ; TEAM et SPECIAL ouverts en plus aux détenteurs de content.edit.
function canViewMedia(user, media) {
  if (isSuperAdmin(user) || media.createdById === user.id) return true;
  if (['PUBLIC', 'CONTRIBUTORS'].includes(media.accessLevel)) return true;
  if (['TEAM', 'SPECIAL'].includes(media.accessLevel)) return user.permissions.includes(P.CONTENT_EDIT);
  return false;
}

function mediaWhere(user) {
  if (isSuperAdmin(user)) return {};
  const levels = ['PUBLIC', 'CONTRIBUTORS', ...(user.permissions.includes(P.CONTENT_EDIT) ? ['TEAM', 'SPECIAL'] : [])];
  return { OR: [{ accessLevel: { in: levels } }, { createdById: user.id }] };
}

async function loadMedia(id, user) {
  const media = await prisma.mediaAsset.findUnique({
    where: { id },
    include: {
      originalFile: true,
      webFile: true,
      thumbnailFile: true,
      consent: { include: { resourcePerson: { select: { id: true, fullName: true, isMinor: true } } } },
      place: true,
      mission: { select: { id: true, code: true, title: true } },
      items: { include: { item: { select: { id: true, title: true, status: true } } } },
      texts: { include: { language: true } },
      createdBy: { select: { id: true, displayName: true } },
    },
  });
  if (!media || !canViewMedia(user, media)) throw notFound('Média introuvable');
  return media;
}

const listQuery = paginationSchema.extend({
  q: z.string().optional(),
  kind: z.enum(['PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT']).optional(),
  accessLevel: z.enum(ACCESS_LEVELS).optional(),
});

router.get('/', async (req, res) => {
  const query = parseQuery(listQuery, req.query);
  const where = {
    AND: [mediaWhere(req.user), { kind: query.kind, accessLevel: query.accessLevel }],
    ...(query.q && { title: { contains: query.q } }),
  };
  const [total, media] = await prisma.$transaction([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...paginate(query),
      include: { originalFile: { select: { mimeType: true, sizeBytes: true, integrityStatus: true } } },
    }),
  ]);
  res.json({ total, media });
});

router.get('/:id', async (req, res) => {
  res.json({ media: await loadMedia(req.params.id, req.user) });
});

mkdirSync(tempDir(), { recursive: true });
const upload = multer({
  dest: tempDir(),
  limits: { fileSize: config.maxUploadBytes, files: 1, fields: 30 },
  fileFilter: (req, file, cb) =>
    isAcceptedType(file.mimetype, file.originalname) ? cb(null, true) : cb(badRequest('Format de fichier non accepté')),
});

router.post('/', need(P.FILES_UPLOAD), upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Aucun fichier reçu');
  const parsed = metadataSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }
  const media = await createMediaFromUpload({ file: req.file, metadata: parsed.data, user: req.user, ip: req.ip });
  res.status(201).json({ media });
});

router.patch('/:id', validateBody(metadataSchema.partial()), async (req, res) => {
  const media = await loadMedia(req.params.id, req.user);
  if (media.createdById !== req.user.id && !can(req, P.CONTENT_EDIT)) throw forbidden();
  const updated = await prisma.mediaAsset.update({ where: { id: media.id }, data: req.body });
  const accessChanged = req.body.accessLevel && req.body.accessLevel !== media.accessLevel;
  await audit(
    req,
    accessChanged ? 'MEDIA_ACCESS_CHANGED' : 'MEDIA_UPDATED',
    'MediaAsset',
    media.id,
    accessChanged ? { from: media.accessLevel, to: req.body.accessLevel } : undefined,
  );
  res.json({ media: updated });
});

router.post('/:id/check-integrity', async (req, res) => {
  const media = await loadMedia(req.params.id, req.user);
  const ids = [media.originalFileId, media.webFileId, media.thumbnailFileId].filter(Boolean);
  const files = [];
  for (const id of ids) files.push(await checkIntegrity(id));
  await audit(req, 'MEDIA_INTEGRITY_CHECKED', 'MediaAsset', media.id, {
    results: files.map((f) => ({ id: f.id, status: f.integrityStatus })),
  });
  res.json({ files });
});

// Lecture interne d'un fichier (original, version web ou miniature).
router.get('/:id/file', async (req, res) => {
  const media = await loadMedia(req.params.id, req.user);
  const variant = req.query.variant;
  const file =
    variant === 'web' ? media.webFile ?? media.originalFile
    : variant === 'thumbnail' ? media.thumbnailFile ?? (media.kind === 'VIDEO' ? null : media.webFile ?? media.originalFile)
    : media.originalFile;
  if (!file) throw notFound('Couverture indisponible');
  if (variant === 'original' || variant === undefined) {
    await audit(req, 'MEDIA_ORIGINAL_ACCESSED', 'MediaAsset', media.id);
  }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.query.download === '1') {
    res.attachment(file.originalName);
  }
  res.sendFile(resolveKey(file.storageKey));
});

export default router;
