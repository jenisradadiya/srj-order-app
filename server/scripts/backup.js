// `npm run backup`: writes today's database backup to server/data/backups now.
import { backupDatabase } from '../src/backup.js';

console.log('Backup written:', backupDatabase());
