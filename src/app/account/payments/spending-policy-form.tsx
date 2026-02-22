"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { useApi } from "@/lib/use-api";

interface SpendingPolicyData {
  id: string;
  participant_id: string;
  wallet_id: string;
  max_single_tx_usd: number;
  max_daily_spend_usd: number;
  approval_threshold: number | null;
  allowed_addresses: string[] | null;
  blocked_addresses: string[] | null;
  is_active: boolean;
}

export function SpendingPolicyForm() {
  const [maxSingleTx, setMaxSingleTx] = useState("5000");
  const [maxDailySpend, setMaxDailySpend] = useState("25000");
  const [approvalThreshold, setApprovalThreshold] = useState("2500");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: policy, loading } = useApi<SpendingPolicyData>({
    path: "/policies/spending/current",
    fallback: null,
  });

  if (loading) {
    return <Card><div className="animate-pulse p-6">Loading policy...</div></Card>;
  }

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      // Save via BFF
      await fetch("/api/account/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_single_transaction_usd: Number(maxSingleTx),
          max_daily_spend_usd: Number(maxDailySpend),
          require_human_approval_above_usd: approvalThreshold ? Number(approvalThreshold) : undefined,
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-navy">Spending Policy</h3>
        <p className="mt-1 text-sm text-slate">
          Configure automated spending limits for your wallet transactions.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate">Max Single Transaction (USD)</label>
            <input
              type="number"
              value={maxSingleTx}
              onChange={(e) => setMaxSingleTx(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate">Max Daily Spend (USD)</label>
            <input
              type="number"
              value={maxDailySpend}
              onChange={(e) => setMaxDailySpend(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate">Human Approval Above (USD)</label>
            <input
              type="number"
              value={approvalThreshold}
              onChange={(e) => setApprovalThreshold(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Policy"}
          </button>
          {saved && <span className="text-xs text-emerald-600">Saved successfully</span>}
        </div>
      </div>
    </Card>
  );
}
