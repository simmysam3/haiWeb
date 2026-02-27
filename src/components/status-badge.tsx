const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/10 text-success",
  trading_pair: "bg-success/10 text-success",
  approved: "bg-teal/10 text-teal-dark",
  paid: "bg-success/10 text-success",
  online: "bg-success/10 text-success",

  pending: "bg-warning/10 text-warning",
  pending_payment: "bg-warning/10 text-warning",
  open: "bg-warning/10 text-warning",
  probation: "bg-warning/10 text-warning",

  jailed: "bg-problem/10 text-problem",
  suspended: "bg-problem/10 text-problem",
  past_due: "bg-problem/10 text-problem",
  banned: "bg-problem/10 text-problem",
  disabled: "bg-problem/10 text-problem",

  offline: "bg-slate/10 text-slate",
  none: "bg-slate/10 text-slate",
  void: "bg-slate/10 text-slate",

  account_owner: "bg-navy/10 text-navy",
  procurement_transact: "bg-teal/10 text-teal-dark",
  buyer_full_transact: "bg-teal/10 text-teal-dark",
  inside_sales_transact: "bg-teal/10 text-teal-dark",
  buyer_request_quote: "bg-warning/10 text-warning",
  procurement_read_only: "bg-slate/10 text-slate",
  buyer_view_only: "bg-slate/10 text-slate",
  inside_sales_read_only: "bg-slate/10 text-slate",
};

const LABEL_MAP: Record<string, string> = {
  trading_pair: "Trading Pair",
  pending_payment: "Pending Payment",
  past_due: "Past Due",
  account_owner: "Owner",
  procurement_read_only: "Procurement Read Only",
  procurement_transact: "Procurement Transact",
  buyer_view_only: "Buyer View Only",
  buyer_request_quote: "Buyer Request Quote",
  buyer_full_transact: "Buyer Full Transact",
  inside_sales_read_only: "Inside Sales Read Only",
  inside_sales_transact: "Inside Sales Transact",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || "bg-slate/10 text-slate";
  const label = LABEL_MAP[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}>
      {label}
    </span>
  );
}
