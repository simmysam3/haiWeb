// src/app/admin/help/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  HelpAdminConversationDetail,
  HelpAdminConversationList,
  HelpAdminConversationSummary,
  HelpLanguage,
} from "@haiwave/protocol";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { DetailChevron } from "@/components/sonar/observations";

const LANGUAGES: Array<{ value: "" | HelpLanguage; label: string }> = [
  { value: "", label: "All languages" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "ko", label: "Korean" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type DetailState = HelpAdminConversationDetail | "loading" | "error";

export default function AdminHelpPage() {
  const [thumbsDown, setThumbsDown] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [language, setLanguage] = useState<"" | HelpLanguage>("");
  const [participantId, setParticipantId] = useState("");
  const [items, setItems] = useState<HelpAdminConversationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // HTTP status of a refused read; 0 = unreachable. A failed read is said, never a silent empty list.
  const [loadError, setLoadError] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});

  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (thumbsDown) params.set("thumbs_down", "true");
    if (flagged) params.set("flagged", "true");
    if (language) params.set("language", language);
    const pid = participantId.trim();
    if (UUID.test(pid)) params.set("participant_id", pid);
    params.set("page_size", "50");
    return params;
  }, [thumbsDown, flagged, language, participantId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/help/conversations?${filterParams}`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(r.status);
          setItems([]);
          setNextCursor(null);
          return;
        }
        const data = (await r.json()) as HelpAdminConversationList;
        setLoadError(null);
        setItems(data.items);
        setNextCursor(data.next_cursor);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(0);
          setItems([]);
          setNextCursor(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filterParams]);

  async function loadMore() {
    if (!nextCursor) return;
    const params = new URLSearchParams(filterParams);
    params.set("cursor", nextCursor);
    try {
      const r = await fetch(`/api/admin/help/conversations?${params}`);
      if (!r.ok) {
        setLoadError(r.status);
        return;
      }
      const data = (await r.json()) as HelpAdminConversationList;
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.next_cursor);
    } catch {
      setLoadError(0);
    }
  }

  async function toggle(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    const known = details[id];
    if (known && known !== "error") return;
    setDetails((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const r = await fetch(`/api/admin/help/conversations/${id}`);
      const detail: DetailState = r.ok ? ((await r.json()) as HelpAdminConversationDetail) : "error";
      setDetails((prev) => ({ ...prev, [id]: detail }));
    } catch {
      setDetails((prev) => ({ ...prev, [id]: "error" }));
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Help Conversations"
        description="Redacted HAIWAVE Help transcripts (kept 90 days). Use thumbs-down and flags to find gaps in the guide and the support brief."
      />
      {loadError !== null && (
        <div role="alert" className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
          Couldn&apos;t load help conversations — {loadError === 0 ? "the server could not be reached" : `haiCore answered ${loadError}`}. The list below is empty because of that, not because there are no conversations.
        </div>
      )}
      <Card>
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={thumbsDown} onChange={(e) => setThumbsDown(e.target.checked)} />
            Thumbs-down only
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
            Flagged only
          </label>
          <select
            aria-label="Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "" | HelpLanguage)}
            className="px-3 py-2 border border-slate/20 rounded-lg text-sm bg-white text-charcoal"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Participant id"
            placeholder="Participant id (UUID)"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            className="px-3 py-2 border border-slate/20 rounded-lg text-sm bg-white text-charcoal w-80"
          />
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate py-8 text-center">No help conversations match the current filters.</p>
        ) : (
          <ul className="divide-y divide-slate/10">
            {items.map((c) => {
              const isOpen = expanded === c.conversation_id;
              return (
                <li key={c.conversation_id}>
                  <button
                    type="button"
                    aria-label={`Conversation ${c.conversation_id}`}
                    aria-expanded={isOpen}
                    onClick={() => void toggle(c.conversation_id)}
                    className="group w-full flex items-center gap-4 py-3 text-left"
                  >
                    <span className="text-sm text-slate w-40 shrink-0">{new Date(c.started_at).toLocaleString()}</span>
                    <span className="text-sm text-slate w-40 shrink-0">{new Date(c.last_message_at).toLocaleString()}</span>
                    <span className="text-sm font-medium w-56 shrink-0 truncate">{c.participant_name ?? c.participant_id}</span>
                    <span className="text-sm text-slate w-40 shrink-0 truncate">{c.user_sub}</span>
                    <span className="text-sm text-slate w-14 shrink-0">{c.language}</span>
                    <span className="text-sm text-slate w-20 shrink-0">{`${c.message_count} msgs`}</span>
                    <span className="text-sm text-slate w-16 shrink-0">{`${c.thumbs_down_count} down`}</span>
                    <span className="text-xs text-problem flex-1 truncate">{c.flags.join(", ")}</span>
                    <DetailChevron expanded={isOpen} />
                  </button>
                  {isOpen && <DetailView state={details[c.conversation_id] ?? "loading"} />}
                </li>
              );
            })}
          </ul>
        )}

        {nextCursor && (
          <div className="flex justify-center mt-4 pt-4 border-t border-slate/10">
            <Button size="sm" variant="secondary" onClick={() => void loadMore()}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function DetailView({ state }: { state: DetailState }) {
  if (state === "loading") return <p className="pb-4 pl-6 text-sm text-slate">Loading…</p>;
  if (state === "error") return <p className="pb-4 pl-6 text-sm text-problem">Couldn&apos;t load this conversation.</p>;
  return (
    <div className="space-y-3 pb-4 pl-6 text-sm">
      <ul className="text-xs text-slate">
        {state.packs.map((p) => (
          <li key={p.version}>{`Pack ${p.version} · guide ${p.manifest.guide.edition} · agent ${p.manifest.agent.version} · brief ${p.manifest.brief.date}`}</li>
        ))}
      </ul>
      <ol className="space-y-2">
        {state.messages.map((m) => (
          <li key={m.message_id} className="rounded border border-slate/10 bg-light-gray/40 p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate">
              <span className="font-semibold text-charcoal">{m.role === "user" ? "User" : "HAIWAVE Help"}</span>
              <span>{m.status}</span>
              <span>{m.language}</span>
              {m.page_route && <span>{m.page_route}</span>}
              {m.role === "assistant" && (
                <span>{`in ${m.input_tokens ?? 0} (cached ${m.cached_tokens ?? 0}) · out ${m.output_tokens ?? 0} · ${m.latency_ms ?? 0} ms`}</span>
              )}
              {m.pack_version && <span>{`pack ${m.pack_version}`}</span>}
              {m.feedback && <span>{`feedback: ${m.feedback}${m.feedback_note ? ` — "${m.feedback_note}"` : ""}`}</span>}
            </div>
            <p className="whitespace-pre-wrap text-charcoal">{m.content}</p>
            {m.guard_flags.length > 0 && <p className="mt-1 text-xs text-problem">{`Flags: ${m.guard_flags.join(", ")}`}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
