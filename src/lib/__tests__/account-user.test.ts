import { describe, it, expect } from 'vitest';
import { toAccountUser } from '../account-user';

describe('toAccountUser', () => {
  it('maps a Keycloak user representation to the snake_case account DTO', () => {
    const dto = toAccountUser({
      id: 'kc1',
      email: 'a@b.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      enabled: true,
      attributes: { role: ['procurement_transact'], participant_id: ['p1'] },
    });
    expect(dto).toMatchObject({
      id: 'kc1',
      email: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      role: 'procurement_transact',
      status: 'active',
    });
  });

  it('marks a disabled user disabled, defaults a missing role, and tolerates missing fields', () => {
    const dto = toAccountUser({ id: 'kc2', enabled: false });
    expect(dto.status).toBe('disabled');
    expect(dto.role).toBe('buyer_view_only');
    expect(dto.first_name).toBe('');
    expect(dto.email).toBe('');
  });
});
