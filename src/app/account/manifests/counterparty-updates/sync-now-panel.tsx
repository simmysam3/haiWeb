"use client";

import { useEffect, useRef, useState } from "react";
import type { CounterpartySyncState, SyncNowResponse } from "@/lib/counterparty-updates-types";

/**
 * 10s x 30 ticks = 5 minutes. One named constant backs both the prose in the
 * spec and the polling loop below so the two figures cannot drift.
 */
export const SYNC_NOW_POLL = { intervalMs: 10_000, maxTicks: 30 } as const;

interface SyncNowPanelProps {
  state: CounterpartySyncState | null;
  /** Refetch trigger: called once right after a successful "started" POST, then again on every poll tick until last_run_id changes or maxTicks pass. */
  onStarted: () => void;
}

/** Relative time with an absolute-time title, for check-in / last-updated cells. Null renders "—" with no title. */
export function formatRelative(iso: string | null | undefined): { text: string; title?: string } {
  if (!iso) return { text: "—" };
  const then = new Date(iso);
  const ms = then.getTime();
  if (!Number.isFinite(ms)) return { text: "—" };
  const diffMs = Date.now() - ms;
  const minutes = Math.floor(diffMs / 60_000);
  let text: string;
  if (minutes < 1) {
    text = "just now";
  } else if (minutes < 60) {
    text = `${minutes}m ago`;
  } else {
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      text = `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      text = `${days} day${days === 1 ? "" : "s"} ago`;
    }
  }
  return { text, title: then.toLocaleString() };
}

function messageFor(status: string | undefined): string {
  switch (status) {
    case "already_running":
      return "A sync is already running";
    case "no_endpoint":
      return "Your agent has not registered an endpoint yet";
    case "agent_unreachable":
      return "Your agent could not be reached";
    default:
      return "Sync failed";
  }
}

export function SyncNowPanel({ state, onStarted }: SyncNowPanelProps) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const startRunIdRef = useRef<string | null>(null);
  const ticksRef = useRef(0);

  useEffect(() => {
    if (!polling) return;
    // A null state means the poll's own fetch failed — never read as the run finishing (or as
    // any run-id change at all); hold polling until a real state arrives, still bounded below by
    // maxTicks.
    if (state && (state.last_run_id ?? null) !== startRunIdRef.current) {
      setPolling(false);
      ticksRef.current = 0;
      return;
    }
    const id = setInterval(() => {
      onStarted();
      ticksRef.current += 1;
      if (ticksRef.current >= SYNC_NOW_POLL.maxTicks) {
        setPolling(false);
        ticksRef.current = 0;
      }
    }, SYNC_NOW_POLL.intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, state?.last_run_id]);

  async function handleClick() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/account/counterparty-updates/sync-now", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = typeof body?.error === "string" ? body.error : `Sync failed (${res.status})`;
        throw new Error(message);
      }
      const json: SyncNowResponse = await res.json();
      if (json.status === "started") {
        setNotice("Sync started");
        startRunIdRef.current = state?.last_run_id ?? null;
        ticksRef.current = 0;
        setPolling(true);
        onStarted();
      } else {
        setError(messageFor(json.status));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  const checkin = formatRelative(state?.last_checkin_at);
  const disabled = busy || polling || Boolean(state?.in_flight_since);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="rounded bg-teal text-white px-4 py-1.5 text-sm font-semibold hover:bg-teal/90 disabled:opacity-60"
        >
          {busy ? "Starting…" : "Sync all now"}
        </button>
        <span className="text-xs text-slate" title={checkin.title}>
          Last check-in {checkin.text} · next scheduled {state?.slot_utc ?? "—"} UTC
        </span>
      </div>
      {notice && <span className="text-xs text-slate">{notice}</span>}
      {error && (
        <span role="alert" className="text-xs text-problem">
          {error}
        </span>
      )}
    </div>
  );
}
