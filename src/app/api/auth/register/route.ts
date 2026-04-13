import { NextRequest, NextResponse } from "next/server";
import { createUser, authenticateUser, deleteUser } from "@/lib/keycloak";
import { createCustomer } from "@/lib/stripe";
import { registerParticipant } from "@/lib/haiwave-api";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";
import { z } from "zod";

// 5 registrations per IP per hour. Module-level so the limiter survives
// across requests in a single Cloud Run instance; stateless across instances
// (acceptable for a first-pass DoS deterrent).
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  company: z.object({
    name: z.string().min(1),
    dba_name: z.string().optional(),
    business_type: z.string().min(1),
    tax_id: z.string().optional(),
    duns: z.string().optional(),
    phone: z.string().min(1),
    email: z.string().email(),
    address: z.object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      postal_code: z.string().min(1),
      country: z.string().default("US"),
    }),
    website: z.string().optional(),
    description: z.string().optional(),
  }),
  payment_method: z.enum(["pay_now", "invoice"]),
});

export async function POST(request: NextRequest) {
  // Rate-limit before hitting Keycloak / Stripe / haiCore. Prevents an
  // unauthenticated caller from exhausting downstream API quotas or
  // creating a flood of participant rows.
  const rl = registerLimiter.check(clientIp(request));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid registration data", details: result.error.issues },
        { status: 400 }
      );
    }

    const { email, password, first_name, last_name, company } = result.data;

    // Step 1: Register participant in haiCore
    // If this fails, we want the whole request to fail immediately. No silent failures.
    const registration = await registerParticipant({
      legal_name: company.name,
      dba_name: company.dba_name,
      business_type: company.business_type,
      tax_id_ein: company.tax_id,
      duns_number: company.duns,
      primary_contact_email: email,
      primary_contact_phone: company.phone,
      primary_contact_name: `${first_name} ${last_name}`.trim(),
      business_address_city: company.address.city,
      business_address_state: company.address.state,
      business_address_country: company.address.country,
      website_url: company.website,
      vendor_description: company.description,
    });

    const participantId = registration.participant_id;
    let keycloakUserId: string | null = null;

    try {
      // Step 2: Create Keycloak user with real participant_id
      keycloakUserId = await createUser({
        email,
        firstName: first_name,
        lastName: last_name,
        password,
        attributes: {
          participant_id: [participantId],
        },
      });

      // Step 3: Create mock Stripe customer
      await createCustomer({
        email,
        name: company.name,
        participantId,
      });

      // Step 4: Authenticate the new user
      const tokens = await authenticateUser(email, password);

      const response = NextResponse.json({
        success: true,
        participant_id: participantId,
      });

      const isProd = process.env.NODE_ENV === "production";

      response.cookies.set("haiwave_session", tokens.access_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: tokens.expires_in,
        path: "/",
      });

      response.cookies.set("haiwave_refresh", tokens.refresh_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: 86400,
        path: "/",
      });

      return response;
    } catch (err) {
      // Rollback Keycloak user if Stripe or Auth fails
      if (keycloakUserId) {
        try {
          await deleteUser(keycloakUserId);
        } catch (rollbackErr) {
          console.error("[register] Failed to rollback Keycloak user:", rollbackErr);
        }
      }
      throw err;
    }
  } catch (err) {
    console.error("[register] Registration error:", err);

    // Provide a dev fallback ONLY in development AND explicitly log the failure
    if (process.env.NODE_ENV === "development") {
      console.warn("Falling back to mock session for development due to the error above.");
      const response = NextResponse.json({ success: true, warning: "dev_fallback_used" });
      response.cookies.set("haiwave_session", "user", {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1800,
        path: "/",
      });
      return response;
    }

    return NextResponse.json(
      { error: "Registration failed. Please check your inputs or try again later." },
      { status: 500 }
    );
  }
}
