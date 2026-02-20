import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

export default function WhyFreeAgentPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-[140px] pb-20 text-center flex flex-col items-center px-6">
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.75rem)] font-bold text-navy leading-tight max-w-[780px] mb-5">
          Your Catalog Is Only as Valuable as the People Who Can Find It
        </h1>
        <p className="text-lg font-light text-slate max-w-[680px] leading-relaxed mb-8">
          Free Agent SCM puts your full product catalog on a network where every buyer&apos;s AI agent can discover it. And it puts every seller&apos;s catalog at your procurement team&apos;s fingertips. New revenue. Lower sourcing costs. Your people focused on the work that actually grows the business.
        </p>
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-2 text-[15px] font-medium text-navy border-[1.5px] border-navy px-7 py-3 rounded-lg hover:bg-navy hover:text-white transition-all"
        >
          See How It Works
        </Link>
      </section>

      {/* Network Discovery */}
      <section className="bg-soft-gray py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy mb-8">
            Every Product You Sell, Discoverable to Every Buyer on the Network
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <p className="text-base text-slate leading-relaxed mb-4">
                Today, a buyer who does not already know you exist cannot find you. Your catalog lives inside your ERP, behind your sales team&apos;s phone calls, inside your portal login. If a purchasing agent at a company three states away needs exactly what you manufacture, the only way they find you is through a trade show, a Google search, a referral, or luck.
              </p>
              <p className="text-base text-slate leading-relaxed mb-4">
                Free Agent SCM changes the math. When you deploy the agent and classify your product catalog on the HAIWAVE network, every product you carry becomes discoverable to every authenticated buyer agent on the network. A procurement team searching for nylon push-type fasteners does not need to know your company name. They describe what they need, and the network resolves which vendors carry it, what the pricing looks like, and how those vendors perform.
              </p>
              <p className="text-base text-slate leading-relaxed">
                This is not a directory listing. It is a live, queryable presence backed by your actual inventory, your actual pricing, and your actual availability. When a buyer&apos;s agent finds you, the response comes from your data, not from a static profile someone updated six months ago.
              </p>
            </div>
            <div>
              <div className="p-6 rounded-[10px] border-l-4 border-orange bg-soft-gray mb-6">
                <p className="text-[15px] text-charcoal leading-relaxed">
                  Every participant on the network is both a buyer and a seller. The same deployment that makes your catalog discoverable gives your procurement team access to every seller.
                </p>
              </div>
              <p className="text-base text-slate leading-relaxed">
                The integration that starts as a pilot with one trading partner immediately exposes your full catalog to the entire network. A fastener manufacturer who joins to service one buyer becomes discoverable to every buyer searching for fasteners. New business connections form without your sales team making a single cold call.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Lower Sourcing Costs */}
      <section className="py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy mb-8">
            Find Better Sources in Seconds, Not Weeks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <p className="text-base text-slate leading-relaxed mb-4">
                Your procurement team spends real time and real money identifying alternative vendors. When a supplier misses a delivery, raises prices, or goes on allocation, the scramble begins: phone calls, emails, trade directory searches, RFQ cycles that take days or weeks while production waits.
              </p>
              <p className="text-base text-slate leading-relaxed mb-4">
                On the HAIWAVE network, your agent submits a catalog discovery query describing what you need. The network classifies the request, identifies every vendor carrying matching products, and returns responses ranked by price, availability, lead time, and behavioral score. Your team compares options from qualified, authenticated vendors in a single interaction instead of a multi-week sourcing exercise.
              </p>
              <p className="text-base text-slate leading-relaxed">
                This is particularly powerful for the long tail of your supply base. Your top ten suppliers are well-managed. It is suppliers 11 through 200 where rapid alternative discovery changes your cost structure and your risk profile.
              </p>
            </div>
            <div>
              <div className="p-6 rounded-[10px] border-l-4 border-teal bg-soft-gray mb-6">
                <p className="text-[15px] text-charcoal leading-relaxed">
                  5-10% of inbound shipments carry exceptions. When a disruption hits, the network resolves alternative sources before your team picks up a phone.
                </p>
              </div>
              <p className="text-base text-slate leading-relaxed">
                Aged inventory pricing amplifies the savings. Vendors on the network can configure automatic discounts on inventory that has been sitting on shelves. Your procurement agent surfaces these opportunities without anyone needing to know they exist. A 25% discount on aged stock that perfectly meets your spec is money found, not money negotiated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free Your People */}
      <section className="bg-soft-gray py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy mb-8">
            Stop Paying Skilled People to Look Things Up
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <p className="text-base text-slate leading-relaxed mb-4">
                Your customer service team answers the same questions hundreds of times a week. Where is my order. What is the lead time on this product. Can you match this price. Each answer requires a person to log in, look it up, and respond. Multiply that across every customer, every day, and you are looking at significant labor cost absorbed by routine inquiry handling.
              </p>
              <p className="text-base text-slate leading-relaxed mb-4">
                Your inside sales team does the same thing in reverse. They look up pricing for customers, check inventory positions, verify terms, and relay information that already exists in your systems. They became salespeople to build relationships and grow accounts, not to be human middleware between a customer and a database.
              </p>
              <p className="text-base text-slate leading-relaxed">
                Free Agent SCM absorbs this work. It handles inbound inquiries from customers and their agents using your actual system data, governed by your manifest rules. It gives your inside sales team a conversational interface to your own systems so lookups happen in seconds.
              </p>
            </div>
            <div>
              <div className="p-6 rounded-[10px] border-l-4 border-orange bg-soft-gray mb-6">
                <p className="text-[15px] text-charcoal leading-relaxed">
                  A manufacturer processing 500 inbound quote requests per week carries roughly $500,000 in annual labor cost for routine inquiry response alone. That capacity redirects to growth.
                </p>
              </div>
              <p className="text-base text-slate leading-relaxed">
                The labor does not disappear. It redirects. Your customer service team handles the complex exceptions that require judgment. Your inside sales team spends their hours on relationship building, account growth, and the conversations that generate margin. Your procurement team focuses on strategic sourcing decisions instead of routine reordering.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Consistency */}
      <section className="py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy mb-8">
            Same Rules. Every Time. Every Partner.
          </h2>
          <p className="text-base text-slate leading-relaxed max-w-[720px] mb-4">
            When a human handles a quote, the result depends on which human, which day, and how well they remember the current pricing matrix. Volume discounts get missed. Outdated terms get quoted. Customer-specific pricing gets applied to the wrong account. The errors are small individually but they compound across thousands of transactions per year.
          </p>
          <p className="text-base text-slate leading-relaxed max-w-[720px] mb-4">
            Free Agent SCM enforces your manifest rules on every interaction. Pricing inheritance resolves from company-wide defaults down to SKU-level overrides. Customer-specific terms are applied automatically. Minimum order values, shipping preferences, and payment terms are enforced consistently whether the request comes from your largest account or a first-time buyer on the network.
          </p>
          <p className="text-base text-slate leading-relaxed max-w-[720px]">
            Your business rules get defined once in configuration files your team controls. The agent applies them uniformly. When rules change, your team updates the configuration and the change applies to every subsequent transaction. No retraining. No memo that half the team misses.
          </p>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="bg-soft-gray py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy mb-8">
            Know Who Delivers Before You Commit
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-cobalt mb-3">As a Buyer</h3>
              <p className="text-base text-slate leading-relaxed">
                Every vendor says they ship on time. The HAIWAVE Behavioral Registry builds performance profiles from what actually happens: response times, inventory accuracy, price adherence, fulfillment reliability, and exception frequency. These are calculated from real transaction patterns, not self-reported ratings. Your procurement agent factors these signals into sourcing decisions automatically.
              </p>
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-[22px] font-bold text-orange mb-3">As a Seller</h3>
              <p className="text-base text-slate leading-relaxed">
                Your own performance becomes a competitive asset. If your company responds quickly, ships accurately, and fulfills commitments, that record is visible in how the network ranks you against competitors. Reliability becomes a differentiator that earns you business without your sales team having to make the case.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cost / Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-[1140px] mx-auto text-center">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy mb-4">
            Free to Download. Low Cost to Operate.
          </h2>
          <p className="text-lg text-slate font-light mb-8">No commitment to evaluate.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-7 rounded-[10px] border border-slate/20 bg-white text-center">
              <h3 className="text-base font-bold text-charcoal">Agent Download</h3>
              <div className="font-[family-name:var(--font-display)] text-[32px] font-bold text-navy my-3">Free</div>
              <p className="text-[13px] text-light-slate">Full source code, copyleft licensed</p>
            </div>
            <div className="p-7 rounded-[10px] border border-slate/20 bg-white text-center">
              <h3 className="text-base font-bold text-charcoal">Platform Fee</h3>
              <div className="font-[family-name:var(--font-display)] text-[32px] font-bold text-navy my-3">$10K<span className="text-base font-normal">/yr</span></div>
              <p className="text-[13px] text-light-slate">Network registration, catalog discovery, behavioral scoring</p>
            </div>
            <div className="p-7 rounded-[10px] border border-slate/20 bg-white text-center">
              <h3 className="text-base font-bold text-charcoal">Connection Fees</h3>
              <div className="font-[family-name:var(--font-display)] text-[32px] font-bold text-navy my-3">$50-100<span className="text-base font-normal">/mo</span></div>
              <p className="text-[13px] text-light-slate">Per trading pair, unlimited transactions, volume-tiered</p>
            </div>
          </div>

          <p className="text-base text-slate leading-relaxed max-w-[720px] mx-auto mt-8">
            For context, traditional EDI connections cost $2,000 to $5,000 annually per trading partner on top of per-document fees, and EDI only handles document exchange for established relationships. It does nothing for discovery, new vendor relationships, or negotiation.
          </p>

          <div className="p-6 rounded-[10px] border-l-4 border-teal bg-soft-gray max-w-[560px] mx-auto mt-8 text-left">
            <p className="text-[15px] text-charcoal leading-relaxed">
              Evaluate with zero cost and zero commitment. Deploy locally, test with your own data, and connect to the network when you are ready.
            </p>
          </div>
        </div>
      </section>

      {/* No Lock-In */}
      <section className="bg-soft-gray py-20 px-6">
        <div className="max-w-[1140px] mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2rem)] font-bold text-navy mb-8">
            Adopt a Protocol, Not a Vendor Contract
          </h2>
          <p className="text-base text-slate leading-relaxed max-w-[720px] mb-4">
            Free Agent SCM is a reference implementation of the HAIWAVE protocol. Your team can use it as-is, customize it, or build your own agent from scratch against the published interfaces. The protocol is the standard. The agent is one way to implement it.
          </p>
          <p className="text-base text-slate leading-relaxed max-w-[720px] mb-4">
            You can swap the AI model. You can replace the database connector. You can restructure the agent&apos;s reasoning to match your operational philosophy. The source code is yours to modify. Implementation partners and VARs can build custom adapters for your specific ERP platform.
          </p>
          <p className="text-base text-slate leading-relaxed max-w-[720px] mb-5">
            The lock-in, to the extent it exists, is at the network layer. The HAIWAVE network is where catalog discovery happens, where behavioral scores accumulate, and where authenticated trading relationships operate. That is where the value compounds. The agent that connects you to the network is a component you own and control.
          </p>
          <Link
            href="/deployment-guide"
            className="inline-block text-teal font-medium hover:text-teal-dark transition-colors"
          >
            Read the Deployment Guide &rarr;
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 text-center relative overflow-hidden px-6">
        <div className="max-w-[1200px] mx-auto relative z-10">
          <h2 className="font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-white mb-4">
            Put Your Catalog on the Network
          </h2>
          <p className="text-[17px] font-light text-light-slate max-w-[680px] mx-auto mb-8">
            Download Free Agent SCM. Get your products in front of every buyer. Get every seller in front of your procurement team.
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
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
