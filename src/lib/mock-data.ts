// Single source of truth for all mock data used across the portal

// ─── Interfaces ──────────────────────────────────────────────

export interface MockUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "account_owner" | "procurement_read_only" | "procurement_transact" | "buyer_view_only" | "buyer_request_quote" | "buyer_full_transact" | "inside_sales_read_only" | "inside_sales_transact";
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

// ─── Mock Session ────────────────────────────────────────────

export const MOCK_SESSION = {
  user: {
    id: "u-001",
    email: "admin@lyntron.com",
    first_name: "Robert",
    last_name: "Fleming",
    role: "account_owner" as const,
    job_title: "Operations Manager",
  },
  participant: {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    company_name: "Lyn-Tron Inc",
    status: "active" as const,
    business_type: "Corporation",
    address: {
      line1: "612 N Fancher Rd",
      line2: "",
      city: "Spokane",
      state: "WA",
      postal_code: "99212",
      country: "US",
    },
    phone: "+1 (509) 924-2662",
    email: "info@lyntron.com",
    dba: "",
    tax_id: "",
    duns: "",
    website: "www.lyntron.com",
    description: "Precision electronic hardware manufacturer — spacers, standoffs, shoulder screws, and NAS hardware for electronics and aerospace.",
  },
};

// ─── Mock Users ──────────────────────────────────────────────

export const MOCK_USERS: MockUser[] = [
  {
    id: "u-001",
    email: "sarah.chen@apexmfg.com",
    first_name: "Sarah",
    last_name: "Chen",
    role: "account_owner",
    job_title: "VP Operations",
    phone: "+1 (313) 555-0101",
    status: "active",
    last_login: "2026-02-13T14:30:00Z",
  },
  {
    id: "u-002",
    email: "james.park@apexmfg.com",
    first_name: "James",
    last_name: "Park",
    role: "procurement_transact",
    job_title: "Procurement Manager",
    phone: "+1 (313) 555-0102",
    status: "active",
    last_login: "2026-02-12T09:15:00Z",
  },
  {
    id: "u-003",
    email: "maria.garcia@apexmfg.com",
    first_name: "Maria",
    last_name: "Garcia",
    role: "buyer_view_only",
    job_title: "Supply Chain Analyst",
    phone: "+1 (313) 555-0103",
    status: "active",
    last_login: "2026-02-10T16:45:00Z",
  },
];

// ─── Mock Agents ─────────────────────────────────────────────

export const MOCK_AGENTS: MockAgent[] = [
  {
    id: "a-7f3b2c1e-8d4a-4e5f-9a6b-1c2d3e4f5a6b",
    status: "active",
    types: [
      { key: "cs_agent_key", label: "Customer Service", enabled: true, age_days: 45 },
      { key: "sales_agent_key", label: "Inside Sales", enabled: true, age_days: 45 },
      { key: "procurement_agent_key", label: "Procurement", enabled: true, age_days: 45 },
    ],
    last_heartbeat: "2026-02-13T15:58:00Z",
    consecutive_failures: 0,
    created_at: "2025-12-30T10:00:00Z",
  },
  {
    id: "a-9e8d7c6b-5a4f-3e2d-1c0b-a9b8c7d6e5f4",
    status: "probation",
    types: [
      { key: "cs_agent_key", label: "Customer Service", enabled: true, age_days: 210 },
      { key: "sales_agent_key", label: "Inside Sales", enabled: false, age_days: 0 },
      { key: "procurement_agent_key", label: "Procurement", enabled: false, age_days: 0 },
    ],
    last_heartbeat: "2026-02-13T14:02:00Z",
    consecutive_failures: 2,
    created_at: "2025-07-18T08:30:00Z",
  },
];

// ─── Mock Behavioral Scores ─────────────────────────────────

export const MOCK_SCORES: MockScore[] = [
  { label: "Fulfillment Reliability", key: "fulfillment", value: 94, trend: 2 },
  { label: "Response Time", key: "response_time", value: 88, trend: -1 },
  { label: "Price Adherence", key: "price_adherence", value: 96, trend: 0 },
  { label: "Agent Uptime", key: "agent_uptime", value: 91, trend: 3 },
  { label: "Exception Rate", key: "exception_rate", value: 85, trend: -2 },
];

