import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../auth/permissions.js';
import { prisma } from '../db.js';
import { badRequest } from '../lib/errors.js';
import { requirePermission } from '../middleware/auth.js';
import { verifyAuditChain } from '../services/audit.js';

// Consultation du journal d'audit (§32, §69). Aucune route ne permet de
// modifier ou de supprimer une entrée.
const router = Router();
router.use(requirePermission(PERMISSIONS.AUDIT_READ));

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().optional(),
  actorId: z.string().optional(),
  entityId: z.string().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Paramètres invalides');
    const { page, pageSize, action, actorId, entityId } = parsed.data;
    const where = { action, actorId, entityId };

    const [total, entries] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, displayName: true, email: true } } },
      }),
    ]);

    res.json({
      total,
      page,
      pageSize,
      entries: entries.map((e) => ({ ...e, details: e.details ? JSON.parse(e.details) : null })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    res.json(await verifyAuditChain());
  } catch (err) {
    next(err);
  }
});

export default router;
