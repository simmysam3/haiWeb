"use client";

import { useState, type ReactNode } from "react";
import { DataTable, type Column } from "@/components/data-table";
import { Button } from "@/components/button";
import { Pill, type PillProps } from "@/components/pill";
import type {
  CounterpartyUpdateRow,
  CounterpartyUpdateCandidate,
  CounterpartyLocationCandidate,
  CounterpartyUpdateDecision,
} from "@/lib/counterparty-updates-types";
import { formatRelative } from "./sync-now-panel";

interface CounterpartyMeta {
  participant_id: string;
  name: string;
  pending_count: number;
}

type OnDecide = (id: string, decision: CounterpartyUpdateDecision) => void | Promise<void>;

interface UpdatesTableProps {
  rows: CounterpartyUpdateRow[];
  counterparties: CounterpartyMeta[];
  onDecide: OnDecide;
}

// ---- value rendering ----------------------------------------------------

/** strings as text; numbers with locale grouping; { amount_usd } as $5,000,000; booleans as Yes/No; an address tuple as two lines; anything else as JSON in <code>. */
export function renderValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.amount_usd === "number") {
      return `$${obj.amount_usd.toLocaleString()}`;
    }
    if (Array.isArray(obj.lines)) {
      const line1 = (obj.lines as string[]).join(", ");
      const line2 = [obj.city, obj.state, obj.postal_code].filter(Boolean).join(", ") + (obj.country ? ` ${obj.country}` : "");
      return (
        <div>
          <div>{line1}</div>
          <div>{line2}</div>
        </div>
      );
    }
    return <code>{JSON.stringify(value)}</code>;
  }
  return String(value);
}

// ---- status pill ----------------------------------------------------------

const STATUS_PILL: Record<string, { label: string; tone: NonNullable<PillProps["tone"]>; definition: string }> = {
  pending: {
    label: "pending",
    tone: "warn",
    definition: "Awaiting your decision: keep your value, take theirs, or link.",
  },
  approved: {
    label: "approved — awaiting your agent",
    tone: "info",
    definition: "You approved taking their value; your agent applies it on its next pass.",
  },
  applied: {
    label: "applied",
    tone: "success",
    definition: "Your agent wrote the approved value to your ERP.",
  },
  kept: {
    label: "kept",
    tone: "success",
    definition: "You kept your own value; the represented value is disregarded.",
  },
  converged: {
    label: "converged",
    tone: "success",
    definition: "Your ERP value now matches the represented value.",
  },
  archived: {
    label: "archived",
    tone: "neutral",
    definition: "No longer active.",
  },
};

function statusPill(row: CounterpartyUpdateRow) {
  if (row.status === "approved" && row.dirty) {
    return {
      label: "dirty — apply in your ERP",
      tone: "warn" as const,
      definition: "Approved, but your agent has not yet applied it to your ERP.",
    };
  }
  return STATUS_PILL[row.status] ?? { label: row.status, tone: "neutral" as const, definition: row.status };
}

const SOURCE_LABEL: Record<CounterpartyUpdateRow["source"], string> = {
  profile: "Profile",
  locations: "Locations",
  library: "Library",
  manifest: "Manifest",
  erp: "ERP",
};

const SOURCE_DEFINITION: Record<CounterpartyUpdateRow["source"], string> = {
  profile: "From the counterparty's company profile.",
  locations: "From the counterparty's shipping/plant locations.",
  library: "From the counterparty's library.",
  manifest: "From the counterparty's manifest.",
  erp: "From the counterparty's ERP-owned record.",
};

// ---- candidate formatting -------------------------------------------------

function cityState(city?: string | null, state?: string | null): string {
  return [city, state].filter(Boolean).join(", ");
}

function isIdentityCandidate(
  c: CounterpartyUpdateCandidate | CounterpartyLocationCandidate,
): c is CounterpartyUpdateCandidate {
  return "erp_ref" in c;
}

// ---- row actions -----------------------------------------------------------

