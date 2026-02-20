"use client";

import { useState, useEffect } from "react";
import { Button } from "./button";
import type { PricingNode } from "./pricing-tree";

interface PricingLevelEditorProps {
  node: PricingNode;
  onSave: (data: Record<string, unknown>) => void;
  onReset: () => void;
}

interface FieldOverride {
  overridden: boolean;
  value: unknown;
}

interface VolumeTier {
  min_qty: number;
  max_qty: number | null;
  discount_pct: number;
}

const PRICING_FIELDS: { key: string; label: string; type: "text" | "number" | "select"; section: "pricing" | "terms"; options?: string[] }[] = [
  { key: "base_unit_price", label: "Base Unit Price", type: "number", section: "pricing" },
  { key: "currency", label: "Currency", type: "select", section: "pricing", options: ["USD", "EUR", "GBP", "CAD", "AUD"] },
  { key: "unit_of_measure", label: "Unit of Measure", type: "select", section: "pricing", options: ["EA", "KG", "LB", "FT", "M", "BOX", "CS", "GAL", "L"] },
  { key: "default_payment_terms", label: "Payment Terms", type: "select", section: "terms", options: ["Net 15", "Net 30", "Net 45", "Net 60", "Net 90", "Due on Receipt"] },
  { key: "default_shipping_terms", label: "Shipping Terms", type: "select", section: "terms", options: ["FOB Origin", "FOB Destination", "CIF", "DDP", "EXW"] },
  { key: "minimum_order_value", label: "Minimum Order Value", type: "number", section: "terms" },
  { key: "minimum_order_quantity", label: "Minimum Order Quantity", type: "number", section: "terms" },
];

const LEVEL_LABELS: Record<string, string> = {
  company: "Company Default",
  product_line: "Product Line",
  product: "Product",
  sku: "SKU",
  customer_override: "Customer Override",
};

function getFieldValue(node: PricingNode, key: string): unknown {
  const field = PRICING_FIELDS.find((f) => f.key === key);
  if (!field) return undefined;
  if (field.section === "pricing") return node.pricing[key];
  return node.terms[key];
}

