import { PageHeader } from "@/components/page-header";
import { PageIntro } from "@/components/page-intro";
import { ReviewQueuePanel } from "./review-queue-panel";

export default function DataCleansingPage() {
  return (
    <div>
      <PageHeader
        title="Data Cleansing"
        description="Review products your agent couldn't auto-classify and resolve them manually."
      />
      <PageIntro>
        The review queue for products the classifier couldn&apos;t auto-place against the concept graph — manual reassignments, new-class requests, and not-a-product flags. Resolve items here so they show up correctly in audit rollups, search results, and downstream classifier behavior.
      </PageIntro>
      <ReviewQueuePanel />
    </div>
  );
}
