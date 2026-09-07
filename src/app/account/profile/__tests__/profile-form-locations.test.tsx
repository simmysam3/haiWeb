import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ProfileForm } from "../profile-form";

function mockFetchImpl(profileBody: unknown) {
  return vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u === "/api/account/aliases") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    }
    if (u === "/api/account/profile" && init?.method === "PUT") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    }
    if (u === "/api/account/profile") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(profileBody) } as Response);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
  });
}

function putCall(fetchMock: ReturnType<typeof mockFetchImpl>) {
  const call = fetchMock.mock.calls.find(
    ([u, init]) => String(u) === "/api/account/profile" && (init as RequestInit | undefined)?.method === "PUT",
  );
  if (!call) throw new Error("no PUT call recorded");
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string);
}

const PROFILE_WITH_PLANT = {
  participant_id: "P1",
  legal_name: "Acme Corporation",
  business_type: "Corporation",
  website_url: "https://acme.example",
  primary_contact_email: "ap@acme.example",
  locations: [
    {
      id: "L1",
      kind: "headquarters",
      label: "Headquarters",
      address_line1: "1 Main St",
      city: "Akron",
      state: "OH",
      postal_code: "44301",
      country: "US",
    },
    {
      id: "L2",
      kind: "plant",
      label: "East Plant",
      address_line1: "2 Second St",
      city: "Canton",
      state: "OH",
      postal_code: "44702",
      country: "US",
    },
  ],
};

const PROFILE_NO_LOCATIONS = {
  participant_id: "P2",
  legal_name: "No Locations Inc",
  business_type: "LLC",
};

const PROFILE_ROUND_TRIP = {
  participant_id: "P1",
  legal_name: "Acme Corporation",
  business_type: "Corporation",
  website_url: "https://acme.example",
  primary_contact_email: "ap@acme.example",
  locations: [
    { id: "L1", kind: "headquarters", label: "Headquarters", address_line1: "1 Main St", city: "Akron" },
  ],
};

const PROFILE_DEV_SHIM = {
  id: "8b7ecca6-b704-4d2b-896c-801898135fdf",
  company_name: "Apex Manufacturing",
  status: "active",
  business_type: "Corporation",
  address: { line1: "612 N Fancher Rd", line2: "", city: "Spokane", state: "WA", postal_code: "99212", country: "US" },
  phone: "+1 (509) 924-2662",
  email: "info@lyntron.com",
  dba: "",
  tax_id: "",
  duns: "",
  website: "www.lyntron.com",
  description: "Precision electronic hardware manufacturer.",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfileForm locations", () => {
  it("renders the headquarters block + one plant card per plant; Add plant appends, Remove drops; Save PUTs locations HQ-first", async () => {
    const fetchMock = mockFetchImpl(PROFILE_WITH_PLANT);
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileForm readOnly={false} />);

    await waitFor(() => expect(screen.getByDisplayValue("Acme Corporation")).toBeInTheDocument());

    // headquarters location mapped into the (unchanged) address block
    expect(screen.getByDisplayValue("1 Main St")).toBeInTheDocument();

    // one plant card for the loaded plant
    const plantCard = screen.getByTestId("plant-location-0");
    expect(within(plantCard).getByDisplayValue("East Plant")).toBeInTheDocument();
    expect(within(plantCard).getByDisplayValue("2 Second St")).toBeInTheDocument();

    // Add plant appends an empty row
    fireEvent.click(screen.getByRole("button", { name: "Add plant" }));
    expect(screen.getByTestId("plant-location-1")).toBeInTheDocument();

    // Remove drops the first plant
    fireEvent.click(within(plantCard).getByRole("button", { name: "Remove" }));
    expect(screen.queryByDisplayValue("East Plant")).toBeNull();

    // fill in the label of the now-only (newly added) plant, which is required
    const remainingCard = screen.getByTestId("plant-location-0");
    fireEvent.change(within(remainingCard).getByLabelText(/label/i), { target: { value: "New Plant" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => putCall(fetchMock));

    const body = putCall(fetchMock);
    expect(body.legal_name).toBe("Acme Corporation");
    expect(body.business_address_city).toBe("Akron");
    expect(body.locations).toHaveLength(2);
    expect(body.locations[0].kind).toBe("headquarters");
    expect(body.locations[1].kind).toBe("plant");
    expect(body.locations[1].label).toBe("New Plant");
  });

  it("a profile with no locations renders an empty HQ block and no plants, and Save still sends one headquarters", async () => {
    const fetchMock = mockFetchImpl(PROFILE_NO_LOCATIONS);
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileForm readOnly={false} />);

    await waitFor(() => expect(screen.getByDisplayValue("No Locations Inc")).toBeInTheDocument());

    expect(screen.queryByTestId("plant-location-0")).toBeNull();
    expect(screen.getByText(/no plant locations added yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => putCall(fetchMock));

    const body = putCall(fetchMock);
    expect(body.locations).toHaveLength(1);
    expect(body.locations[0].kind).toBe("headquarters");
    expect(body.locations[0].label).toBe("Headquarters");
  });

  it("THE ROUND-TRIP PIN: haiCore's real shape loads correctly and an unedited Save never wipes legal_name/website_url", async () => {
    const fetchMock = mockFetchImpl(PROFILE_ROUND_TRIP);
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileForm readOnly={false} />);

    await waitFor(() => expect(screen.getByDisplayValue("Acme Corporation")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => putCall(fetchMock));

    const body = putCall(fetchMock);
    expect(body.legal_name).toBe("Acme Corporation"); // never '' — the load must have mapped it
    expect(body.website_url).toBe("https://acme.example"); // present control: an untouched field survives
    expect(body.locations).toHaveLength(1);
    // the omit-empty rule: dba_name/vendor_description were never present in the loaded body and were
    // never edited, so they must be OMITTED from the PUT body, never sent as ''.
    expect(body).not.toHaveProperty("dba_name");
    expect(body).not.toHaveProperty("vendor_description");
  });

  it("the dev-shim / mock shape still loads company_name into the input (present control)", async () => {
    const fetchMock = mockFetchImpl(PROFILE_DEV_SHIM);
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileForm readOnly={false} />);

    await waitFor(() => expect(screen.getByDisplayValue("Apex Manufacturing")).toBeInTheDocument());
  });

  it("read-only mode disables the plant inputs and buttons", async () => {
    const fetchMock = mockFetchImpl(PROFILE_WITH_PLANT);
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileForm readOnly={true} />);

    await waitFor(() => expect(screen.getByDisplayValue("Acme Corporation")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Add plant" })).toBeDisabled();
    const plantCard = screen.getByTestId("plant-location-0");
    expect(within(plantCard).getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(within(plantCard).getByLabelText(/label/i)).toHaveAttribute("readonly");
  });
});
