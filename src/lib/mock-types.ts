// Type-only exports for mock data.
// Client components import types from here so they do not pull in
// the mock constants (which live in mock-data.ts and should stay server-side
// or behind BFF routes).

export interface MockUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role:
    | "account_owner"
    | "procurement_read_only"
    | "procurement_transact"
    | "buyer_view_only"
    | "buyer_request_quote"
    | "buyer_full_transact"
    | "inside_sales_read_only"
    | "inside_sales_transact";
  job_title: string;
  phone: string;
  status: "active" | "disabled";
  last_login: string;
}

export interface MockAgent {
  id: string;
  status: "active" | "jailed" | "probation" | "offline";
  types: { key: string; label: string; enabled: boolean; age_days: number }[];
  last_heartbeat: string;
  consecutive_failures: number;
  created_at: string;
}

export interface MockScore {
  label: string;
  key: string;
  value: number;
  trend: number; // positive = improving
}

export interface MockPartner {
  id: string;
  company_name: string;
  status: "approved" | "trading_pair";
  manifest_progress: number;
  established_at: string;
  location: string;
  industry: string;
  invite_yours: boolean;
  invite_theirs: boolean;
  connection_id: string;
}

export interface MockAccessRequest {
  id: string;
  company_name: string;
  contact_name: string;
  message: string;
  requested_at: string;
  industry: string;
  location: string;
  business_type: string;
  company_description: string;
  behavioral_score: number | null;
  product_lines: string[];
  region: string;
  network_member_since: string | null;
  request_type: "approved" | "trading_pair";
  invite: boolean;
  age_days: number;
}

export interface MockDirectoryCompany {
  id: string;
  company_name: string;
  location: string;
  industry: string;
  description: string;
  connection_status: "none" | "pending" | "approved" | "trading_pair" | "banned";
}

export interface MockInvoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "open" | "past_due" | "void";
  pdf_url: string;
}

export interface MockRequirement {
  id: string;
  field_name: string;
  display_name: string;
  required: boolean;
  enabled: boolean;
  description: string;
}

export interface MockPosture {
  id: string;
  document_type: string;
  display_name: string;
  posture: "support" | "not_supported" | "exception";
  score_threshold: number | null;
  notification_email: string;
}

export type LeadTimeTrendSharingPosture = "require" | "prefer" | "not_required";

export interface MockParticipant {
  id: string;
  company_name: string;
  status: "active" | "pending_payment" | "suspended";
  location: string;
  registered_at: string;
  agent_count: number;
  trading_pairs: number;
  suspension_reason?: string;
}

export interface MockApprovalRules {
  bulk: {
    publicly_traded: boolean;
    duns_verified: boolean;
    min_months_on_network: number;
    min_score: number;
    min_active_trading_pairs: number;
    allowlist_ids: string[];
  };
  per_request: {
    min_score: number;
    allowed_business_types: string[];
    allowed_regions: string[];
    blocklist_ids: string[];
    default_posture: "auto_approve_all" | "auto_approve_with_rules" | "manual_only";
  };
  contact: {
    email: string;
    phone: string;
  };
}

export interface MockBlockedCompany {
  participant_id: string;
  company_name: string;
  blocked_at: string;
  reason: string;
}

export interface MockPricingNode {
  id: string;
  level: string;
  label: string;
  scope?: { product_line?: string; product_id?: string };
  customer_override?: string;
  inherited_from?: string;
  pricing: Record<string, unknown>;
  terms: Record<string, unknown>;
  children?: MockPricingNode[];
}
