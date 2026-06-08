import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Non-public directory holding the agent downloads (outside `public/`). */
export const DOWNLOAD_DIR = join(process.cwd(), 'private', 'agent-downloads');

export interface AgentManifest {
  version: string;
  zipFile: string;
  zipBytes: number;
  builtAt: string;
}

export interface DownloadSpec {
  name: string;
  contentType: string;
}

export async function loadManifest(dir: string = DOWNLOAD_DIR): Promise<AgentManifest | null> {
  try {
    return JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as AgentManifest;
  } catch {
    return null;
  }
}

export async function fileExists(name: string, dir: string = DOWNLOAD_DIR): Promise<boolean> {
  try {
    await stat(join(dir, name));
    return true;
  } catch {
    return false;
  }
}

/**
 * Map an allowlisted public key to a fixed on-disk file. The key (not raw user
 * input) selects the filename, so there is no path-traversal surface. Returns
 * null for unknown keys, or for "agent" before the zip has been built.
 */
export async function resolveDownloadSpec(
  file: string,
  dir: string = DOWNLOAD_DIR,
): Promise<DownloadSpec | null> {
  if (file === 'guide') {
    return { name: 'configuration-guide.pdf', contentType: 'application/pdf' };
  }
  if (file === 'agent') {
    const manifest = await loadManifest(dir);
    return manifest?.zipFile ? { name: manifest.zipFile, contentType: 'application/zip' } : null;
  }
  return null;
}