export const MOCK_SCORE_COMPOSITE = 91;

export const MOCK_SCORE_HISTORY = {
  "30d": [88, 89, 90, 90, 91, 91, 92, 91, 91, 90, 91, 92, 91, 91, 91],
  "60d": [85, 86, 86, 87, 87, 88, 88, 89, 89, 90, 90, 91, 91, 91, 91],
  "90d": [82, 83, 84, 84, 85, 85, 86, 87, 87, 88, 89, 89, 90, 91, 91],
};

export const MOCK_VENDOR_SCORES = {
  composite: 93,
  components: [
    { label: "Fulfillment Reliability", value: 96 },
    { label: "Response Time", value: 90 },
    { label: "Price Adherence", value: 95 },
    { label: "Agent Uptime", value: 91 },
    { label: "Exception Rate", value: 88 },
  ],
};

export const MOCK_BUYER_SCORES = {
  composite: 70,
  components: [
    { label: "Active Trading Pairs", value: 70 },
  ],
};

// ─── Mock Trading Partners ───────────────────────────────────

export const MOCK_PARTNERS: MockPartner[] = [
  { id: "22222222-2222-2222-2222-222222222222", company_name: "MidWest Fastener Corp", status: "trading_pair", manifest_progress: 100, established_at: "2025-11-15T00:00:00Z", location: "Chicago, IL", industry: "Fastener Manufacturing", invite_yours: true, invite_theirs: true, connection_id: "conn-mw" },
  { id: "33333333-3333-3333-3333-333333333333", company_name: "Great Lakes Hardware", status: "trading_pair", manifest_progress: 100, established_at: "2025-12-01T00:00:00Z", location: "Detroit, MI", industry: "Hardware Distribution", invite_yours: true, invite_theirs: true, connection_id: "conn-gl" },
  { id: "66666666-6666-6666-6666-666666666666", company_name: "National Industrial Supply", status: "trading_pair", manifest_progress: 100, established_at: "2025-10-10T00:00:00Z", location: "Columbus, OH", industry: "Industrial Distribution", invite_yours: true, invite_theirs: true, connection_id: "conn-ni" },
  { id: "88888888-8888-8888-8888-888888888888", company_name: "Pacific Safety Products", status: "trading_pair", manifest_progress: 100, established_at: "2025-11-20T00:00:00Z", location: "Portland, OR", industry: "Safety Equipment", invite_yours: true, invite_theirs: true, connection_id: "conn-ps" },
  { id: "55555555-5555-5555-5555-555555555555", company_name: "Precision Plastics Inc", status: "approved", manifest_progress: 60, established_at: "2026-01-20T00:00:00Z", location: "Fort Wayne, IN", industry: "Plastics Manufacturing", invite_yours: true, invite_theirs: false, connection_id: "conn-pp" },
  { id: "77777777-7777-7777-7777-777777777777", company_name: "Summit Electrical Components", status: "approved", manifest_progress: 30, established_at: "2026-02-05T00:00:00Z", location: "Indianapolis, IN", industry: "Electrical Components", invite_yours: false, invite_theirs: false, connection_id: "conn-se" },
];

// ─── Mock Approval Rules ────────────────────────────────────

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

export const MOCK_APPROVAL_RULES: MockApprovalRules = {
  bulk: {
    publicly_traded: true,
    duns_verified: true,
    min_months_on_network: 6,
    min_score: 80,
    min_active_trading_pairs: 10,
    allowlist_ids: [],
  },
  per_request: {
    min_score: 70,
    allowed_business_types: ["Corporation", "LLC"],
    allowed_regions: ["Midwest", "West Coast", "East Coast"],
    blocklist_ids: [],
    default_posture: "auto_approve_with_rules",
  },
  contact: {
    email: "partnerships@apexmfg.com",
    phone: "+1 (313) 555-0100",
  },
};

// ─── Mock Access Requests ────────────────────────────────────

