"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { Card } from "@/components/card";
import { DetailChevron } from "@/components/sonar/observations/detail-chevron";
import { ApprovalsQueue, type EntityApprovalQueueRow } from "./approvals-queue";
import { ReviewWizard } from "./review-wizard";

/** A directory search hit (mirrors GET /api/account/directory → MockDirectoryCompany). */
interface DirectoryCompany {
  id: string;
  company_name: string;
  location?: string;
  industry?: string;
}

/** Builds a synthetic queue row for proactively reviewing a directory company. */
function proactiveRow(company: DirectoryCompany): EntityApprovalQueueRow {
  return {
    request_id: null,
    counterparty: { id: company.id, name: company.company_name },
    submitted_at: null,
    gap_count: 0,
    status: "pending",
    last_decision: null,
  };
}

/**
 * Owns the Entity Approvals tab's queue ⇄ review switch. Selecting a queue row
 * opens the review wizard; "Approve a company" opens a directory search modal,
 * and picking a company opens the same wizard in proactive (counterparty) mode.
 */
export function EntityApprovalsTab() {
  const [selected, setSelected] = useState<EntityApprovalQueueRow | null>(null);
  const [isProactive, setIsProactive] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  function backToQueue() {
    setSelected(null);
    setIsProactive(false);
  }

  if (selected) {
    return (
      <ReviewWizard row={selected} proactive={isProactive} onClose={backToQueue} onDecided={backToQueue} />
    );
  }

  return (
    <>
      <ApprovalsQueue
        onReview={(row) => {
          setIsProactive(false);
          setSelected(row);
        }}
        onProactive={() => setSearchOpen(true)}
      />
      <CompanySearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(company) => {
          setSearchOpen(false);
          setIsProactive(true);
          setSelected(proactiveRow(company));
        }}
      />
    </>
  );
}

function CompanySearchModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (company: DirectoryCompany) => void;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryCompany[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error" | "loaded">("idle");

  // 300ms debounce, mirroring the partners directory modal.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(handle);
  }, [input, open]);

  // Server-side search once the debounced query is ≥ 2 chars (haiCore requires it).
  useEffect(() => {
    if (!open || query.length < 2) return;
    let cancelled = false;
    setState("loading");
    fetch(`/api/account/directory?q=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((rows: DirectoryCompany[]) => {
        if (!cancelled) {
          setResults(Array.isArray(rows) ? rows : []);
          setState("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [query, open]);

  const canSearch = query.length >= 2;

  return (
    <Modal open={open} onClose={onClose} title="Approve a company" width="max-w-2xl">
      <div className="space-y-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search the HAIWAVE directory by name, industry, or location…"
          autoFocus
          className="w-full px-4 py-2.5 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />
        {!canSearch ? (
          <p className="text-sm text-slate text-center py-6">Type at least 2 characters to search.</p>
        ) : state === "loading" ? (
          <p className="text-sm text-slate text-center py-6">Searching…</p>
        ) : state === "error" ? (
          <p className="text-sm text-problem text-center py-6">Search failed — try again.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-slate text-center py-6">No companies match &ldquo;{query}&rdquo;.</p>
        ) : (
          <div className="space-y-2">
            {results.map((c) => (
              <Card key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  aria-label={`Review ${c.company_name}`}
                  className="group flex w-full items-center gap-4 text-left"
                >
                  <div className="flex-1">
                    <p className="font-medium text-charcoal">{c.company_name}</p>
                    {(c.location || c.industry) && (
                      <p className="text-xs text-slate mt-0.5">
                        {[c.location, c.industry].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <DetailChevron />
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
