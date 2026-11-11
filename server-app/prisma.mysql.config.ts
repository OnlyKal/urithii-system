import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Configuration Prisma de la production (MySQL). Le développement local
// utilise prisma.config.ts (SQLite).
export default defineConfig({
  schema: 'prisma/mysql/schema.prisma',
  migrations: {
    path: 'prisma/mysql/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'mysql://localhost:3306/urithi',
  },
})
