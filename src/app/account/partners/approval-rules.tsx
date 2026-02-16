"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { MOCK_APPROVAL_RULES, MockApprovalRules } from "@/lib/mock-data";

const BUSINESS_TYPES = ["Corporation", "LLC", "Partnership", "Sole Proprietorship", "Government", "Nonprofit"];
const REGIONS = ["Midwest", "West Coast", "East Coast", "Southeast", "Southwest", "Mountain West", "Pacific Northwest"];

export function ApprovalRules() {
  const [rules, setRules] = useState<MockApprovalRules>(MOCK_APPROVAL_RULES);
  const [toast, setToast] = useState("");
  const [newRegion, setNewRegion] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const inputClass = "w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal";

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success">
          {toast}
        </div>
      )}

      {/* Bulk Pre-Approval */}
      <Card title="Bulk Pre-Approval Criteria">
        <p className="text-sm text-slate mb-4">
          Companies meeting all enabled criteria are auto-approved without manual review.
        </p>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rules.bulk.publicly_traded}
              onChange={(e) => setRules({ ...rules, bulk: { ...rules.bulk, publicly_traded: e.target.checked } })}
              className="accent-teal"
            />
            <span className="text-sm text-charcoal">Publicly traded companies only</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rules.bulk.duns_verified}
              onChange={(e) => setRules({ ...rules, bulk: { ...rules.bulk, duns_verified: e.target.checked } })}
              className="accent-teal"
            />
            <span className="text-sm text-charcoal">DUNS verified</span>
          </label>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Min Years on Network</label>
              <input
                type="number"
                min="0"
                value={rules.bulk.min_years_on_network}
                onChange={(e) => setRules({ ...rules, bulk: { ...rules.bulk, min_years_on_network: parseInt(e.target.value) || 0 } })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Min Behavioral Score</label>
              <input
                type="number"
                min="0"
                max="100"
                value={rules.bulk.min_score}
                onChange={(e) => setRules({ ...rules, bulk: { ...rules.bulk, min_score: parseInt(e.target.value) || 0 } })}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Per-Request Rules */}
      <Card title="Per-Request Rules">
        <p className="text-sm text-slate mb-4">
          Rules applied to each individual connection request during manual or semi-automatic review.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Minimum Behavioral Score</label>
            <input
              type="number"
              min="0"
              max="100"
              value={rules.per_request.min_score}
              onChange={(e) => setRules({ ...rules, per_request: { ...rules.per_request, min_score: parseInt(e.target.value) || 0 } })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">Allowed Business Types</label>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_TYPES.map((bt) => (
                <label key={bt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs ${
                  rules.per_request.allowed_business_types.includes(bt)
                    ? "border-teal bg-teal/5 text-teal-dark"
                    : "border-slate/20 text-slate"
                }`}>
                  <input
                    type="checkbox"
                    checked={rules.per_request.allowed_business_types.includes(bt)}
                    onChange={(e) => {
                      const types = e.target.checked
                        ? [...rules.per_request.allowed_business_types, bt]
                        : rules.per_request.allowed_business_types.filter((t) => t !== bt);
                      setRules({ ...rules, per_request: { ...rules.per_request, allowed_business_types: types } });
                    }}
                    className="sr-only"
                  />
                  {bt}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">Allowed Regions</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {rules.per_request.allowed_regions.map((region) => (
                <span key={region} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-teal/10 text-teal-dark rounded-full">
                  {region}
                  <button
                    onClick={() => setRules({
                      ...rules,
                      per_request: {
                        ...rules.per_request,
                        allowed_regions: rules.per_request.allowed_regions.filter((r) => r !== region),
                      },
                    })}
                    className="text-teal-dark/60 hover:text-teal-dark ml-0.5"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                className={inputClass}
              >
                <option value="">Add region...</option>
                {REGIONS.filter((r) => !rules.per_request.allowed_regions.includes(r)).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (newRegion) {
                    setRules({
                      ...rules,
                      per_request: {
                        ...rules.per_request,
                        allowed_regions: [...rules.per_request.allowed_regions, newRegion],
                      },
                    });
                    setNewRegion("");
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">Default Posture</label>
            <div className="space-y-2">
              {([
                { value: "auto_approve_all", label: "Auto-approve all requests" },
                { value: "auto_approve_with_rules", label: "Auto-approve if rules pass" },
                { value: "manual_only", label: "Manual review only" },
              ] as const).map((opt) => (
                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                  rules.per_request.default_posture === opt.value
                    ? "border-teal bg-teal/5"
                    : "border-slate/20"
                }`}>
                  <input
                    type="radio"
                    name="posture"
                    value={opt.value}
                    checked={rules.per_request.default_posture === opt.value}
                    onChange={() => setRules({ ...rules, per_request: { ...rules.per_request, default_posture: opt.value } })}
                    className="accent-teal"
                  />
                  <span className="text-sm text-charcoal">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Contact Route */}
      <Card title="Contact Route">
        <p className="text-sm text-slate mb-4">
          Where connection requests and partnership inquiries should be routed.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Email</label>
            <input
              type="email"
              value={rules.contact.email}
              onChange={(e) => setRules({ ...rules, contact: { ...rules.contact, email: e.target.value } })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Phone</label>
            <input
              type="tel"
              value={rules.contact.phone}
              onChange={(e) => setRules({ ...rules, contact: { ...rules.contact, phone: e.target.value } })}
              className={inputClass}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => showToast("Approval rules saved.")}>Save Rules</Button>
      </div>
    </div>
  );
}
