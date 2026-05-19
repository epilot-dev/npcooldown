import { select, input, confirm } from '@inquirer/prompts';

export async function promptCooldownDays(): Promise<number> {
  const choice = await select({
    message: 'Cooldown duration (how old must a package version be before installing?):',
    choices: [
      { name: '1 day  — pnpm 11 default. Lowest friction.', value: 1 },
      { name: '3 days — Yarn 4 default. Covers weekend-published malware.', value: 3 },
      { name: '7 days — CISA recommendation. Strongest protection.', value: 7 },
      { name: 'Custom', value: -1 }
    ],
    default: 7
  });

  if (choice !== -1) return choice;

  return Number(
    await input({
      message: 'Custom cooldown (days):',
      default: '7',
      validate: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) return 'Must be a non-negative number';
        if (n > 365) return 'That seems too long (>365 days)';
        return true;
      }
    })
  );
}

export async function promptExcludePatterns(): Promise<string[]> {
  const raw = await input({
    message: 'Packages/scopes to exclude from cooldown (comma-separated, leave empty for none):',
    default: '',
    validate: (value) => {
      if (!value.trim()) return true;
      const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
      const invalid = parts.find((p) => /\s/.test(p));
      if (invalid) return `Pattern "${invalid}" contains whitespace`;
      return true;
    }
  });

  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

export async function promptStrictSettings(): Promise<{
  strict: boolean;
  ignoreMissingTime: boolean;
  blockExoticSubdeps: boolean;
}> {
  const useDefaults = await confirm({
    message: 'Apply additional strict security settings? (strict mode, block missing timestamps, block exotic subdeps — recommended)',
    default: true
  });

  if (useDefaults) {
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
