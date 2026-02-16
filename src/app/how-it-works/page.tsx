import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

const positions = [
  {
    title: "Customer Service",
    subtitle: "Serves your external buyers",
    accent: "bg-orange",
    body: "Your customers and their agents need answers about your products, pricing, availability, and order status. Free Agent SCM handles inbound inquiries with the same data your own team uses, responding consistently whether the question comes from a person or another company's AI agent.",
    useCases: ["Inbound inquiries", "Quote requests", "Order status"],
    badges: [
      { label: "Human-to-Agent", style: "bg-teal/10 text-teal-dark" },
      { label: "Agent-to-Agent", style: "bg-orange/10 text-orange" },
    ],
  },
  {
    title: "Inside Sales",
    subtitle: "Serves your own teams",
    accent: "bg-teal",
    body: "Your inside sales and operations staff spend time looking up product details, checking pricing rules, confirming availability, and navigating internal policies. Free Agent SCM gives them a conversational interface to your own systems so they get answers in seconds instead of clicks.",
    useCases: ["Product lookups", "Pricing and availability", "Policy and procedures"],
    badges: [
      { label: "Human-to-Agent", style: "bg-teal/10 text-teal-dark" },
    ],
  },
  {
    title: "Procurement",
    subtitle: "Serves your buying team",
    accent: "bg-cobalt",
    body: "When your team needs to source products, Free Agent SCM searches the HAIWAVE network to discover qualified vendors, compare pricing, and initiate purchase orders. Your procurement staff and their agents can find what they need across every company on the network without picking up a phone.",
    useCases: ["Vendor discovery", "Purchase orders", "Delivery tracking"],
    badges: [
      { label: "Human-to-Agent", style: "bg-teal/10 text-teal-dark" },
      { label: "Agent-to-Agent", style: "bg-orange/10 text-orange" },
    ],
  },
];

