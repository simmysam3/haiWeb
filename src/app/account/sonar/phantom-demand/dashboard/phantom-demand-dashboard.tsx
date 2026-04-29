"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { Tabs } from "@/components/tabs";
import { useApi } from "@/lib/use-api";

interface UsageEntry {
  trading_partner: string;
  month: string;
  requests: number;
  limit: number;
  status: string;
}

interface ForecastEntry {
  product_name: string;
  buyer_name: string;
  checks: number;
  trend: string;
}

interface PhantomDemandApiResponse {
  usage: {
    entries: UsageEntry[];
    total_requests: number;
  };
  forecast: {
    entries: ForecastEntry[];
  };
}

const PHANTOM_DEMAND_FALLBACK: PhantomDemandApiResponse = {
  usage: { entries: [], total_requests: 0 },
  forecast: { entries: [] },
};

const PHANTOM_DEMAND_TABS = [
  { key: "usage", label: "Usage" },
  { key: "forecast", label: "Forecast" },
];

export function PhantomDemandDashboard() {
  const [activeTab, setActiveTab] = useState("usage");

  const { data, loading } = useApi<PhantomDemandApiResponse>({
    url: "/api/account/sonar/phantom-demand",
    fallback: PHANTOM_DEMAND_FALLBACK,
  });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <p className="text-sm text-slate mb-1">Total Requests</p>
        <p className="text-3xl font-bold text-navy">{data.usage.total_requests}</p>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs tabs={PHANTOM_DEMAND_TABS} active={activeTab} onChange={setActiveTab} />

        {activeTab === "usage" && (
          <>
            {data.usage.entries.length === 0 ? (
              <p className="text-sm text-slate py-8 text-center">
                {loading ? "Loading usage data..." : "No usage data found."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate border-b border-slate/15">
                      <th className="pb-3 font-medium">Trading Partner</th>
                      <th className="pb-3 font-medium">Month</th>
                      <th className="pb-3 font-medium">Requests</th>
                      <th className="pb-3 font-medium">Limit</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.usage.entries.map((e, i) => (
                      <tr key={i} className="border-b border-slate/10 hover:bg-gray-50">
                        <td className="py-3 text-navy font-medium">{e.trading_partner}</td>
                        <td className="py-3 text-charcoal">{e.month}</td>
                        <td className="py-3 text-charcoal">{e.requests}</td>
                        <td className="py-3 text-charcoal">{e.limit}</td>
                        <td className="py-3">
                          {e.requests > e.limit ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-problem/10 text-problem">
                              Overage
                            </span>
                          ) : (
                            <StatusBadge status="active" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "forecast" && (
          <>
            {data.forecast.entries.length === 0 ? (
              <p className="text-sm text-slate py-8 text-center">
                {loading ? "Loading forecast data..." : "No forecast data available."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate border-b border-slate/15">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium">Buyer</th>
                      <th className="pb-3 font-medium">Checks</th>
                      <th className="pb-3 font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.forecast.entries.map((e, i) => (
                      <tr key={i} className="border-b border-slate/10 hover:bg-gray-50">
                        <td className="py-3 text-navy font-medium">{e.product_name}</td>
                        <td className="py-3 text-charcoal">{e.buyer_name}</td>
                        <td className="py-3 text-charcoal">{e.checks}</td>
                        <td className="py-3 text-charcoal">{e.trend}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
