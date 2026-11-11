// Outils de conservation en ligne de commande (§52 à §54).
//
//   npm run backup                       sauvegarde complète (base + fichiers)
//   npm run backup:verify -- <dossier>   vérifie une sauvegarde
//   npm run backup:restore-test [-- <dossier>]  test de restauration
//   npm run integrity-check              contrôle des empreintes des fichiers
//   npm run restore -- <dossier> --confirm      restauration réelle
//
// La restauration réelle n'efface rien : la base et le dossier de stockage
// actuels sont déplacés à côté (suffixe « avant-restauration-<date> »).
// Arrêtez le serveur avant de restaurer.
import { cp, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { isMysql, prisma } from '../db.js';
import { databaseFilePath, restoreTest, runBackup, runIntegrityCheck, verifyBackup } from '../services/backup.js';

const [command, ...args] = process.argv.slice(2);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function restore(dir, confirmed) {
  if (isMysql) {
    console.error('Base MySQL : restaurez avec « mysql urithi < <dossier>/urithi.sql » puis copiez <dossier>/storage (voir docs/DEPLOIEMENT.md).');
    process.exit(1);
  }
  const source = path.resolve(dir);
  const { valid, problems } = await verifyBackup(source);
  if (!valid) {
    console.error('Sauvegarde invalide, restauration annulée :');
    for (const p of problems) console.error(` - ${p}`);
    process.exit(1);
  }
  if (!confirmed) {
    console.error('Sauvegarde vérifiée. Relancez avec --confirm pour restaurer (serveur arrêté).');
    process.exit(1);
  }
  await prisma.$disconnect();
  const suffix = `avant-restauration-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const dbFile = databaseFilePath();
  const storage = path.resolve(config.storageDir);
  if (await exists(dbFile)) await rename(dbFile, `${dbFile}.${suffix}`);
  if (await exists(storage)) await rename(storage, `${storage}-${suffix}`);
  await cp(path.join(source, 'urithi.db'), dbFile);
  if (await exists(path.join(source, 'storage'))) await cp(path.join(source, 'storage'), storage, { recursive: true });
  console.log('Restauration terminée. Données précédentes conservées avec le suffixe :', suffix);
}

try {
  switch (command) {
    case 'backup': {
      const result = await runBackup();
      console.log(`Sauvegarde créée : ${result.location} (${result.files} fichiers)`);
      if (result.mirror) console.log(`Copie miroir : ${result.mirror}`);
      break;
    }
    case 'verify': {
      if (!args[0]) throw new Error('Indiquez le dossier de sauvegarde');
      const { valid, problems } = await verifyBackup(path.resolve(args[0]));
      console.log(valid ? 'Sauvegarde intacte.' : `Problèmes détectés :\n - ${problems.join('\n - ')}`);
      process.exitCode = valid ? 0 : 1;
      break;
    }
    case 'restore-test': {
      const result = await restoreTest({ dir: args[0] ? path.resolve(args[0]) : undefined });
      console.log(result.success ? 'Test de restauration réussi.' : 'Test de restauration en échec.');
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.success ? 0 : 1;
      break;
    }
    case 'integrity': {
      const result = await runIntegrityCheck();
      console.log(`Fichiers contrôlés : ${result.checked}`, result.counts);
      process.exitCode = result.failures.length ? 1 : 0;
      break;
    }
    case 'restore': {
      if (!args[0]) throw new Error('Indiquez le dossier de sauvegarde');
      await restore(args[0], args.includes('--confirm'));
      break;
    }
    default:
      console.error('Commandes : backup | verify <dossier> | restore-test [dossier] | integrity | restore <dossier> --confirm');
      process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect().catch(() => {});
}
