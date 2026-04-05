"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/use-toast";
import type {
  MockRequirement,
  MockPosture,
  LeadTimeTrendSharingPosture,
} from "@/lib/mock-types";

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
  inbound_requirements: MockRequirement[];
  outbound_postures: MockPosture[];
  pricing_defaults: PricingDefaults;
  lead_time_trend_sharing: LeadTimeTrendSharingPosture;
}

const EMPTY_MANIFEST: ManifestData = {
  inbound_requirements: [],
  outbound_postures: [],
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

  const [requirements, setRequirements] = useState<MockRequirement[]>([]);
  const [postures, setPostures] = useState<MockPosture[]>([]);
  const [leadTimeTrendSharing, setLeadTimeTrendSharing] = useState<LeadTimeTrendSharingPosture>("not_required");
  const { toast, showToast } = useToast();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data.inbound_requirements) {
      setRequirements(data.inbound_requirements);
    }
    if (data.outbound_postures) {
      setPostures(data.outbound_postures);
    }
    if (data.lead_time_trend_sharing) {
      setLeadTimeTrendSharing(data.lead_time_trend_sharing);
    }
  }, [data]);

  function toggleReq(id: string) {
    setRequirements(requirements.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  }

  function toggleRequired(id: string) {
    setRequirements(requirements.map((r) =>
      r.id === id ? { ...r, required: !r.required } : r
    ));
  }

  function setPosture(id: string, posture: MockPosture["posture"]) {
    setPostures(postures.map((p) =>
      p.id === id ? { ...p, posture } : p
    ));
  }

  function setThreshold(id: string, threshold: string) {
    const val = threshold === "" ? null : parseInt(threshold, 10);
    setPostures(postures.map((p) =>
      p.id === id ? { ...p, score_threshold: val } : p
    ));
  }

  function setNotifEmail(id: string, email: string) {
    setPostures(postures.map((p) =>
      p.id === id ? { ...p, notification_email: email } : p
    ));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/manifests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "counterparty",
          data: {
            inbound_requirements: requirements,
            outbound_postures: postures,
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

      {/* Inbound Requirements */}
      <Card title="Inbound Requirements">
        <p className="text-sm text-slate mb-4">
          What your company requires from counterparties before establishing a trading relationship.
        </p>
        <div className="space-y-3">
          {requirements.map((req) => (
            <div key={req.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate/15">
              <label className="flex items-center gap-2 shrink-0">
                <input
                  type="checkbox"
                  checked={req.enabled}
                  onChange={() => toggleReq(req.id)}
                  className="accent-teal"
                />
              </label>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${req.enabled ? "text-charcoal" : "text-slate"}`}>
                  {req.display_name}
                </p>
                <p className="text-xs text-slate truncate">{req.description}</p>
              </div>
              {req.enabled && (
                <label className="flex items-center gap-2 shrink-0">
                  <input
                    type="checkbox"
                    checked={req.required}
                    onChange={() => toggleRequired(req.id)}
                    className="accent-teal"
                  />
                  <span className="text-xs text-charcoal">Required</span>
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button size="sm" variant="secondary" onClick={() => {
            const newReq: MockRequirement = {
              id: `req-custom-${Date.now()}`,
              field_name: `custom_${Date.now()}`,
              display_name: "Custom Requirement",
              required: false,
              enabled: true,
              description: "Enter a description for this requirement.",
            };
            setRequirements([...requirements, newReq]);
          }}>
            Add Custom Requirement
          </Button>
        </div>
      </Card>

      {/* Outbound Postures */}
      <Card title="Outbound Postures">
        <p className="text-sm text-slate mb-4">
          How your company responds when counterparties request documents from you.
        </p>
        <div className="space-y-4">
          {postures.map((pos) => (
            <div key={pos.id} className="p-4 rounded-lg border border-slate/15">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-charcoal">{pos.display_name}</p>
                <StatusBadge status={pos.posture === "support" ? "active" : pos.posture === "not_supported" ? "disabled" : "pending"} />
              </div>
              <div className="flex gap-3 mb-3">
                {(["support", "not_supported", "exception"] as const).map((p) => (
                  <label key={p} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs ${pos.posture === p ? "border-teal bg-teal/5 text-teal-dark" : "border-slate/20 text-slate"}`}>
                    <input
                      type="radio"
                      name={`posture-${pos.id}`}
                      value={p}
                      checked={pos.posture === p}
                      onChange={() => setPosture(pos.id, p)}
                      className="sr-only"
                    />
                    {p === "support" ? "Support" : p === "not_supported" ? "Not Supported" : "Exception"}
                  </label>
                ))}
              </div>
              {pos.posture === "support" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-dashed border-slate/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate">Upload document</p>
                    <p className="text-[10px] text-light-slate mt-1">PDF, PNG, JPG (max 10MB)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-charcoal mb-1">Score Threshold (optional)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={pos.score_threshold ?? ""}
                      onChange={(e) => setThreshold(pos.id, e.target.value)}
                      placeholder="e.g. 85"
                      className="w-full px-3 py-1.5 border border-slate/20 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    />
                    <p className="text-[10px] text-slate mt-1">Auto-approve if counterparty score is above threshold</p>
                  </div>
                </div>
              )}
              {pos.posture === "exception" && (
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Notification Email</label>
                  <input
                    type="email"
                    value={pos.notification_email}
                    onChange={(e) => setNotifEmail(pos.id, e.target.value)}
                    placeholder="alerts@company.com"
                    className="w-full px-3 py-1.5 border border-slate/20 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

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
