// Single source of truth for all mock data used across the portal

// ─── Interfaces ──────────────────────────────────────────────

export interface MockUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "account_owner" | "account_admin" | "account_viewer";
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
}

export interface MockAccessRequest {
  id: string;
  company_name: string;
  contact_name: string;
  message: string;
  requested_at: string;
  industry: string;
  location: string;
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
    email: "sarah.chen@apexmfg.com",
    first_name: "Sarah",
    last_name: "Chen",
    role: "account_owner" as const,
    job_title: "VP Operations",
  },
  participant: {
    id: "p-apex-001",
    company_name: "Apex Manufacturing",
    status: "active" as const,
    business_type: "Corporation",
    address: {
      line1: "1200 Industrial Parkway",
      line2: "Suite 400",
      city: "Detroit",
      state: "MI",
      postal_code: "48201",
      country: "US",
    },
    phone: "+1 (313) 555-0100",
    email: "info@apexmfg.com",
    dba: "",
    tax_id: "38-4012789",
    duns: "084567123",
    website: "https://apexmfg.com",
    description: "Precision-machined industrial components and assemblies for automotive, aerospace, and heavy equipment markets.",
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
    role: "account_admin",
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
    role: "account_viewer",
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
  composite: 89,
  components: [
    { label: "Fulfillment Reliability", value: 92 },
    { label: "Response Time", value: 86 },
    { label: "Price Adherence", value: 97 },
    { label: "Agent Uptime", value: 91 },
    { label: "Exception Rate", value: 82 },
  ],
};

// ─── Mock Trading Partners ───────────────────────────────────

export const MOCK_PARTNERS: MockPartner[] = [
  {
    id: "p-bolt-001",
    company_name: "Bolt Industrial Supply",
    status: "trading_pair",
    manifest_progress: 100,
    established_at: "2025-11-15T00:00:00Z",
    location: "Chicago, IL",
    industry: "Industrial Distribution",
  },
  {
    id: "p-cascade-001",
    company_name: "Cascade Chemicals",
    status: "trading_pair",
    manifest_progress: 100,
    established_at: "2025-12-01T00:00:00Z",
    location: "Portland, OR",
    industry: "Chemical Manufacturing",
  },
  {
    id: "p-falcon-001",
    company_name: "Falcon Electronics",
    status: "approved",
    manifest_progress: 60,
    established_at: "2026-01-20T00:00:00Z",
    location: "Austin, TX",
    industry: "Electronics Manufacturing",
  },
  {
    id: "p-global-001",
    company_name: "Global Steel Corp",
    status: "approved",
    manifest_progress: 30,
    established_at: "2026-02-05T00:00:00Z",
    location: "Pittsburgh, PA",
    industry: "Steel Manufacturing",
  },
];

// ─── Mock Access Requests ────────────────────────────────────

export const MOCK_ACCESS_REQUESTS: MockAccessRequest[] = [
  {
    id: "req-001",
    company_name: "Harbor Logistics Inc",
    contact_name: "David Kim",
    message: "We handle freight forwarding for several industrial clients and would like to connect with Apex for logistics coordination.",
    requested_at: "2026-02-11T10:30:00Z",
    industry: "Logistics & Freight",
    location: "Long Beach, CA",
  },
  {
    id: "req-002",
    company_name: "IronBridge Fabrication",
    contact_name: "Lisa Thompson",
    message: "Interested in sourcing precision components for our fabrication projects.",
    requested_at: "2026-02-09T14:00:00Z",
    industry: "Metal Fabrication",
    location: "Cleveland, OH",
  },
  {
    id: "req-003",
    company_name: "NovaTech Systems",
    contact_name: "Ryan Mitchell",
    message: "We are expanding our supplier network for industrial automation components.",
    requested_at: "2026-02-08T08:45:00Z",
    industry: "Industrial Automation",
    location: "San Jose, CA",
  },
];

// ─── Mock Network Directory ──────────────────────────────────

