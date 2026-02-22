"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { useApi } from "@/lib/use-api";

export function PaymentManifestForm() {
  const [manifestType, setManifestType] = useState<"vendor" | "buyer">("vendor");
  const [minOrderValue, setMinOrderValue] = useState("25");
  const [walletRequiredBelow, setWalletRequiredBelow] = useState("500");
  const [walletUnavailableAbove, setWalletUnavailableAbove] = useState("50000");
  const [traditionalAvailable, setTraditionalAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: manifest, loading } = useApi<Record<string, unknown>>({
    path: `/payments/manifests/current?type=${manifestType}`,
    fallback: null,
  });

  if (loading) {
    return <Card><div className="animate-pulse p-6">Loading manifest...</div></Card>;
  }

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/account/manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifest_type: manifestType,
          acceptance_rules: {
            minimum_order_value_usd: Number(minOrderValue),
            wallet_required_below_usd: Number(walletRequiredBelow),
            wallet_unavailable_above_usd: Number(walletUnavailableAbove),
            traditional_terms_available: traditionalAvailable,
          },
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
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy">Payment Manifest</h3>
          <select
            value={manifestType}
            onChange={(e) => setManifestType(e.target.value as "vendor" | "buyer")}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="vendor">Vendor Manifest</option>
            <option value="buyer">Buyer Manifest</option>
          </select>
        </div>
        <p className="mt-1 text-sm text-slate">
          {manifestType === "vendor"
            ? "Configure which buyers can pay you via wallet and at what thresholds."
            : "Configure your spending limits when paying vendors via wallet."}
        </p>

        {manifestType === "vendor" && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate">Minimum Order Value (USD)</label>
                <input
                  type="number"
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate">Wallet Required Below (USD)</label>
                <input
                  type="number"
                  value={walletRequiredBelow}
                  onChange={(e) => setWalletRequiredBelow(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate">Wallet Unavailable Above (USD)</label>
                <input
                  type="number"
                  value={walletUnavailableAbove}
                  onChange={(e) => setWalletUnavailableAbove(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="traditional-available"
                checked={traditionalAvailable}
                onChange={(e) => setTraditionalAvailable(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="traditional-available" className="text-sm text-navy">
                Traditional credit terms also available
              </label>
            </div>

            <div className="rounded-md bg-slate/5 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate">Preview</h4>
              <div className="mt-2 space-y-1 text-xs text-navy">
                <p>Orders below ${walletRequiredBelow}: <span className="font-medium text-amber-700">Wallet required</span></p>
                <p>Orders ${walletRequiredBelow}–${walletUnavailableAbove}: <span className="font-medium text-teal">Wallet optional</span></p>
                <p>Orders above ${walletUnavailableAbove}: <span className="font-medium text-slate">Traditional only</span></p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Manifest"}
          </button>
          {saved && <span className="text-xs text-emerald-600">Saved successfully</span>}
        </div>
      </div>
    </Card>
  );
}
