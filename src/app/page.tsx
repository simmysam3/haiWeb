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
              <span className="text-teal">company boundaries.</span> We remove
              the friction.
            </h1>
            <p className="text-lg font-light text-slate max-w-[560px] mb-10 leading-relaxed">
              HAIWAVE lets AI agents discover, negotiate, and transact across
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
