import type { ProfileLocation } from "@/lib/haiwave-api";

export interface ProfileData {
  id: string;
  company_name: string;
  status: string;
  business_type: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  phone: string;
  email: string;
  dba: string;
  tax_id: string;
  duns: string;
  website: string;
  description: string;
  /** headquarters location id, carried through so Save updates the same record instead of creating a new one. */
  hqId: string;
  plants: ProfileLocation[];
}

export const EMPTY_PROFILE: ProfileData = {
  id: "",
  company_name: "",
  status: "",
  business_type: "",
  address: { line1: "", line2: "", city: "", state: "", postal_code: "", country: "" },
  phone: "",
  email: "",
  dba: "",
  tax_id: "",
  duns: "",
  website: "",
  description: "",
  hqId: "",
  plants: [],
};

export const EMPTY_PLANT: ProfileLocation = {
  kind: "plant",
  label: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

/** haiCore's real profile body (`buildProfile`, company-search.ts) vs. the console's own shape
 *  (`GET /api/account/profile`'s dev/mock fallback, `MOCK_SESSION.participant`) — both are seen in
 *  practice, so the mapper below accepts either. */
function isHaiCoreProfileBody(body: Record<string, unknown>): boolean {
  return typeof body.legal_name === "string";
}

/** Maps a raw `GET /api/account/profile` body (either shape) into the form's `ProfileData`. */
export function toProfileData(raw: unknown): ProfileData {
  if (!raw || typeof raw !== "object") return EMPTY_PROFILE;
  const body = raw as Record<string, unknown>;

  if (isHaiCoreProfileBody(body)) {
    const locations = Array.isArray(body.locations) ? (body.locations as ProfileLocation[]) : [];
    const hq = locations.find((l) => l.kind === "headquarters");
    const locality = (body.locality as { city?: string; state?: string; country?: string } | undefined) ?? undefined;
    return {
      id: typeof body.participant_id === "string" ? body.participant_id : "",
      company_name: typeof body.legal_name === "string" ? body.legal_name : "",
      status: "",
      business_type: typeof body.business_type === "string" ? body.business_type : "",
      address: {
        line1: hq?.address_line1 ?? "",
        line2: hq?.address_line2 ?? "",
        city: hq?.city ?? locality?.city ?? "",
        state: hq?.state ?? locality?.state ?? "",
        postal_code: hq?.postal_code ?? "",
        country: hq?.country ?? locality?.country ?? "",
      },
      phone: typeof body.primary_contact_phone === "string" ? body.primary_contact_phone : "",
      email: typeof body.primary_contact_email === "string" ? body.primary_contact_email : "",
      dba: typeof body.dba_name === "string" ? body.dba_name : "",
      // haiCore has no column for these — client-side only, never round-tripped.
      tax_id: "",
      duns: "",
      website: typeof body.website_url === "string" ? body.website_url : "",
      description: typeof body.vendor_description === "string" ? body.vendor_description : "",
      hqId: hq?.id ?? "",
      plants: locations.filter((l) => l.kind === "plant"),
    };
  }

  const address = (body.address as Partial<ProfileData["address"]> | undefined) ?? {};
  return {
    id: typeof body.id === "string" ? body.id : "",
    company_name: typeof body.company_name === "string" ? body.company_name : "",
    status: typeof body.status === "string" ? body.status : "",
    business_type: typeof body.business_type === "string" ? body.business_type : "",
    address: {
      line1: address.line1 ?? "",
      line2: address.line2 ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      postal_code: address.postal_code ?? "",
      country: address.country ?? "",
    },
    phone: typeof body.phone === "string" ? body.phone : "",
    email: typeof body.email === "string" ? body.email : "",
    dba: typeof body.dba === "string" ? body.dba : "",
    tax_id: typeof body.tax_id === "string" ? body.tax_id : "",
    duns: typeof body.duns === "string" ? body.duns : "",
    website: typeof body.website === "string" ? body.website : "",
    description: typeof body.description === "string" ? body.description : "",
    hqId: "",
    plants: Array.isArray(body.locations) ? (body.locations as ProfileLocation[]).filter((l) => l.kind === "plant") : [],
  };
}

/** `legal_name` and `business_type` are `.notNull()` columns (haiCore `db/schema/participants.ts`).
 *  A blank input is never a legitimate value for either — however it got blank — so the key is
 *  OMITTED from the PUT rather than sent, regardless of what was loaded: sending `''` would land in
 *  the NOT NULL column as an empty string with no validation error from haiCore. */
function requiredField(body: Record<string, unknown>, key: string, current: string) {
  if (current.trim() === "") return;
  body[key] = current;
}

/** The remaining mapped scalar columns are nullable. Both the current input and the loaded value
 *  being empty means the field was never touched — omit it (haiCore's `updateProfile` writes every
 *  key that is not `undefined`, so an omitted key leaves the column alone; see
 *  registration-service.ts:178-196). A non-empty current value is sent as-is. Otherwise the field HAD
 *  a loaded value and was just cleared — send `null` explicitly, the same encoding a cleared location
 *  field gets (`toLocationPayload`'s `|| null`), never `''`. */
function nullableField(body: Record<string, unknown>, key: string, current: string, loaded: string) {
  const trimmedCurrent = current.trim();
  if (trimmedCurrent === "" && loaded.trim() === "") return;
  body[key] = trimmedCurrent === "" ? null : trimmedCurrent;
}

function toLocationPayload(
  kind: ProfileLocation["kind"],
  id: string | undefined,
  label: string,
  addr: ProfileData["address"],
): ProfileLocation {
  return {
    ...(id ? { id } : {}),
    kind,
    label,
    address_line1: addr.line1 || null,
    address_line2: addr.line2 || null,
    city: addr.city || null,
    state: addr.state || null,
    postal_code: addr.postal_code || null,
    country: addr.country || null,
  };
}

/** Builds the explicit PUT body in haiCore's own field names — the form's own keys (`company_name`,
 *  `address`, `phone`, …) are never sent; haiCore ignores keys it doesn't recognize. */
export function toProfileUpdate(form: ProfileData, loaded: ProfileData): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  requiredField(body, "legal_name", form.company_name);
  requiredField(body, "business_type", form.business_type);
  nullableField(body, "dba_name", form.dba, loaded.dba);
  nullableField(body, "website_url", form.website, loaded.website);
  nullableField(body, "vendor_description", form.description, loaded.description);
  nullableField(body, "primary_contact_email", form.email, loaded.email);
  nullableField(body, "primary_contact_phone", form.phone, loaded.phone);
  nullableField(body, "business_address_city", form.address.city, loaded.address.city);
  nullableField(body, "business_address_state", form.address.state, loaded.address.state);
  nullableField(body, "business_address_country", form.address.country, loaded.address.country);

  const hq = toLocationPayload("headquarters", form.hqId || undefined, "Headquarters", form.address);
  const plants = form.plants.map((p) =>
    toLocationPayload("plant", p.id, p.label, {
      line1: p.address_line1 ?? "",
      line2: p.address_line2 ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
      postal_code: p.postal_code ?? "",
      country: p.country ?? "",
    }),
  );
  body.locations = [hq, ...plants];

  return body;
}