export const MOCK_DIRECTORY: MockDirectoryCompany[] = [
  { id: "p-bolt-001", company_name: "Bolt Industrial Supply", location: "Chicago, IL", industry: "Industrial Distribution", description: "Full-line industrial MRO distributor serving the Midwest.", connection_status: "trading_pair" },
  { id: "p-cascade-001", company_name: "Cascade Chemicals", location: "Portland, OR", industry: "Chemical Manufacturing", description: "Specialty chemical formulations for industrial applications.", connection_status: "trading_pair" },
  { id: "p-delta-001", company_name: "Delta Packaging Solutions", location: "Atlanta, GA", industry: "Packaging", description: "Custom packaging and shipping solutions for manufacturers.", connection_status: "none" },
  { id: "p-evergreen-001", company_name: "Evergreen Building Materials", location: "Seattle, WA", industry: "Building Materials", description: "Sustainable building materials and construction supplies.", connection_status: "none" },
  { id: "p-falcon-001", company_name: "Falcon Electronics", location: "Austin, TX", industry: "Electronics Manufacturing", description: "PCB assemblies, connectors, and electronic control systems.", connection_status: "approved" },
  { id: "p-global-001", company_name: "Global Steel Corp", location: "Pittsburgh, PA", industry: "Steel Manufacturing", description: "Structural steel, sheet metal, and specialty alloys.", connection_status: "approved" },
  { id: "p-harbor-001", company_name: "Harbor Logistics Inc", location: "Long Beach, CA", industry: "Logistics & Freight", description: "Port-to-door freight forwarding and warehousing.", connection_status: "pending" },
  { id: "p-ironbridge-001", company_name: "IronBridge Fabrication", location: "Cleveland, OH", industry: "Metal Fabrication", description: "Custom metal fabrication and welding services.", connection_status: "pending" },
  { id: "p-novatech-001", company_name: "NovaTech Systems", location: "San Jose, CA", industry: "Industrial Automation", description: "Robotics integration and industrial control systems.", connection_status: "pending" },
  { id: "p-summit-001", company_name: "Summit Precision Tools", location: "Milwaukee, WI", industry: "Tooling & Fixtures", description: "CNC tooling, custom jigs, and precision fixtures.", connection_status: "none" },
  { id: "p-trident-001", company_name: "Trident Fluid Power", location: "Minneapolis, MN", industry: "Hydraulics & Pneumatics", description: "Hydraulic systems, pneumatic components, and fluid power solutions.", connection_status: "none" },
  { id: "p-vertex-001", company_name: "Vertex Coatings", location: "Houston, TX", industry: "Surface Treatment", description: "Industrial coating, plating, and surface finishing services.", connection_status: "none" },
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
  participants: { active: 9, pending_payment: 2, suspended: 1, total: 12 },
  trading_pairs: 14,
  outstanding_invoices: 3,
  outstanding_amount: 15400,
  agent_health: { active: 15, jailed: 2, probation: 3, offline: 4 },
};

export const MOCK_ADMIN_PARTICIPANTS: MockParticipant[] = [
  { id: "p-apex-001", company_name: "Apex Manufacturing", status: "active", location: "Detroit, MI", registered_at: "2025-10-01T00:00:00Z", agent_count: 2, trading_pairs: 4 },
  { id: "p-bolt-001", company_name: "Bolt Industrial Supply", status: "active", location: "Chicago, IL", registered_at: "2025-10-05T00:00:00Z", agent_count: 2, trading_pairs: 3 },
  { id: "p-cascade-001", company_name: "Cascade Chemicals", status: "active", location: "Portland, OR", registered_at: "2025-10-10T00:00:00Z", agent_count: 1, trading_pairs: 2 },
  { id: "p-delta-001", company_name: "Delta Packaging Solutions", status: "active", location: "Atlanta, GA", registered_at: "2025-10-15T00:00:00Z", agent_count: 1, trading_pairs: 1 },
  { id: "p-evergreen-001", company_name: "Evergreen Building Materials", status: "active", location: "Seattle, WA", registered_at: "2025-11-01T00:00:00Z", agent_count: 1, trading_pairs: 1 },
  { id: "p-falcon-001", company_name: "Falcon Electronics", status: "active", location: "Austin, TX", registered_at: "2025-11-10T00:00:00Z", agent_count: 2, trading_pairs: 2 },
  { id: "p-global-001", company_name: "Global Steel Corp", status: "active", location: "Pittsburgh, PA", registered_at: "2025-11-15T00:00:00Z", agent_count: 1, trading_pairs: 1 },
  { id: "p-harbor-001", company_name: "Harbor Logistics Inc", status: "active", location: "Long Beach, CA", registered_at: "2025-12-01T00:00:00Z", agent_count: 1, trading_pairs: 0 },
  { id: "p-ironbridge-001", company_name: "IronBridge Fabrication", status: "active", location: "Cleveland, OH", registered_at: "2025-12-10T00:00:00Z", agent_count: 1, trading_pairs: 0 },
  { id: "p-novatech-001", company_name: "NovaTech Systems", status: "pending_payment", location: "San Jose, CA", registered_at: "2026-01-20T00:00:00Z", agent_count: 0, trading_pairs: 0 },
  { id: "p-summit-001", company_name: "Summit Precision Tools", status: "pending_payment", location: "Milwaukee, WI", registered_at: "2026-02-01T00:00:00Z", agent_count: 0, trading_pairs: 0 },
  { id: "p-trident-001", company_name: "Trident Fluid Power", status: "suspended", location: "Minneapolis, MN", registered_at: "2025-10-20T00:00:00Z", agent_count: 1, trading_pairs: 0, suspension_reason: "Non-payment: invoice past due > 60 days" },
];
