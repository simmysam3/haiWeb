import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.HAIWAVE_API_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("haiwave_session")?.value;
  const body = await request.json();
  const action = body.action as string;
  delete body.action;

  try {
    const res = await fetch(`${API_URL}/api/v1/admin/actions/${action}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-HaiWave-Protocol-Version": "1.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `haiCore ${res.status}` }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Failed to reach haiCore" }, { status: 502 });
  }
}
