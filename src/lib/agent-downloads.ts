import { readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

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
 * input) selects which file; for the manifest-derived zip the name is reduced
 * to a basename, so no path segment can escape the download dir. Returns null
 * for unknown keys, or for "agent" before the zip has been built.
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
    if (!manifest?.zipFile) return null;
    // The manifest is server-generated, but treat its filename as untrusted:
    // reduce to a bare basename so a stray path segment can never escape the
    // download dir when the route joins it onto DOWNLOAD_DIR.
    return { name: basename(manifest.zipFile), contentType: 'application/zip' };
  }
  return null;
}
