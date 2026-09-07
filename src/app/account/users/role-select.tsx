"use client";

import { definitionFor } from "@/components/pill";
import { STATUS_LABELS } from "@/components/status-badge";

/** The roles an account owner may pick in the Invite and Edit dialogs. */
export const ROLES = [
  "account_admin",
  "procurement_read_only",
  "procurement_transact",
  "buyer_view_only",
  "buyer_request_quote",
  "buyer_full_transact",
  "inside_sales_read_only",
  "inside_sales_transact",
] as const;

interface RoleSelectProps {
  id: string;
  value: string;
  onChange: (role: string) => void;
}

/**
 * The Role dropdown with the selected role's definition under it. The copy
 * comes from the pill vocabulary (`definitionFor('status', role)`), the same
 * text the roster's pills read out to a screen reader, so the two can never
 * disagree (owner ruling 2026-09-06: available at the dropdown, not duplicated
 * under the table).
 */
export function RoleSelect({ id, value, onChange }: RoleSelectProps) {
  const definition = definitionFor("status", value);
  const definitionId = `${id}-definition`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-charcoal mb-1">Role</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={definition ? definitionId : undefined}
        className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{STATUS_LABELS[r] ?? r}</option>
        ))}
      </select>
      {definition && (
        <p id={definitionId} className="mt-1 text-xs text-slate">{definition}</p>
      )}
    </div>
  );
}
