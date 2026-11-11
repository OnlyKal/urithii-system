// Création du premier super administrateur, en ligne de commande.
// Usage : npm run create-admin -- <email> "<Nom affiché>"
import { prisma } from '../db.js';
import { generateTemporaryPassword, hashPassword } from '../lib/password.js';
import { recordAudit } from '../services/audit.js';

const [email, ...nameParts] = process.argv.slice(2);
const displayName = nameParts.join(' ').trim();

if (!email || !displayName) {
  console.error('Usage : npm run create-admin -- <email> "<Nom affiché>"');
  process.exit(1);
}

const normalizedEmail = email.trim().toLowerCase();
if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
  console.error(`Un compte existe déjà pour ${normalizedEmail}.`);
  process.exit(1);
}

const temporaryPassword = generateTemporaryPassword();
const user = await prisma.user.create({
  data: {
    email: normalizedEmail,
    displayName,
    passwordHash: await hashPassword(temporaryPassword),
    roles: { create: [{ role: 'SUPER_ADMIN' }] },
  },
});
await recordAudit({
  action: 'USER_CREATED',
  entityType: 'User',
  entityId: user.id,
  details: { roles: ['SUPER_ADMIN'], via: 'cli' },
});
await prisma.$disconnect();

console.log(`Super administrateur créé : ${normalizedEmail}`);
console.log(`Mot de passe temporaire : ${temporaryPassword}`);
console.log('Il devra être changé à la première connexion.');
