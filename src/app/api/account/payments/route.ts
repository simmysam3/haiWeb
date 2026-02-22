import { NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ payments: [], total: 0 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "history";

    const client = createHaiwaveClient(token, session.participant.id);

    if (type === "manifest") {
      const manifestType = searchParams.get("manifest_type") ?? "vendor";
      const manifest = await client.getPaymentManifest(session.participant.id, manifestType);
      return NextResponse.json(manifest);
    }

    // Default: payment history
    const wallet = await client.getWallet(session.participant.id) as Record<string, unknown> | null;
    const address = wallet?.address as string ?? "";
    const history = await client.getPaymentHistory(address);
    return NextResponse.json(history);
  } catch {
    return NextResponse.json({ payments: [], total: 0 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const body = await request.json();
    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.updatePaymentManifest({
      participant_id: session.participant.id,
      effective_date: new Date().toISOString(),
      ...body,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
