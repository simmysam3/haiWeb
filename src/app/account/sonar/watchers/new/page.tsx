import { PageHeader } from '@/components';
import { WatcherWizard } from './_components/watcher-wizard';

export default function WatcherNewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="New watcher"
        title="Create a watcher"
        description="Pick the components or counterparties to monitor, the signals you care about, and a cadence. Each run scans your trading network and surfaces drift in lead time, capacity, and delivery events."
      />
      <WatcherWizard />
    </div>
  );
}
