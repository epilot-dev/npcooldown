import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import ini from 'ini';
import { createBackup, cleanupOldBackups } from '../backup.service.js';
import { parseMajor } from '../detect.service.js';
import type { CooldownConfig, WriteResult } from '../../types/index.js';

const PNPM_YAML_PATH = path.join(os.homedir(), '.config', 'pnpm', 'config.yaml');
const NPMRC_PATH = path.join(os.homedir(), '.npmrc');

export async function writePnpmConfig(params: {
  config: CooldownConfig;
  version: string | undefined;
}): Promise<WriteResult> {
  const { config, version } = params;
  const useYaml = parseMajor(version) >= 11;
  return useYaml ? writePnpmYaml(config) : writePnpmIni(config);
}

const writePnpmYaml = async (config: CooldownConfig): Promise<WriteResult> => {
  try {
    await fs.mkdir(path.dirname(PNPM_YAML_PATH), { recursive: true });
    await createBackup(PNPM_YAML_PATH);

    let existing: Record<string, any> = {};
    try {
      const content = await fs.readFile(PNPM_YAML_PATH, 'utf-8');
      existing = (yaml.load(content) as Record<string, any>) || {};
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }

    const next = {
      ...existing,
      minimumReleaseAge: config.days * 24 * 60,
      minimumReleaseAgeExclude: config.exclude,
      minimumReleaseAgeStrict: config.strict,
      minimumReleaseAgeIgnoreMissingTime: config.ignoreMissingTime,
      blockExoticSubdeps: config.blockExoticSubdeps
    };

    await fs.writeFile(PNPM_YAML_PATH, yaml.dump(next), 'utf-8');
    await fs.chmod(PNPM_YAML_PATH, 0o600);
    await cleanupOldBackups(PNPM_YAML_PATH);

    return { manager: 'pnpm', path: PNPM_YAML_PATH, success: true };
  } catch (error: any) {
    return { manager: 'pnpm', path: PNPM_YAML_PATH, success: false, error: error.message };
  }
};

const writePnpmIni = async (config: CooldownConfig): Promise<WriteResult> => {
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
      'minimum-release-age': config.days * 24 * 60,
      'minimum-release-age-exclude': config.exclude.join(','),
      'block-exotic-subdeps': config.blockExoticSubdeps
    };

    await fs.writeFile(NPMRC_PATH, ini.stringify(next), 'utf-8');
    await fs.chmod(NPMRC_PATH, 0o600);
    await cleanupOldBackups(NPMRC_PATH);

    return { manager: 'pnpm', path: NPMRC_PATH, success: true };
  } catch (error: any) {
    return { manager: 'pnpm', path: NPMRC_PATH, success: false, error: error.message };
  }
};
