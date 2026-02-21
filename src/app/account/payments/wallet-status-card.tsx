"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { useApi } from "@/lib/use-api";

interface WalletData {
  id: string;
  participant_id: string;
  wallet_type: string;
  network: string;
  address: string;
  verification_status: string;
  is_active: boolean;
  created_at: string;
}

interface BalanceData {
  address: string;
  balance_usdc: number;
  network: string;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    verified: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

export function WalletStatusCard() {
  const [registering, setRegistering] = useState(false);

  const { data: wallet, loading, error, refetch } = useApi<WalletData>({
    path: "/wallets/current",
    fallback: null,
  });

  const { data: balance } = useApi<BalanceData>({
    path: wallet ? `/wallets/${wallet.id}/balance` : null,
    fallback: null,
  });

  if (loading) {
    return <Card><div className="animate-pulse p-6">Loading wallet...</div></Card>;
  }

  if (!wallet || error) {
    return (
      <Card>
        <div className="p-6 text-center">
          <h3 className="text-lg font-semibold text-navy">No Wallet Configured</h3>
          <p className="mt-2 text-sm text-slate">
            Set up a USDC wallet on Base L2 to enable instant payment settlement.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90 transition-colors"
              onClick={() => setRegistering(true)}
              disabled={registering}
            >
              {registering ? "Provisioning..." : "Create New Wallet"}
            </button>
            <button
              className="rounded-md border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/5 transition-colors"
              onClick={() => setRegistering(true)}
              disabled={registering}
            >
              Register Existing
            </button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-navy">USDC Wallet</h3>
            {statusBadge(wallet.verification_status)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate">Address</p>
              <p className="mt-0.5 font-mono text-sm text-navy break-all">
                {wallet.address}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate">Network</p>
              <p className="mt-0.5 text-sm text-navy">{wallet.network}</p>
            </div>
            <div>
              <p className="text-xs text-slate">Type</p>
              <p className="mt-0.5 text-sm text-navy capitalize">{wallet.wallet_type.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-xs text-slate">Balance</p>
              <p className="mt-0.5 text-lg font-bold text-teal">
                {balance ? `$${balance.balance_usdc.toLocaleString()} USDC` : "Loading..."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <a
              href={`https://basescan.org/address/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal hover:underline"
            >
              View on Base Explorer
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
