"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/tabs";
import { CounterpartyManifest } from "./counterparty-manifest";
import { PricingDefaults } from "./pricing-defaults";
import { SharingPolicyPanel } from "./sharing-policy-panel";

const MANIFEST_TABS = [
  { key: "counterparty", label: "Counterparty Manifest" },
  { key: "pricing", label: "Baseline Pricing" },
  { key: "sharing", label: "Sharing Policy" },
];

export default function ManifestsPage() {
  const [activeTab, setActiveTab] = useState("counterparty");

  return (
    <div>
      <PageHeader
        title="Manifests"
        description="Configure counterparty requirements, baseline pricing, and your sharing policy."
      />
      <Tabs tabs={MANIFEST_TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "counterparty" && <CounterpartyManifest />}
      {activeTab === "pricing" && <PricingDefaults />}
      {activeTab === "sharing" && <SharingPolicyPanel />}
    </div>
  );
}
