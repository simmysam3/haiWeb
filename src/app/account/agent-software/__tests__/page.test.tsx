// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession }));

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect }));

const { loadManifest, fileExists, resolveDownloadSpec } = vi.hoisted(() => ({
  loadManifest: vi.fn(),
  fileExists: vi.fn(),
  resolveDownloadSpec: vi.fn(),
}));
vi.mock('@/lib/agent-downloads', () => ({ loadManifest, fileExists, resolveDownloadSpec }));

import AgentSoftwarePage from '../page';

describe('AgentSoftwarePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadManifest.mockResolvedValue({
      version: '9.9.9',
      // Raw manifest name carries a path segment; the resolver basenames it.
      zipFile: 'sub/haiwave-agent-v9.9.9.zip',
      zipBytes: 1234,
      builtAt: '2026-06-08T00:00:00.000Z',
    });
    resolveDownloadSpec.mockResolvedValue({
      name: 'haiwave-agent-v9.9.9.zip',
      contentType: 'application/zip',
    });
    fileExists.mockResolvedValue(true);
  });

  it('redirects to /login when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    await AgentSoftwarePage();
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('renders (no redirect) when authenticated', async () => {
    getSession.mockResolvedValue({ participant: { id: 'p1' } });
    const result = await AgentSoftwarePage();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  it('derives agent availability from resolveDownloadSpec (resolved basename), not raw manifest.zipFile', async () => {
    getSession.mockResolvedValue({ participant: { id: 'p1' } });
    resolveDownloadSpec.mockResolvedValue({
      name: 'haiwave-agent-v1.2.3.zip',
      contentType: 'application/zip',
    });
    loadManifest.mockResolvedValue({
      version: '1.2.3',
      zipFile: 'sub/haiwave-agent-v1.2.3.zip',
      zipBytes: 1234,
      builtAt: '2026-06-08T00:00:00.000Z',
    });

    await AgentSoftwarePage();

    expect(resolveDownloadSpec).toHaveBeenCalledWith('agent');
    // Availability must be checked against the RESOLVED basename, not the raw
    // path-bearing manifest.zipFile.
    expect(fileExists).toHaveBeenCalledWith('haiwave-agent-v1.2.3.zip');
    expect(fileExists).not.toHaveBeenCalledWith('sub/haiwave-agent-v1.2.3.zip');
  });
});
