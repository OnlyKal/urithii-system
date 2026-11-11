import { config } from '../config.js';
import { runBackup, runIntegrityCheck } from './backup.js';
import { publishDueItems } from './workflow.js';

// Tâches périodiques : publications programmées (chaque minute), puis
// contrôle d'intégrité et sauvegarde automatique (AUTO_BACKUP_HOURS, 0 pour
// désactiver).
export function startScheduler() {
  const publishTimer = setInterval(() => {
    publishDueItems().catch((err) => console.error('Publication programmée :', err));
  }, 60_000);
  publishTimer.unref();

  if (config.autoBackupHours > 0) {
    const backupTimer = setInterval(async () => {
      try {
        await runIntegrityCheck();
        await runBackup();
      } catch (err) {
        console.error('Sauvegarde automatique :', err);
      }
    }, config.autoBackupHours * 60 * 60 * 1000);
    backupTimer.unref();
  }
}
