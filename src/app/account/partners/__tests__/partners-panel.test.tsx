import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { MockAccessRequest, MockPartner } from '@/lib/mock-types';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { PartnersPanel } from '../partners-panel';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const pendingRequest: MockAccessRequest = {
  id: 'req-1',
  company_name: 'Acme Metals',
  contact_name: 'Jo Lee',
  message: '',
  requested_at: '2026-09-01T00:00:00Z',
  industry: 'Metals',
  location: 'Ohio',
  business_type: 'Corporation',
  company_description: 'Makes metal parts.',
  behavioral_score: 80,
  product_lines: [],
  region: 'Midwest',
  network_member_since: null,
  request_type: 'approved',
  invite: false,
  age_days: 2,
};

const activePartner: MockPartner = {
  id: 'p-acme',
  company_name: 'Acme Metals',
  status: 'approved',
  established_at: '2026-08-01T00:00:00Z',
  location: 'Ohio',
  industry: 'Metals',
  invite_yours: false,
  invite_theirs: false,
  connection_id: 'conn-1',
};

type Mutation = (url: string, init?: RequestInit) => Response | undefined;

/**
 * URL-routed fetch double at the BFF boundary: the two mount-time GETs are
 * seeded, every mutation is answered by `mutation`, anything else is a bug.
 */
type Seed = { requests?: MockAccessRequest[]; partners?: MockPartner[] | (() => MockPartner[]) };

function routeFetch(mutation: Mutation, seed: Seed = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (method === 'GET' && url === '/api/account/connections') return jsonResponse(seed.requests ?? []);
    if (method === 'GET' && url === '/api/account/partners') {
      return jsonResponse(typeof seed.partners === 'function' ? seed.partners() : seed.partners ?? []);
    }
    const answer = mutation(url, init);
    if (answer) return answer;
    throw new Error(`unexpected fetch ${method} ${url}`);
  });
}

async function renderQueue() {
  render(<PartnersPanel />);
  fireEvent.click(await screen.findByRole('button', { name: /approval queue/i }));
  await screen.findByText('Acme Metals');
}

describe('PartnersPanel — approve (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a 403 keeps the request in the queue, shows no success toast, and shows the error', async () => {
    routeFetch((url, init) =>
      url === '/api/account/connections/req-1' && init?.method === 'POST'
        ? jsonResponse({ error: 'Forbidden' }, 403)
        : undefined,
    { requests: [pendingRequest] });
    await renderQueue();

    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.getByText('Acme Metals')).toBeInTheDocument();
    expect(screen.queryByText(/approved connection with/i)).not.toBeInTheDocument();
  });

  it('a 2xx removes the request and reloads the active partners from the BFF (no invented row)', async () => {
    let approved = false;
    routeFetch((url, init) => {
      if (url === '/api/account/connections/req-1' && init?.method === 'POST') {
        approved = true;
        return jsonResponse({ id: 'conn-77', target_participant_id: 'p-me', status: 'approved' });
      }
      return undefined;
    }, {
      requests: [pendingRequest],
      // What the BFF serves once haiCore has recorded the approval.
      partners: () => (approved ? [{ ...activePartner, company_name: 'Acme Metals (as served by the BFF)', connection_id: 'conn-77' }] : []),
    });
    await renderQueue();

    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));

    await screen.findByText(/approved connection with acme metals/i);
    fireEvent.click(screen.getByRole('button', { name: /^active/i }));
    expect(await screen.findByText('Acme Metals (as served by the BFF)')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('PartnersPanel — block (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a 403 keeps the partner listed, shows no success toast, and shows the error', async () => {
    routeFetch((url, init) =>
      url === '/api/account/connections/blocked' && init?.method === 'POST'
        ? jsonResponse({ error: 'Forbidden' }, 403)
        : undefined,
    { partners: [activePartner] });
    render(<PartnersPanel />);
    await screen.findByText('Acme Metals');

    fireEvent.click(screen.getByRole('button', { name: /^block$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ban permanently/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.getByText('Acme Metals')).toBeInTheDocument();
    expect(screen.queryByText(/^banned /i)).not.toBeInTheDocument();
  });
});

describe('PartnersPanel — approve as trading partner (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('approves, then proposes the trading pair on the connection the response names, then reloads', async () => {
    const calls: string[] = [];
    routeFetch((url, init) => {
      if (url === '/api/account/connections/req-1' && init?.method === 'POST') {
        calls.push('approve');
        expect(JSON.parse(String(init.body))).toEqual({ action: 'approve' });
        return jsonResponse({ id: 'conn-77', target_participant_id: 'p-me', status: 'approved' });
      }
      if (url === '/api/account/connections/conn-77/invite' && init?.method === 'PATCH') {
        calls.push('invite');
        expect(JSON.parse(String(init.body))).toEqual({ invite: true });
        return jsonResponse({ id: 'conn-77', status: 'approved', invite_yours: true });
      }
      return undefined;
    }, {
      requests: [pendingRequest],
      partners: () => (calls.includes('invite') ? [{ ...activePartner, company_name: 'Acme Metals (BFF, invite sent)', invite_yours: true }] : []),
    });
    await renderQueue();

    fireEvent.click(screen.getByRole('button', { name: /approve as trading partner/i }));

    await screen.findByText(/approved as trading partner/i);
    expect(calls).toEqual(['approve', 'invite']);
    fireEvent.click(screen.getByRole('button', { name: /^active/i }));
    expect(await screen.findByText('Acme Metals (BFF, invite sent)')).toBeInTheDocument();
  });
});

