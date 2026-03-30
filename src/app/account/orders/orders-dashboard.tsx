"use client";

import { useState } from "react";
import { Tabs } from "@/components/tabs";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { useApi } from "@/lib/use-api";

interface SellSideOrder {
  id: string;
  order_id: string;
  invoice_id: string;
  vendor_participant_id: string;
  buyer_participant_id: string;
  status: string;
  erp_platform: string | null;
  erp_order_reference: string | null;
  po_number: string | null;
  order_total: number | null;
  currency: string;
  line_items_summary: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  completed_at: string | null;
}

interface OrdersApiResponse {
  sell_side: SellSideOrder[];
}

const TABS = [
  { key: "sell_side", label: "Sell Side" },
  { key: "buy_side", label: "Buy Side" },
];

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "processed", label: "Processed" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
];

const FALLBACK: OrdersApiResponse = {
  sell_side: [],
};

export function OrdersDashboard() {
  const [activeTab, setActiveTab] = useState("sell_side");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processing, setProcessing] = useState<string | null>(null);

  const { data, loading, refetch } = useApi<OrdersApiResponse>({
    url: "/api/account/orders",
    fallback: FALLBACK,
  });

  const filteredOrders = data.sell_side.filter(
    (o) => statusFilter === "all" || o.status === statusFilter,
  );

  async function handleAction(orderId: string, action: "process" | "complete") {
    setProcessing(orderId);
    try {
      const res = await fetch(`/api/account/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`Order action failed: ${text}`);
      }
      refetch();
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-6">
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "sell_side" && (
        <>
          <div className="flex gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                  statusFilter === f.key
                    ? "bg-navy text-white"
                    : "bg-white text-slate border border-slate/20 hover:bg-slate/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <Card>
              <p className="text-slate text-sm">Loading orders...</p>
            </Card>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <p className="text-slate text-sm">
                No sell-side orders{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
                Orders are created when a buyer accepts an invoice.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-navy text-sm">
                          Order {order.order_id.slice(0, 8)}...
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-slate">
                        {order.line_items_summary ?? "No items"}
                      </p>
                      {order.po_number && (
                        <p className="text-xs text-slate">PO: {order.po_number}</p>
                      )}
                      {order.erp_order_reference && (
                        <p className="text-xs text-teal-dark">
                          ERP Ref: {order.erp_order_reference}
                        </p>
                      )}
                      <p className="text-xs text-slate">
                        Created {new Date(order.created_at).toLocaleDateString()}
                        {order.order_total != null && (
                          <> &middot; {order.currency} ${Number(order.order_total).toFixed(2)}</>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {order.status === "pending" && (
                        <button
                          onClick={() => handleAction(order.id, "process")}
                          disabled={processing === order.id}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-teal text-white hover:bg-teal-dark transition-colors disabled:opacity-50"
                        >
                          {processing === order.id ? "Processing..." : "Process"}
                        </button>
                      )}
                      {order.status === "processed" && (
                        <button
                          onClick={() => handleAction(order.id, "complete")}
                          disabled={processing === order.id}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-success text-white hover:bg-success/80 transition-colors disabled:opacity-50"
                        >
                          {processing === order.id ? "Completing..." : "Mark Shipped"}
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "buy_side" && (
        <Card>
          <p className="text-slate text-sm">
            Buy-side order tracking coming soon. Use the agent chat interface to view and manage your purchase orders.
          </p>
        </Card>
      )}
    </div>
  );
}
