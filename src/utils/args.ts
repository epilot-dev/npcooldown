import { parseArgs } from 'node:util';

export interface CliArgs {
  days?: number;
  exclude?: string[];
  noStrict: boolean;
  noBlockExotic: boolean;
  allowMissingTime: boolean;
  yes: boolean;
  help: boolean;
}

export const USAGE = `npcooldown — supply chain attack protection across npm, pnpm, Yarn, and Bun

Usage:
  npx npcooldown [options]

Options:
  --days <n>            Cooldown duration in days (default: 7)
  --exclude <pattern>   Exclude package/scope from cooldown (repeatable)
                        e.g. --exclude @epilot --exclude '@yourorg/*'
  --no-strict           Disable strict mode (allow falling through to older versions)
  --no-block-exotic     Disable blockExoticSubdeps (pnpm only)
  --allow-missing-time  Allow packages without registry timestamps to bypass cooldown
  -y, --yes             Skip prompts and apply with flags/defaults only
  -h, --help            Show this help

Examples:
  npx npcooldown
  npx npcooldown --days 7 --exclude '@epilot/*' --yes
  npx npcooldown --days 1 --exclude @internal-tools --no-block-exotic --yes
`;

export const parseCliArgs = (): CliArgs => {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      days: { type: 'string' },
      exclude: { type: 'string', multiple: true },
      'no-strict': { type: 'boolean' },
      'no-block-exotic': { type: 'boolean' },
      'allow-missing-time': { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' },
      help: { type: 'boolean', short: 'h' }
    },
    strict: true,
    allowPositionals: false
  });

  const daysNum = values.days != null ? Number(values.days) : undefined;
  if (values.days != null && (!Number.isFinite(daysNum) || daysNum! < 0)) {
    throw new Error(`Invalid --days value: ${values.days}`);
  }

  return {
    days: daysNum,
    exclude: values.exclude as string[] | undefined,
    noStrict: !!values['no-strict'],
    noBlockExotic: !!values['no-block-exotic'],
    allowMissingTime: !!values['allow-missing-time'],
    yes: !!values.yes,
    help: !!values.help
  };
};

const shellQuote = (s: string): string => {
  if (/^[A-Za-z0-9@/_.\-+]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
};

export const buildShareCommand = (params: {
  days: number;
  exclude: string[];
  strict: boolean;
  blockExoticSubdeps: boolean;
  ignoreMissingTime: boolean;
}): string => {
  const parts = ['npx npcooldown', `--days ${params.days}`];
  for (const e of params.exclude) parts.push(`--exclude ${shellQuote(e)}`);
  if (!params.strict) parts.push('--no-strict');
  if (!params.blockExoticSubdeps) parts.push('--no-block-exotic');
  if (params.ignoreMissingTime) parts.push('--allow-missing-time');
  parts.push('--yes');
  return parts.join(' ');
};
