import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';

export async function createBackup(filePath: string): Promise<string | null> {
  try {
    await fs.access(filePath);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;

    await fs.copyFile(filePath, backupPath);
    await fs.chmod(backupPath, 0o600);

    logger.gray(`Backup: ${backupPath}`);
    return backupPath;
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      logger.warning(`Could not create backup of ${filePath}: ${error.message}`);
    }
    return null;
  }
}

export async function cleanupOldBackups(
  filePath: string,
  keepCount: number = 5
): Promise<void> {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);

  try {
    const files = await fs.readdir(dir);
    const backups = files
      .filter(f => f.startsWith(`${basename}.backup.`))
      .sort()
      .reverse();

    for (const backup of backups.slice(keepCount)) {
      try {
        await fs.unlink(path.join(dir, backup));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