export const MOCK_ACCESS_REQUESTS: MockAccessRequest[] = [
  {
    id: "req-001",
    company_name: "Delta Flow Systems",
    contact_name: "Mark Sullivan",
    message: "We supply flow control systems and valves — interested in sourcing fasteners and fittings for our assemblies.",
    requested_at: "2026-02-11T10:30:00Z",
    industry: "Flow Systems Manufacturing",
    location: "Milwaukee, WI",
    business_type: "Corporation",
    company_description: "Industrial flow control systems, valves, and fluid handling equipment.",
    behavioral_score: 91,
    product_lines: ["Valves", "Flow Meters", "Pipe Fittings", "Regulators"],
    region: "Midwest",
    network_member_since: "2025-06-15T00:00:00Z",
    request_type: "approved",
    invite: false,
    age_days: 4,
  },
  {
    id: "req-002",
    company_name: "W.M. Gore Advanced Materials",
    contact_name: "Patricia Collins",
    message: "Gore manufactures PTFE-based materials and we are looking to supply coated fastener components.",
    requested_at: "2026-02-09T14:00:00Z",
    industry: "Advanced Materials",
    location: "Newark, DE",
    business_type: "Corporation",
    company_description: "PTFE, expanded PTFE, and advanced polymer materials for industrial and electronics applications.",
    behavioral_score: 86,
    product_lines: ["PTFE Membranes", "Sealants", "Gaskets", "Cable Assemblies"],
    region: "East Coast",
    network_member_since: "2025-04-01T00:00:00Z",
    request_type: "trading_pair",
    invite: true,
    age_days: 6,
  },
  {
    id: "req-003",
    company_name: "Lyn-Tron Inc",
    contact_name: "Robert Fleming",
    message: "Precision electronic hardware manufacturer — spacers, standoffs, and shoulder screws for PCB and panel assemblies.",
    requested_at: "2026-02-08T08:45:00Z",
    industry: "Electronic Hardware",
    location: "Spokane, WA",
    business_type: "Corporation",
    company_description: "Precision spacers, standoffs, and fasteners for electronics and aerospace applications.",
    behavioral_score: 88,
    product_lines: ["Spacers", "Standoffs", "Shoulder Screws", "NAS Hardware", "Jack Screws"],
    region: "West Coast",
    network_member_since: "2026-02-15T00:00:00Z",
    request_type: "approved",
    invite: false,
    age_days: 7,
  },
];

// ─── Mock Network Directory ──────────────────────────────────

export const MOCK_DIRECTORY: MockDirectoryCompany[] = [
  { id: "11111111-1111-1111-1111-111111111111", company_name: "Apex Manufacturing", location: "Cleveland, OH", industry: "Precision Manufacturing", description: "Precision-machined industrial components and assemblies for automotive, aerospace, and heavy equipment.", connection_status: "trading_pair" },
  { id: "22222222-2222-2222-2222-222222222222", company_name: "MidWest Fastener Corp", location: "Chicago, IL", industry: "Fastener Manufacturing", description: "Full-line fastener manufacturer — bolts, nuts, screws, rivets, and specialty hardware.", connection_status: "trading_pair" },
  { id: "33333333-3333-3333-3333-333333333333", company_name: "Great Lakes Hardware", location: "Detroit, MI", industry: "Hardware Distribution", description: "Regional distributor of industrial hardware, fasteners, and assembly components.", connection_status: "trading_pair" },
  { id: "44444444-4444-4444-4444-444444444444", company_name: "Delta Flow Systems", location: "Milwaukee, WI", industry: "Flow Systems Manufacturing", description: "Industrial flow control systems, valves, and fluid handling equipment.", connection_status: "pending" },
  { id: "55555555-5555-5555-5555-555555555555", company_name: "Precision Plastics Inc", location: "Fort Wayne, IN", industry: "Plastics Manufacturing", description: "Injection molded plastic components, nylon fasteners, and specialty polymers.", connection_status: "approved" },
  { id: "66666666-6666-6666-6666-666666666666", company_name: "National Industrial Supply", location: "Columbus, OH", industry: "Industrial Distribution", description: "National MRO distributor with 12 regional warehouses across the US.", connection_status: "trading_pair" },
  { id: "77777777-7777-7777-7777-777777777777", company_name: "Summit Electrical Components", location: "Indianapolis, IN", industry: "Electrical Components", description: "Connectors, terminals, wire harnesses, and electrical panel assemblies.", connection_status: "approved" },
  { id: "88888888-8888-8888-8888-888888888888", company_name: "Pacific Safety Products", location: "Portland, OR", industry: "Safety Equipment", description: "PPE, safety signage, lockout/tagout kits, and workplace safety solutions.", connection_status: "trading_pair" },
  { id: "99999999-9999-9999-9999-999999999999", company_name: "W.M. Gore Advanced Materials", location: "Newark, DE", industry: "Advanced Materials", description: "PTFE, expanded PTFE membranes, sealants, gaskets, and cable assemblies.", connection_status: "pending" },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", company_name: "Lyn-Tron Inc", location: "Spokane, WA", industry: "Electronic Hardware", description: "Precision spacers, standoffs, shoulder screws, and NAS hardware for electronics and aerospace.", connection_status: "none" },
];

