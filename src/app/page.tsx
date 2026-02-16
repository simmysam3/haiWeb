import Link from "next/link";
import Image from "next/image";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-[140px] pb-[120px] relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-10 relative">
          <div className="max-w-[720px] relative z-10">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-teal-dark uppercase tracking-wider mb-6">
              <span className="w-6 h-px bg-teal" />
              Agentic Supply Chain Automation
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,2.5rem)] font-bold text-navy leading-tight mb-6">
              AI automation fails at{" "}
              <span className="text-teal">company boundaries.</span> We fix
              that.
            </h1>
            <p className="text-lg font-light text-slate max-w-[560px] mb-10 leading-relaxed">
              Remove the friction. HAIWAVE lets AI agents discover, negotiate, and transact across
              corporate boundaries. One integration. Every counterparty on the
              network.
            </p>
            <div className="flex gap-4 items-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-[15px] font-medium bg-navy text-white px-7 py-3 rounded-lg hover:bg-charcoal transition-all hover:-translate-y-px hover:shadow-lg"
              >
                Get Started <span>&rarr;</span>
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center gap-2 text-[15px] font-medium text-teal-dark border-[1.5px] border-teal-dark px-7 py-3 rounded-lg hover:bg-soft-gray transition-all hover:-translate-y-px"
              >
                Learn More
              </Link>
            </div>
          </div>
          <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[560px] h-[560px] z-0 hidden lg:block">
            <Image
              src="/img/hero-orbital.svg"
              alt=""
              width={560}
              height={560}
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="bg-soft-gray py-20">
        <div className="max-w-[1200px] mx-auto px-10">
          <div className="grid grid-cols-4 gap-6 max-md:grid-cols-2">
            {[
              { value: "$186T", label: "Global B2B payments annually" },
              {
                value: "90%+",
                label: "Trading relationships lack EDI",
              },
              {
                value: "$500K",
                label: "Annual labor on routine inquiry response",
              },
              {
                value: "4-24hr",
                label: "Standard quote turnaround time",
              },
            ].map((m, i) => (
              <div
                key={i}
                className="pl-5 border-l-2 border-teal [&:nth-child(2)]:border-orange [&:nth-child(3)]:border-cobalt [&:nth-child(4)]:border-layer-2"
              >
                <div className="font-[family-name:var(--font-display)] text-3xl font-bold text-navy leading-tight mb-1">
                  {m.value}
                </div>
                <div className="text-sm text-slate">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20" id="pricing">
        <div className="max-w-[1200px] mx-auto px-10">
          <div className="text-center max-w-[640px] mx-auto mb-16">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-teal-dark uppercase tracking-wider mb-4">
              <span className="w-4 h-px bg-teal" />
              Pricing
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-navy mb-4">
              Simple, transparent components
            </h2>
            <p className="text-slate text-[17px] font-light">
              Platform access, implementation, and per-connection fees. No
              per-document charges. No transaction volume surcharges.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 max-md:grid-cols-1">
            {[
              {
                label: "Platform",
                value: "$10,000",
                unit: "per year",
                features: [
                  "Network registration and identity verification",
                  "Go Fish discovery across full ecosystem",
                  "Vendor Behavioral Registry participation",
                  "Published interface access",
                ],
              },
              {
                label: "Connection Fees",
                value: "$50-$100",
                unit: "per pair / month, volume-tiered",
                featured: true,
                features: [
                  "First 20 pairs: $100/mo each",
                  "Pairs 21-100: $80/mo each",
                  "101+: $50/mo each",
                  "Unlimited transactions per pair",
                ],
              },
              {
                label: "Implementation",
                value: "~$20,000",
                unit: "one-time",
                features: [
                  "ERP connectivity and catalog discovery",
                  "Taxonomy mapping and manifest configuration",
                  "Reference implementation deployment",
                  "Network registration and go-live",
                ],
              },
            ].map((card, i) => (
              <div
                key={i}
                className={`bg-white border rounded-xl p-8 ${
                  card.featured
                    ? "border-teal shadow-[0_0_0_1px_var(--color-teal)]"
                    : "border-slate/20"
                }`}
              >
                <div className="text-xs font-medium uppercase tracking-wider text-slate mb-3">
                  {card.label}
                </div>
                <div className="font-[family-name:var(--font-display)] text-3xl font-bold text-navy mb-1">
                  {card.value}
                </div>
                <div className="text-sm text-light-slate mb-6">
                  {card.unit}
                </div>
                <ul className="flex flex-col gap-3">
                  {card.features.map((f, j) => (
                    <li
                      key={j}
                      className="text-sm text-charcoal flex items-start gap-2"
                    >
                      <span className="w-1 h-1 rounded-full bg-teal mt-[7px] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 text-center relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-10 relative z-10">
          <h2 className="font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-white mb-4">
            Your agents are ready. The network is waiting.
          </h2>
          <p className="text-[17px] font-light text-light-slate max-w-[520px] mx-auto mb-8">
            Extend your internal AI automation across the boundary to every
            trading partner on the network.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 text-[15px] font-medium bg-teal-dark text-white px-7 py-3 rounded-lg hover:bg-[#006570] transition-all hover:-translate-y-px hover:shadow-lg"
          >
            Start a Conversation <span>&rarr;</span>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
