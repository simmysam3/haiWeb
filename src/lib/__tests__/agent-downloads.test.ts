// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { readFile, stat } = vi.hoisted(() => ({ readFile: vi.fn(), stat: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile, stat }));

import { loadManifest, fileExists, resolveDownloadSpec } from '../agent-downloads';

beforeEach(() => vi.clearAllMocks());

describe('loadManifest', () => {
  it('parses manifest.json', async () => {
    readFile.mockResolvedValue(JSON.stringify({ version: '1.2.3', zipFile: 'a.zip', zipBytes: 5, builtAt: 'x' }));
    expect(await loadManifest('/d')).toEqual({ version: '1.2.3', zipFile: 'a.zip', zipBytes: 5, builtAt: 'x' });
  });
  it('returns null when missing/unreadable', async () => {
    readFile.mockRejectedValue(new Error('ENOENT'));
    expect(await loadManifest('/d')).toBeNull();
  });
});

describe('fileExists', () => {
  it('true when stat resolves', async () => {
    stat.mockResolvedValue({});
    expect(await fileExists('x.pdf', '/d')).toBe(true);
  });
  it('false when stat rejects', async () => {
    stat.mockRejectedValue(new Error('ENOENT'));
    expect(await fileExists('x.pdf', '/d')).toBe(false);
  });
});

describe('resolveDownloadSpec', () => {
  it('maps "guide" to the fixed PDF (no manifest needed)', async () => {
    expect(await resolveDownloadSpec('guide', '/d')).toEqual({
      name: 'configuration-guide.pdf', contentType: 'application/pdf',
    });
  });
  it('maps "agent" to the manifest zip', async () => {
    readFile.mockResolvedValue(JSON.stringify({ zipFile: 'haiwave-agent-v9.9.9.zip' }));
    expect(await resolveDownloadSpec('agent', '/d')).toEqual({
      name: 'haiwave-agent-v9.9.9.zip', contentType: 'application/zip',
    });
  });
  it('returns null for "agent" when no manifest exists', async () => {
    readFile.mockRejectedValue(new Error('ENOENT'));
    expect(await resolveDownloadSpec('agent', '/d')).toBeNull();
  });
  it('returns null for an unknown key', async () => {
    expect(await resolveDownloadSpec('passwd', '/d')).toBeNull();
  });
});
