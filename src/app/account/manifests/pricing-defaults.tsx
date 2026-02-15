"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { MOCK_PRICING_DEFAULTS } from "@/lib/mock-data";

interface VolumeTier {
  min_qty: number;
  max_qty: number | null;
  discount_pct: number;
}

export function PricingDefaults() {
  const d = MOCK_PRICING_DEFAULTS;

  const [currency, setCurrency] = useState(d.default_currency);
  const [paymentTerms, setPaymentTerms] = useState(d.default_payment_terms);
  const [freightTerms, setFreightTerms] = useState(d.default_freight_terms);
  const [mov, setMov] = useState(d.minimum_order_value.toString());
  const [quoteValidity, setQuoteValidity] = useState(d.quote_validity_days.toString());
  const [tiers, setTiers] = useState<VolumeTier[]>(d.volume_discount_tiers);
  const [agedEnabled, setAgedEnabled] = useState(d.aged_inventory_discount_enabled);
  const [agedThreshold, setAgedThreshold] = useState(d.aged_inventory_threshold_days.toString());
  const [agedDiscount, setAgedDiscount] = useState(d.aged_inventory_discount_pct.toString());
  const [toast, setToast] = useState("");

  const inputClass = "w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal";

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function updateTier(index: number, field: keyof VolumeTier, value: string) {
    setTiers(tiers.map((t, i) => {
      if (i !== index) return t;
      if (field === "max_qty") {
        return { ...t, [field]: value === "" ? null : parseInt(value, 10) };
      }
      return { ...t, [field]: parseInt(value, 10) || 0 };
    }));
  }

  function addTier() {
    const lastTier = tiers[tiers.length - 1];
    setTiers([...tiers, { min_qty: (lastTier?.max_qty ?? 0) + 1, max_qty: null, discount_pct: 0 }]);
  }

  function removeTier(index: number) {
    setTiers(tiers.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success">
          {toast}
        </div>
      )}

      <Card title="General Terms">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Payment Terms</label>
            <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputClass}>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option>
              <option value="COD">COD</option>
              <option value="Prepaid">Prepaid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Freight Terms</label>
            <select value={freightTerms} onChange={(e) => setFreightTerms(e.target.value)} className={inputClass}>
              <option value="FOB Origin">FOB Origin</option>
              <option value="FOB Destination">FOB Destination</option>
              <option value="Prepaid">Prepaid</option>
              <option value="Collect">Collect</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Minimum Order Value ($)</label>
            <input type="number" value={mov} onChange={(e) => setMov(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Quote Validity (days)</label>
            <input type="number" value={quoteValidity} onChange={(e) => setQuoteValidity(e.target.value)} className={inputClass} />
          </div>
        </div>
      </Card>

      <Card title="Volume Discount Tiers">
        <div className="space-y-3">
          {tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="grid grid-cols-3 gap-3 flex-1">
                <div>
                  <label className="block text-xs text-slate mb-1">Min Qty</label>
                  <input type="number" value={tier.min_qty} onChange={(e) => updateTier(i, "min_qty", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-slate mb-1">Max Qty</label>
                  <input type="number" value={tier.max_qty ?? ""} onChange={(e) => updateTier(i, "max_qty", e.target.value)} placeholder="No limit" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-slate mb-1">Discount %</label>
                  <input type="number" value={tier.discount_pct} onChange={(e) => updateTier(i, "discount_pct", e.target.value)} className={inputClass} />
                </div>
              </div>
              <button onClick={() => removeTier(i)} className="text-slate hover:text-problem text-lg mt-4">&times;</button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={addTier}>Add Tier</Button>
        </div>
      </Card>

      <Card title="Aged Inventory Discount">
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={agedEnabled} onChange={(e) => setAgedEnabled(e.target.checked)} className="accent-teal" />
            <span className="text-sm text-charcoal">Enable aged inventory discounts</span>
          </label>
          {agedEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Threshold (days)</label>
                <input type="number" value={agedThreshold} onChange={(e) => setAgedThreshold(e.target.value)} className={inputClass} />
                <p className="text-xs text-slate mt-1">Products older than this trigger discount</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Discount %</label>
                <input type="number" value={agedDiscount} onChange={(e) => setAgedDiscount(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => showToast("Pricing defaults saved.")}>Save Pricing</Button>
      </div>
    </div>
  );
}
