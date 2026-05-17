import { Pill } from './pill';

// Preserved for callers that import these maps directly.
export const STATUS_LABELS: Record<string, string> = {
  trading_pair: 'Trading Pair',
  pending_payment: 'Pending Payment',
  past_due: 'Past Due',
  account_owner: 'Owner',
  procurement_read_only: 'Procurement Read Only',
  procurement_transact: 'Procurement Transact',
  buyer_view_only: 'Buyer View Only',
  buyer_request_quote: 'Buyer Request Quote',
  buyer_full_transact: 'Buyer Full Transact',
  inside_sales_read_only: 'Inside Sales Read Only',
  inside_sales_transact: 'Inside Sales Transact',
  pass: 'Pass',
  fail: 'Fail',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const label =
    STATUS_LABELS[status] ??
    status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  return (
    <Pill category="status" value={status} className={className}>
      {label}
    </Pill>
  );
}