export function PricingLevelEditor({ node, onSave, onReset }: PricingLevelEditorProps) {
  const [overrides, setOverrides] = useState<Record<string, FieldOverride>>({});
  const [volumeTiers, setVolumeTiers] = useState<VolumeTier[]>([]);
  const [tiersOverridden, setTiersOverridden] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCompanyLevel = node.level === "company";

  // Reset overrides when node changes
  useEffect(() => {
    const initial: Record<string, FieldOverride> = {};
    for (const field of PRICING_FIELDS) {
      const value = getFieldValue(node, field.key);
      initial[field.key] = {
        overridden: value !== undefined && value !== null,
        value: value ?? "",
      };
    }
    setOverrides(initial);

    const tiers = (node.pricing.volume_tiers as VolumeTier[]) ?? [];
    setVolumeTiers(tiers);
    setTiersOverridden(tiers.length > 0);
  }, [node]);

  function handleOverrideToggle(key: string, checked: boolean) {
    setOverrides((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        overridden: checked,
        value: checked ? (prev[key]?.value ?? "") : "",
      },
    }));
  }

  function handleValueChange(key: string, value: unknown) {
    setOverrides((prev) => ({
      ...prev,
      [key]: { ...prev[key], overridden: true, value },
    }));
  }

  function addVolumeTier() {
    setVolumeTiers([...volumeTiers, { min_qty: 0, max_qty: null, discount_pct: 0 }]);
    setTiersOverridden(true);
  }

  function removeVolumeTier(index: number) {
    setVolumeTiers(volumeTiers.filter((_, i) => i !== index));
  }

  function updateVolumeTier(index: number, field: keyof VolumeTier, value: number | null) {
    setVolumeTiers(volumeTiers.map((tier, i) =>
      i === index ? { ...tier, [field]: value } : tier,
    ));
  }

  function handleSave() {
    setSaving(true);

    const pricing: Record<string, unknown> = {};
    const terms: Record<string, unknown> = {};

    for (const field of PRICING_FIELDS) {
      const override = overrides[field.key];
      if (override?.overridden && override.value !== "" && override.value !== undefined) {
        const val = field.type === "number" ? Number(override.value) : override.value;
        if (field.section === "pricing") {
          pricing[field.key] = val;
        } else {
          terms[field.key] = val;
        }
      }
    }

    if (tiersOverridden) {
      pricing.volume_tiers = volumeTiers;
    }

    onSave({
      id: node.id,
      level: node.level,
      label: node.label,
      scope: node.scope,
      customer_override: node.customer_override,
      pricing,
      terms,
    });

    setTimeout(() => setSaving(false), 500);
  }

  const inputClass =
    "w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal";
  const disabledInputClass =
    "w-full px-3 py-2 border border-slate/10 rounded-lg text-sm bg-light-gray text-slate cursor-not-allowed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy">
            {node.label}
          </h3>
          <p className="text-sm text-slate mt-1">
            Level: {LEVEL_LABELS[node.level] ?? node.level}
            {node.scope?.product_line && ` \u2022 ${node.scope.product_line}`}
            {node.scope?.product_id && ` \u2022 ${node.scope.product_id}`}
          </p>
          {node.inherited_from && (
            <p className="text-xs text-slate mt-1">
              Inherits from: <span className="text-teal font-medium">{node.inherited_from}</span>
            </p>
          )}
        </div>
        {!isCompanyLevel && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset to Inherited
          </Button>
        )}
      </div>

      {/* Pricing Fields */}
      <div className="bg-white rounded-lg border border-slate/15 p-6">
        <h4 className="text-sm font-medium text-navy mb-4 uppercase tracking-wider">
          Pricing
        </h4>
        <div className="space-y-4">
          {PRICING_FIELDS.filter((f) => f.section === "pricing").map((field) => {
            const override = overrides[field.key];
            const isOverridden = override?.overridden ?? false;
            const parentValue = node.inherited_from
              ? getFieldValue(node, field.key)
              : undefined;

            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-charcoal">
                    {field.label}
                  </label>
                  {!isCompanyLevel && (
                    <label className="flex items-center gap-1.5 text-xs text-slate cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOverridden}
                        onChange={(e) => handleOverrideToggle(field.key, e.target.checked)}
                        className="accent-teal"
                      />
                      Override
                    </label>
                  )}
                </div>

                {field.type === "select" ? (
                  <select
                    value={isOverridden ? String(override?.value ?? "") : ""}
                    onChange={(e) => handleValueChange(field.key, e.target.value)}
                    disabled={!isCompanyLevel && !isOverridden}
                    className={!isCompanyLevel && !isOverridden ? disabledInputClass : inputClass}
                  >
                    <option value="">
                      {!isCompanyLevel && !isOverridden && parentValue
                        ? `${parentValue} (inherited)`
                        : "Select..."}
                    </option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={isOverridden ? String(override?.value ?? "") : ""}
                    onChange={(e) => handleValueChange(field.key, e.target.value)}
                    disabled={!isCompanyLevel && !isOverridden}
                    placeholder={
                      !isCompanyLevel && !isOverridden && parentValue !== undefined && parentValue !== null
                        ? `${parentValue} (inherited)`
                        : ""
                    }
                    className={!isCompanyLevel && !isOverridden ? disabledInputClass : inputClass}
                  />
                )}

                {!isCompanyLevel && node.inherited_from && parentValue !== undefined && parentValue !== null && (
                  <p className="text-xs text-slate">
                    Inherited: <span className="font-medium">{String(parentValue)}</span>
                    <span className="text-slate/60"> (from {node.inherited_from})</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Terms Fields */}
      <div className="bg-white rounded-lg border border-slate/15 p-6">
        <h4 className="text-sm font-medium text-navy mb-4 uppercase tracking-wider">
          Terms
        </h4>
        <div className="space-y-4">
          {PRICING_FIELDS.filter((f) => f.section === "terms").map((field) => {
            const override = overrides[field.key];
            const isOverridden = override?.overridden ?? false;
            const parentValue = node.inherited_from
              ? getFieldValue(node, field.key)
              : undefined;

            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-charcoal">
                    {field.label}
                  </label>
                  {!isCompanyLevel && (
                    <label className="flex items-center gap-1.5 text-xs text-slate cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOverridden}
                        onChange={(e) => handleOverrideToggle(field.key, e.target.checked)}
                        className="accent-teal"
                      />
                      Override
                    </label>
                  )}
                </div>

                {field.type === "select" ? (
                  <select
                    value={isOverridden ? String(override?.value ?? "") : ""}
                    onChange={(e) => handleValueChange(field.key, e.target.value)}
                    disabled={!isCompanyLevel && !isOverridden}
                    className={!isCompanyLevel && !isOverridden ? disabledInputClass : inputClass}
                  >
                    <option value="">
                      {!isCompanyLevel && !isOverridden && parentValue
                        ? `${parentValue} (inherited)`
                        : "Select..."}
                    </option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={isOverridden ? String(override?.value ?? "") : ""}
                    onChange={(e) => handleValueChange(field.key, e.target.value)}
                    disabled={!isCompanyLevel && !isOverridden}
                    placeholder={
                      !isCompanyLevel && !isOverridden && parentValue !== undefined && parentValue !== null
                        ? `${parentValue} (inherited)`
                        : ""
                    }
                    className={!isCompanyLevel && !isOverridden ? disabledInputClass : inputClass}
                  />
                )}

                {!isCompanyLevel && node.inherited_from && parentValue !== undefined && parentValue !== null && (
                  <p className="text-xs text-slate">
                    Inherited: <span className="font-medium">{String(parentValue)}</span>
                    <span className="text-slate/60"> (from {node.inherited_from})</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Volume Tiers */}
      <div className="bg-white rounded-lg border border-slate/15 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-navy uppercase tracking-wider">
            Volume Discount Tiers
          </h4>
          {!isCompanyLevel && (
            <label className="flex items-center gap-1.5 text-xs text-slate cursor-pointer">
              <input
                type="checkbox"
                checked={tiersOverridden}
                onChange={(e) => {
                  setTiersOverridden(e.target.checked);
                  if (!e.target.checked) setVolumeTiers([]);
                }}
                className="accent-teal"
              />
              Override
            </label>
          )}
        </div>

        {(isCompanyLevel || tiersOverridden) ? (
          <div className="space-y-3">
            {volumeTiers.length === 0 && (
              <p className="text-sm text-slate">No volume tiers configured.</p>
            )}
            {volumeTiers.map((tier, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate mb-1">Min Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={tier.min_qty}
                      onChange={(e) => updateVolumeTier(index, "min_qty", parseInt(e.target.value) || 0)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate mb-1">Max Qty</label>
                    <input
                      type="number"
                      min="0"
                      value={tier.max_qty ?? ""}
                      onChange={(e) => updateVolumeTier(index, "max_qty", e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="No limit"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate mb-1">Discount %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tier.discount_pct}
                      onChange={(e) => updateVolumeTier(index, "discount_pct", parseInt(e.target.value) || 0)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeVolumeTier(index)}
                  className="text-slate hover:text-problem transition-colors text-lg mt-4"
                >
                  &times;
                </button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addVolumeTier}>
              + Add Tier
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate">
              Using inherited tiers.
              {node.inherited_from && (
                <span className="text-slate/60"> (from {node.inherited_from})</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        {!isCompanyLevel && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset All to Inherited
          </Button>
        )}
        <div className={isCompanyLevel ? "ml-auto" : ""}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
