"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { Pill } from "@/components/pill";
import { DetailChevron } from "@/components/sonar/observations";

interface FeedbackRow {
  event_id: string;
  occurred_at: string;
  received_at: string;
  session_id: string;
  message_id: string;
  sentiment: "up" | "down";
  feedback_text?: string;
  user_query?: string;
  assistant_response?: string;
  end_user: string;
  client_version: string;
  protocol_version: string;
  deployment: "internal" | "external";
  answer_provenance?: string;
  agent_id: string;
  participant_id: string;
  participant_legal_name: string | null;
}

interface FeedbackResponse {
  events: FeedbackRow[];
  total: number;
  page: number;
  page_size: number;
}

// House rule: no mock-data fallback (the audit page's MOCK_AUDIT pattern is on
// the mock-data backlog). Start from an empty response and let the fetch fill it.
const EMPTY: FeedbackResponse = { events: [], total: 0, page: 1, page_size: 50 };

export default function AdminFeedbackPage() {
  const [data, setData] = useState<FeedbackResponse>(EMPTY);
  const [sentiment, setSentiment] = useState("");
  const [deployment, setDeployment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Shared by both the fetch effect and the download href so the exported
  // JSONL always matches exactly what's on screen.
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (sentiment) params.set("sentiment", sentiment);
    if (deployment) params.set("deployment", deployment);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    return params;
  }, [sentiment, deployment, from, to]);

  useEffect(() => {
    const params = new URLSearchParams(filterParams);
    params.set("page", String(page));
    params.set("page_size", "50");
    fetch(`/api/admin/chat-feedback?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, [filterParams, page]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Chat Feedback"
        description="Thumbs up/down events rolled up from deployed agents. Download the filtered set as JSONL for triage."
      />
      <Card>
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <select
            aria-label="Sentiment"
            value={sentiment}
            onChange={(e) => { setSentiment(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate/20 rounded-lg text-sm bg-white text-charcoal"
          >
            <option value="">All Sentiment</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
          </select>
          <select
            aria-label="Deployment"
            value={deployment}
            onChange={(e) => { setDeployment(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate/20 rounded-lg text-sm bg-white text-charcoal"
          >
            <option value="">All Deployment</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate">
            From
            <input
              type="date"
              aria-label="From date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate/20 rounded-lg text-sm bg-white text-charcoal"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate">
            To
            <input
              type="date"
              aria-label="To date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate/20 rounded-lg text-sm bg-white text-charcoal"
            />
          </label>
          <span className="text-sm text-slate">{data.total} events</span>
          <a
            href={`/api/admin/chat-feedback/export?${filterParams}`}
            download
            className="ml-auto inline-flex items-center justify-center font-medium rounded-lg transition-colors bg-white text-charcoal border border-slate/20 hover:bg-light-gray px-3 py-1.5 text-xs"
          >
            Download JSONL
          </a>
        </div>

        {data.events.length === 0 ? (
          <p className="text-sm text-slate py-8 text-center">No feedback matches the current filters.</p>
        ) : (
          <ul className="divide-y divide-slate/10">
            {data.events.map((row) => {
              const isOpen = expanded === row.event_id;
              return (
                <li key={row.event_id}>
                  <button
                    type="button"
                    aria-label={`Feedback from ${row.end_user}`}
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : row.event_id)}
                    className="group w-full flex items-center gap-4 py-3 text-left"
                  >
                    <span className="text-sm text-slate w-40 shrink-0">
                      {new Date(row.received_at).toLocaleString()}
                    </span>
                    <span className="text-sm font-medium w-56 shrink-0 truncate">
                      {row.participant_legal_name ?? row.participant_id}
                    </span>
                    <span className="text-sm text-slate w-32 shrink-0 truncate">{row.end_user}</span>
                    <Pill category="feedback-sentiment" value={row.sentiment} />
                    <Pill category="agent-deployment" value={row.deployment} />
                    <span className="text-sm text-slate flex-1 truncate">{row.feedback_text ?? ""}</span>
                    <DetailChevron expanded={isOpen} />
                  </button>
                  {isOpen && (
                    <div className="pb-4 pl-40 space-y-2 text-sm">
                      <p><span className="font-medium">User asked:</span> {row.user_query ?? "—"}</p>
                      <p><span className="font-medium">Agent answered:</span> {row.assistant_response ?? "—"}</p>
                      <p className="text-slate">
                        Agent {row.agent_id} · client v{row.client_version} · protocol v{row.protocol_version}
                        {row.answer_provenance ? ` · provenance: ${row.answer_provenance}` : ""}
                        {" · session "}{row.session_id}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate/10">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white text-charcoal border border-slate/20 hover:bg-light-gray px-3 py-1.5 text-xs"
            >
              Previous
            </button>
            <span className="text-sm text-slate">Page {page} of {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white text-charcoal border border-slate/20 hover:bg-light-gray px-3 py-1.5 text-xs"
            >
              Next
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
