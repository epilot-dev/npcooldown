import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { createBackup, cleanupOldBackups } from '../backup.service.js';
import type { CooldownConfig, ReadResult, WriteResult } from '../../types/index.js';

const YARNRC_PATH = path.join(os.homedir(), '.yarnrc.yml');

const parseYarnDuration = (raw: string): number | undefined => {
  const match = /^(\d+)([dhmsw]?)$/i.exec(raw.trim());
  if (!match) return undefined;
  const n = Number(match[1]);
  const unit = (match[2] || 'd').toLowerCase();
  switch (unit) {
    case 'w': return n * 7;
    case 'd': return n;
    case 'h': return Math.round(n / 24);
    case 'm': return Math.round(n / (24 * 60));
    case 's': return Math.round(n / (24 * 60 * 60));
    default: return n;
  }
};

export async function readYarnConfig(): Promise<ReadResult> {
  try {
    const content = await fs.readFile(YARNRC_PATH, 'utf-8');
    const parsed = (yaml.load(content) as Record<string, any>) || {};
    const raw = parsed.npmMinimalAgeGate;
    const days = typeof raw === 'string' ? parseYarnDuration(raw) : typeof raw === 'number' ? raw : undefined;
    const exclude = Array.isArray(parsed.npmPreapprovedPackages) ? parsed.npmPreapprovedPackages : [];
    return { days, exclude };
  } catch {
    return { exclude: [] };
  }
}

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
