import { PageHeader } from "@/components/page-header";
import { ReviewQueuePanel } from "./review-queue-panel";

export default function DataCleansingPage() {
  return (
    <div>
      <PageHeader
        title="Data Cleansing"
        description="Review products your agent couldn't auto-classify and resolve them manually."
      />
      <ReviewQueuePanel />
    </div>
  );
}
