"use client";

import { Card } from "@/components/card";
import { useApi } from "@/lib/use-api";

interface PaymentRecord {
  id: string;
  order_id: string;
  payment_status: string;
  amount_usdc: number;
  buyer_address: string;
  vendor_address: string;
  network: string;
  settlement_tx_hash: string | null;
  settled_at: string | null;
  created_at: string;
}

interface PaymentHistoryResponse {
  payments: PaymentRecord[];
  total: number;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    settled: "bg-emerald-100 text-emerald-700",
    authorized: "bg-blue-100 text-blue-700",
    settling: "bg-yellow-100 text-yellow-700",
    awaiting_authorization: "bg-gray-100 text-gray-600",
    pending_approval: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
    refunded: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function PaymentHistoryTable() {
  const { data, loading } = useApi<PaymentHistoryResponse>({
    path: "/payments/history",
    fallback: { payments: [], total: 0 },
  });

  if (loading) {
    return <Card><div className="animate-pulse p-6">Loading payment history...</div></Card>;
  }

  const payments = data?.payments ?? [];

  if (payments.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center text-sm text-slate">
          No payment transactions yet.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-navy">Payment History</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate">
                <th className="pb-2 pr-4">Order</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Vendor Address</th>
                <th className="pb-2 pr-4">Tx Hash</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-mono text-xs">{p.order_id.slice(0, 8)}...</td>
                  <td className="py-2 pr-4 font-medium text-teal">${p.amount_usdc.toLocaleString()}</td>
                  <td className="py-2 pr-4">{statusBadge(p.payment_status)}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{p.vendor_address.slice(0, 10)}...</td>
                  <td className="py-2 pr-4">
                    {p.settlement_tx_hash ? (
                      <a
                        href={`https://basescan.org/tx/${p.settlement_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-teal hover:underline"
                      >
                        {p.settlement_tx_hash.slice(0, 10)}...
                      </a>
                    ) : (
                      <span className="text-xs text-slate">-</span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-slate">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
