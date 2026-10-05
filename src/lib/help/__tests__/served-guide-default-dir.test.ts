// @vitest-environment node
// src/lib/help/__tests__/served-guide-default-dir.test.ts
// The default directory has its own file because node:fs/promises is mocked for the whole file.
import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';

const { readFile } = vi.hoisted(() => ({
  readFile: vi.fn<(path: string, encoding: string) => Promise<string>>(async () => {
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  }),
}));
vi.mock('node:fs/promises', async (importOriginal) => ({ ...(await importOriginal<typeof import('node:fs/promises')>()), readFile }));

import { readServedGuide } from '../served-guide';

describe('readServedGuide default directory', () => {
  it('reads both files from private/agent-downloads under the working directory (contract C.6)', async () => {
    expect(await readServedGuide()).toEqual({ guideSha: null, agentVersion: null });
    const base = join(process.cwd(), 'private', 'agent-downloads');
    expect(readFile.mock.calls.map(([path]) => path).sort()).toEqual([join(base, 'configuration-guide.json'), join(base, 'manifest.json')]);
  });
});
