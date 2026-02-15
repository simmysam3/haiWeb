"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { DataTable, Column } from "@/components/data-table";
import { MOCK_INVOICES, MOCK_PARTNERS, MockInvoice } from "@/lib/mock-data";

export function BillingPanel() {
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const tradingPairs = MOCK_PARTNERS.filter((p) => p.status === "trading_pair");
  const pairCount = tradingPairs.length;
  const tier1 = Math.min(pairCount, 20);
  const tier2 = Math.min(Math.max(pairCount - 20, 0), 80);
  const tier3 = Math.max(pairCount - 100, 0);
  const monthlyConnection = tier1 * 100 + tier2 * 80 + tier3 * 50;

  const invoiceColumns: Column<MockInvoice>[] = [
    {
      key: "date",
      label: "Date",
      render: (inv) => <span className="text-charcoal">{inv.date}</span>,
    },
    {
      key: "description",
      label: "Description",
      render: (inv) => <span className="text-charcoal">{inv.description}</span>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (inv) => <span className="font-medium text-charcoal">${inv.amount.toLocaleString()}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (inv) => <StatusBadge status={inv.status} />,
    },
    {
      key: "actions",
      label: "",
      render: () => (
        <Button size="sm" variant="ghost" onClick={() => showToast("PDF download started (mock)")}>
          Download PDF
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success">
          {toast}
        </div>
      )}

      {/* Subscription */}
      <Card title="Subscription">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate mb-1">HAIWAVE Platform</p>
            <p className="text-2xl font-bold text-navy">$10,000<span className="text-sm text-slate font-normal">/year</span></p>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-charcoal">Renewal: March 1, 2027</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-charcoal">Payment Status:</span>
                <StatusBadge status="active" />
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-slate mb-1">Connection Fee Summary</p>
            <p className="text-sm text-charcoal">{pairCount} pairs @ $100/mo each</p>
            <p className="text-lg font-bold text-navy mt-1">${monthlyConnection}/mo</p>
          </div>
        </div>
      </Card>

      {/* Payment Method */}
      <Card title="Payment Method">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-7 bg-navy/10 rounded flex items-center justify-center text-xs font-bold text-navy">
              VISA
            </div>
            <div>
              <p className="text-sm font-medium text-charcoal">Visa ending in 4242</p>
              <p className="text-xs text-slate">Expires 12/2028</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => showToast("Payment method update (mock)")}>
            Update
          </Button>
        </div>
      </Card>

      {/* Invoice History */}
      <Card title="Invoice History">
        <DataTable
          columns={invoiceColumns}
          data={MOCK_INVOICES}
          keyFn={(inv) => inv.id}
          emptyMessage="No invoices."
        />
      </Card>

      {/* Connection Fee Detail */}
      <Card title="Connection Fee Detail">
        <p className="text-sm text-slate mb-4">
          Each party pays independently. Tiered pricing: $100/mo (1-20 pairs), $80/mo (21-100), $50/mo (101+).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate/15">
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Partner</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Status</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Rate</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Monthly</th>
              </tr>
            </thead>
            <tbody>
              {tradingPairs.map((p, i) => (
                <tr key={p.id} className="border-b border-slate/10">
                  <td className="py-3 px-4 text-charcoal">{p.company_name}</td>
                  <td className="py-3 px-4"><StatusBadge status="trading_pair" /></td>
                  <td className="py-3 px-4 text-slate">
                    {i < 20 ? "$100" : i < 100 ? "$80" : "$50"}/mo
                  </td>
                  <td className="py-3 px-4 font-medium text-charcoal">
                    ${i < 20 ? "100" : i < 100 ? "80" : "50"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate/20">
                <td colSpan={3} className="py-3 px-4 font-medium text-charcoal">Total Monthly</td>
                <td className="py-3 px-4 font-bold text-navy">${monthlyConnection}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
