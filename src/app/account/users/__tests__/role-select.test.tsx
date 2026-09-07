import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleSelect, ROLES } from '../role-select';
import { definitionFor } from '@/components/pill';
import { isAssignableRole } from '@/lib/auth';

describe('RoleSelect — the role definition is available at the dropdown', () => {
  it('shows the selected role\'s definition from the pill vocabulary and describes the select with it', () => {
    render(<RoleSelect id="invite-role" value="buyer_view_only" onChange={() => {}} />);
    const select = screen.getByLabelText('Role');
    // The literal text from src/components/pill.tsx (status → buyer_view_only):
    // the same string the pill reads out to a screen reader.
    const definition = screen.getByText('Buyer role with view-only access.');
    expect(definition).toBeVisible();
    expect(select).toHaveAttribute('aria-describedby', definition.id);
  });

  it('changes the definition with the selection and reports the new role', () => {
    const onChange = vi.fn();
    render(<RoleSelect id="edit-role" value="buyer_view_only" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'procurement_transact' } });
    expect(onChange).toHaveBeenCalledWith('procurement_transact');
  });

  it('shows the definition of whatever value it is given (controlled)', () => {
    render(<RoleSelect id="edit-role" value="procurement_transact" onChange={() => {}} />);
    expect(screen.getByText('Procurement role permitted to transact.')).toBeInTheDocument();
    expect(screen.queryByText('Buyer role with view-only access.')).not.toBeInTheDocument();
  });
});

describe('RoleSelect — every dropdown role carries a definition and is assignable', () => {
  it('every option in ROLES resolves a definition from the pill vocabulary', () => {
    // A role offered here with no PILL_DEFINITIONS entry would render the
    // dropdown with no explanation and warn "[Pill] no definition resolved" on
    // the roster. The dropdown and the pill read from the same vocabulary, so
    // the two can never disagree — this pins that they cannot drift apart.
    for (const r of ROLES) expect(definitionFor('status', r), r).toBeTruthy();
  });

  it('every option in ROLES is assignable, so the BFF can never refuse one the dropdown offers', () => {
    // The route rejects any role outside ASSIGNABLE_USER_ROLES with a 400. A
    // role offered here but missing from that allowlist would be a dead option:
    // pickable, then refused on Save.
    for (const r of ROLES) expect(isAssignableRole(r), r).toBe(true);
  });

  it('both halves of the census can say no (calibration)', () => {
    // A census that cannot fail proves nothing, so the instrument is checked
    // against a known positive and two known negatives.
    expect(definitionFor('status', 'buyer_view_only')).toBeTruthy();
    expect(isAssignableRole('buyer_view_only')).toBe(true);
    // Unknown to both vocabularies.
    expect(definitionFor('status', 'not_a_role')).toBeFalsy();
    expect(isAssignableRole('not_a_role')).toBe(false);
    // Defined as a pill, but never assignable from this dropdown — so the
    // assignability half is load-bearing on its own, not shadowed by the
    // definition half.
    expect(definitionFor('status', 'account_owner')).toBeTruthy();
    expect(isAssignableRole('account_owner')).toBe(false);
  });

  it('offers Account Admin with its definition', () => {
    render(<RoleSelect id="invite-role" value="account_admin" onChange={() => {}} />);
    // An explicit label: without a STATUS_LABELS entry the option reads the raw id "account_admin".
    expect(screen.getByRole('option', { name: 'Account Admin' })).toBeInTheDocument();
    expect(screen.getByText('Account administrator; manages portal settings, the library and manifests.')).toBeInTheDocument();
  });
});
