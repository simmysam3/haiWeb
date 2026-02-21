"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { Tabs } from "@/components/tabs";
import { WalletStatusCard } from "./wallet-status-card";
import { SpendingPolicyForm } from "./spending-policy-form";
import { PaymentManifestForm } from "./payment-manifest-form";
import { PaymentHistoryTable } from "./payment-history-table";
import { PaymentApprovalQueue } from "./payment-approval-queue";

const SECTION_TABS = [
  { key: "wallet", label: "Wallet" },
  { key: "manifests", label: "Manifests" },
  { key: "policies", label: "Policies" },
  { key: "history", label: "History" },
  { key: "approvals", label: "Approvals" },
];

export function PaymentsDashboard() {
  const [activeTab, setActiveTab] = useState("wallet");

  return (
    <div className="space-y-6">
      <Tabs
        tabs={SECTION_TABS}
        activeKey={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "wallet" && <WalletStatusCard />}
      {activeTab === "manifests" && <PaymentManifestForm />}
      {activeTab === "policies" && <SpendingPolicyForm />}
      {activeTab === "history" && <PaymentHistoryTable />}
      {activeTab === "approvals" && <PaymentApprovalQueue />}
    </div>
  );
}
