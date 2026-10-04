// src/lib/help/served-guide.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DOWNLOAD_DIR, loadManifest } from '@/lib/agent-downloads';

export interface ServedGuide {
  guideSha: string | null;
  agentVersion: string | null;
}

const SHA256 = /^[0-9a-f]{64}$/;

/**
 * What this haiWeb instance serves right now (spec §6.3 step 1a): the guide body SHA
 * that `build:guide-pdf` writes next to the PDF (phase-1 Task 1.6) and the agent zip
 * version. Read per request rather than once per process — two small files — so a
 * re-rendered PDF on the rig is reflected without a restart. Missing or malformed
 * files yield nulls; haiCore treats a missing header as a mismatch and only flags it.
 */
export async function readServedGuide(dir: string = DOWNLOAD_DIR): Promise<ServedGuide> {
  let guideSha: string | null = null;
  try {
    const parsed = JSON.parse(await readFile(join(dir, 'configuration-guide.json'), 'utf8')) as { bodySha256?: unknown };
    if (typeof parsed.bodySha256 === 'string' && SHA256.test(parsed.bodySha256)) guideSha = parsed.bodySha256;
  } catch {
    // Not built yet, or unreadable.
  }
  const manifest = await loadManifest(dir);
  const agentVersion = typeof manifest?.version === 'string' && manifest.version !== '' ? manifest.version : null;
  return { guideSha, agentVersion };
}
