import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.HAIWAVE_API_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("haiwave_session")?.value;
  const params = request.nextUrl.searchParams.toString();

  try {
    const res = await fetch(`${API_URL}/api/v1/admin/audit?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-HaiWave-Protocol-Version": "1.0.0",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `haiCore ${res.status}` }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Failed to reach haiCore" }, { status: 502 });
  }
}