// ─── Mock Invoices ───────────────────────────────────────────

export const MOCK_INVOICES: MockInvoice[] = [
  { id: "inv-001", date: "2026-02-01", description: "HAIWAVE Platform Fee — Annual", amount: 10000, status: "paid", pdf_url: "#" },
  { id: "inv-002", date: "2026-02-01", description: "Connection Fees — February 2026", amount: 400, status: "open", pdf_url: "#" },
  { id: "inv-003", date: "2026-01-01", description: "Connection Fees — January 2026", amount: 400, status: "paid", pdf_url: "#" },
  { id: "inv-004", date: "2025-12-01", description: "Connection Fees — December 2025", amount: 300, status: "paid", pdf_url: "#" },
  { id: "inv-005", date: "2025-11-01", description: "Connection Fees — November 2025", amount: 200, status: "paid", pdf_url: "#" },
  { id: "inv-006", date: "2025-10-15", description: "Connection Fees — October 2025", amount: 100, status: "past_due", pdf_url: "#" },
];

// ─── Mock Counterparty Manifest ──────────────────────────────

export const MOCK_INBOUND_REQUIREMENTS: MockRequirement[] = [
  { id: "req-w9", field_name: "w9_form", display_name: "W-9 Form", required: true, enabled: true, description: "IRS Form W-9 for tax identification." },
  { id: "req-coi", field_name: "certificate_of_insurance", display_name: "Certificate of Insurance", required: true, enabled: true, description: "Proof of general liability insurance coverage." },
  { id: "req-resale", field_name: "resale_certificate", display_name: "Resale Certificate", required: false, enabled: true, description: "State-issued resale certificate for tax-exempt purchases." },
  { id: "req-license", field_name: "business_license", display_name: "Business License", required: false, enabled: false, description: "Valid business license for the operating jurisdiction." },
  { id: "req-credit", field_name: "credit_references", display_name: "Credit References", required: false, enabled: false, description: "Three trade credit references." },
  { id: "req-financial", field_name: "financial_statements", display_name: "Financial Statements", required: false, enabled: false, description: "Most recent annual financial statements." },
];

export const MOCK_OUTBOUND_POSTURES: MockPosture[] = [
  { id: "pos-w9", document_type: "w9_form", display_name: "W-9 Form", posture: "support", score_threshold: null, notification_email: "" },
  { id: "pos-coi", document_type: "certificate_of_insurance", display_name: "Certificate of Insurance", posture: "support", score_threshold: 85, notification_email: "" },
  { id: "pos-resale", document_type: "resale_certificate", display_name: "Resale Certificate", posture: "support", score_threshold: null, notification_email: "" },
  { id: "pos-license", document_type: "business_license", display_name: "Business License", posture: "support", score_threshold: null, notification_email: "" },
  { id: "pos-credit", document_type: "credit_references", display_name: "Credit References", posture: "exception", score_threshold: null, notification_email: "sarah.chen@apexmfg.com" },
  { id: "pos-financial", document_type: "financial_statements", display_name: "Financial Statements", posture: "not_supported", score_threshold: null, notification_email: "" },
];

