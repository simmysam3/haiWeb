import { PageHeader } from "@/components/page-header";
import { ScoreDashboard } from "./score-dashboard";

export default function ScoresPage() {
  return (
    <div>
      <PageHeader
        title="Behavioral Scores"
        description="Your network performance as calculated by the Behavioral Registry."
      />
      <ScoreDashboard />
    </div>
  );
}
