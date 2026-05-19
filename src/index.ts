#!/usr/bin/env node

import { logger } from './utils/logger.js';
import {
  promptCooldownDays,
  promptExcludePatterns,
  promptStrictSettings,
  promptConfirmApply
} from './utils/prompts.js';
import { detectManagers, parseMajor } from './services/detect.service.js';
import { writeNpmConfig } from './services/config/npm.service.js';
import { writePnpmConfig } from './services/config/pnpm.service.js';
import { writeYarnConfig } from './services/config/yarn.service.js';
import { writeBunConfig } from './services/config/bun.service.js';
import type { CooldownConfig, DetectedManager, WriteResult } from './types/index.js';

const MIN_VERSIONS: Record<string, number> = {
  npm: 11,
  pnpm: 10,
  yarn: 4,
  bun: 1
};

const isSupported = (m: DetectedManager): boolean => {
  if (!m.installed || !m.version) return false;
  return parseMajor(m.version) >= MIN_VERSIONS[m.name];
};

async function main() {
  logger.banner('🧊 npcooldown — supply chain protection');
  logger.gray('Sets minimumReleaseAge across npm, pnpm, Yarn, and Bun');
  logger.newline();

  logger.info('Detecting installed package managers...');
  const detected = await detectManagers();

  const supported = detected.filter(isSupported);
  const unsupported = detected.filter((m) => m.installed && !isSupported(m));
  const missing = detected.filter((m) => !m.installed);

  for (const m of supported) {
    logger.success(`${m.name} v${m.version}`);
  }
  for (const m of unsupported) {
    logger.warning(`${m.name} v${m.version} — version too old for minimumReleaseAge support, skipping`);
  }
  for (const m of missing) {
    logger.gray(`${m.name} not installed, skipping`);
  }

  if (supported.length === 0) {
    logger.newline();
    logger.error('No supported package managers found.');
    logger.gray('Need at least one of: npm 11+, pnpm 10.16+, Yarn 4.10+, Bun 1.3+');
    process.exit(1);
  }

  logger.newline();

  const days = await promptCooldownDays();
  const exclude = await promptExcludePatterns();
  const strict = await promptStrictSettings();

  const config: CooldownConfig = {
    days,
    exclude,
    strict: strict.strict,
    ignoreMissingTime: strict.ignoreMissingTime,
    blockExoticSubdeps: strict.blockExoticSubdeps
  };

  logger.newline();
  logger.bold('Summary');
  logger.gray(`Cooldown: ${days} day${days === 1 ? '' : 's'}`);
  logger.gray(`Exclude:  ${exclude.length > 0 ? exclude.join(', ') : '(none)'}`);
  logger.gray(`Strict:   ${config.strict ? 'on' : 'off'}`);
  logger.gray(`Block missing timestamps: ${!config.ignoreMissingTime ? 'on' : 'off'}`);
  logger.gray(`Block exotic subdeps:     ${config.blockExoticSubdeps ? 'on' : 'off'} (pnpm)`);
  logger.newline();

  logger.bold('Will write:');
  for (const m of supported) {
    logger.gray(`${m.name.padEnd(6)} → ${pathFor(m)}`);
  }
  logger.newline();

  const apply = await promptConfirmApply();
  if (!apply) {
    logger.warning('Aborted. No files were modified.');
    process.exit(0);
  }

  logger.newline();
  const results: WriteResult[] = [];

  for (const m of supported) {
    logger.info(`Updating ${m.name}...`);
    const result = await writeFor(m, config);
    results.push(result);
    if (result.success) {
      logger.success(`${result.manager} → ${result.path}`);
    } else {
      logger.error(`${result.manager} failed: ${result.error}`);
    }
  }

  logger.newline();
  const failed = results.filter((r) => !r.success);
  if (failed.length === 0) {
    logger.success(`All done! Protection active across ${results.length} package manager${results.length === 1 ? '' : 's'}.`);
  } else {
    logger.warning(`${results.length - failed.length}/${results.length} succeeded. ${failed.length} failed — see errors above.`);
  }
  logger.gray('Run npcooldown again any time to update settings.');
  logger.newline();
}

const pathFor = (m: DetectedManager): string => {
  switch (m.name) {
    case 'npm': return '~/.npmrc';
    case 'pnpm': return parseMajor(m.version) >= 11 ? '~/.config/pnpm/config.yaml' : '~/.npmrc';
    case 'yarn': return '~/.yarnrc.yml';
    case 'bun': return '~/.bunfig.toml';
  }
};

const writeFor = (m: DetectedManager, config: CooldownConfig): Promise<WriteResult> => {
  switch (m.name) {
    case 'npm': return writeNpmConfig(config);
    case 'pnpm': return writePnpmConfig({ config, version: m.version });
    case 'yarn': return writeYarnConfig(config);
    case 'bun': return writeBunConfig(config);
  }
};

main().catch((error) => {
  if (error?.name === 'ExitPromptError') {
    logger.newline();
    logger.gray('Aborted.');
    process.exit(0);
  }
  logger.error('Unexpected error:');
  console.error(error);
  process.exit(1);
});
