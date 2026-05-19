import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { logger } from './logger.js';

const KNOWN_DURATIONS = [1, 3, 7];

export async function promptCooldownDays(defaultDays: number = 7): Promise<number> {
  const isKnown = KNOWN_DURATIONS.includes(defaultDays);

  const choices = [
    ...(isKnown ? [] : [{ name: `Keep current (${defaultDays} day${defaultDays === 1 ? '' : 's'})`, value: defaultDays }]),
    { name: '1 day  — pnpm 11 default. Lowest friction.', value: 1 },
    { name: '3 days — Yarn 4 default. Covers weekend-published malware.', value: 3 },
    { name: '7 days — CISA recommendation. Strongest protection.', value: 7 },
    { name: 'Custom', value: -1 }
  ];

  const choice = await select({
    message: 'Cooldown duration (how old must a package version be before installing?):',
    choices,
    default: defaultDays
  });

  if (choice !== -1) return choice;

  return Number(
    await input({
      message: 'Custom cooldown (days):',
      default: String(defaultDays),
      validate: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) return 'Must be a non-negative number';
        if (n > 365) return 'That seems too long (>365 days)';
        return true;
      }
    })
  );
}

export async function promptExcludePatterns(initial: string[] = []): Promise<string[]> {
  const collected = [...new Set(initial)];

  if (collected.length > 0) {
    console.log(chalk.gray(`  Existing excludes: ${collected.join(', ')}`));
  }

  let added = 0;
  while (true) {
    const next = await input({
      message: collected.length === 0
        ? 'Add an excluded scope/package (e.g. @epilot or @epilot/*) — leave empty to skip:'
        : `Add another exclude — leave empty when done [${collected.length} total]:`,
      default: ''
    });

    const trimmed = next.trim();
    if (!trimmed) break;
    if (/\s/.test(trimmed)) {
      logger.warning('Pattern cannot contain whitespace');
      continue;
    }
    if (collected.includes(trimmed)) {
      logger.warning(`Already added: ${trimmed}`);
      continue;
    }
    collected.push(trimmed);
    added++;
  }

  return collected;
}

export async function promptStrictSettings(): Promise<{
  strict: boolean;
  ignoreMissingTime: boolean;
  blockExoticSubdeps: boolean;
}> {
  const useStrict = await confirm({
    message: 'Apply strict security settings? (strict mode + block missing timestamps + block exotic subdeps — recommended)',
    default: true
  });

  if (useStrict) {
    return { strict: true, ignoreMissingTime: false, blockExoticSubdeps: true };
  }

  return { strict: false, ignoreMissingTime: true, blockExoticSubdeps: false };
}

export async function promptConfirmApply(): Promise<boolean> {
  return await confirm({
    message: 'Apply these changes?',
    default: true
  });
}
