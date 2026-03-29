"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { Tabs } from "@/components/tabs";
import { useApi } from "@/lib/use-api";

interface ManifestEntry {
  product_id: string;
  product_name: string;
  version: string;
  depth: number;
  updated_at: string;
}

interface CertificationEntry {
  product_name: string;
  level: string;
  result: string;
  certified_at: string;
  expires_at: string;
}

interface ProvenanceApiResponse {
  manifests: ManifestEntry[];
  certifications: CertificationEntry[];
}

const PROVENANCE_FALLBACK: ProvenanceApiResponse = {
  manifests: [],
  certifications: [],
};

const PROVENANCE_TABS = [
  { key: "manifests", label: "Origin Manifests" },
  { key: "certifications", label: "Certifications" },
];

export function ProvenanceDashboard() {
  const [activeTab, setActiveTab] = useState("manifests");

  const { data, loading } = useApi<ProvenanceApiResponse>({
    url: "/api/account/provenance",
    fallback: PROVENANCE_FALLBACK,
  });

  return (
    <div className="space-y-6">
      <Card>
        <Tabs tabs={PROVENANCE_TABS} active={activeTab} onChange={setActiveTab} />

        {activeTab === "manifests" && (
          <>
            {data.manifests.length === 0 ? (
              <p className="text-sm text-slate py-8 text-center">
                {loading ? "Loading manifests..." : "No origin manifests found."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate border-b border-slate/15">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium">Version</th>
                      <th className="pb-3 font-medium">Depth</th>
                      <th className="pb-3 font-medium">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.manifests.map((m) => (
                      <tr key={m.product_id} className="border-b border-slate/10 hover:bg-gray-50">
                        <td className="py-3 text-navy font-medium">{m.product_name}</td>
                        <td className="py-3 text-charcoal">{m.version}</td>
                        <td className="py-3 text-charcoal">{m.depth}</td>
                        <td className="py-3 text-slate">{m.updated_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "certifications" && (
          <>
            {data.certifications.length === 0 ? (
              <p className="text-sm text-slate py-8 text-center">
                {loading ? "Loading certifications..." : "No certifications found."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate border-b border-slate/15">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium">Level</th>
                      <th className="pb-3 font-medium">Result</th>
                      <th className="pb-3 font-medium">Certified</th>
                      <th className="pb-3 font-medium">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.certifications.map((c, i) => (
                      <tr key={i} className="border-b border-slate/10 hover:bg-gray-50">
                        <td className="py-3 text-navy font-medium">{c.product_name}</td>
                        <td className="py-3 text-charcoal">{c.level}</td>
                        <td className="py-3">
                          <StatusBadge status={c.result === "pass" ? "approved" : "failed"} />
                        </td>
                        <td className="py-3 text-slate">{c.certified_at}</td>
                        <td className="py-3 text-slate">{c.expires_at}</td>
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