// ─── Mock Pricing Defaults ───────────────────────────────────

export const MOCK_PRICING_DEFAULTS = {
  default_currency: "USD",
  default_payment_terms: "Net 30",
  default_freight_terms: "FOB Origin",
  minimum_order_value: 500,
  quote_validity_days: 14,
  volume_discount_tiers: [
    { min_qty: 100, max_qty: 499, discount_pct: 5 },
    { min_qty: 500, max_qty: 999, discount_pct: 10 },
    { min_qty: 1000, max_qty: null, discount_pct: 15 },
  ],
  aged_inventory_discount_enabled: true,
  aged_inventory_threshold_days: 90,
  aged_inventory_discount_pct: 20,
};

// ─── Mock Admin Stats ────────────────────────────────────────

export const MOCK_ADMIN_STATS = {
  participants: { active: 10, pending_payment: 0, suspended: 0, total: 10 },
  trading_pairs: 24,
  outstanding_invoices: 1,
  outstanding_amount: 2400,
  agent_health: { active: 10, jailed: 0, probation: 0, offline: 0 },
};

// ─── Mock Audit Events ────────────────────────────────────

export interface MockAuditEvent {
  id: string;
  event_type: string;
  actor_id: string;
  actor_type: string;
  participant_id: string | null;
  action: string;
  timestamp: string;
  retention_class: string;
}

