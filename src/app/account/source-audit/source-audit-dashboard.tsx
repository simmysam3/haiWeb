"use client";

import { useState } from "react";
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

export function SourceAuditDashboard() {
  const [vendorId, setVendorId] = useState("");
  const [productId, setProductId] = useState("");
  const [locationParameter, setLocationParameter] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/account/source-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendorId,
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
            <div>
              <label htmlFor="vendor-id" className="block text-sm font-medium text-navy mb-1">
                Vendor ID
              </label>
              <input
                id="vendor-id"
                type="text"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                placeholder="Enter vendor ID"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                required
              />
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
                placeholder="Enter product ID"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="location-parameter"
              type="checkbox"
              checked={locationParameter}
              onChange={(e) => setLocationParameter(e.target.checked)}
              className="rounded border-gray-300 text-teal focus:ring-teal/50"
            />
            <label htmlFor="location-parameter" className="text-sm text-charcoal">
              Location Parameter
            </label>
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
            Enter a vendor and product ID to run a supply chain audit
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
                {result.audit_id} &middot; {result.audited_at}
              </span>
            </div>

            {result.nodes.length === 0 ? (
              <p className="text-sm text-slate py-4 text-center">
                No audit nodes returned.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate border-b border-slate/15">
                      <th className="pb-3 font-medium">Entity</th>
                      <th className="pb-3 font-medium">Plant Location</th>
                      <th className="pb-3 font-medium">Country</th>
                      <th className="pb-3 font-medium">Depth</th>
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
                            style={{ paddingLeft: `${node.depth_level * 16}px` }}
                            title={node.guid}
                            className="cursor-help"
                          >
                            {node.vendor_name
                              ? node.vendor_name
                              : <span className="text-slate italic">Tier {node.depth_level} (Hidden)</span>
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
