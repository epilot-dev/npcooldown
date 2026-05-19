import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { createBackup, cleanupOldBackups } from '../backup.service.js';
import type { CooldownConfig, WriteResult } from '../../types/index.js';

const YARNRC_PATH = path.join(os.homedir(), '.yarnrc.yml');

export async function writeYarnConfig(config: CooldownConfig): Promise<WriteResult> {
  try {
    await createBackup(YARNRC_PATH);

    let existing: Record<string, any> = {};
    try {
      const content = await fs.readFile(YARNRC_PATH, 'utf-8');
      existing = (yaml.load(content) as Record<string, any>) || {};
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }

    const next: Record<string, any> = {
      ...existing,
      npmMinimalAgeGate: `${config.days}d`
    };

    if (config.exclude.length > 0) {
      next.npmPreapprovedPackages = config.exclude;
    }

    await fs.writeFile(YARNRC_PATH, yaml.dump(next), 'utf-8');
    await fs.chmod(YARNRC_PATH, 0o600);
    await cleanupOldBackups(YARNRC_PATH);

    return { manager: 'yarn', path: YARNRC_PATH, success: true };
  } catch (error: any) {
    return { manager: 'yarn', path: YARNRC_PATH, success: false, error: error.message };
  }
}
