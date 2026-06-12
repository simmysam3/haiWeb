"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { Tabs } from "@/components/tabs";
import { CounterpartyManifest } from "./counterparty-manifest";
import { PricingDefaults } from "./pricing-defaults";
import { SharingPolicyPanel } from "./sharing-policy-panel";
import { LibraryTab } from "./library/library-tab";
import { EntityApprovalsTab } from "./entity-approvals/entity-approvals-tab";

const MANIFEST_TABS = [
  { key: "counterparty", label: "Counterparty Manifest" },
  { key: "library_sharing", label: "Library — Sharing" },
  { key: "library_requirements", label: "Library — Requirements" },
  { key: "pricing", label: "Baseline Pricing" },
  { key: "sharing", label: "Audit Permissions" },
  { key: "entity_approvals", label: "Entity Approvals" },
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
        Manifests are forward declarations of your trading posture, in both directions. Buy side: what you require of the parties you buy from — requirements each supplier satisfies from their own library. Sell side: the documents, pricing, and audit access you hold and offer the parties who buy from you. Edit them here to change obligations, propagate pricing, and shape what trading partners see when they connect.
      </PageIntro>
      <Tabs tabs={MANIFEST_TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "counterparty" && <CounterpartyManifest />}
      {activeTab === "library_sharing" && <LibraryTab context="share" />}
      {activeTab === "library_requirements" && <LibraryTab context="require" />}
      {activeTab === "pricing" && <PricingDefaults />}
      {activeTab === "sharing" && <SharingPolicyPanel />}
      {activeTab === "entity_approvals" && <EntityApprovalsTab />}
    </div>
  );
}
