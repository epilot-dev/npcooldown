# 🧊 npcooldown
[![CI](https://github.com/epilot-dev/npcooldown/workflows/CI/badge.svg)](https://github.com/epilot-dev/npcooldown/actions?query=workflow%3ACI)
[![npm version](https://img.shields.io/npm/v/npcooldown.svg)](https://www.npmjs.com/package/npcooldown)
[![License](http://img.shields.io/:license-mit-blue.svg)](https://github.com/epilot-dev/npcooldown/blob/master/LICENSE)

**Protect yourself from npm supply chain attacks in one command.** Sets up `minimumReleaseAge` cooldowns across npm, pnpm, Yarn Berry, and Bun globally — so freshly-published malware never makes it into your `node_modules`.

```sh
npx npcooldown
```

## Demo

```text
🧊 npcooldown — supply chain protection

  Sets minimumReleaseAge across npm, pnpm, Yarn, and Bun

→ Detecting installed package managers...
✓ npm v11.12.1
✓ yarn v4.14.1
✓ bun v1.3.11
⚠ pnpm v9.15.9 — too old for minimumReleaseAge support

→ Checking how the outdated managers were installed...
  pnpm (via volta) → volta install pnpm@latest

? Update them now? yes
? Run "volta install pnpm@latest" to update pnpm? yes

→ Running: volta install pnpm@latest
success: installed pnpm@11.1.0 with executables: pnpm, pnpx, pn, pnx

→ Re-detecting versions after updates...
✓ npm v11.12.1
✓ pnpm v11.1.0
✓ yarn v4.14.1
✓ bun v1.3.11

→ Reading existing cooldown settings...
  Current cooldown across managers: 7d, 7d, 7d
  Current excludes: @yourorg, @yourorg-internal

? Cooldown duration (how old must a package version be before installing?): 7 days — CISA recommendation. Strongest protection.
  Existing excludes: @yourorg, @yourorg-internal
? Add another exclude — leave empty when done [2 total]:
? Apply strict security settings? (strict mode + block missing timestamps + block exotic subdeps — recommended) yes

Summary
  Cooldown: 7 days
  Exclude:  @yourorg, @yourorg-internal
  Strict:   on
  Block missing timestamps: on
  Block exotic subdeps:     on (pnpm)

Will write:
  npm    → ~/.npmrc
  pnpm   → ~/.config/pnpm/config.yaml
  yarn   → ~/.yarnrc.yml
  bun    → ~/.bunfig.toml

? Apply these changes? yes

→ Updating npm...
  Backup: ~/.npmrc.backup.2026-05-19T08-27-10-973Z
✓ npm → ~/.npmrc
→ Updating pnpm...
✓ pnpm → ~/.config/pnpm/config.yaml
→ Updating yarn...
  Backup: ~/.yarnrc.yml.backup.2026-05-19T08-27-10-979Z
✓ yarn → ~/.yarnrc.yml
→ Updating bun...
  Backup: ~/.bunfig.toml.backup.2026-05-19T08-27-10-981Z
✓ bun → ~/.bunfig.toml

✓ All done! Protection active across 4 package managers.
```

## The Problem

2025-2026 has been a brutal year for the JavaScript supply chain:

- **Shai-Hulud worm** (Sept 2025) — self-propagating npm malware that stole credentials from hundreds of packages
- **chalk / debug compromise** (Sept 2025) — billions of weekly downloads affected for hours
- **Nx s1ngularity attack** (Aug 2025) — malicious post-install scripts harvesting tokens
- **axios RAT** (Mar 2026) — poisoned versions live for 4 hours, phoning home within 2 seconds of `npm install`

The pattern is always the same: attacker compromises a maintainer token, publishes a malicious version, gets removed within hours — but anyone running `npm install` in that window is owned.

**The fix is a "cooldown" — refuse to install package versions younger than N days.** Most malicious releases are detected and yanked within 24-72 hours, so a 7-day cooldown blocks essentially every fast-burn supply chain attack.

The problem is that every package manager calls this setting something different and stores it in a different file with different units. `npcooldown` configures all of them at once.

## How It Works

`npcooldown` is a **transparent config writer**. It walks you through one short prompt, then writes the appropriate cooldown setting to each package manager's global config file:

| Manager | File | Key | Units |
|---|---|---|---|
| npm (11.10+) | `~/.npmrc` | `min-release-age` | days |
| pnpm (11+) | `~/.config/pnpm/config.yaml` | `minimumReleaseAge` | minutes |
| pnpm (10.16+) | `~/.npmrc` | `minimum-release-age` | minutes |
| Yarn Berry (4.10+) | `~/.yarnrc.yml` | `npmMinimalAgeGate` | duration string |
| Bun (1.3+) | `~/.bunfig.toml` | `minimumReleaseAge` | seconds |

It only writes config for managers you actually have installed, backs up existing files with a timestamp, and merges with whatever settings you already have.

## Security & Privacy

- ✅ **Open source** — full code transparency
- ✅ **No network calls** — everything is local file writes
- ✅ **No data collection** — your config never leaves your machine
- ✅ **Timestamped backups** — every file is backed up before modification
- ✅ **Restrictive permissions** — backups are written `0600`
- ✅ **Merges, never replaces** — your existing config keys are preserved

## Requirements

- Node.js 18+
- At least one of: npm 11.10+, pnpm 10.16+, Yarn Berry 4.10+, Bun 1.3+

(Older versions are skipped with a warning — the `minimumReleaseAge` settings only exist in these versions.)

## Quick Start

```sh
npx npcooldown
```

The interactive CLI walks you through:

- **Cooldown duration** — 1 day, 3 days, **7 days (recommended, CISA)**, or custom
- **Exclude patterns** — packages/scopes that bypass the cooldown (e.g. `@yourorg/*` for internal packages you publish and install immediately)
- **Strict mode** — fail install if no version satisfies the age constraint (default: on)
- **Block exotic subdeps** — pnpm-only; prevents transitive deps from pulling from git/tarball URLs (default: on)

Then it shows you a preview of what will change in each file, asks for confirmation, and writes.

When you've run it before, existing values are read back from disk and presented as defaults — so re-running to tweak one setting doesn't make you re-type everything.

### Non-interactive mode (share with your team)

After a successful run, `npcooldown` prints a single copy-pasteable command that reproduces your exact config:

```sh
npx npcooldown --days 7 --exclude '@epilot/*' --exclude '@yourorg/*' --yes
```

Paste it into your team's onboarding docs or `package.json` setup script. Run with `--help` to see all flags:

```sh
npx npcooldown --help
```

### Recommended Cooldown Duration

| Duration | Tradeoff |
|---|---|
| **1 day** (1440 min) | pnpm 11's built-in default. Catches fast-detected attacks. Lowest friction. |
| **3 days** (4320 min) | Yarn Berry's built-in default. Covers weekend-published malware. |
| **7 days** (10080 min) | **CISA's explicit recommendation.** Would have blocked every known 2025-2026 fast-burn supply chain attack. |

The CLI defaults to **7 days** — strongest protection, marginal friction. Override at any time by running `npcooldown` again.

### Excluding Internal Packages

If you publish and immediately install your own organization's packages (e.g. CI/CD pipelines for `@yourorg/*`), the cooldown will block them. Add them to the exclude list:

```
Exclude patterns: @yourorg/*, @yourorg-internal/*
```

Patterns support glob-style wildcards. Pnpm and Yarn handle them natively; Bun and npm support exact package names.

## What If I Need a Hotfix?

If a critical security update lands and you need it *before* the cooldown clears, you have three options:

1. **Add the package to your exclude list** — `npcooldown` re-run, add the name, done
2. **Temporarily lower the cooldown** — run `npcooldown` again with a shorter duration
3. **Override on the command line** (manager-specific) — e.g. pnpm's `--minimum-release-age=0` flag for a one-off install

The default settings prioritize safety over speed, on the theory that you'd rather wait a week for chalk@5.4.1 than ship a credential-stealing worm.

## Notes

- Config backups are saved as `~/.npmrc.backup.TIMESTAMP`, `~/.yarnrc.yml.backup.TIMESTAMP`, etc. — last 5 are kept per file.
- Running `npcooldown` again is idempotent — it overwrites the cooldown keys but preserves everything else.
- For project-level overrides (e.g. a single repo needs different settings), edit that repo's `pnpm-workspace.yaml`, `.npmrc`, `.yarnrc.yml`, or `bunfig.toml` directly — `npcooldown` only writes global config.

## Related Reading

- [pnpm: Mitigating supply chain attacks](https://pnpm.io/supply-chain-security)
- [Socket: npm Introduces minimumReleaseAge](https://socket.dev/blog/npm-introduces-minimumreleaseage-and-bulk-oidc-configuration)
- [CISA Alert on axios npm compromise](https://www.cisa.gov/news-events/alerts/2026/04/20/supply-chain-compromise-impacts-axios-node-package-manager)
- [Dani Akash: Minimum Release Age is an Underrated Supply Chain Defense](https://daniakash.com/posts/simplest-supply-chain-defense/)

## License

MIT — This tool is not affiliated with npm, Inc., pnpm, Yarn, or Oven (Bun).
