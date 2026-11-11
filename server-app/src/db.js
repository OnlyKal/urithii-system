import { PrismaClient } from './generated/prisma/client.ts';
import { config } from './config.js';

// Base de données : SQLite en développement (DATABASE_URL=file:…), MySQL en
// production (DATABASE_URL=mysql://…). Le client Prisma est généré à partir
// du schéma correspondant (prisma/schema.prisma ou prisma/mysql/schema.prisma).
export const isMysql = /^mysql:/.test(config.databaseUrl);

async function createAdapter() {
  if (isMysql) {
    const { PrismaMariaDb } = await import('@prisma/adapter-mariadb');
    const url = new URL(config.databaseUrl);
    return new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
      // MySQL 8 : authentification caching_sha2_password sans TLS local.
      allowPublicKeyRetrieval: true,
    });
  }
  const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
  return new PrismaBetterSqlite3({ url: config.databaseUrl });
}

export const prisma = new PrismaClient({ adapter: await createAdapter() });
