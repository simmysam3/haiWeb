"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { Tabs } from "@/components/tabs";
import { CounterpartyManifest } from "./counterparty-manifest";
import { PricingDefaults } from "./pricing-defaults";
import { SharingPolicyPanel } from "./sharing-policy-panel";
import { LibraryTab } from "./library/library-tab";

const MANIFEST_TABS = [
  { key: "counterparty", label: "Counterparty Manifest" },
  { key: "library_sharing", label: "Library — Sharing" },
  { key: "library_requirements", label: "Library — Requirements" },
  { key: "pricing", label: "Baseline Pricing" },
  { key: "sharing", label: "Audit Permissions" },
];

export default function ManifestsPage() {
  const [activeTab, setActiveTab] = useState("counterparty");

  return (
    <div>
      <PageHeader
        title="Manifests"
        description="Configure counterparty requirements, baseline pricing, and audit permissions."
      />
      <PageIntro>
        Manifests are forward declarations: how you tell counterparties what you&apos;ll require of them and what posture they should expect from you — counterparty obligations, baseline pricing, and audit permissions. Edit them here to change obligations, propagate pricing, and shape what your trading partners see when they connect.
      </PageIntro>
      <Tabs tabs={MANIFEST_TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "counterparty" && <CounterpartyManifest />}
      {activeTab === "library_sharing" && <LibraryTab context="share" />}
      {activeTab === "library_requirements" && <LibraryTab context="require" />}
      {activeTab === "pricing" && <PricingDefaults />}
      {activeTab === "sharing" && <SharingPolicyPanel />}
    </div>
  );
}
