import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { ScoreDashboard } from "./score-dashboard";

export default function ScoresPage() {
  return (
    <div>
      <PageHeader
        title="Behavioral Scores"
        description="Your network performance as calculated by the Behavioral Registry."
      />
      <PageIntro>
        How every counterparty you transact with is performing, scored against actual fulfillment, accuracy, and dispute outcomes. Use the scores to set trust thresholds, decide who you&apos;ll auto-acknowledge in the inbound queue, and flag relationships worth a closer look.
      </PageIntro>
      <ScoreDashboard />
    </div>
  );
}
