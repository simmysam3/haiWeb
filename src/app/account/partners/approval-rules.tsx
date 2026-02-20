"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { MOCK_APPROVAL_RULES, MockApprovalRules } from "@/lib/mock-data";

const BUSINESS_TYPES = ["Corporation", "LLC", "Partnership", "Sole Proprietorship", "Government", "Nonprofit"];
const REGIONS = ["Midwest", "West Coast", "East Coast", "Southeast", "Southwest", "Mountain West", "Pacific Northwest"];

interface TestResult {
  result: "auto_approve" | "queue" | "reject";
  reason: string;
  matched_criterion?: string;
}

export function ApprovalRules() {
  const [rules, setRules] = useState<MockApprovalRules>(MOCK_APPROVAL_RULES);
  const [toast, setToast] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newBlocklistId, setNewBlocklistId] = useState("");
  const [newAllowlistId, setNewAllowlistId] = useState("");
  const [testScore, setTestScore] = useState(75);
  const [testBusinessType, setTestBusinessType] = useState("Corporation");
  const [testRegion, setTestRegion] = useState("Midwest");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetch("/api/account/rules")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setRules(d); })
      .catch(() => {});
  }, []);

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

      {/* Blocklist */}
      <Card title="Blocklist">
        <p className="text-sm text-slate mb-4">
          Participants on the blocklist are automatically rejected regardless of other rules.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {rules.per_request.blocklist_ids.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-problem/10 text-problem rounded-full">
              {id.slice(0, 12)}...
              <button
                onClick={() => setRules({
                  ...rules,
                  per_request: {
                    ...rules.per_request,
                    blocklist_ids: rules.per_request.blocklist_ids.filter((i) => i !== id),
                  },
                })}
                className="text-problem/60 hover:text-problem ml-0.5"
              >
                &times;
              </button>
            </span>
          ))}
          {rules.per_request.blocklist_ids.length === 0 && (
            <span className="text-xs text-slate">No blocked participants.</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newBlocklistId}
            onChange={(e) => setNewBlocklistId(e.target.value)}
            placeholder="Participant ID to block..."
            className={inputClass}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (newBlocklistId.trim()) {
                setRules({
                  ...rules,
                  per_request: {
                    ...rules.per_request,
                    blocklist_ids: [...rules.per_request.blocklist_ids, newBlocklistId.trim()],
                  },
                });
                setNewBlocklistId("");
              }
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      {/* Allowlist (Bulk Criteria) */}
      <Card title="Allowlist (Bulk Pre-Approval)">
        <p className="text-sm text-slate mb-4">
          Participants on the allowlist are always auto-approved regardless of criteria checks.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {rules.bulk.allowlist_ids.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-success/10 text-success rounded-full">
              {id.slice(0, 12)}...
              <button
                onClick={() => setRules({
                  ...rules,
                  bulk: {
                    ...rules.bulk,
                    allowlist_ids: rules.bulk.allowlist_ids.filter((i) => i !== id),
                  },
                })}
                className="text-success/60 hover:text-success ml-0.5"
              >
                &times;
              </button>
            </span>
          ))}
          {rules.bulk.allowlist_ids.length === 0 && (
            <span className="text-xs text-slate">No allowlisted participants.</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newAllowlistId}
            onChange={(e) => setNewAllowlistId(e.target.value)}
            placeholder="Participant ID to allowlist..."
            className={inputClass}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (newAllowlistId.trim()) {
                setRules({
                  ...rules,
                  bulk: {
                    ...rules.bulk,
                    allowlist_ids: [...rules.bulk.allowlist_ids, newAllowlistId.trim()],
                  },
                });
                setNewAllowlistId("");
              }
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      {/* Test Rules */}
      <Card title="Test Rules">
        <p className="text-sm text-slate mb-4">
          Preview what would happen for a hypothetical connection request.
        </p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Behavioral Score</label>
            <input
              type="number"
              min="0"
              max="100"
              value={testScore}
              onChange={(e) => setTestScore(parseInt(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Business Type</label>
            <select value={testBusinessType} onChange={(e) => setTestBusinessType(e.target.value)} className={inputClass}>
              {BUSINESS_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Region</label>
            <select value={testRegion} onChange={(e) => setTestRegion(e.target.value)} className={inputClass}>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            setIsTesting(true);
            setTestResult(null);
            try {
              const res = await fetch("/api/account/rules/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ behavioral_score: testScore, business_type: testBusinessType, region: testRegion }),
              });
              if (res.ok) {
                setTestResult(await res.json());
              } else {
                // Fallback: evaluate locally
                const localResult = evaluateLocally(rules, testScore, testBusinessType, testRegion);
                setTestResult(localResult);
              }
            } catch {
              const localResult = evaluateLocally(rules, testScore, testBusinessType, testRegion);
              setTestResult(localResult);
            } finally {
              setIsTesting(false);
            }
          }}
        >
          {isTesting ? "Testing..." : "Test Rules"}
        </Button>
        {testResult && (
          <div className={`mt-4 p-4 rounded-lg border ${
            testResult.result === "auto_approve" ? "bg-success/5 border-success/20" :
            testResult.result === "queue" ? "bg-warning/5 border-warning/20" :
            "bg-problem/5 border-problem/20"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-bold ${
                testResult.result === "auto_approve" ? "text-success" :
                testResult.result === "queue" ? "text-warning" : "text-problem"
              }`}>
                {testResult.result === "auto_approve" ? "Auto-Approve" :
                 testResult.result === "queue" ? "Queued for Review" : "Rejected"}
              </span>
            </div>
            <p className="text-sm text-charcoal">{testResult.reason}</p>
            {testResult.matched_criterion && (
              <p className="text-xs text-slate mt-1">Matched: {testResult.matched_criterion}</p>
            )}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button
          disabled={isSaving}
          onClick={async () => {
            setIsSaving(true);
            try {
              await Promise.all([
                fetch("/api/account/rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: "bulk_criteria", data: rules.bulk }) }),
                fetch("/api/account/rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: "per_request", data: rules.per_request }) }),
                fetch("/api/account/rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: "contact_route", data: rules.contact }) }),
              ]);
              showToast("Approval rules saved.");
            } catch {
              showToast("Approval rules saved (local only).");
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving ? "Saving..." : "Save Rules"}
        </Button>
      </div>
    </div>
  );
}

function evaluateLocally(
  rules: MockApprovalRules,
  score: number,
  businessType: string,
  region: string,
): TestResult {
  if (rules.per_request.default_posture === "auto_approve_all") {
    return { result: "auto_approve", reason: "Posture is auto-approve all." };
  }
  if (rules.per_request.default_posture === "manual_only") {
    return { result: "queue", reason: "Posture is manual review only." };
  }
  // Check bulk criteria first
  if (score >= rules.bulk.min_score) {
    return { result: "auto_approve", reason: `Score ${score} meets bulk minimum of ${rules.bulk.min_score}.`, matched_criterion: "bulk_criteria.min_score" };
  }
  // Per-request checks
  if (score < rules.per_request.min_score) {
    return { result: "queue", reason: `Score ${score} below per-request minimum of ${rules.per_request.min_score}.`, matched_criterion: "per_request.min_score" };
  }
  if (rules.per_request.allowed_business_types.length > 0 && !rules.per_request.allowed_business_types.includes(businessType)) {
    return { result: "queue", reason: `Business type "${businessType}" not in allowed types.`, matched_criterion: "per_request.allowed_business_types" };
  }
  if (rules.per_request.allowed_regions.length > 0 && !rules.per_request.allowed_regions.includes(region)) {
    return { result: "queue", reason: `Region "${region}" not in allowed regions.`, matched_criterion: "per_request.allowed_regions" };
  }
  return { result: "auto_approve", reason: "All per-request rules passed." };
}
