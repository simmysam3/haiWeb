"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { useApi } from "@/lib/use-api";

interface ComplianceFlag {
  vendor_name: string;
  product_name: string;
  reason_code: string;
  status: string;
  detected_at: string;
}

interface ComplianceApiResponse {
  flags: ComplianceFlag[];
  total_count: number;
  open_count: number;
}

const COMPLIANCE_FALLBACK: ComplianceApiResponse = {
  flags: [],
  total_count: 0,
  open_count: 0,
};

export function ComplianceDashboard() {
  const { data, loading, refetch } = useApi<ComplianceApiResponse>({
    url: "/api/account/compliance",
    fallback: COMPLIANCE_FALLBACK,
  });

  const [auditing, setAuditing] = useState(false);

  async function handleSelfAudit() {
    setAuditing(true);
    try {
      const res = await fetch("/api/account/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "self-audit" }),
      });
      if (res.ok) {
        refetch();
      }
    } finally {
      setAuditing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-slate mb-1">Open Flags</p>
          <p className="text-3xl font-bold text-problem">{data.open_count}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate mb-1">Total Flags</p>
          <p className="text-3xl font-bold text-navy">{data.total_count}</p>
        </Card>
      </div>

      {/* Flags Table */}
      <Card title="Compliance Flags">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleSelfAudit}
            disabled={auditing}
            className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
          >
            {auditing ? "Running..." : "Run Self-Audit"}
          </button>
        </div>

        {data.flags.length === 0 ? (
          <p className="text-sm text-slate py-8 text-center">
            {loading ? "Loading compliance data..." : "No compliance flags found."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate border-b border-slate/15">
                  <th className="pb-3 font-medium">Vendor</th>
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">Reason Code</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Detected</th>
                </tr>
              </thead>
              <tbody>
                {data.flags.map((f, i) => (
                  <tr key={i} className="border-b border-slate/10 hover:bg-gray-50">
                    <td className="py-3 text-navy font-medium">{f.vendor_name}</td>
                    <td className="py-3 text-charcoal">{f.product_name}</td>
                    <td className="py-3 text-charcoal font-mono text-xs">{f.reason_code}</td>
                    <td className="py-3">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="py-3 text-slate">{f.detected_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
