import { NextRequest, NextResponse } from "next/server";
import { createUser, authenticateUser } from "@/lib/keycloak";
import { createCustomer } from "@/lib/stripe";

/**
 * POST /api/auth/register
 *
 * Creates user in Keycloak, mock Stripe customer, authenticates, sets cookies.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, first_name, last_name, company } = body;

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 },
    );
  }

  // Try Keycloak registration
  try {
    await createUser({
      email,
      firstName: first_name ?? "",
      lastName: last_name ?? "",
      password: password ?? "",
      attributes: {
        participant_id: ["pending"],
      },
    });

    // Create mock Stripe customer
    await createCustomer({
      email,
      name: company?.name ?? `${first_name} ${last_name}`,
      participantId: "pending",
    });

    // Authenticate the new user
    const tokens = await authenticateUser(email, password);

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
    // Dev fallback
    if (process.env.NODE_ENV === "development") {
      const isAdmin = email.toLowerCase().includes("admin");
      const response = NextResponse.json({ success: true });

      response.cookies.set("haiwave_session", isAdmin ? "admin" : "user", {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1800,
        path: "/",
      });

      return response;
    }

    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 },
    );
  }
}
