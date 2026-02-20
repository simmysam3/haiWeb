# haiWeb Account Portal — Requirements Specification

**Version:** 1.0  
**Date:** February 13, 2026  
**Status:** Approved. All open questions resolved.  
**Companion Docs:** Doc 1 (Business Context), Doc 2 (Central Services), Doc 3 (Reference Agent), Doc 4 (Protocol Spec), Doc 5 (Test Environment)

---

## 1. Overview

The haiWeb Account Portal is the browser-based administration interface at `haiwave.com/account` where registered HAIWAVE participants manage their network presence. This includes company profile management, agent provisioning, manifest configuration, trading partner relationships, and billing.

The portal is distinct from the public-facing marketing site at haiwave.com. The `/account` path is accessible only to authenticated users.

### 1.1 Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js (App Router) | Server-side rendering, API routes, file-based routing |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | Custom theme per HAIWAVE brand standards |
| UI Components | Tailwind + custom components | HAIWAVE design system: Deep Navy #1A1F36, Orange #F58220, Teal #29B0C3 |
| Authentication | Keycloak (OIDC Authorization Code Flow) | Same Keycloak instance as agent auth. Custom login/registration forms backed by Keycloak Admin REST API |
| Database | PostgreSQL | Shared with HAIWAVE Central via API; portal does not directly access central DB |
| Billing | Stripe | Stripe Invoicing for platform fees; Stripe API for metered connection billing |
| Deployment | GCP Cloud Run | Containerized Next.js deployment |

### 1.2 Architectural Boundaries

The account portal is a **frontend application with a lightweight BFF (backend-for-frontend) layer** implemented via Next.js API routes. It does not replicate business logic from HAIWAVE Central. Instead, it calls the HAIWAVE Central API for all network operations (manifest exchange, Go Fish, behavioral scores, trading relationships).

The BFF layer handles:
- Keycloak Admin REST API calls (user creation, credential management, token exchange)
- Stripe API calls (subscription creation, invoice management, webhook processing)
- Session management (OIDC tokens, refresh flow)
- Aggregation of multiple Central API calls into single page loads

The BFF does NOT handle:
- Manifest orchestration logic
- Go Fish resolution
- Behavioral scoring
- Agent heartbeat processing
- Any agent-to-agent protocol operations

---

## 2. Authentication Model

### 2.1 Identity Architecture

Keycloak remains the single identity provider for the entire HAIWAVE ecosystem. The existing `haiwave-network` realm is extended with a new client type for web portal users, alongside the existing machine-to-machine clients used for agent authentication.

Two Keycloak client registrations in the `haiwave-network` realm:

| Client | Grant Type | Purpose |
|--------|-----------|---------|
| `haiwave-agent-{participant_id}` | Client Credentials | Machine-to-machine agent auth (existing) |
| `haiwave-portal` | Authorization Code + PKCE | Human user login to web portal |

### 2.2 Custom Login and Registration Forms

HAIWAVE renders its own login, registration, and password reset forms using the HAIWAVE brand design system. These forms submit to Next.js API routes that call the Keycloak Admin REST API. Keycloak's built-in login pages are not exposed to users.

The portal backend authenticates to Keycloak's Admin REST API using a dedicated service account (`haiwave-portal-admin`) with permissions to create users, manage credentials, and query user attributes within the `haiwave-network` realm.

### 2.3 User-to-Participant Mapping

Each human user in Keycloak carries a custom attribute `participant_id` that maps them to a Participant record in HAIWAVE Central. Multiple users can map to the same `participant_id` (multiple admins for one company).

User roles within a participant organization:

| Role | Permissions |
|------|------------|
| `account_owner` | Full access. Billing, manifests, agent provisioning, user management, trading partnerships. One per participant. |
| `account_admin` | Everything except billing and user management. Can manage manifests, agents, trading partnerships. |
| `account_viewer` | Read-only access to all account sections. Cannot modify configuration. |

Roles are stored as Keycloak realm roles scoped to the participant. The `account_owner` role is assigned during registration and cannot be reassigned through the portal UI (requires HAIWAVE support).

### 2.4 Session Management

- OIDC access tokens issued by Keycloak, stored in HTTP-only secure cookies
- Token refresh handled server-side via Next.js middleware
- Session timeout: 30 minutes of inactivity
- Concurrent sessions: allowed (user may be logged in from multiple devices)
- Logout: clears local session and calls Keycloak end-session endpoint

