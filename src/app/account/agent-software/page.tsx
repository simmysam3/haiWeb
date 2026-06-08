import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DownloadCard } from "@/components/download-card";
import { loadManifest, fileExists } from "@/lib/agent-downloads";

export const runtime = "nodejs";

export default async function AgentSoftwarePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const manifest = await loadManifest();
  const guideAvailable = await fileExists("configuration-guide.pdf");
  const agentAvailable = manifest ? await fileExists(manifest.zipFile) : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Software"
        description="Download the agent configuration guide and the latest HAIWAVE agent client software."
      />
      <div className="space-y-4">
        <DownloadCard
          title="Configuration Guide (PDF)"
          subtitle="Step-by-step setup and configuration for your agent."
          href="/api/agent-software/download/guide"
          available={guideAvailable}
        />
        <DownloadCard
          title={`Agent — Latest Version${manifest ? ` (v${manifest.version})` : ""}`}
          subtitle={
            manifest
              ? `Built ${new Date(manifest.builtAt).toLocaleDateString()}`
              : "Source archive of the latest agent client."
          }
          href="/api/agent-software/download/agent"
          available={agentAvailable}
        />
      </div>
    </div>
  );
}
