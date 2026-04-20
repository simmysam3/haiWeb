import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = {
  listGeneratedKeys: vi.fn(),
  listMyInstallations: vi.fn(),
  getSharingPolicy: vi.fn(),
};

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async () =>
      handler({
        client: mockClient,
        session: { participant: { id: 'pid' } },
        request: {} as unknown,
        params: {},
      }),
}));

describe('GET /api/account/provenance-keys/dashboard', () => {
  beforeEach(() => {
    mockClient.listGeneratedKeys.mockReset();
    mockClient.listMyInstallations.mockReset();
    mockClient.getSharingPolicy.mockReset();
  });

  it('composes generated + installations + sharingPolicy + aggregateCounts', async () => {
    mockClient.listGeneratedKeys.mockResolvedValueOnce([
      {
        key_id: 'k1',
        active_installations: 3,
        total_installations: 3,
        active_compliant: 2,
        active_grace_pending: 1,
        active_non_compliant: 0,
      },
    ]);
    mockClient.listMyInstallations.mockResolvedValueOnce([
      {
        installation_id: 'i1',
        compliance: { status: 'grace_pending', missing_fields: ['x'], grace_deadline: null },
      },
      {
        installation_id: 'i2',
        compliance: { status: 'compliant', missing_fields: [], grace_deadline: null },
      },
    ]);
    mockClient.getSharingPolicy.mockResolvedValueOnce({ shared_fields: ['facility_country'] });

    const { GET } = await import('../route');
    const res = await GET();
    const json = await res.json();

    expect(json.generated).toHaveLength(1);
    expect(json.installations).toHaveLength(2);
    expect(json.sharingPolicy.shared_fields).toEqual(['facility_country']);
    expect(json.aggregateCounts).toEqual({
      generatorActiveCompliant: 2,
      generatorActiveGracePending: 1,
      generatorActiveNonCompliant: 0,
      installerGracePending: 1,
      installerNonCompliant: 0,
    });
  });

  it('returns zero aggregate counts when no keys or installations exist', async () => {
    mockClient.listGeneratedKeys.mockResolvedValueOnce([]);
    mockClient.listMyInstallations.mockResolvedValueOnce([]);
    mockClient.getSharingPolicy.mockResolvedValueOnce({ shared_fields: [] });

    const { GET } = await import('../route');
    const res = await GET();
    const json = await res.json();

    expect(json.aggregateCounts).toEqual({
      generatorActiveCompliant: 0,
      generatorActiveGracePending: 0,
      generatorActiveNonCompliant: 0,
      installerGracePending: 0,
      installerNonCompliant: 0,
    });
  });
});
