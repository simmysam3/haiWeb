import { NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(null);
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const wallet = await client.getWallet(session.participant.id);
    return NextResponse.json(wallet);
  } catch {
    return NextResponse.json(null);
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
    const result = await client.registerWallet({
      participant_id: session.participant.id,
      ...body,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
