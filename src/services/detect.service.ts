import { execa } from 'execa';
import type { DetectedManager, Manager } from '../types/index.js';

const MANAGERS: Manager[] = ['npm', 'pnpm', 'yarn', 'bun'];

export async function detectManagers(): Promise<DetectedManager[]> {
  const results = await Promise.all(
    MANAGERS.map(async (name): Promise<DetectedManager> => {
      try {
        const { stdout } = await execa(name, ['--version'], { timeout: 5000 });
        const version = stdout.trim().split('\n').pop()?.trim() ?? '';
        return { name, installed: true, version };
      } catch {
        return { name, installed: false };
      }
    })
  );

  return results;
}

export const parseMajor = (version: string | undefined): number => {
  if (!version) return 0;
  const match = version.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};
