import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API Urithi opérationnelle', timestamp: new Date().toISOString() });
});

export default router;
