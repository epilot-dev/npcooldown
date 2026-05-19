#!/usr/bin/env node

import chalk from 'chalk';
import { logger } from './utils/logger.js';
import {
  promptCooldownDays,
  promptExcludePatterns,
  promptStrictSettings,
  promptConfirmApply
} from './utils/prompts.js';
import { parseCliArgs, buildShareCommand, USAGE } from './utils/args.js';
import { detectManagers, parseMajor } from './services/detect.service.js';
import { writeNpmConfig, readNpmConfig } from './services/config/npm.service.js';
import { writePnpmConfig, readPnpmConfig } from './services/config/pnpm.service.js';
import { writeYarnConfig, readYarnConfig } from './services/config/yarn.service.js';
import { writeBunConfig, readBunConfig } from './services/config/bun.service.js';
import type { CooldownConfig, DetectedManager, ReadResult, WriteResult } from './types/index.js';

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

const readFor = (m: DetectedManager): Promise<ReadResult> => {
  switch (m.name) {
    case 'npm': return readNpmConfig();
    case 'pnpm': return readPnpmConfig();
    case 'yarn': return readYarnConfig();
    case 'bun': return readBunConfig();
  }
};

async function main() {
  let args;
  try {
    args = parseCliArgs();
  } catch (error: any) {
    logger.error(error.message);
    console.error(`\n${USAGE}`);
    process.exit(1);
  }

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  logger.banner('🧊 npcooldown — supply chain protection');
  logger.gray('Sets minimumReleaseAge across npm, pnpm, Yarn, and Bun');
  logger.newline();

  logger.info('Detecting installed package managers...');
  const detected = await detectManagers();

  const supported = detected.filter(isSupported);
  const unsupported = detected.filter((m) => m.installed && !isSupported(m));
  const missing = detected.filter((m) => !m.installed);

  for (const m of supported) logger.success(`${m.name} v${m.version}`);
  for (const m of unsupported) logger.warning(`${m.name} v${m.version} — version too old for minimumReleaseAge support, skipping`);
  for (const m of missing) logger.gray(`${m.name} not installed, skipping`);

  if (supported.length === 0) {
    logger.newline();
    logger.error('No supported package managers found.');
    logger.gray('Need at least one of: npm 11+, pnpm 10.16+, Yarn 4.10+, Bun 1.3+');
    process.exit(1);
  }

  logger.newline();
  logger.info('Reading existing cooldown settings...');
  const existing = await Promise.all(
    supported.map(async (m) => ({ manager: m.name, ...(await readFor(m)) }))
  );

  const existingDays = existing.map((e) => e.days).filter((d): d is number => typeof d === 'number');
  const existingExcludes = Array.from(new Set(existing.flatMap((e) => e.exclude)));

  if (existingDays.length > 0) {
    logger.gray(`Current cooldown across managers: ${existingDays.map((d) => `${d}d`).join(', ')}`);
  }
  if (existingExcludes.length > 0) {
    logger.gray(`Current excludes: ${existingExcludes.join(', ')}`);
  }
  logger.newline();

  const maxExisting = existingDays.length > 0 ? Math.max(...existingDays) : 0;
  const defaultDays = args.days ?? (maxExisting > 0 ? maxExisting : 7);
  const initialExcludes = Array.from(new Set([...existingExcludes, ...(args.exclude ?? [])]));

  let days: number;
  let exclude: string[];
  let strict: boolean;
  let ignoreMissingTime: boolean;
  let blockExoticSubdeps: boolean;

  if (args.yes) {
    days = args.days ?? defaultDays;
    exclude = args.exclude ? Array.from(new Set([...existingExcludes, ...args.exclude])) : existingExcludes;
    strict = !args.noStrict;
    ignoreMissingTime = args.allowMissingTime;
    blockExoticSubdeps = !args.noBlockExotic;
  } else {
    days = args.days ?? (await promptCooldownDays(defaultDays));
    exclude = args.exclude
      ? Array.from(new Set([...existingExcludes, ...args.exclude]))
      : await promptExcludePatterns(initialExcludes);

    const anyStrictFlag = args.noStrict || args.noBlockExotic || args.allowMissingTime;
    if (anyStrictFlag) {
      strict = !args.noStrict;
      ignoreMissingTime = args.allowMissingTime;
      blockExoticSubdeps = !args.noBlockExotic;
    } else {
      const strictSettings = await promptStrictSettings();
      strict = strictSettings.strict;
      ignoreMissingTime = strictSettings.ignoreMissingTime;
      blockExoticSubdeps = strictSettings.blockExoticSubdeps;
    }
  }

  const config: CooldownConfig = { days, exclude, strict, ignoreMissingTime, blockExoticSubdeps };

  logger.newline();
  logger.bold('Summary');
  logger.gray(`Cooldown: ${days} day${days === 1 ? '' : 's'}`);
  logger.gray(`Exclude:  ${exclude.length > 0 ? exclude.join(', ') : '(none)'}`);
  logger.gray(`Strict:   ${config.strict ? 'on' : 'off'}`);
  logger.gray(`Block missing timestamps: ${!config.ignoreMissingTime ? 'on' : 'off'}`);
  logger.gray(`Block exotic subdeps:     ${config.blockExoticSubdeps ? 'on' : 'off'} (pnpm)`);
  logger.newline();

  logger.bold('Will write:');
  for (const m of supported) logger.gray(`${m.name.padEnd(6)} → ${pathFor(m)}`);
  logger.newline();

  if (!args.yes) {
    const apply = await promptConfirmApply();
    if (!apply) {
      logger.warning('Aborted. No files were modified.');
      process.exit(0);
    }
    logger.newline();
  }

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

  logger.newline();
  logger.bold('Share this exact config with your team:');
  console.log(chalk.cyan(`  ${buildShareCommand(config)}`));
  logger.newline();
}

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
