import Link from "next/link";
import { PageIntro } from "@/components/page-intro";

interface HubCard {
  href: string;
  title: string;
  blurb: string;
}

const REQUEST_MANAGEMENT_CARDS: HubCard[] = [
  {
    href: "/account/sonar/compliance/requests",
    title: "Active queue",
    blurb: "Nominations and obligations awaiting a decision on either side.",
  },
  {
    href: "/account/sonar/compliance/requests/declined",
    title: "Declined",
    blurb: "Items declined within the last 30 days.",
  },
];

const POSTURE_CARDS: HubCard[] = [
  {
    href: "/account/sonar/compliance/posture/coverage",
    title: "Coverage",
    blurb: "Current state of observability across your active scopes.",
  },
  {
    href: "/account/sonar/compliance/posture/working-list",
    title: "Working List",
    blurb: "Open gaps, changes, and expiries to triage.",
  },
  {
    href: "/account/sonar/compliance/posture/changes",
    title: "Changes",
    blurb: "Recent change events across monitored vendors.",
  },
];

function HubCardLink({ href, title, blurb }: HubCard) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-lg border border-slate/15 p-6 hover:border-teal hover:bg-light-gray/40 transition-colors"
    >
      <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate">{blurb}</p>
    </Link>
  );
}

export default async function ComplianceHubPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy mb-2">
        Compliance
      </h1>
      <p className="text-slate mb-3">
        Two-mode view across bilateral requests and daily posture monitoring.
      </p>
      <PageIntro>
        Request Management covers bilateral asks — nominations and obligations awaiting acceptance.
        Posture covers the ongoing state of your active supply-chain compliance — coverage, gaps,
        and recent changes.
      </PageIntro>

      <section className="mb-8">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-1">
          Request Management
        </h2>
        <p className="text-sm text-slate mb-4">
          Bilateral requests requiring action — nominations and obligations awaiting acceptance.
        </p>
        <div className="grid grid-cols-2 gap-6">
          {REQUEST_MANAGEMENT_CARDS.map((card) => (
            <HubCardLink key={card.href} {...card} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-1">
          Posture
        </h2>
        <p className="text-sm text-slate mb-4">
          Daily monitoring of your active supply-chain compliance state.
        </p>
        <div className="grid grid-cols-3 gap-6">
          {POSTURE_CARDS.map((card) => (
            <HubCardLink key={card.href} {...card} />
          ))}
        </div>
      </section>
    </div>
  );
}
