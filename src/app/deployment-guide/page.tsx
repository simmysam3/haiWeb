import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

const sidebarLinks = [
  { id: "licensing", label: "Licensing" },
  { id: "package", label: "What Ships" },
  { id: "integration", label: "Integration Architecture" },
  { id: "service-accounts", label: "Service Accounts" },
  { id: "docker", label: "Docker Deployment" },
  { id: "auth", label: "Auth & Registration" },
  { id: "manifests", label: "Manifest Configuration" },
  { id: "roles", label: "Agent Roles" },
  { id: "prompts", label: "Custom Prompts" },
  { id: "updates", label: "Updates vs. Forking" },
  { id: "security", label: "Security Model" },
  { id: "partners", label: "Implementation Partners" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const envVarRows = [
  { category: "Identity", description: "Your participant ID and agent ID, assigned when you register with the HAIWAVE network." },
  { category: "Authentication", description: "OAuth client credentials (client_id and client_secret) for authenticating with the HAIWAVE network via Keycloak." },
  { category: "Database", description: "Connection strings for your Classification SA and Transaction SA, plus the database type (Snowflake for production, DuckDB for local development)." },
  { category: "AI Model", description: "Your own Anthropic Claude API key. The agent uses Claude for reasoning across all operations." },
  { category: "Behavior", description: "Scan intervals, confidence thresholds, response timeouts. Sensible defaults provided. Adjust as you learn." },
];

const postureRows = [
  { posture: "Support", color: "text-success", description: "Agent auto-provides the document or credential from your local repository. COI, W-9, business license. Handled without human involvement." },
  { posture: "Not Supported", color: "text-light-slate", description: "Agent skips that counterparty entirely. If a buyer requires something your company does not provide, the agent moves on." },
  { posture: "Exception", color: "text-orange", description: "Agent routes the decision to a human on your team. The relationship pauses until someone makes the call." },
];

const troubleshootingRows = [
  { symptom: "401 errors on network calls", cause: "Expired or misconfigured OAuth credentials" },
  { symptom: "Classification returns no results", cause: "Database views do not expose expected column names" },
  { symptom: "Agent fails to start", cause: "Manifest JSON files with syntax errors" },
  { symptom: "Heartbeat failures", cause: "Network connectivity between container and HAIWAVE central endpoints" },
];

function SectionDivider() {
  return <div className="mb-16" />;
}

export default function DeploymentGuidePage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />

      {/* Header */}
      <section className="pt-[120px] pb-8 px-6">
        <div className="max-w-[1140px] mx-auto">
          <p className="text-sm text-light-slate mb-2">
            <Link href="/how-it-works" className="text-teal hover:text-teal-dark transition-colors">How It Works</Link>
            {" "}&#8250; Deployment Guide
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold text-navy mb-4">
            Deployment Guide
          </h1>
          <p className="text-lg font-light text-slate max-w-[680px]">
            Everything your technical team needs to download, configure, deploy, and maintain Free Agent SCM in your environment.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="px-6 pb-20">
        <div className="max-w-[1140px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-12 items-start">
            {/* Sidebar */}
            <ul className="sticky top-[104px] hidden md:block border-l-2 border-slate/15 pl-5 space-y-3">
              {sidebarLinks.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    className="text-[13px] font-medium text-light-slate hover:text-charcoal transition-colors leading-snug block"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Content */}
            <div>
              {/* Licensing */}
              <div id="licensing" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Your Code. Your Deployment.
                </h2>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Free Agent SCM is released under the Business Source License (BSL) 1.1. If your team has worked with open source before, the model will feel familiar. Here is what it means in practice.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  You can download the full source code, modify it, and deploy it for commercial use within your own organization. There is no time limit on this right. No trial expiration. No seat-based licensing. You can run as many instances as you need, across as many environments as you need, for as long as you need.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  The one restriction: you cannot take the source code and release a competing network platform. You are free to build on top of it, extend it, integrate it, and customize it. You are not free to redistribute it as the foundation of a rival product.
                </p>
                <p className="text-base text-slate leading-relaxed mb-6">
                  This is the same licensing model used by MariaDB, CockroachDB, and other infrastructure projects that balance open access with sustainable development. It protects HAIWAVE&apos;s ability to keep investing in the platform while giving your team full operational freedom.
                </p>
                <div className="p-6 rounded-[10px] border border-slate/15 bg-light-gray">
                  <ul className="space-y-1.5">
                    {[
                      "Use it commercially: Yes",
                      "Modify the source code: Yes",
                      "Deploy unlimited instances: Yes",
                      "No trial period or expiration: Yes",
                      "Redistribute as a competing platform: No",
                    ].map((item) => (
                      <li key={item} className="text-sm text-charcoal flex items-center gap-2.5">
                        <span className="text-success font-bold">&#10003;</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <SectionDivider />

              {/* What Ships */}
              <div id="package" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  What Ships in the Package
                </h2>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Free Agent SCM ships as a Docker container image with the full source code available in the accompanying repository. The package includes:
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  The agent application itself, built on .NET 8 with ASP.NET Core. It runs as a single container that serves two roles simultaneously: an MCP server that HAIWAVE central services call into, and an active network participant that initiates outbound operations like catalog discovery and order placement.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Configuration templates for pricing manifests, counterparty posture settings, and environment-specific parameters. These are starting points. Your team will customize them to match your business rules.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  A local development environment using Docker Compose and DuckDB, so your team can run and test the agent without connecting to production systems or the live network.
                </p>
                <p className="text-base text-slate leading-relaxed">
                  Documentation covering configuration, customization, and the published protocol interfaces your agent implements.
                </p>
              </div>

              <SectionDivider />

              {/* Integration Architecture */}
              <div id="integration" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Stubbed for Your Systems
                </h2>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Free Agent SCM is designed to connect to your systems, not replace them. The agent reads from your existing databases through a well-defined integration layer that your team controls entirely.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  The integration is built around the stub pattern. The agent delivers structured requests to defined endpoints, but the actual business logic lives in your systems. HAIWAVE does not try to replicate your ERP, your pricing engine, or your inventory management. The agent asks your systems questions through interfaces your team configures.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Out of the box, the agent supports direct database connections through Snowflake and DuckDB. For other systems (Oracle, SAP, Epicor, NetSuite), the integration points are stubbed with clear interface contracts. Your team or an implementation partner builds the adapter that connects the stub to your specific system. The interface contract does not change regardless of what sits behind it.
                </p>
                <p className="text-base text-slate leading-relaxed">
                  This is intentional. Your ERP has years of business logic encoded in it. The agent should leverage that logic, not attempt to replicate it.
                </p>
              </div>

              <SectionDivider />

              {/* Service Accounts */}
              <div id="service-accounts" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Data Access On Your Terms
                </h2>
                <p className="text-base text-slate leading-relaxed mb-6">
                  The agent accesses your data through two scoped service accounts that your DBA creates and controls. This is not HAIWAVE accessing your database. This is your agent, running in your environment, reading from views your team defines.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="p-6 rounded-[10px] border border-slate/15 bg-light-gray">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-charcoal mb-3">Classification Service Account</h3>
                    <p className="text-sm text-slate leading-relaxed mb-3">
                      Read-only access to public-equivalent product fields. The kind of information that would appear on a cut sheet, spec sheet, or safety data sheet: product name, product line, descriptive attributes, material, dimensions, certifications.
                    </p>
                    <p className="text-sm text-problem font-medium">
                      Cannot see: pricing, inventory levels, customer lists, or financial data.
                    </p>
                  </div>
                  <div className="p-6 rounded-[10px] border border-slate/15 bg-light-gray">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-charcoal mb-3">Transaction Service Account</h3>
                    <p className="text-sm text-slate leading-relaxed mb-3">
                      Broader read access covering pricing, inventory positions, lead times, and availability. This data powers the agent&apos;s ability to respond to quote requests, check availability, and support order workflows.
                    </p>
                    <p className="text-sm text-charcoal font-medium">
                      Transaction data only flows through agent-to-agent interactions. It never reaches the HAIWAVE classifier.
                    </p>
                  </div>
                </div>
                <div className="p-6 rounded-[10px] border-l-4 border-teal bg-soft-gray">
                  <p className="text-[15px] text-charcoal leading-relaxed">
                    Your DBA creates database views that expose exactly the fields each service account can see. Nothing more. The agent cannot access tables or columns that are not explicitly surfaced through these views.
                  </p>
                </div>
              </div>

              <SectionDivider />

              {/* Docker Deployment */}
              <div id="docker" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Pull, Configure, Run
                </h2>
                <p className="text-base text-slate leading-relaxed mb-6">
                  The agent ships as a Docker image. Deployment follows the standard container workflow your team already knows. Pull the image from the HAIWAVE container registry. Configure environment variables. Mount your configuration directory as a volume. Start the container.
                </p>
                <p className="text-base text-charcoal font-semibold mb-4">Key environment variables your team will set:</p>
                <div className="border border-slate/15 rounded-[10px] overflow-hidden mb-5">
                  <div className="grid grid-cols-[140px_1fr] border-b border-slate/15">
                    <div className="p-3 px-4 bg-light-gray text-[13px] font-semibold text-charcoal">Category</div>
                    <div className="p-3 px-4 bg-light-gray text-[13px] font-semibold text-charcoal">Description</div>
                  </div>
                  {envVarRows.map((row, i) => (
                    <div key={row.category} className={`grid grid-cols-[140px_1fr] ${i < envVarRows.length - 1 ? "border-b border-slate/15" : ""}`}>
                      <div className="p-3 px-4 text-sm font-medium text-navy">{row.category}</div>
                      <div className="p-3 px-4 text-sm text-slate">{row.description}</div>
                    </div>
                  ))}
                </div>
                <p className="text-base text-slate leading-relaxed">
                  For local development and testing, the included Docker Compose configuration stands up the agent with a DuckDB database so your team can validate configuration and behavior before connecting to production systems or the live network.
                </p>
              </div>

              <SectionDivider />

              {/* Auth */}
              <div id="auth" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Joining the Network
                </h2>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Before your agent can participate in the HAIWAVE network, your organization registers as a network participant. HAIWAVE provisions your identity credentials: a participant ID that represents your company on the network, an agent ID for each agent instance you deploy, and OAuth client credentials that your agent uses to authenticate every network interaction through Keycloak.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Your agent requests a short-lived JWT token using these credentials before making any API call. Tokens expire quickly and are refreshed automatically. Every request your agent sends to the network is authenticated. Every request it receives from the network is verified.
                </p>
                <p className="text-base text-slate leading-relaxed mb-6">
                  This is standard OAuth 2.0 client credentials flow. If your team has integrated with any modern API that uses bearer tokens, the pattern is identical.
                </p>
                <div className="p-6 rounded-[10px] border-l-4 border-teal bg-soft-gray">
                  <p className="text-[15px] text-charcoal leading-relaxed">
                    Every agent interaction on the network is authenticated in both directions.
                  </p>
                </div>
              </div>

              <SectionDivider />

              {/* Manifests */}
              <div id="manifests" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Define Your Business Rules Once
                </h2>
                <p className="text-base text-slate leading-relaxed mb-8">
                  Manifests are where your business logic meets the network. You configure them once, and your agent enforces them consistently across every transaction and every trading partner.
                </p>

                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-charcoal mb-3">Pricing Manifests</h3>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Pricing follows an inheritance model. You set a company-wide default, then override at the business line level, the product level, or down to individual SKUs. The most specific rule wins. You can also define customer-specific overrides at any level, so your strategic accounts automatically receive their negotiated terms.
                </p>
                <p className="text-base text-slate leading-relaxed mb-8">
                  Volume tiers, aged inventory discounts, minimum order values, payment terms, and shipping preferences all live in manifest configuration files. Your team edits JSON files in the config directory. The agent picks up changes on restart or, in development, on file watch.
                </p>

                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-charcoal mb-3">Counterparty Posture</h3>
                <p className="text-base text-slate leading-relaxed mb-4">
                  When another company wants to establish a trading relationship with you, the network compares what they require against what you are willing to provide. Your posture configuration defines how the agent responds to each type of requirement:
                </p>
                <div className="border border-slate/15 rounded-[10px] overflow-hidden mb-4">
                  <div className="grid grid-cols-[140px_1fr] border-b border-slate/15">
                    <div className="p-3 px-4 bg-light-gray text-[13px] font-semibold text-charcoal">Posture</div>
                    <div className="p-3 px-4 bg-light-gray text-[13px] font-semibold text-charcoal">Behavior</div>
                  </div>
                  {postureRows.map((row, i) => (
                    <div key={row.posture} className={`grid grid-cols-[140px_1fr] ${i < postureRows.length - 1 ? "border-b border-slate/15" : ""}`}>
                      <div className={`p-3 px-4 text-sm font-medium ${row.color}`}>{row.posture}</div>
                      <div className="p-3 px-4 text-sm text-slate">{row.description}</div>
                    </div>
                  ))}
                </div>
                <p className="text-base text-slate leading-relaxed">
                  You can also set reputation thresholds that automate approvals for counterparties above a certain behavioral score, keeping human review for unfamiliar or lower-scoring trading partners.
                </p>
              </div>

              <SectionDivider />

              {/* Roles */}
              <div id="roles" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Deploy the Way That Fits Your Operation
                </h2>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Free Agent SCM supports three deployment positions out of the box: Customer Service, Inside Sales, and Procurement. Your team decides which to activate and how to configure each one.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  A single instance can serve all three positions. Larger organizations may choose to run separate instances per position, each with tailored configuration: a customer-facing instance with stricter response rules, an internal instance with broader data access for sales support, and a procurement instance connected to a different set of network services.
                </p>
                <p className="text-base text-slate leading-relaxed">
                  The agent architecture does not prescribe a topology. Run one instance or several. Run them behind a load balancer or as standalone services. Point them at the same database or different views. These are your infrastructure decisions.
                </p>
              </div>

              <SectionDivider />

              {/* Prompts */}
              <div id="prompts" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Train the Agent on Your Business
                </h2>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Free Agent SCM uses Claude for reasoning across every operation. The system prompts that guide that reasoning ship with the reference implementation as a starting point. Your team can modify and extend them.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  The agent&apos;s behavior when evaluating whether to respond to a discovery query, how it reasons about pricing decisions, how it interprets incoming orders, and how it handles ambiguous requests all flows from the system prompts. These prompts represent HAIWAVE&apos;s accumulated understanding of supply chain agent behavior. They are good defaults. They are not the final word on how your agent should think.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Your team can layer in company-specific context: your product expertise, your customer relationship nuances, your industry terminology, your escalation preferences. A fastener distributor might train the agent to recognize thread specification shorthand that the default prompts do not cover. A plumbing wholesaler might add reasoning about regional building code requirements that affect product recommendations.
                </p>
                <p className="text-base text-slate leading-relaxed">
                  Prompt modifications live in your configuration directory alongside your manifest files. They are part of your deployment, versioned in your source control, and reviewed by your team.
                </p>
              </div>

              <SectionDivider />

              {/* Updates */}
              <div id="updates" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Updates, Customization, and the Tradeoff
                </h2>
                <p className="text-base text-slate leading-relaxed mb-4">
                  HAIWAVE continuously improves Free Agent SCM. Prompts advance. Core agent capabilities expand. Protocol support broadens. Network services evolve. When your team deploys the standard image with minimal customization, staying current is straightforward: pull the latest image and redeploy.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">Customization introduces a tradeoff your team should plan for.</p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  <strong className="text-charcoal">Light customization</strong> such as adding your own system prompts, configuring manifests, and building adapters for your specific ERP sits cleanly on top of the standard agent. Updates from HAIWAVE flow in without conflict because your customizations live in configuration, not in the core codebase.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  <strong className="text-charcoal">Deep customization</strong> such as modifying the agent&apos;s core reasoning, replacing the Claude integration with a different model, or restructuring the MCP tool implementations creates a fork. Your team is responsible for merging upstream changes into your modified codebase. This is standard software maintenance for any open-source dependency your team modifies at the source level.
                </p>
                <p className="text-base text-slate leading-relaxed mb-6">
                  You can swap out the Claude integration entirely and run a different model. You can disconnect from HAIWAVE network services and operate standalone. The source code is yours to modify. The tradeoff is that you lose access to the ongoing improvements and network capabilities that HAIWAVE provides.
                </p>
                <div className="p-6 rounded-[10px] border-l-4 border-teal bg-soft-gray">
                  <p className="text-[15px] text-charcoal leading-relaxed">
                    Most deployments sit in the middle. Custom prompts and manifests on top of the standard agent. Configuration-level customization with full access to upstream updates.
                  </p>
                </div>
              </div>

              <SectionDivider />

              {/* Security */}
              <div id="security" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Architecturally Enforced, Not Policy-Dependent
                </h2>
                <p className="text-base text-slate leading-relaxed mb-4">
                  The security model is not a set of promises. It is a consequence of how the system is built.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  HAIWAVE never accesses your database. The agent runs in your environment, connects to your database through service accounts your DBA creates, and reads from views your team defines. HAIWAVE central services communicate with your agent through authenticated API calls. They do not have credentials to your data stores.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  The Classification Service Account can only see public-equivalent product data. It cannot read pricing, inventory, customer lists, or financials. The Transaction Service Account has broader access for pricing and availability, but that data only flows through authenticated agent-to-agent interactions on the network. It never reaches the HAIWAVE classifier.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Classification output (product name, assigned taxonomy classes, application tags, confidence score, and timestamp) represents the complete scope of what HAIWAVE persists about your products. Your team can audit this log at any time.
                </p>
                <p className="text-base text-slate leading-relaxed mb-6">
                  Network intelligence derived from aggregate patterns across all participants is a HAIWAVE network asset. Individual vendor data, transaction details, and competitive pricing are never disclosed to other participants. Behavioral scores are visible only through their effect on network ranking, not as raw data.
                </p>
                <div className="p-6 rounded-[10px] border-l-4 border-orange bg-soft-gray">
                  <p className="text-[15px] text-charcoal leading-relaxed">
                    Your agent, your service accounts, your access policies. HAIWAVE receives only what you configure the agent to send.
                  </p>
                </div>
              </div>

              <SectionDivider />

              {/* Partners */}
              <div id="partners" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  When to Bring in a Partner
                </h2>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Many deployments can be handled by your internal team. Download the image, configure the service accounts, set up your manifests, and go. The agent is designed to minimize the need for outside help.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  For more complex environments, HAIWAVE maintains a network of implementation partners and VARs who specialize in connecting Free Agent SCM to specific ERP platforms, building custom adapters, and handling enterprise deployment patterns. Consider engaging a partner if:
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Your ERP is not one of the directly supported database platforms (Snowflake, DuckDB) and you need a custom adapter built for Oracle, SAP, Epicor, NetSuite, or another system.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Your deployment spans multiple business units with different data architectures, different pricing models, or different security requirements that need coordinated configuration.
                </p>
                <p className="text-base text-slate leading-relaxed mb-4">
                  Your team wants to accelerate time-to-network and prefers to have experienced hands handle the initial setup while your team focuses on business rule configuration.
                </p>
                <p className="text-base text-slate leading-relaxed">
                  Partners build against the same published interfaces your team would use. There is no partner-only API or hidden capability. Everything a partner does, your team could do with sufficient time and expertise. Partners offer speed and specialization, not access.
                </p>
              </div>

              <SectionDivider />

              {/* Troubleshooting */}
              <div id="troubleshooting" className="scroll-mt-28">
                <h2 className="font-[family-name:var(--font-display)] text-[26px] font-bold text-navy mb-5 pt-4">
                  Confirming It Works
                </h2>
                <p className="text-base text-slate leading-relaxed mb-6">
                  Before connecting to the live network, your team should validate the deployment using the local development environment.
                </p>

                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-charcoal mb-3">Health Checks</h3>
                <p className="text-base text-slate leading-relaxed mb-6">
                  The agent exposes a health endpoint that confirms the application is running, database connections are active, and authentication credentials are valid. Hit it first.
                </p>

                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-charcoal mb-3">Heartbeat</h3>
                <p className="text-base text-slate leading-relaxed mb-6">
                  Once connected to the network, HAIWAVE central sends periodic heartbeat checks (Hello/ACK). Your agent must respond within the configured window. Three consecutive missed heartbeats trigger jail status, which makes your agent undiscoverable on the network until it recovers and completes a probationary period. Heartbeat failures usually indicate networking issues, container resource constraints, or misconfigured authentication.
                </p>

                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-charcoal mb-3">Classification Test</h3>
                <p className="text-base text-slate leading-relaxed mb-6">
                  Push a small batch of known products through the classification flow and verify the returned taxonomy classes match your expectations. Low-confidence results usually mean the product descriptors need enrichment. The agent will suggest which additional fields to provide.
                </p>

                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-charcoal mb-3">Discovery Test</h3>
                <p className="text-base text-slate leading-relaxed mb-6">
                  If you have a second agent running in the test environment (your own or a HAIWAVE-provided sandbox), submit a catalog discovery query and verify your products appear in the results with correct pricing from your manifest configuration.
                </p>

                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-charcoal mb-3">Manifest Exchange Test</h3>
                <p className="text-base text-slate leading-relaxed mb-6">
                  Initiate a test relationship with a sandbox counterparty and verify that your posture configuration behaves as expected: documents auto-provided where configured as Support, requests routed to humans where configured as Exception, and counterparties skipped where configured as Not Supported.
                </p>

                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-charcoal mb-3">Common Issues</h3>
                <div className="border border-slate/15 rounded-[10px] overflow-hidden mt-3">
                  <div className="grid grid-cols-2 border-b border-slate/15">
                    <div className="p-2.5 px-4 bg-light-gray text-[13px] font-semibold text-charcoal">Symptom</div>
                    <div className="p-2.5 px-4 bg-light-gray text-[13px] font-semibold text-charcoal">Likely Cause</div>
                  </div>
                  {troubleshootingRows.map((row, i) => (
                    <div key={row.symptom} className={`grid grid-cols-2 ${i < troubleshootingRows.length - 1 ? "border-b border-slate/15" : ""}`}>
                      <div className="p-2.5 px-4 text-sm text-slate">{row.symptom}</div>
                      <div className="p-2.5 px-4 text-sm text-slate">{row.cause}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 text-center relative overflow-hidden px-6">
        <div className="max-w-[1200px] mx-auto relative z-10">
          <h2 className="font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-white mb-3">
            Ready to Deploy?
          </h2>
          <p className="text-[17px] font-light text-light-slate max-w-[680px] mx-auto mb-8">
            Download Free Agent SCM and have your team running in your environment today.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-[15px] font-medium bg-teal text-white px-7 py-3 rounded-lg hover:bg-teal-dark transition-all hover:-translate-y-px hover:shadow-lg"
            >
              Download Free Agent SCM
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-[15px] font-medium text-white border-[1.5px] border-white/30 px-7 py-3 rounded-lg hover:bg-white/10 hover:border-white/50 transition-all"
            >
              Back to How It Works
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
