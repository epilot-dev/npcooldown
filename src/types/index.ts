export type Manager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface DetectedManager {
  name: Manager;
  installed: boolean;
  version?: string;
}

export interface CooldownConfig {
  days: number;
  exclude: string[];
  strict: boolean;
  ignoreMissingTime: boolean;
  blockExoticSubdeps: boolean;
}

export interface WriteResult {
  manager: Manager;
  path: string;
  success: boolean;
  error?: string;
}