function RowActions({ row, onDecide }: { row: CounterpartyUpdateRow; onDecide: OnDecide }) {
  const [selected, setSelected] = useState("");

  if (row.status !== "pending") {
    return <span className="text-slate text-xs">—</span>;
  }

  if (row.kind === "identity") {
    const candidates = (row.candidates ?? []).filter(isIdentityCandidate);
    if (candidates.length === 0) {
      return <span className="text-sm text-slate">No candidate records</span>;
    }
    return (
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="border border-slate/20 rounded px-2 py-1 text-sm"
        >
          <option value="">-- choose --</option>
          {candidates.map((c) => (
            <option key={c.erp_ref} value={c.erp_ref}>
              {c.name} · {c.erp_id} · {cityState(c.city, c.state)}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={!selected} onClick={() => onDecide(row.id, { link: Number(selected) })}>
          Link
        </Button>
      </div>
    );
  }

  if (row.kind === "location" && row.mine === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate">Not in your ERP</span>
        <Button size="sm" onClick={() => onDecide(row.id, { keep: "theirs" })}>
          Create in ERP
        </Button>
      </div>
    );
  }

  const locationCandidates =
    row.kind === "location"
      ? (row.candidates ?? []).filter((c): c is CounterpartyLocationCandidate => !isIdentityCandidate(c))
      : [];

  if (row.kind === "location" && locationCandidates.length > 0) {
    return (
      <div className="space-y-1">
        <ul className="text-xs text-slate space-y-0.5">
          {locationCandidates.map((c) => (
            <li key={c.location_ref}>
              {c.name} · {c.location_ref} · {cityState(c.city, c.state)}
            </li>
          ))}
        </ul>
        <Button size="sm" variant="secondary" onClick={() => onDecide(row.id, { keep: "mine" })}>
          Keep mine
        </Button>
        <p className="text-xs text-slate italic">
          Keeping yours suppresses this represented address until it changes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => onDecide(row.id, { keep: "mine" })}>
        Keep mine
      </Button>
      <Button size="sm" onClick={() => onDecide(row.id, { keep: "theirs" })}>
        Take theirs
      </Button>
    </div>
  );
}

// ---- grouping ---------------------------------------------------------

interface Group {
  id: string;
  name: string;
  pendingCount: number;
  rows: CounterpartyUpdateRow[];
}

function groupRows(rows: CounterpartyUpdateRow[], counterparties: CounterpartyMeta[]): Group[] {
  const order: string[] = [];
  const byId = new Map<string, CounterpartyUpdateRow[]>();
  for (const r of rows) {
    if (!byId.has(r.counterparty_participant_id)) {
      byId.set(r.counterparty_participant_id, []);
      order.push(r.counterparty_participant_id);
    }
    byId.get(r.counterparty_participant_id)!.push(r);
  }
  return order.map((id) => {
    const groupedRows = byId.get(id)!;
    const meta = counterparties.find((c) => c.participant_id === id);
    return {
      id,
      name: meta?.name ?? groupedRows[0].counterparty_name,
      pendingCount: meta?.pending_count ?? groupedRows.filter((r) => r.status === "pending").length,
      rows: groupedRows,
    };
  });
}

// ---- table ---------------------------------------------------------------

export function UpdatesTable({ rows, counterparties, onDecide }: UpdatesTableProps) {
  const groups = groupRows(rows, counterparties);

  const columns: Column<CounterpartyUpdateRow>[] = [
    {
      key: "attribute",
      label: "Attribute",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span>{r.label}</span>
          <Pill tone="neutral" definition={SOURCE_DEFINITION[r.source]}>
            {SOURCE_LABEL[r.source]}
          </Pill>
        </div>
      ),
    },
    { key: "mine", label: "Your ERP value", render: (r) => renderValue(r.mine) },
    { key: "theirs", label: "Represented value", render: (r) => renderValue(r.theirs) },
    {
      key: "theirs_updated_at",
      label: "Their last updated",
      render: (r) => {
        const rel = formatRelative(r.theirs_updated_at);
        return <span title={rel.title}>{rel.text}</span>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const p = statusPill(r);
        return (
          <Pill tone={p.tone} definition={p.definition}>
            {p.label}
          </Pill>
        );
      },
    },
    {
      key: "why",
      label: "Why",
      render: (r) => (r.apply_detail ? <span className="text-sm">{r.apply_detail}</span> : "—"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => <RowActions row={r} onDecide={onDecide} />,
    },
  ];

  if (groups.length === 0) {
    return <p className="text-sm text-slate">No counterparty updates.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.id}>
          <h3 className="text-sm font-semibold text-navy mb-2">
            {g.name} <span className="text-slate font-normal">({g.pendingCount} pending)</span>
          </h3>
          <DataTable columns={columns} data={g.rows} keyFn={(r) => r.id} />
        </div>
      ))}
    </div>
  );
}