export const MOCK_AUDIT_EVENTS: MockAuditEvent[] = [
  { id: "ae-001", event_type: "connection.approved", actor_id: "system", actor_type: "system", participant_id: null, action: "auto_approved_bulk_criteria", timestamp: "2026-02-13T10:00:00Z", retention_class: "standard" },
  { id: "ae-002", event_type: "connection.approved", actor_id: "system", actor_type: "system", participant_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", action: "auto_approved_new_participant", timestamp: "2026-02-15T08:30:00Z", retention_class: "standard" },
  { id: "ae-003", event_type: "pricing.updated", actor_id: "66666666-6666-6666-6666-666666666666", actor_type: "participant", participant_id: "66666666-6666-6666-6666-666666666666", action: "updated_pricing_manifest", timestamp: "2026-02-11T15:45:00Z", retention_class: "standard" },
  { id: "ae-004", event_type: "pricing.updated", actor_id: "22222222-2222-2222-2222-222222222222", actor_type: "participant", participant_id: "22222222-2222-2222-2222-222222222222", action: "updated_pricing_manifest", timestamp: "2026-02-10T12:00:00Z", retention_class: "standard" },
  { id: "ae-005", event_type: "order.placed", actor_id: "11111111-1111-1111-1111-111111111111", actor_type: "participant", participant_id: "66666666-6666-6666-6666-666666666666", action: "placed_order", timestamp: "2026-02-09T16:30:00Z", retention_class: "standard" },
];

// ─── Mock Admin Analytics ─────────────────────────────────

export const MOCK_ADMIN_ANALYTICS = {
  connections: {
    approval_rate_30d: 78.5,
    mean_time_to_approve_hours: 4.2,
    auto_approval_rate: 62.3,
    requests_30d: 47,
    top_requesters: [
      { participant_id: "44444444-4444-4444-4444-444444444444", name: "Delta Flow Systems", request_count: 8 },
      { participant_id: "99999999-9999-9999-9999-999999999999", name: "W.M. Gore Advanced Materials", request_count: 6 },
      { participant_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "Lyn-Tron Inc", request_count: 5 },
    ],
  },
  abuse: {
    active_blocks: 3,
    blocks_30d: 2,
    spam_signals: [] as { participant_id: string; name: string; signal_type: string; count: number }[],
    trust_anomalies: [] as { participant_id: string; name: string; anomaly: string }[],
  },
  health: {
    agent_uptime_pct: 97.2,
    agents_jailed: 2,
    agents_probation: 3,
    heartbeat_success_rate: 98.1,
    avg_response_time_ms: 245,
    narrowing_completion_rate: 84.5,
    rma_volume_30d: 3,
  },
};

// ─── Mock Blocked Companies ───────────────────────────────

export interface MockBlockedCompany {
  participant_id: string;
  company_name: string;
  blocked_at: string;
  reason: string;
}

export const MOCK_BLOCKED_COMPANIES: MockBlockedCompany[] = [];

// ─── Mock Pricing Hierarchy ──────────────────────────────

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

export const MOCK_PRICING_HIERARCHY: MockPricingNode[] = [
  {
    id: "pm-company",
    level: "company",
    label: "Company Default",
    pricing: { base_unit_price: null, currency: "USD", unit_of_measure: "EA", volume_tiers: [], aged_inventory_rules: [] },
    terms: { default_payment_terms: "Net 30", default_shipping_terms: "FOB Origin", minimum_order_value: 500 },
    children: [
      {
        id: "pm-fasteners",
        level: "product_line",
        label: "Fasteners",
        scope: { product_line: "Fasteners" },
        inherited_from: "Company Default",
        pricing: { base_unit_price: 0.85, currency: "USD", unit_of_measure: "EA" },
        terms: { default_payment_terms: "Net 30", default_shipping_terms: "FOB Origin", minimum_order_quantity: 100 },
        children: [],
      },
      {
        id: "pm-bearings",
        level: "product_line",
        label: "Bearings",
        scope: { product_line: "Bearings" },
        inherited_from: "Company Default",
        pricing: { base_unit_price: 4.50, currency: "USD", unit_of_measure: "EA" },
        terms: { default_payment_terms: "Net 45", default_shipping_terms: "FOB Origin" },
        children: [],
      },
    ],
  },
];

export const MOCK_ADMIN_PARTICIPANTS: MockParticipant[] = [
  { id: "11111111-1111-1111-1111-111111111111", company_name: "Apex Manufacturing", status: "active", location: "Cleveland, OH", registered_at: "2025-06-01T00:00:00Z", agent_count: 1, trading_pairs: 6 },
  { id: "22222222-2222-2222-2222-222222222222", company_name: "MidWest Fastener Corp", status: "active", location: "Chicago, IL", registered_at: "2025-06-01T00:00:00Z", agent_count: 1, trading_pairs: 5 },
  { id: "33333333-3333-3333-3333-333333333333", company_name: "Great Lakes Hardware", status: "active", location: "Detroit, MI", registered_at: "2025-06-15T00:00:00Z", agent_count: 1, trading_pairs: 5 },
  { id: "44444444-4444-4444-4444-444444444444", company_name: "Delta Flow Systems", status: "active", location: "Milwaukee, WI", registered_at: "2025-07-01T00:00:00Z", agent_count: 1, trading_pairs: 4 },
  { id: "55555555-5555-5555-5555-555555555555", company_name: "Precision Plastics Inc", status: "active", location: "Fort Wayne, IN", registered_at: "2025-07-15T00:00:00Z", agent_count: 1, trading_pairs: 3 },
  { id: "66666666-6666-6666-6666-666666666666", company_name: "National Industrial Supply", status: "active", location: "Columbus, OH", registered_at: "2025-06-01T00:00:00Z", agent_count: 1, trading_pairs: 7 },
  { id: "77777777-7777-7777-7777-777777777777", company_name: "Summit Electrical Components", status: "active", location: "Indianapolis, IN", registered_at: "2025-08-01T00:00:00Z", agent_count: 1, trading_pairs: 4 },
  { id: "88888888-8888-8888-8888-888888888888", company_name: "Pacific Safety Products", status: "active", location: "Portland, OR", registered_at: "2025-08-15T00:00:00Z", agent_count: 1, trading_pairs: 5 },
  { id: "99999999-9999-9999-9999-999999999999", company_name: "W.M. Gore Advanced Materials", status: "active", location: "Newark, DE", registered_at: "2025-09-01T00:00:00Z", agent_count: 1, trading_pairs: 3 },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", company_name: "Lyn-Tron Inc", status: "active", location: "Spokane, WA", registered_at: "2026-02-15T00:00:00Z", agent_count: 1, trading_pairs: 9 },
];
