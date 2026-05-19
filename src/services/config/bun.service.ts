import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parse, stringify } from 'smol-toml';
import { createBackup, cleanupOldBackups } from '../backup.service.js';
import type { CooldownConfig, ReadResult, WriteResult } from '../../types/index.js';

const BUNFIG_PATH = path.join(os.homedir(), '.bunfig.toml');

export async function readBunConfig(): Promise<ReadResult> {
  try {
    const content = await fs.readFile(BUNFIG_PATH, 'utf-8');
    const parsed = parse(content) as Record<string, any>;
    const install = (parsed.install as Record<string, any>) ?? {};
    const seconds = install.minimumReleaseAge != null ? Number(install.minimumReleaseAge) : undefined;
    const exclude = Array.isArray(install.minimumReleaseAgeExcludes) ? install.minimumReleaseAgeExcludes : [];
    return {
      days: Number.isFinite(seconds) ? Math.round(seconds! / 86400) : undefined,
      exclude
    };
  } catch {
    return { exclude: [] };
  }
}

export async function writeBunConfig(config: CooldownConfig): Promise<WriteResult> {
  try {
    await createBackup(BUNFIG_PATH);

    let existing: Record<string, any> = {};
    try {
      const content = await fs.readFile(BUNFIG_PATH, 'utf-8');
      existing = parse(content) as Record<string, any>;
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }

    const installSection = (existing.install as Record<string, any>) ?? {};
    const seconds = config.days * 24 * 60 * 60;

    const next = {
      ...existing,
      install: {
        ...installSection,
        minimumReleaseAge: seconds,
        ...(config.exclude.length > 0 && { minimumReleaseAgeExcludes: config.exclude })
      }
    };

    await fs.writeFile(BUNFIG_PATH, stringify(next), 'utf-8');
    await fs.chmod(BUNFIG_PATH, 0o600);
    await cleanupOldBackups(BUNFIG_PATH);

    return { manager: 'bun', path: BUNFIG_PATH, success: true };
  } catch (error: any) {
    return { manager: 'bun', path: BUNFIG_PATH, success: false, error: error.message };
  }
}