describe('PartnersPanel — deny (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a 403 keeps the request in the queue, shows no success toast, and shows the error', async () => {
    routeFetch((url, init) =>
      url === '/api/account/connections/req-1' && init?.method === 'POST'
        ? jsonResponse({ error: 'Forbidden' }, 403)
        : undefined,
    { requests: [pendingRequest] });
    await renderQueue();

    fireEvent.click(screen.getByRole('button', { name: /^deny$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.getByText('Acme Metals')).toBeInTheDocument();
    expect(screen.queryByText(/declined connection from/i)).not.toBeInTheDocument();
  });
});

describe('PartnersPanel — downgrade (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a 403 keeps the trading pair, shows no success toast, and shows the error', async () => {
    routeFetch((url, init) =>
      url === '/api/account/connections/downgrade' && init?.method === 'POST'
        ? jsonResponse({ error: 'Forbidden' }, 403)
        : undefined,
    { partners: [{ ...activePartner, status: 'trading_pair', invite_yours: true, invite_theirs: true }] });
    render(<PartnersPanel />);
    await screen.findByText('Acme Metals');

    fireEvent.click(screen.getByRole('button', { name: /^downgrade$/i }));
    const confirm = (await screen.findAllByRole('button', { name: /^downgrade$/i })).at(-1)!;
    fireEvent.click(confirm);

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.queryByText(/downgraded .* to approved/i)).not.toBeInTheDocument();
    // Still a trading pair: the row-level Downgrade action is only offered to trading pairs.
    expect(screen.getAllByRole('button', { name: /^downgrade$/i }).length).toBeGreaterThan(0);
  });
});

describe('PartnersPanel — propose trading pair (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a 403 leaves the invite untouched, shows no success toast, and shows the error', async () => {
    routeFetch((url, init) =>
      url === '/api/account/connections/conn-1/invite' && init?.method === 'PATCH'
        ? jsonResponse({ error: 'Forbidden' }, 403)
        : undefined,
    { partners: [activePartner] });
    render(<PartnersPanel />);
    await screen.findByText('Acme Metals');

    fireEvent.click(screen.getByRole('button', { name: /^propose trading pair$/i }));
    const confirm = (await screen.findAllByRole('button', { name: /^propose trading pair$/i })).at(-1)!;
    fireEvent.click(confirm);

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.queryByText(/proposed trading pair with/i)).not.toBeInTheDocument();
    expect(screen.getByText(/your invite: not sent/i)).toBeInTheDocument();
  });
});

describe('PartnersPanel — request connection (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a 403 leaves the company unconnected, shows no success toast, and shows the error', async () => {
    const company = {
      id: 'c-foundry', company_name: 'Acme Foundry', location: 'Ohio', industry: 'Metals',
      description: 'Casts things.', connection_status: 'none' as const,
    };
    routeFetch((url, init) => {
      if ((init?.method ?? 'GET') === 'GET' && url.startsWith('/api/account/directory?q=')) return jsonResponse([company]);
      if (url === '/api/account/connections' && init?.method === 'POST') return jsonResponse({ error: 'Forbidden' }, 403);
      return undefined;
    });
    render(<PartnersPanel />);
    await screen.findByRole('button', { name: /approval queue/i });

    fireEvent.click(screen.getByRole('radio', { name: /directory/i }));
    fireEvent.change(await screen.findByPlaceholderText(/search by name, industry, or location/i), { target: { value: 'ac' } });
    fireEvent.click(await screen.findByRole('button', { name: /request connection/i }, { timeout: 3000 }));
    fireEvent.click(await screen.findByRole('button', { name: /send request/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/forbidden|permission/i);
    expect(screen.queryByText(/connection request sent/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request connection/i })).toBeInTheDocument();
  });
});

describe('PartnersPanel — network failure (SEC-web-account-1-05)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('a failed request shows the unreachable message and mutates nothing', async () => {
    routeFetch((url, init) => {
      if (url === '/api/account/connections/req-1' && init?.method === 'POST') throw new TypeError('Failed to fetch');
      return undefined;
    }, { requests: [pendingRequest] });
    await renderQueue();

    fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    expect(screen.getByText('Acme Metals')).toBeInTheDocument();
    expect(screen.queryByText(/approved connection with/i)).not.toBeInTheDocument();
  });
});

describe('PartnersPanel — remove partnership (SEC-web-account-1-02, §L-26)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('offers no Remove control: haiCore has no endpoint that removes an active connection', async () => {
    routeFetch(() => undefined, { partners: [activePartner] });
    render(<PartnersPanel />);
    await screen.findByText('Acme Metals');

    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument();
    // The real severance path stays available.
    expect(screen.getByRole('button', { name: /^block$/i })).toBeInTheDocument();
  });
});

describe('PartnersPanel — manifest progress (QUA-web-api-2-07)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('presents no manifest progress percentage: haiCore records no such figure', async () => {
    routeFetch(() => undefined, { partners: [activePartner] });
    render(<PartnersPanel />);
    await screen.findByText('Acme Metals');

    expect(screen.queryByText(/manifest progress/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });
});
