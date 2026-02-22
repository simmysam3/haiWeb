"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { useApi } from "@/lib/use-api";

interface PendingPayment {
  id: string;
  order_id: string;
  payment_status: string;
  amount_usdc: number;
  buyer_address: string;
  vendor_address: string;
  created_at: string;
}

export function PaymentApprovalQueue() {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const { data, loading, refetch } = useApi<{ payments: PendingPayment[] }>({
    path: "/payments/pending-approvals",
    fallback: { payments: [] },
  });

  const handleApprove = async (orderId: string) => {
    setActionInProgress(orderId);
    try {
      await fetch(`/api/account/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      refetch();
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (orderId: string) => {
    setActionInProgress(orderId);
    try {
      await fetch(`/api/account/approve`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, reason: "Rejected by user" }),
      });
      refetch();
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return <Card><div className="animate-pulse p-6">Loading approvals...</div></Card>;
  }

  const payments = data?.payments ?? [];

  if (payments.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center text-sm text-slate">
          No payments pending approval.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-navy">Pending Approvals</h3>
        <p className="mt-1 text-sm text-slate">
          Payments exceeding your approval threshold require manual authorization.
        </p>
        <div className="mt-4 space-y-3">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-navy">
                  Order {p.order_id.slice(0, 8)}...
                </p>
                <p className="text-xs text-slate">
                  ${p.amount_usdc.toLocaleString()} USDC to {p.vendor_address.slice(0, 10)}...
                </p>
                <p className="text-xs text-slate">
                  {new Date(p.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(p.order_id)}
                  disabled={actionInProgress === p.order_id}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(p.order_id)}
                  disabled={actionInProgress === p.order_id}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
