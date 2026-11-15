const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  isProduction,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 4000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5180',
  databaseUrl: process.env.DATABASE_URL || 'file:./data/urithi.db',
  storageDir: process.env.STORAGE_DIR || './storage',
  backupDir: process.env.BACKUP_DIR || './backups',
  backupMirrorDir: process.env.BACKUP_MIRROR_DIR || null,
  autoBackupHours: Number(process.env.AUTO_BACKUP_HOURS ?? 24),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 2048) * 1024 * 1024,
  // Durée maximale d'une requête (envoi compris). Node coupe par défaut au
  // bout de 5 minutes (réponse 408) : trop court pour une vidéo envoyée sur
  // une connexion ordinaire. nginx, en amont, protège des connexions lentes.
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MIN || 180) * 60 * 1000,
  clamscanPath: process.env.CLAMSCAN_PATH || null,
  // Conversion des vidéos non lisibles partout (HEVC, MOV…) en H.264.
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  session: {
    cookieName: 'urithi_session',
    ttlMs: 12 * 60 * 60 * 1000,
    // Jetons d'accès des applications de collecte (en-tête Authorization).
    apiTokenTtlMs: Number(process.env.API_TOKEN_DAYS || 30) * 24 * 60 * 60 * 1000,
  },
  // Applications web externes autorisées à appeler l'API (CORS), séparées par
  // des virgules. Inutile pour une application mobile ou un script.
  apiAllowedOrigins: (process.env.API_ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  login: {
    maxFailedAttempts: 5,
    lockDurationMs: 15 * 60 * 1000,
  },
};
