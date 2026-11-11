import { unlink } from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { optionalDate, optionalId, optionalText } from '../../lib/http.js';
import { validateBody } from '../../middleware/validate.js';
import { consentProblems, revokeConsent } from '../../services/consents.js';
import { identifyUpload } from '../../services/media.js';
import { openStoredFile, storeOriginal, tempDir } from '../../services/storage.js';
import { audit, need } from './shared.js';

// Consentements (§25 étape 3, §46). Chaque droit est distinct ; la
// révocation suspend les fiches publiées qui en dépendent.
const router = Router();
router.use(need(PERMISSIONS.CONSENTS_MANAGE));

const flags = [
  'canStore', 'canProcess', 'canPublish', 'canTranslate', 'canReuse', 'allowsInterview',
  'allowsAudio', 'allowsVideo', 'allowsPhoto', 'allowsTranscription', 'guardianConsent',
];

const schema = z.object({
  resourcePersonId: optionalId,
  missionId: optionalId,
  collectedAt: z.coerce.date(),
  ...Object.fromEntries(flags.map((f) => [f, z.boolean().optional()])),
  attribution: z.enum(['NAME', 'PSEUDONYM', 'ANONYMOUS']).optional(),
  restrictions: optionalText(),
  communityAuthorization: optionalText(),
  validFrom: optionalDate,
  validUntil: optionalDate,
  notes: optionalText(),
});

const include = {
  resourcePerson: { select: { id: true, fullName: true, publicName: true, isMinor: true } },
  mission: { select: { id: true, code: true, title: true } },
  collectedBy: { select: { id: true, displayName: true } },
  documentFile: { select: { id: true, originalName: true, sizeBytes: true } },
  _count: { select: { items: true, media: true } },
};

const withState = (consent) => ({
  ...consent,
  publicationProblems: consentProblems(consent),
  isActive: consentProblems(consent, new Date(), { forPublication: false }).length === 0,
});

router.get('/', async (req, res) => {
  const where = {};
  if (typeof req.query.resourcePersonId === 'string') where.resourcePersonId = req.query.resourcePersonId;
  if (typeof req.query.missionId === 'string') where.missionId = req.query.missionId;
  const consents = await prisma.consent.findMany({ where, orderBy: { collectedAt: 'desc' }, include });
  res.json({ consents: consents.map(withState) });
});

router.get('/:id', async (req, res) => {
  const consent = await prisma.consent.findUnique({
    where: { id: req.params.id },
    include: {
      ...include,
      items: { include: { item: { select: { id: true, title: true, status: true } } } },
      media: { select: { id: true, title: true, kind: true } },
    },
  });
  if (!consent) throw notFound('Consentement introuvable');
  res.json({ consent: withState(consent) });
});

router.post('/', validateBody(schema), async (req, res) => {
  const consent = await prisma.consent.create({ data: { ...req.body, collectedById: req.user.id }, include });
  await audit(req, 'CONSENT_CREATED', 'Consent', consent.id);
  res.status(201).json({ consent: withState(consent) });
});

// Les termes d'un consentement révoqué ne sont plus modifiables : il faut en
// recueillir un nouveau. Les modifications sont journalisées en détail.
router.patch('/:id', validateBody(schema.partial()), async (req, res) => {
  const before = await prisma.consent.findUnique({ where: { id: req.params.id } });
  if (!before) throw notFound('Consentement introuvable');
  if (before.revokedAt) throw badRequest('Un consentement révoqué ne peut plus être modifié');
  const consent = await prisma.consent.update({ where: { id: req.params.id }, data: req.body, include });
  const changes = Object.fromEntries(
    Object.keys(req.body)
      .filter((k) => String(before[k]) !== String(consent[k]))
      .map((k) => [k, { from: before[k], to: consent[k] }]),
  );
  await audit(req, 'CONSENT_UPDATED', 'Consent', consent.id, changes);
  res.json({ consent: withState(consent) });
});

router.post(
  '/:id/revoke',
  validateBody(z.object({ reason: z.string().trim().min(3).max(2000) })),
  async (req, res) => {
    const before = await prisma.consent.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound('Consentement introuvable');
    if (before.revokedAt) throw badRequest('Ce consentement est déjà révoqué');
    const result = await revokeConsent(req.params.id, { reason: req.body.reason, actor: req.user, ip: req.ip });
    res.json(result);
  },
);

// Document de consentement signé (scan ou PDF), conservé comme original privé.
const upload = multer({ dest: tempDir(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });

router.post('/:id/document', upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Aucun fichier reçu');
  const consent = await prisma.consent.findUnique({ where: { id: req.params.id } });
  if (!consent) {
    await unlink(req.file.path).catch(() => {});
    throw notFound('Consentement introuvable');
  }
  if (consent.documentFileId) throw badRequest('Un document est déjà associé ; il ne peut pas être remplacé');
  let file;
  try {
    const { mimeType } = await identifyUpload(req.file.path, req.file.originalname, req.file.mimetype);
    file = await storeOriginal({
      tempPath: req.file.path,
      originalName: req.file.originalname,
      mimeType,
      uploadedById: req.user.id,
    });
  } finally {
    await unlink(req.file.path).catch(() => {});
  }
  await prisma.consent.update({ where: { id: consent.id }, data: { documentFileId: file.id } });
  await audit(req, 'CONSENT_DOCUMENT_ADDED', 'Consent', consent.id, { sha256: file.sha256 });
  res.status(201).json({ file });
});

router.get('/:id/document', async (req, res) => {
  const consent = await prisma.consent.findUnique({ where: { id: req.params.id }, include: { documentFile: true } });
  if (!consent?.documentFile) throw notFound('Document introuvable');
  res.setHeader('Content-Type', consent.documentFile.mimeType);
  res.setHeader('Content-Disposition', 'attachment; filename="consentement"');
  openStoredFile(consent.documentFile).pipe(res);
});

export default router;
