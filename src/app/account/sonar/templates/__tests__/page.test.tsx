import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectMock = vi.fn((url: string) => {
  // Mirror next/navigation: redirect() throws a sentinel error so the
  // component aborts. Tests catch + inspect the captured URL.
  throw new Error(`__NEXT_REDIRECT__:${url}`);
});

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

beforeEach(() => {
  redirectMock.mockClear();
});

async function runPage(observation_class?: string) {
  const Page = (await import('../page')).default;
  await expect(
    Page({ searchParams: Promise.resolve({ observation_class }) }),
  ).rejects.toThrow(/__NEXT_REDIRECT__/);
  return redirectMock.mock.calls[0]?.[0];
}

describe('TemplatesRedirect — v.1.41 dispatch by observation_class', () => {
  it('?observation_class=watcher → /account/sonar/posture/runs (watcher home today; flips to /sonar/watchers in PR-B)', async () => {
    expect(await runPage('watcher')).toBe('/account/sonar/posture/runs');
  });

  it('?observation_class=phantom_demand → /account/sonar/observations', async () => {
    expect(await runPage('phantom_demand')).toBe('/account/sonar/observations');
  });

  it('?observation_class=audit → /account/sonar/audit', async () => {
    expect(await runPage('audit')).toBe('/account/sonar/audit');
  });

  it('no class → defaults to the watcher home', async () => {
    expect(await runPage(undefined)).toBe('/account/sonar/posture/runs');
  });

  it('unknown class → defaults to the watcher home (graceful)', async () => {
    expect(await runPage('not-a-real-class')).toBe('/account/sonar/posture/runs');
  });
});