### 2.5 Password Policy

Enforced by Keycloak realm configuration:
- Minimum 12 characters
- At least one uppercase, one lowercase, one digit, one special character
- Password history: last 5 passwords rejected
- Account lockout after 5 failed attempts, 15-minute lockout duration

---

## 3. Registration Flow

Registration creates both a Keycloak user identity and a HAIWAVE Participant record. The process is self-service with no HAIWAVE administrative approval gate in Phase 1.

### 3.1 Registration Sequence

**Step 1: Create Account**
- Email address (becomes Keycloak username)
- Password (per password policy)
- Full name (first, last)
- Job title
- Phone number

On submit, the BFF calls Keycloak Admin REST API to create the user. An email verification link is sent. The user must verify email before proceeding.

**Step 2: Company Profile**
After email verification, the user completes the company profile form. This creates the Participant record in HAIWAVE Central.

Required fields:
- Legal company name
- Business type (Corporation, LLC, Partnership, Sole Proprietorship, Government, Nonprofit)
- Street address (line 1, line 2, city, state/province, postal code, country)
- Primary phone number
- Primary email (may differ from user's login email)

Optional fields (can be completed later):
- DBA name
- Tax ID / EIN
- DUNS number
- Website URL
- Company description (used in network directory)

**Step 3: Platform Fee Payment**
After company profile submission, the user is presented with the platform fee ($10,000/year). Payment is processed via Stripe Invoice.

Two payment paths:
- **Credit card / ACH auto-pay:** Stripe Checkout session, immediate activation upon successful payment
- **Invoice (net-30):** Stripe Invoice generated and emailed. Account is activated in a "pending payment" state that allows profile completion and manifest configuration but does not activate network participation (Go Fish, trading partnerships) until payment clears.

**Step 4: Account Active**
Upon payment confirmation (immediate or invoice settlement), the participant status transitions to `active` in HAIWAVE Central. The user can now:
- Configure manifests
- Provision agents
- Search the network directory
- Apply to connect with trading partners

### 3.2 Registration Constraints

- One participant record per company. If a user attempts to register a company that already exists (matched on Legal Name + EIN), the system prompts them to request access from the existing account owner rather than creating a duplicate.
- The registering user automatically receives the `account_owner` role.
- No HAIWAVE administrative approval is required for registration. Any company can register and pay. Network-level vetting by HAIWAVE is deferred to Phase 2.

---

## 4. Account Portal Sections

All sections are accessible from a persistent left-hand navigation at `/account`. The nav includes:
- Dashboard
- Company Profile
- Users
- Agents
- Manifests
- Trading Partners
- Behavioral Scores
- Billing

### 4.1 Dashboard (`/account`)

Summary view showing:
- Account status (active, pending payment, suspended)
- Active trading pair count and tier summary
- Agent status overview (count by status: active, jailed, probation, offline)
- Pending partnership requests (inbound and outbound)
- Most recent behavioral score snapshot
- Next invoice date and amount

No configuration actions on this page. All items link to their respective detail sections.

### 4.2 Company Profile (`/account/profile`)

Edit form for all Participant fields defined in Section 3.1 Step 2. The `account_owner` and `account_admin` roles can edit. `account_viewer` sees read-only.

Additional profile fields available after registration:
- Company logo upload (used in network directory)
- Industry vertical tags (multiselect from taxonomy-derived list)
- Preferred communication contacts (separate from login users; these are the business contacts that receive operational notifications)

Changes to Legal Name or EIN require confirmation dialog explaining that these fields affect network identity and billing records.

### 4.3 Users (`/account/users`)

**Accessible to: `account_owner` only.**

- List of all Keycloak users mapped to this `participant_id`
- Invite new user (sends email invitation with registration link pre-bound to this participant)
- Assign/change role (`account_admin`, `account_viewer`)
- Deactivate user (disables Keycloak account, does not delete)
- View last login timestamp per user

The `account_owner` role cannot be reassigned through the UI.

### 4.4 Agents (`/account/agents`)

This section manages the agent deployments that connect to the HAIWAVE network on behalf of this participant.

#### 4.4.1 Agent Type Registry

HAIWAVE defines a fixed set of agent types. Each agent type represents a functional role:

| Agent Type | Key | Purpose |
|-----------|-----|---------|
| Customer Service | `cs_agent_key` | Handles inbound customer inquiries, order status, exceptions |
| Inside Sales | `sales_agent_key` | Responds to Go Fish queries, manages inbound RFQs, quoting |
| Procurement | `procurement_agent_key` | Initiates Go Fish queries, manages outbound orders, vendor evaluation |

These three types are hardcoded for Phase 1. Adding a new agent type constitutes a major version release of the agent implementation. The type registry is maintained by HAIWAVE and is not configurable by participants.

#### 4.4.2 Agent Provisioning

From the Agents page, the participant can:

1. **Generate Agent Instance ID:** Click "Register New Agent" to generate a new UUID. This becomes the `agent_id` for the deployment. The system registers this ID with Keycloak (creates a client credentials client) and HAIWAVE Central (creates an Agent record linked to the participant).

2. **Generate Agent Type Keys:** For each agent type the participant wants to activate, they generate a type-specific API key. These keys are generated via the portal and displayed once (copy-to-clipboard pattern; keys are not retrievable after initial display).

3. **Download Configuration:** After generating the instance ID and type keys, the portal offers a downloadable configuration snippet (JSON or env format) containing:
   ```
   HAIWAVE_AGENT_ID=<generated-uuid>
   HAIWAVE_PARTICIPANT_ID=<participant-uuid>
   HAIWAVE_AUTH_URL=https://auth.haiwave.io/realms/haiwave-network
   HAIWAVE_CLIENT_ID=<keycloak-client-id>
   HAIWAVE_CLIENT_SECRET=<keycloak-client-secret>
   HAIWAVE_API_URL=https://api.haiwave.io
   HAIWAVE_CS_AGENT_KEY=<key-if-generated>
   HAIWAVE_SALES_AGENT_KEY=<key-if-generated>
   HAIWAVE_PROCUREMENT_AGENT_KEY=<key-if-generated>
   ```

4. **Regenerate Keys:** Type keys and client secrets can be regenerated (invalidating the previous key). Requires confirmation dialog.

#### 4.4.3 Agent Status View

For each registered agent, the portal displays:
- Agent ID
- Status: Active, Jailed, Probation, Offline (never connected)
- Activated agent types (which type keys have been generated)
- Key age per type key with visual indicator (green: under 6 months, yellow: 6-12 months, red: over 12 months)
- Last heartbeat timestamp
- Consecutive heartbeat failures
- Jail/probation history

Status data is read from HAIWAVE Central's Health service. The portal does not manage heartbeats; it only displays the state.

#### 4.4.4 Agent Decommission

An agent can be decommissioned (deactivated) from the portal. This revokes the Keycloak client credentials and marks the agent as `decommissioned` in Central. Decommissioned agents cannot reconnect. This is a destructive action with confirmation dialog and a 24-hour grace period before the Keycloak credentials are actually revoked (allowing the participant to cancel).

#### 4.4.5 Front-End Chat Interface Deployment

HAIWAVE provides a reference frontend chat implementation as a public Git repository. Participants clone the repo, configure it with their agent keys, and deploy it themselves (on their own infrastructure, embedded in their website, or as a standalone internal tool).

The chat frontend is configured via a local configuration file in the cloned repo:

```
# .env.local or config.json in the cloned chat frontend repo
HAIWAVE_AGENT_ID=<agent-instance-uuid>
HAIWAVE_PARTICIPANT_ID=<participant-uuid>
HAIWAVE_API_URL=https://api.haiwave.io
HAIWAVE_CS_AGENT_KEY=<key-if-applicable>
HAIWAVE_SALES_AGENT_KEY=<key-if-applicable>
HAIWAVE_PROCUREMENT_AGENT_KEY=<key-if-applicable>
```

The frontend routes user interactions to the appropriate agent type based on the keys present in its configuration. If only the CS agent key is configured, the frontend operates as a customer service interface. If multiple keys are present, the frontend provides routing logic to direct queries to the appropriate agent type.

HAIWAVE does not host or manage the chat frontend deployment. The portal's role is limited to provisioning the agent keys that the frontend consumes. The public Git repo includes deployment documentation and example configurations.

### 4.5 Manifests (`/account/manifests`)

Phase 1 manifest configuration covers two areas: counterparty requirements and baseline pricing defaults. The full pricing manifest inheritance model (product line, SKU, customer-specific overrides) is deferred to Phase 2, where it will be populated through ERP integration rather than manual UI entry.

#### 4.5.1 Counterparty Manifest Configuration

The counterparty manifest defines what this participant requires from trading partners before establishing a relationship, and what posture they take when counterparties make requirements of them.

**Inbound Requirements (what we require from counterparties):**

A configurable list of document/data requirements. For each requirement:

| Field | Type | Description |
|-------|------|-------------|
| `field_name` | string | Identifier (e.g., `w9_form`, `certificate_of_insurance`, `resale_certificate`) |
| `display_name` | string | Human-readable label |
| `required` | boolean | Whether this is mandatory or optional for the counterparty |
| `description` | string | Explanation text shown to the counterparty during manifest exchange |

The portal provides a starter template of common requirements (W9, COI, Resale Certificate, Business License, Credit References, Financial Statements) that the participant can enable/disable and supplement with custom fields.

**Outbound Postures (how we respond to counterparty requirements):**

For each document type that counterparties may request, the participant configures one of three postures:

| Posture | Behavior |
|---------|----------|
| `support` | Agent auto-provides the document during manifest exchange. Participant uploads the document to the portal. |
| `not_supported` | Agent declines this requirement. If the counterparty marks it as mandatory, the relationship cannot be established. |
| `exception` | Agent queues the request for human review. Notification sent to configured contacts. |

For `support` posture, the portal provides a document upload area. Uploaded documents are stored in a single GCS bucket with participant-scoped prefixes (`gs://haiwave-documents/{participant_id}/`), encrypted at rest. Maximum file size: 10MB. Accepted formats: PDF, PNG, JPG. The participant can replace documents (e.g., upload updated COI annually).

For `exception` posture, the participant configures notification contacts (email addresses that receive the exception alert).

**Conditional Auto-Approval:**

For `support` posture items, the participant can optionally set a behavioral score threshold. Counterparties with a behavioral score above the threshold receive auto-approval. Counterparties below the threshold are routed to `exception` handling despite the `support` posture.

#### 4.5.2 Baseline Pricing Defaults

The Phase 1 UI exposes only company-wide default pricing parameters. These serve as the fallback when no product-specific or customer-specific overrides exist (overrides are configured through ERP integration in Phase 2).

Configurable baseline defaults:

| Parameter | Type | Description |
|-----------|------|-------------|
| `default_currency` | string | ISO 4217 currency code (e.g., USD) |
| `default_payment_terms` | string | e.g., Net 30, Net 60, COD |
| `default_freight_terms` | string | e.g., FOB Origin, FOB Destination, Prepaid |
| `minimum_order_value` | decimal | Minimum order amount below which the agent declines |
| `quote_validity_days` | integer | How many days a quote remains valid |
| `volume_discount_tiers` | array | Optional quantity-based discount brackets |
| `aged_inventory_discount_enabled` | boolean | Whether shelf-age discounts apply |
| `aged_inventory_threshold_days` | integer | Days before aged discount activates |
| `aged_inventory_discount_pct` | decimal | Percentage discount for aged inventory |

These defaults populate the company-level pricing manifest that the agent reads at runtime.

### 4.6 Trading Partners (`/account/partners`)

Trading partnerships exist at three levels:

| Level | Description | Network Capabilities |
|-------|-------------|---------------------|
| **No Connection** | Default state. No relationship between participants. | Can view each other in network directory. Can send connection requests. |
| **Approved** | One party has requested and the other has accepted a connection. Manifest exchange has not occurred or is incomplete. | Can initiate manifest exchange. Can view each other's public profile. Cannot transact. |
| **Trading Pair** | Manifest exchange is complete. Both parties have resolved requirements. Connection fee billing begins. | Full transactional capability: Go Fish responses between pair, order initiation, quoting. |

#### 4.6.1 Network Directory Search

A searchable directory of all registered HAIWAVE participants. Search by:
- Company name
- Industry vertical
- Product class (taxonomy-based)
- Location (state/region/country)

Results show: company name, location, industry tags, and a "Request Connection" action button. Companies already connected show their current partnership level instead.

#### 4.6.2 Connection Requests

**Outbound (requesting):** From the directory or a company profile page, the participant clicks "Request Connection." An optional message field allows context (e.g., "We are interested in sourcing industrial fasteners from your catalog"). The request is delivered to the target company's approval queue.

**Inbound (receiving):** The Trading Partners section includes an "Approval Queue" tab showing all pending inbound connection requests. Each request shows: requesting company name, profile summary, message, and request date. The participant can:
- **Approve:** Moves the relationship to `Approved` status. Triggers manifest exchange initiation.
- **Decline:** Rejects the request. The requesting party is notified. They may request again after 90 days.
- **Ignore:** Request remains in queue. Auto-expires after 30 days.

**Rate Limiting:** Each participant is limited to 100 outbound connection requests per week. The system tracks running weekly totals per participant. When the limit is reached, the "Request Connection" button is disabled with an explanatory message. Weekly totals, request counts, approval rates, and decline rates are logged per participant from Phase 1 for Phase 2 reporting and abuse detection.

#### 4.6.3 Active Partnerships View

A table of all relationships at `Approved` or `Trading Pair` status. Columns:
- Company name
- Status (Approved / Trading Pair)
- Manifest exchange completion percentage (if in progress)
- Date established
- Actions: View details, Remove

#### 4.6.4 Removing Partnerships

Either party can remove a partnership at any time.

- Removing a `Trading Pair` terminates the connection. Both agents are notified. Active orders in flight are not cancelled but no new orders can be initiated. Connection fee billing for this pair stops at end of current billing period.
- Removing an `Approved` connection cancels any in-progress manifest exchange and returns both parties to `No Connection`.

Removal is immediate but includes a confirmation dialog that explains consequences. After removal, either party may immediately send a new connection request to re-establish the relationship.

#### 4.6.5 Banning a Trading Partner

Either party can ban the other. A ban permanently prevents the banned party from sending connection requests to the banning party. The banned party sees no "Request Connection" button for the banning company in the directory.

Bans are:
- Unilateral (either side can initiate)
- Permanent (no expiration; can only be lifted by the party that imposed it)
- Logged with timestamp and banning participant ID for Phase 2 reporting

Ban activity is a spam/abuse signal. The system tracks total bans issued and received per participant. Phase 2 reporting will surface participants with abnormally high ban-received counts as potential bad actors. Phase 2 will also surface participants with abnormally high ban-issued counts as potential abuse of the feature.

#### 4.6.6 Phase 2 Deferral

Network-level approval by HAIWAVE (vetting companies before they can appear in the directory) is deferred to Phase 2. In Phase 1, any registered and paying participant appears in the directory.

### 4.7 Behavioral Scores (`/account/scores`)

Read-only view of this participant's behavioral scores as calculated by the Behavioral Registry.

Displays:
- Overall composite score
- Component scores: fulfillment reliability, response time, price adherence, agent uptime, exception rate
- Score trend over time (last 30/60/90 days)
- Separate vendor-side and buyer-side scores (if participant operates on both sides)

No configuration on this page. Scores are computed by Central and consumed as-is.

### 4.8 Billing (`/account/billing`)

**Accessible to: `account_owner` only.**

#### 4.8.1 Subscription Overview

- Current plan: HAIWAVE Platform ($10,000/year)
- Billing cycle: annual, with specific renewal date
- Payment status: current, past due, suspended
- Current connection fee tier summary: X pairs at $100, Y pairs at $80, Z pairs at $50
- Estimated next month's connection fee total

#### 4.8.2 Payment Method

Managed via Stripe Customer Portal (embedded or redirect). Supports:
- Credit card
- ACH bank transfer
- Wire transfer (for invoiced customers)

#### 4.8.3 Invoice History

List of all invoices, pulled from Stripe. Each shows: date, description, amount, status (paid, open, past due, void). Download PDF for each.

#### 4.8.4 Connection Fee Detail

Monthly breakdown showing each active trading pair, the per-pair rate (based on volume tier), and the monthly total. Each party in a trading pair pays their own connection fee independently. Both sides pay the same tiered rate: $100/month per pair for the first 20, $80 for pairs 21-100, $50 for pairs above 100. Tier thresholds are based on each participant's own total active pair count, not the pair's combined count.

This data feeds from Central's trading relationship records.

---

## 5. Stripe Integration

### 5.1 Stripe Objects

| HAIWAVE Concept | Stripe Object | Notes |
|----------------|---------------|-------|
| Participant | Customer | Created during registration. `participant_id` stored in Stripe metadata. |
| Platform fee | Subscription (annual) | Single price: $10,000/year. |
| Connection fees | Subscription (monthly, metered) | Usage-based. Portal reports active pair count monthly to Stripe via Usage Records. Tiered pricing per side: 0-20 pairs at $100/mo, 21-100 at $80/mo, 101+ at $50/mo. Each party in a pair pays independently. |
| Implementation fee | Not in Stripe | Handled via out-of-band services contract. |

### 5.2 Billing Lifecycle

1. **Registration:** Stripe Customer created. Platform fee Subscription created (annual, with invoice or auto-charge depending on payment path).
2. **First trading pair activated:** Metered connection fee Subscription created. No charge until first usage report.
3. **Monthly (automated):** BFF cron job queries Central for active trading pair count per participant. Reports usage to Stripe. Stripe generates invoice based on tiered pricing.
4. **Annual renewal:** Stripe auto-renews platform subscription. Invoice sent 30 days before renewal.
5. **Payment failure:** Stripe retries per configured retry schedule. After final retry failure, webhook triggers account suspension flow in Central.

### 5.3 Webhook Events

The BFF exposes a `/api/webhooks/stripe` endpoint to receive Stripe events:

| Event | Action |
|-------|--------|
| `invoice.paid` | If platform fee: activate or maintain account. If connection fee: no action needed (billing confirmation). |
| `invoice.payment_failed` | Log event. After retry exhaustion, escalate. |
| `customer.subscription.deleted` | Trigger account suspension review. |
| `invoice.finalized` | Send notification email to account owner with invoice link. |

### 5.4 Invoiced Customers (Net-30/Net-60)

Some enterprise customers will require invoiced billing. Stripe supports this via:
- Subscription with `collection_method: send_invoice`
- Configurable `days_until_due` (30 or 60)
- Stripe sends the invoice email with a payment link
- Customer pays via link (credit card, ACH, or wire)

The portal must support toggling a participant between auto-charge and invoiced billing. This is an `account_owner` action with HAIWAVE admin approval (prevents participants from switching to delay payment).

---

## 6. HAIWAVE Administrative Controls

Separate from participant-facing portal features, HAIWAVE operators need administrative capabilities. These are implemented as a protected admin section (`/admin`) or as a separate internal tool, accessible only to users with the `admin:manage` Keycloak scope.

### 6.1 Account Suspension

HAIWAVE can suspend a participant account for:
- Non-payment (triggered automatically via Stripe webhook after retry exhaustion)
- Breach of terms (manual action by HAIWAVE operator)

Suspension effects:
- Participant's agents are immediately jailed
- Go Fish queries from this participant return errors
- Go Fish queries TO this participant are excluded from results
- Trading partners are notified that this participant is temporarily unavailable
- Portal access remains active (read-only) so the participant can resolve the issue
- Billing continues to accrue for any unpaid invoices

### 6.2 Account Reactivation

Reactivation requires:
- For non-payment: payment of all outstanding invoices (verified via Stripe)
- For breach of terms: manual approval by HAIWAVE operator

Upon reactivation:
- Agents transition from Jailed to Probation per standard heartbeat state machine
- Go Fish inclusion resumes
- Trading partners are notified

### 6.3 Admin Dashboard Requirements (Phase 1 Minimal)

HAIWAVE operators need basic visibility in Phase 1. A full admin/reporting console is deferred to Phase 2, but the data collection and logging infrastructure must be in place from Phase 1 to feed it.

Phase 1 admin interface provides:
- Total registered participants (by status: active, pending payment, suspended)
- Total active trading pairs (current billing base)
- Participants with outstanding invoices
- Recently registered participants (review queue even if no approval gate)
- Suspended accounts and reason
- Network health: percentage of agents in Active vs. Jailed vs. Probation
- Manual account suspension/reactivation actions

Phase 1 logging (captured but not surfaced in UI until Phase 2):
- Connection request totals per participant (weekly rolling counts)
- Approval, decline, and ignore rates per participant
- Ban events (who banned whom, timestamps)
- Partner removal events
- Agent key generation, rotation, and age tracking events

This admin interface can be minimal (data tables, filters, action buttons). Polish is not required. The Phase 2 admin/reporting console will replace it with dashboards, trend analysis, and abuse detection.

---

## 7. Non-Functional Requirements

### 7.1 Performance

- Page load time: under 2 seconds for dashboard and list views
- Search (directory): under 3 seconds for results
- Form submission: under 1 second acknowledgment (async processing acceptable for operations like manifest exchange initiation)

### 7.2 Security

- All traffic over HTTPS
- CSRF protection on all state-changing operations
- Input validation and sanitization on all form fields
- Uploaded documents scanned for malware before storage
- Agent keys and client secrets hashed in storage (displayed only at generation time)
- Rate limiting on registration and login endpoints (prevent abuse)
- Audit log for all administrative actions (account suspension/reactivation, user role changes, agent provisioning/decommission)
- Audit log retention: rolling 2-year window for operational logs
- Financial record retention: 5 years (Stripe invoices, payment history, connection fee records)

### 7.3 Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigable
- Screen reader compatible
- Sufficient color contrast per HAIWAVE brand standards (verified against WCAG ratios)

### 7.4 Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- Mobile Safari and Chrome on iOS/Android (responsive layout)

### 7.5 Brand Compliance

All UI elements follow HAIWAVE brand standards:
- Primary palette: Deep Navy #1A1F36, Orange #F58220, Teal #29B0C3
- Typography: Helvetica Now Display (headlines), Helvetica Now Text (body), or system sans-serif fallback
- Spacing: 4px baseline grid, 20px within components, 40px between sections
- Design principles: light and airy, high contrast, generous white space

---

## 8. Phase 1 vs. Phase 2 Boundary

### Phase 1 (This Specification)

- Self-service registration with Stripe payment
- Company profile management
- User management within participant organization
- Agent provisioning with per-type keys
- Counterparty manifest configuration (requirements and postures)
- Baseline pricing defaults (company-wide only)
- Trading partner directory, connection requests, and approval queue
- Three-tier partnership model (No Connection, Approved, Trading Pair)
- Behavioral score viewing
- Stripe billing for platform fees and connection fees
- HAIWAVE admin: account suspension/reactivation

### Phase 2 (Deferred)

- HAIWAVE admin/reporting console (connection request analytics, ban monitoring, abuse detection, network health dashboards)
- Pricing manifest inheritance UI (line, product, SKU, customer-specific)
- HAIWAVE network-level vetting of new registrations
- ERP integration configuration from portal
- Advanced analytics and reporting
- Bulk partner import/export
- Partner grouping and tagging
- API key usage analytics
- SSO/SAML integration for enterprise customers
- Multi-language support
- Notification preferences and digest configuration

---

## 9. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Document storage | GCS bucket, scoped per participant. Encrypted at rest. |
| 2 | Connection request rate limiting | 100 outbound requests per week per participant. Log and track totals from Phase 1 for Phase 2 reporting. |
| 3 | Chat endpoint / SDK | No SDK. Public Git repo with local config file. Portal provisions keys only. |
| 4 | Connection fee billing model | Per pair, per month, per side. Each party pays independently. Tier thresholds based on each participant's own active pair count. |
| 5 | Partner removal and re-connection | Immediate re-request allowed. Ban feature available to permanently block a counterparty. Bans tracked for Phase 2 abuse reporting. |
| 6 | Agent type extensibility | Hardcoded at three types (CS, Inside Sales, Procurement). Adding a type is a major version release of the agent implementation. |
| 7 | Audit log retention | Rolling 2-year window for operational audit logs. 5-year retention for financial records (Stripe invoices, payment history). |

---

## 10. Resolved Decisions (Continued)

| # | Question | Decision |
|---|----------|----------|
| 8 | GCS bucket structure | Single bucket with participant-scoped prefixes (`gs://haiwave-documents/{participant_id}/`). |
| 9 | Email service | GCP-native (Pub/Sub + Cloud Functions). |
| 10 | Manifest document limits | 10MB per file. Accepted formats: PDF, PNG, JPG. |
| 11 | Agent key rotation | No mandatory rotation in Phase 1. Rotation available on demand via portal. Key age displayed in agent status view (green < 6 months, yellow 6-12 months, red > 12 months). Key age logged for Phase 2 reporting. Revisit mandatory rotation policy in Phase 2 if network exceeds 100 participants. |
