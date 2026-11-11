import { Router } from 'express';
import { PERMISSIONS } from '../../auth/permissions.js';
import { prisma } from '../../db.js';
import { parseJson } from '../../lib/text.js';
import { restoreTest, runBackup, runIntegrityCheck } from '../../services/backup.js';
import { exportFull } from '../../services/export.js';
import { audit, need } from './shared.js';

// Sauvegardes, contrôles d'intégrité, exports (§52 à §55, §73).
const router = Router();

router.get('/runs', need(PERMISSIONS.BACKUPS_MANAGE), async (req, res) => {
  const runs = await prisma.backupRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 100,
    include: { triggeredBy: { select: { id: true, displayName: true } } },
  });
  res.json({ runs: runs.map((r) => ({ ...r, summary: parseJson(r.summary) })) });
});

router.post('/backup', need(PERMISSIONS.BACKUPS_MANAGE), async (req, res) => {
  res.status(201).json(await runBackup({ triggeredById: req.user.id }));
});

router.post('/restore-test', need(PERMISSIONS.BACKUPS_MANAGE), async (req, res) => {
  res.json(await restoreTest({ triggeredById: req.user.id }));
});

router.post('/integrity-check', need(PERMISSIONS.BACKUPS_MANAGE), async (req, res) => {
  res.json(await runIntegrityCheck({ triggeredById: req.user.id }));
});

router.get('/export', need(PERMISSIONS.EXPORT_FULL), async (req, res) => {
  await audit(req, 'EXPORT_FULL', 'Export', null);
  res.attachment(`urithi-export-complet-${new Date().toISOString().slice(0, 10)}.json`);
  res.json(await exportFull());
});

export default router;
