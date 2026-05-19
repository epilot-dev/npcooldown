import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import ini from 'ini';
import { createBackup, cleanupOldBackups } from '../backup.service.js';
import type { CooldownConfig, WriteResult } from '../../types/index.js';

const NPMRC_PATH = path.join(os.homedir(), '.npmrc');

export async function writeNpmConfig(config: CooldownConfig): Promise<WriteResult> {
  try {
    await createBackup(NPMRC_PATH);

    let existing: Record<string, any> = {};
    try {
      const content = await fs.readFile(NPMRC_PATH, 'utf-8');
      existing = ini.parse(content);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }

    const next = {
      ...existing,
      'min-release-age': config.days
    };

    await fs.writeFile(NPMRC_PATH, ini.stringify(next), 'utf-8');
    await fs.chmod(NPMRC_PATH, 0o600);
    await cleanupOldBackups(NPMRC_PATH);

    return { manager: 'npm', path: NPMRC_PATH, success: true };
  } catch (error: any) {
    return { manager: 'npm', path: NPMRC_PATH, success: false, error: error.message };
  }
}
