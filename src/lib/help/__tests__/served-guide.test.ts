// @vitest-environment node
// src/lib/help/__tests__/served-guide.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readServedGuide } from '../served-guide';

const SHA = 'ab'.repeat(32);
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'served-guide-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('readServedGuide', () => {
  it('reads the guide body SHA and the agent zip version', async () => {
    await writeFile(
      join(dir, 'configuration-guide.json'),
      JSON.stringify({ bodySha256: SHA, edition: '1.7', sourceFile: 'client-implementation-guidelines-v1.7.md', sourceSha256: 'cd'.repeat(32), builtAt: '2026-10-07T12:00:00.000Z' }),
    );
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ version: '1.102.0', zipFile: 'haiwave-agent-v1.102.0.zip', zipBytes: 1, builtAt: '2026-10-07T12:00:00.000Z' }));
    expect(await readServedGuide(dir)).toEqual({ guideSha: SHA, agentVersion: '1.102.0' });
  });

  // Amendment P3-3: until the bound guide body is rendered (Task 4.3) there is no
  // configuration-guide.json beside the agent zip, so this is the normal case today.
  it('yields a null SHA and the agent version while only the agent zip has been built', async () => {
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ version: '1.102.0', zipFile: 'haiwave-agent-v1.102.0.zip', zipBytes: 1, builtAt: '2026-10-07T12:00:00.000Z' }));
    expect(await readServedGuide(dir)).toEqual({ guideSha: null, agentVersion: '1.102.0' });
  });

  it('yields nulls when nothing has been built yet', async () => {
    expect(await readServedGuide(dir)).toEqual({ guideSha: null, agentVersion: null });
  });

  it('yields a null SHA for malformed JSON or a non-hex SHA', async () => {
    await writeFile(join(dir, 'configuration-guide.json'), '{oops');
    expect((await readServedGuide(dir)).guideSha).toBeNull();
    await writeFile(join(dir, 'configuration-guide.json'), JSON.stringify({ bodySha256: 'not-a-sha' }));
    expect((await readServedGuide(dir)).guideSha).toBeNull();
  });

  it('yields a null SHA when bodySha256 is not a string, even one that prints as a SHA', async () => {
    // String([SHA]) is the SHA itself, so the pattern alone would let this array through.
    await writeFile(join(dir, 'configuration-guide.json'), JSON.stringify({ bodySha256: [SHA] }));
    expect((await readServedGuide(dir)).guideSha).toBeNull();
  });

  it.each([
    ['an empty string', ''],
    ['a number', 1102],
    // Not a legal header value: fetch would throw building the request, and every question would answer 502.
    ['a line feed inside it', '1.102.0\n-rc1'],
  ])('yields a null agent version when manifest.json holds %s as its version', async (_what, version) => {
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({ version, zipFile: 'haiwave-agent.zip', zipBytes: 1, builtAt: '2026-10-07T12:00:00.000Z' }));
    expect((await readServedGuide(dir)).agentVersion).toBeNull();
  });
});
