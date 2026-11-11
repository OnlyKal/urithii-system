import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { HttpError } from './lib/errors.js';
import { loadSession } from './middleware/auth.js';
import { checkOrigin } from './middleware/origin.js';
import adminRouter from './routes/admin/index.js';
import auditRouter from './routes/audit.js';
import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
import publicRouter from './routes/public.js';
import publicGamesRouter from './routes/publicGames.js';
import usersRouter from './routes/users.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: [config.clientUrl, ...config.apiAllowedOrigins], credentials: true }));
  // Les fichiers d'import de communautés peuvent dépasser la limite générale :
  // ils ne sont lus qu'une fois la session chargée, pour un utilisateur connecté.
  const IMPORT_PATH = '/api/admin/communities/import';
  const jsonBody = express.json({ limit: '1mb' });
  const largeJsonBody = express.json({ limit: '10mb' });
  app.use((req, res, next) => (req.path === IMPORT_PATH ? next() : jsonBody(req, res, next)));
  app.use(cookieParser());
  app.use(checkOrigin(config.clientUrl));
  app.use(loadSession);
  app.use(IMPORT_PATH, (req, res, next) => (req.user ? largeJsonBody(req, res, next) : next()));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/public/games', publicGamesRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/admin', adminRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Route introuvable' });
  });

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Corps de requête JSON invalide' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Fichier trop volumineux' });
    }
    // Erreurs Prisma courantes, traduites en messages compréhensibles (§65).
    if (err.code === 'P2002') return res.status(409).json({ error: 'Un élément identique existe déjà' });
    if (err.code === 'P2003' || err.code === 'P2014') {
      return res.status(409).json({ error: 'Opération impossible : cet élément est relié à d’autres données' });
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'Élément introuvable' });
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  });

  return app;
}
