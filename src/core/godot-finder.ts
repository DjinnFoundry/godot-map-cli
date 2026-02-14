/**
 * Detect Godot 4 executable on the system.
 * Checks: GODOT_PATH env, common install locations per OS, PATH.
 */

import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalize } from 'node:path';

const execFileAsync = promisify(execFile);

const GODOT_VALIDATION_TIMEOUT_MS = 5000;

const MACOS_PATHS = [
  '/Applications/Godot.app/Contents/MacOS/Godot',
  '/Applications/Godot_4.app/Contents/MacOS/Godot',
  `${process.env.HOME}/Applications/Godot.app/Contents/MacOS/Godot`,
  `${process.env.HOME}/Downloads/Godot.app/Contents/MacOS/Godot`,
].filter(p => !p.includes('undefined'));

const LINUX_PATHS = [
  '/usr/bin/godot',
  '/usr/local/bin/godot',
  '/snap/bin/godot',
  `${process.env.HOME}/.local/bin/godot`,
].filter(p => !p.includes('undefined'));

const WINDOWS_PATHS = [
  'C:\\Program Files\\Godot\\Godot.exe',
  'C:\\Program Files (x86)\\Godot\\Godot.exe',
  `${process.env.USERPROFILE}\\Godot\\Godot.exe`,
].filter(p => !p.includes('undefined'));

async function isValidGodot(path: string): Promise<boolean> {
  try {
    if (path !== 'godot' && !existsSync(path)) return false;
    await execFileAsync(path, ['--version'], { timeout: GODOT_VALIDATION_TIMEOUT_MS });
    return true;
  } catch {
    // Expected: path doesn't exist or isn't a valid Godot binary
    return false;
  }
}

export async function findGodot(): Promise<string | null> {
  // 1. Environment variable
  if (process.env.GODOT_PATH) {
    const p = normalize(process.env.GODOT_PATH);
    if (await isValidGodot(p)) return p;
  }

  // 2. In PATH
  if (await isValidGodot('godot')) return 'godot';

  // 3. Platform-specific locations
  const candidates =
    process.platform === 'darwin' ? MACOS_PATHS :
    process.platform === 'win32' ? WINDOWS_PATHS :
    LINUX_PATHS;

  for (const p of candidates) {
    const norm = normalize(p);
    if (await isValidGodot(norm)) return norm;
  }

  return null;
}

export async function getGodotVersion(godotPath: string): Promise<string> {
  const { stdout } = await execFileAsync(godotPath, ['--version'], { timeout: GODOT_VALIDATION_TIMEOUT_MS });
  return stdout.trim();
}
