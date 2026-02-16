import { NextRequest, NextResponse } from "next/server";
import { refreshToken } from "@/lib/keycloak";

/**
 * POST /api/auth/refresh
 *
 * Refreshes OIDC tokens via Keycloak token endpoint.
 */
export async function POST(request: NextRequest) {
  const currentRefresh = request.cookies.get("haiwave_refresh")?.value;

  if (!currentRefresh) {
    return NextResponse.json(
      { error: "No refresh token" },
      { status: 401 },
    );
  }

  try {
    const tokens = await refreshToken(currentRefresh);

    const response = NextResponse.json({ success: true });

    response.cookies.set("haiwave_session", tokens.access_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    });

    response.cookies.set("haiwave_refresh", tokens.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 401 },
    );
  }
}