const networkBlocks = [
  {
    title: "Catalog Discovery",
    body: "Your products become discoverable by every buyer on the network. Their products become discoverable by you. When your procurement team or their agent searches for a product, the network resolves which vendors carry it, what their pricing looks like, and how they perform.",
  },
  {
    title: "Manifest Rules Engine",
    body: "You define your business rules once: pricing tiers, payment terms, shipping preferences, counterparty requirements. Your agent enforces them consistently on every transaction across every trading partner. No per-deal configuration. No human re-entry.",
  },
  {
    title: "Behavioral Scoring",
    body: "The network builds trading partner performance profiles from real transaction data. Response times, fulfillment accuracy, price adherence. Your agent uses these trust signals when evaluating vendors. Other agents use them when evaluating you.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-[140px] pb-20 text-center flex flex-col items-center px-6">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-teal-dark uppercase tracking-wider mb-6">
          <span className="w-6 h-px bg-teal" />
          Agentic Supply Chain Automation
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.75rem)] font-bold text-navy leading-tight max-w-[780px] mb-5">
          Deploy a &apos;Free&apos; Agent Across Your Organization
        </h1>
        <p className="text-lg font-light text-slate max-w-[680px] leading-relaxed mb-2">
          Free Agent SCM is a multi-positional AI teammate you deploy wherever your business crosses a company boundary. Customer service, inside sales, procurement. One agent. Three positions. Download the full source code and put them to work.
        </p>
        <p className="text-teal font-medium text-[15px] mb-6">freeagent.haiwave.ai</p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 text-[15px] font-medium bg-navy text-white px-7 py-3 rounded-lg hover:bg-charcoal transition-all hover:-translate-y-px hover:shadow-lg"
        >
          Download Free Agent SCM
        </Link>
      </section>

      {/* One Agent Three Positions */}
      <section className="bg-soft-gray py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy mb-8">
            One Agent. Three Positions.
          </h2>
          <p className="text-base text-slate leading-relaxed max-w-[720px] mb-4">
            Free Agent SCM is a downloadable AI agent that connects to your existing business systems and serves three distinct roles within your organization. It reads from your ERP, CRM, inventory, and order management systems through secure, read-only connections your team configures. Then it goes to work.
          </p>
          <p className="text-base text-slate leading-relaxed max-w-[720px]">
            Unlike tools that automate a single workflow, Free Agent SCM operates across the functions where your business interacts with the outside world: answering customer questions, supporting your sales team, and sourcing products from vendors. Same agent, same data layer, three different jobs.
          </p>
        </div>
      </section>

      {/* Three Position Cards */}
      <section className="py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy text-center mb-10">
            Where Does Free Agent SCM Play?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {positions.map((pos) => (
              <div
                key={pos.title}
                className="bg-white border border-slate/15 rounded-xl p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className={`w-12 h-1 rounded-sm ${pos.accent} mb-5`} />
                <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-charcoal mb-1">
                  {pos.title}
                </h3>
                <p className="text-sm text-light-slate mb-4">{pos.subtitle}</p>
                <p className="text-base text-slate leading-relaxed mb-4">{pos.body}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {pos.useCases.map((uc) => (
                    <span key={uc} className="text-[13px] px-3 py-1 rounded-full bg-light-gray text-slate font-medium">
                      {uc}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {pos.badges.map((b) => (
                    <span key={b.label} className={`text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-xl ${b.style}`}>
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Back Office */}
      <section className="bg-soft-gray py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy mb-6">
                Connects to Your Back Office. Never Replaces It.
              </h2>
              <p className="text-base text-slate leading-relaxed mb-4">
                Free Agent SCM connects to your ERP, CRM, inventory, and order management systems through secure service accounts your database team configures. It reads from your data. It does not migrate it, replicate it, or store it somewhere else. Your systems remain your systems.
              </p>
              <p className="text-base text-slate leading-relaxed">
                Implementation partners and VARs can build custom adapters and extensions for systems HAIWAVE does not cover out of the box. The agent is yours to extend.
              </p>
            </div>
            <div>
              <div className="flex flex-col gap-3">
                <div className="p-3.5 border border-slate/15 rounded-lg bg-white">
                  <span className="text-[13px] font-semibold uppercase tracking-wider text-light-slate">Your Back Office</span>
                </div>
                {["ERP", "CRM", "Inventory Management", "Order Management"].map((sys) => (
                  <div key={sys} className="p-3 border border-slate/15 rounded-lg text-[15px] text-slate">
                    {sys}
                  </div>
                ))}
              </div>
              <div className="p-6 rounded-[10px] border-l-4 border-teal bg-soft-gray mt-5">
                <p className="text-[15px] text-charcoal leading-relaxed">
                  <strong>Implementation Partners</strong><br />
                  <span className="text-light-slate">Third-party integrators build custom adapters against your systems. Your agent, extended by your chosen partners.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Network */}
      <section className="py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy text-center mb-2">
            The Network Behind the Agent
          </h2>
          <p className="text-lg font-light text-slate text-center mb-10">
            Every participant is both a buyer and a seller.
          </p>
          <p className="text-base text-slate leading-relaxed text-center max-w-[720px] mx-auto mb-8">
            Free Agent SCM is powerful on its own, but its full potential activates when connected to the HAIWAVE network. The network is where your agent discovers vendors, responds to buyer inquiries, and transacts across company boundaries with other agents.
          </p>

          <div className="max-w-[680px] mx-auto">
            <div className="flex gap-4 mb-6">
              <div className="flex-1 text-center p-2.5 rounded-lg bg-orange/8 border border-orange/20">
                <span className="text-[13px] font-semibold text-orange">Sell Side</span><br />
                <span className="text-xs text-light-slate">Customer Service</span>
              </div>
              <div className="flex-1 text-center p-2.5 rounded-lg bg-cobalt/6 border border-cobalt/15">
                <span className="text-[13px] font-semibold text-cobalt">Buy Side</span><br />
                <span className="text-xs text-light-slate">Procurement</span>
              </div>
            </div>

            {networkBlocks.map((block) => (
              <div key={block.title} className="p-7 rounded-[10px] border border-slate/15 bg-white mb-6">
                <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-charcoal mb-2">
                  {block.title}
                </h3>
                <p className="text-[15px] text-slate leading-relaxed">{block.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 text-center relative overflow-hidden px-6">
        <div className="max-w-[1200px] mx-auto relative z-10">
          <h2 className="font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-white mb-3">
            Free Means Free
          </h2>
          <p className="text-[17px] font-light text-light-slate max-w-[680px] mx-auto mb-2">
            Download the full source code. Sign up for a free HAIWAVE network key. Add your own Claude API key. Deploy Free Agent SCM in your environment and put them to work.
          </p>
          <p className="text-[15px] text-light-slate/70 mb-8">
            No trial period. No feature gates. No expiration. Copyleft licensed for commercial use.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-[15px] font-medium bg-teal text-white px-7 py-3 rounded-lg hover:bg-teal-dark transition-all hover:-translate-y-px hover:shadow-lg"
            >
              Download Free Agent SCM
            </Link>
            <Link
              href="/deployment-guide"
              className="inline-flex items-center gap-2 text-[15px] font-medium text-white border-[1.5px] border-white/30 px-7 py-3 rounded-lg hover:bg-white/10 hover:border-white/50 transition-all"
            >
              Read the Deployment Guide
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
