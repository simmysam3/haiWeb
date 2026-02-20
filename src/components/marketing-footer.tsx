import Image from "next/image";

export function MarketingFooter() {
  return (
    <footer className="py-12 border-t border-slate/15">
      <div className="max-w-[1200px] mx-auto px-10">
        <div className="flex justify-between items-start max-md:flex-col max-md:gap-8">
          <div>
            <Image
              src="/img/haiwave-logo.png"
              alt="hAIWave"
              width={120}
              height={36}
              className="h-9 w-auto mb-3"
            />
            <p className="text-sm text-slate max-w-[280px]">
              The medium of exchange for cross-organizational agentic
              commerce.
            </p>
          </div>
          <div className="flex gap-16">
            {[
              {
                title: "Product",
                links: [
                  "Protocol",
                  "Reference Implementation",
                  "Documentation",
                ],
              },
              { title: "Company", links: ["About", "Careers", "Contact"] },
              {
                title: "Resources",
                links: ["Case Studies", "Blog", "Partners"],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-medium uppercase tracking-wider text-light-slate mb-4">
                  {col.title}
                </h4>
                {col.links.map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="block text-sm text-slate hover:text-teal-dark transition-colors mb-3"
                  >
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-slate/10">
          <p className="text-[13px] text-light-slate">
            &copy; 2026 HAIWAVE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
