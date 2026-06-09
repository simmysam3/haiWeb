// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession }));

const { resolveDownloadSpec, fileExists, DOWNLOAD_DIR } = vi.hoisted(() => ({
  resolveDownloadSpec: vi.fn(),
  fileExists: vi.fn(),
  DOWNLOAD_DIR: '/downloads',
}));
vi.mock('@/lib/agent-downloads', () => ({ resolveDownloadSpec, fileExists, DOWNLOAD_DIR }));

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile }));

import { GET } from '../route';

const call = (file: string) =>
  GET(
    new NextRequest(`http://localhost/api/agent-software/download/${file}`),
    { params: Promise.resolve({ file }) },
  );

describe('GET /api/agent-software/download/[file]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ participant: { id: 'p1' } });
    fileExists.mockResolvedValue(true);
    readFile.mockResolvedValue(Buffer.from('bytes'));
    resolveDownloadSpec.mockResolvedValue({ name: 'configuration-guide.pdf', contentType: 'application/pdf' });
  });

  it('401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await call('guide');
    expect(res.status).toBe(401);
    expect(resolveDownloadSpec).not.toHaveBeenCalled();
  });

  it('400 for an unknown / traversal key (not in the allowlist)', async () => {
    const res = await call('passwd');
    expect(res.status).toBe(400);
    expect(resolveDownloadSpec).not.toHaveBeenCalled();
  });

  it('404 for a known key whose file is not built yet (null spec)', async () => {
    resolveDownloadSpec.mockResolvedValue(null);
    const res = await call('agent');
    expect(res.status).toBe(404);
  });

  it('404 when the resolved file is not on disk', async () => {
    fileExists.mockResolvedValue(false);
    const res = await call('agent');
    expect(res.status).toBe(404);
  });

  it('streams the file with attachment headers on success', async () => {
    resolveDownloadSpec.mockResolvedValue({ name: 'haiwave-agent-v9.9.9.zip', contentType: 'application/zip' });
    const res = await call('agent');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="haiwave-agent-v9.9.9.zip"');
  });
});
