"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/card";

interface AuditNode {
  guid: string;
  vendor_name?: string | null;
  plant_location?: string | null;
  plant_country?: string | null;
  jurisdiction?: string | null;
  external_product_id?: string | null;
  depth_level: number;
  is_domestic?: boolean | null;
  gap: boolean;
  gap_reason?: string | null;
}

interface AuditResult {
  audit_id: string;
  nodes: AuditNode[];
  audited_at: string;
}

interface VendorSuggestion {
  id: string;
  name: string;
}

export function SourceAuditDashboard() {
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorDisplayName, setVendorDisplayName] = useState("");
  const [productId, setProductId] = useState("");
  const [locationParameter, setLocationParameter] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<VendorSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced vendor search
  useEffect(() => {
    if (!vendorSearch || vendorSearch.length < 2) {
      setSuggestions([]);
      return;
    }

    // If it looks like a UUID, don't search
    if (/^[0-9a-f]{8}-/.test(vendorSearch)) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/account/directory?q=${encodeURIComponent(vendorSearch)}`);
        if (res.ok) {
          const data = await res.json();
          const companies = (data.companies ?? data ?? []) as Array<Record<string, unknown>>;
          setSuggestions(
            companies.slice(0, 8).map((c) => ({
              id: (c.id ?? c.participant_id ?? "") as string,
              name: (c.company_name ?? c.dba_name ?? c.legal_name ?? c.name ?? "") as string,
            }))
          );
          setShowSuggestions(true);
        }
      } catch {
        // Ignore search errors
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [vendorSearch]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectVendor(suggestion: VendorSuggestion) {
    setVendorId(suggestion.id);
    setVendorSearch(suggestion.name);
    setVendorDisplayName(suggestion.name);
    setShowSuggestions(false);
  }

  function handleVendorInputChange(value: string) {
    setVendorSearch(value);
    // If user types a UUID directly, set it as vendor ID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      setVendorId(value);
      setVendorDisplayName("");
    } else {
      // Clear the resolved ID when typing a name — will resolve on selection
      setVendorId("");
      setVendorDisplayName("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/account/source-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendorId || undefined, // empty = self-audit
          vendor_search: !vendorId && vendorSearch ? vendorSearch : undefined,
          product_id: productId,
          location_parameter: locationParameter,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();
      setResult(data as AuditResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative" ref={suggestionsRef}>
              <label htmlFor="vendor-search" className="block text-sm font-medium text-navy mb-1">
                Vendor <span className="text-slate font-normal">(optional — defaults to your company)</span>
              </label>
              <input
                id="vendor-search"
                type="text"
                value={vendorSearch}
                onChange={(e) => handleVendorInputChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Leave blank for your own products, or search a vendor"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
              />
              {vendorDisplayName && (
                <p className="text-xs text-teal mt-1">
                  Resolved: {vendorDisplayName} ({vendorId.slice(0, 8)}...)
                </p>
              )}
              {!vendorSearch && !vendorId && (
                <p className="text-xs text-slate mt-1">
                  Leave blank to audit your own products
                </p>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectVendor(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <span className="font-medium text-navy">{s.name}</span>
                      <span className="text-xs text-slate ml-2">{s.id.slice(0, 8)}...</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="product-id" className="block text-sm font-medium text-navy mb-1">
                Product ID
              </label>
              <input
                id="product-id"
                type="text"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="Enter product ID or SKU"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                id="location-parameter"
                type="checkbox"
                checked={locationParameter}
                onChange={(e) => setLocationParameter(e.target.checked)}
                className="rounded border-gray-300 text-teal focus:ring-teal/50"
              />
              <label htmlFor="location-parameter" className="text-sm text-charcoal">
                Mask vendor identities (location parameter mode)
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="bg-teal text-white px-4 py-2 rounded-md hover:bg-teal/90 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? "Running Audit..." : "Run Audit"}
            </button>
          </div>
        </form>
      </Card>

      {error && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      <Card>
        {!result && !loading && (
          <p className="text-sm text-slate py-8 text-center">
            Enter a product ID to run a supply chain audit. Leave vendor blank to audit your own products.
          </p>
        )}

        {loading && (
          <p className="text-sm text-slate py-8 text-center">Running audit...</p>
        )}

        {result && !loading && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-navy">
                Audit Results
              </h2>
              <span className="text-xs text-slate">
                {result.audited_at}
              </span>
            </div>

            {result.nodes.length === 0 ? (
              <p className="text-sm text-slate py-4 text-center">
                No audit nodes returned. Check that the product ID exists and has origin manifest data.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate border-b border-slate/15">
                      <th className="pb-3 font-medium">Entity</th>
                      <th className="pb-3 font-medium">Plant Location</th>
                      <th className="pb-3 font-medium">Country</th>
                      <th className="pb-3 font-medium">Tier</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.nodes.map((node, idx) => (
                      <tr
                        key={`${node.guid}-${idx}`}
                        className="border-b border-slate/10 hover:bg-gray-50"
                      >
                        <td className="py-3 text-navy font-medium">
                          <span
                            style={{ paddingLeft: `${node.depth_level * 20}px` }}
                            title={`GUID: ${node.guid}`}
                            className="cursor-help"
                          >
                            {node.vendor_name
                              ? node.vendor_name
                              : node.depth_level === 0
                                ? <span className="text-slate">{node.external_product_id ?? "Product"} <span className="italic">(no origin data)</span></span>
                                : node.gap
                                  ? <span className="text-slate">{node.gap_reason === "vendor_not_on_network" ? "Off-Network Supplier" : "Unresolved"}</span>
                                  : <span className="text-slate italic">Tier {node.depth_level} (Undisclosed)</span>
                            }
                          </span>
                        </td>
                        <td className="py-3 text-charcoal">
                          {node.plant_location ?? "Undisclosed"}
                        </td>
                        <td className="py-3 text-charcoal">
                          {node.plant_country ?? "Unknown"}
                        </td>
                        <td className="py-3 text-charcoal">{node.depth_level}</td>
                        <td className="py-3 space-x-1">
                          {node.gap ? (
                            <span className="inline-block bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">
                              Gap{node.gap_reason ? `: ${node.gap_reason}` : ""}
                            </span>
                          ) : node.is_domestic ? (
                            <span className="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                              Domestic
                            </span>
                          ) : node.is_domestic === false ? (
                            <span className="inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">
                              Foreign
                            </span>
                          ) : (
                            <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                              Unknown
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
