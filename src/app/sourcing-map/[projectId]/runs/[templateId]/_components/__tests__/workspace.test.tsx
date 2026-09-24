import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vomeroDetail, vomeroEstimate, vomeroExecution, vomeroProducts, vomeroRunTemplate } from '@/lib/sourcing-map/__fixtures__/vomero';
import { Workspace } from '../workspace';

const { push, refresh, replace, search } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), search: { value: '' } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace }),
  usePathname: () => '/sourcing-map/p/runs/t',
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} /> }));
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: undefined }) }));

const fetchMock = vi.fn();
function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}
beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  search.value = '';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => (url.endsWith('/estimate') ? reply(200, vomeroEstimate) : reply(404, { error: `unexpected ${url}` })));
});
afterEach(() => vi.unstubAllGlobals());

function mount(detail = vomeroDetail) {
  render(
    <Workspace projectName="Spring 2027" template={vomeroRunTemplate} library={vomeroProducts} executions={[vomeroExecution]} initialDetail={detail} />,
  );
}

describe('Workspace', () => {
  it('reads the as-of drop from ?drop= and writes a clicked drop back to the URL (spec §9.3)', async () => {
    search.value = 'drop=2027-04-15';
    mount();
    const leather = screen.getByRole('group', { name: 'Full grain leather hides' });
    expect(within(leather).getByText('16,000 sq ft by Mar 22')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jan 15 100%' }));
    expect(replace).toHaveBeenCalledWith('/sourcing-map/p/runs/t?drop=2027-01-15', { scroll: false });
  });
});
