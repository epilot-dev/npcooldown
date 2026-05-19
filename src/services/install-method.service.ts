import { execa } from 'execa';
import type { Manager } from '../types/index.js';

export type InstallMethod =
  | 'volta'
  | 'corepack'
  | 'brew'
  | 'bun-installer'
  | 'npm-global'
  | 'nvm'
  | 'fnm'
  | 'asdf'
  | 'unknown';

export interface InstallInfo {
  method: InstallMethod;
  binaryPath: string | null;
  updateCommand: string;
}

const whichCmd = process.platform === 'win32' ? 'where' : 'which';

export async function detectInstallMethod(manager: Manager): Promise<InstallInfo> {
  let binaryPath: string | null = null;
  try {
    const { stdout } = await execa(whichCmd, [manager], { timeout: 3000 });
    binaryPath = stdout.split('\n')[0].trim() || null;
  } catch {
    // not found on PATH
  }

  const method = inferMethod(binaryPath);
  return { method, binaryPath, updateCommand: updateCommandFor(manager, method) };
}

const inferMethod = (binaryPath: string | null): InstallMethod => {
  if (!binaryPath) return 'unknown';
  const p = binaryPath.toLowerCase();
  if (p.includes('/.volta/')) return 'volta';
  if (p.includes('/corepack/') || p.includes('/.local/share/node/corepack/')) return 'corepack';
  if (p.includes('homebrew') || p.includes('linuxbrew')) return 'brew';
  if (p.includes('/.bun/bin')) return 'bun-installer';
  if (p.includes('/.nvm/')) return 'nvm';
  if (p.includes('/.fnm/') || p.includes('/fnm_multishells/')) return 'fnm';
  if (p.includes('/.asdf/')) return 'asdf';
  if (p.includes('/node_modules/') || p.includes('/npm/')) return 'npm-global';
  return 'unknown';
};

const updateCommandFor = (manager: Manager, method: InstallMethod): string => {
  switch (manager) {
    case 'npm':
      switch (method) {
        case 'volta': return 'volta install node@latest';
        case 'brew': return 'brew upgrade node';
        case 'nvm': return 'nvm install node --reinstall-packages-from=current';
        case 'fnm': return 'fnm install --latest';
        case 'asdf': return 'asdf install nodejs latest && asdf global nodejs latest';
        default: return 'npm install -g npm@latest';
      }
    case 'pnpm':
      switch (method) {
        case 'volta': return 'volta install pnpm@latest';
        case 'corepack': return 'corepack prepare pnpm@latest --activate';
        case 'brew': return 'brew upgrade pnpm';
        case 'npm-global': return 'npm install -g pnpm@latest';
        default: return 'pnpm self-update';
      }
    case 'yarn':
      switch (method) {
        case 'volta': return 'volta install yarn@latest';
        case 'corepack': return 'corepack prepare yarn@stable --activate';
        case 'brew': return 'brew upgrade yarn';
        default: return 'corepack prepare yarn@stable --activate';
      }
    case 'bun':
      switch (method) {
        case 'volta': return 'volta install bun@latest';
        case 'brew': return 'brew upgrade bun';
        default: return 'bun upgrade';
      }
  }
};

export const runUpdate = async (command: string): Promise<boolean> => {
  try {
    await execa(command, { stdio: 'inherit', timeout: 10 * 60 * 1000, shell: true });
    return true;
  } catch {
    return false;
  }
};
