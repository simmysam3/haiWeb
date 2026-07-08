import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

export const GET = withHaiCore(
  ({ client }) => client.listAgents(),
  { role: "account_admin", fallback: { agents: [] } },
);

export const POST = withHaiCore(
  async ({ client, request }) => {
    const body = (await request.json()) as { name?: string };
    const cred = await client.createAgent((body.name ?? "").trim());
    return NextResponse.json(cred, { status: 201 });
  },
  { role: "account_admin" },
);
