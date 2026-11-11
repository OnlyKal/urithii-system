import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Valeur par défaut : « prisma generate » (postinstall) n'a pas besoin de base.
    url: process.env.DATABASE_URL ?? 'file:./data/urithi.db',
  },
})
