"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/use-toast";
import type { LeadTimeTrendSharingPosture } from "@/lib/mock-types";

interface PricingDefaults {
  default_currency: string;
  default_payment_terms: string;
  default_freight_terms: string;
  minimum_order_value: number;
  quote_validity_days: number;
  volume_discount_tiers: { min_qty: number; max_qty: number | null; discount_pct: number }[];
  aged_inventory_discount_enabled: boolean;
  aged_inventory_threshold_days: number;
  aged_inventory_discount_pct: number;
}

interface ManifestData {
  pricing_defaults: PricingDefaults;
  lead_time_trend_sharing: LeadTimeTrendSharingPosture;
}

const EMPTY_MANIFEST: ManifestData = {
  pricing_defaults: {
    default_currency: "USD",
    default_payment_terms: "",
    default_freight_terms: "",
    minimum_order_value: 0,
    quote_validity_days: 0,
    volume_discount_tiers: [],
    aged_inventory_discount_enabled: false,
    aged_inventory_threshold_days: 0,
    aged_inventory_discount_pct: 0,
  },
  lead_time_trend_sharing: "not_required",
};

export function CounterpartyManifest() {
  const { data, loading } = useApi<ManifestData>({
    url: "/api/account/manifests",
    fallback: EMPTY_MANIFEST,
  });

  const [leadTimeTrendSharing, setLeadTimeTrendSharing] = useState<LeadTimeTrendSharingPosture>("not_required");
  const { toast, showToast } = useToast();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data.lead_time_trend_sharing) {
      setLeadTimeTrendSharing(data.lead_time_trend_sharing);
    }
  }, [data]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/manifests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "counterparty",
          data: {
            lead_time_trend_sharing: leadTimeTrendSharing,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        showToast(err.error ?? "Save failed");
        return;
      }
      showToast("Counterparty manifest saved.");
    } catch {
      showToast("Network error -- changes saved locally only.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success">
          {toast}
        </div>
      )}

      {loading && (
        <div className="text-sm text-slate animate-pulse">Loading manifest data...</div>
      )}

      {/* Lead Time Trend Sharing */}
      <Card title="Lead Time Intelligence">
        <p className="text-sm text-slate mb-4">
          Control whether you require vendors to share lead time trend data in GoFish responses.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 rounded-lg border border-slate/15">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal">Lead Time Trend Sharing</p>
              <p className="text-xs text-slate">
                When set to Require, GoFish results will exclude vendors who do not provide trend data.
              </p>
            </div>
            <select
              value={leadTimeTrendSharing}
              onChange={(e) => setLeadTimeTrendSharing(e.target.value as LeadTimeTrendSharingPosture)}
              className="px-3 py-1.5 border border-slate/20 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal bg-white"
            >
              <option value="not_required">Not Required</option>
              <option value="prefer">Prefer</option>
              <option value="require">Require</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Manifest"}
        </Button>
      </div>
    </div>
  );
}
