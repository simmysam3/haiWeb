import { PageHeader } from "@/components/page-header";
import { AdminDashboard } from "./admin-dashboard";

export default function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="HAIWAVE network administration overview."
      />
      <AdminDashboard />
    </div>
  );
}
