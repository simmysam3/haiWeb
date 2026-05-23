"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { Tabs } from "@/components/tabs";
import { useApi } from "@/lib/use-api";
import { ManifestDetailDrawer } from "./manifest-detail-drawer";

interface ManifestEntry {
  origin_manifest_id: string;
  external_product_id: string;
  product_name: string;
  manifest_version: number;
  provenance_depth: string;
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
  const [selected, setSelected] = useState<{ productId: string; productName: string } | null>(null);

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
                      <th className="pb-3 font-medium" aria-hidden="true"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.manifests.map((m) => (
                      <tr
                        key={m.origin_manifest_id}
                        onClick={() =>
                          setSelected({
                            productId: m.external_product_id,
                            productName: m.product_name,
                          })
                        }
                        className="border-b border-slate/10 hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="py-3 text-navy font-medium">{m.product_name}</td>
                        <td className="py-3 text-charcoal">v{m.manifest_version}</td>
                        <td className="py-3 text-charcoal capitalize">{m.provenance_depth}</td>
                        <td className="py-3 text-slate">
                          {new Date(m.updated_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right text-teal text-xs">
                          Inspect <span className="text-lg font-bold align-middle">›</span>
                        </td>
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
                          <StatusBadge status={c.result} />
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

      <ManifestDetailDrawer
        productId={selected?.productId ?? null}
        productName={selected?.productName ?? null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
