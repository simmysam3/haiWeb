import { render, screen, waitFor } from "@testing-library/react";
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

// haiCore's own body shape (isHaiCoreProfileBody: typeof legal_name === "string") — tax_id and duns
// have no source field on this shape at all; primary_contact_phone is the present control.
const PROFILE_HAICORE_SHAPE = {
  participant_id: "P1",
  legal_name: "Acme Corporation",
  business_type: "Corporation",
  primary_contact_phone: "+1 555 0100",
};

const CAPTION =
  "Not saved from this form — HAIWAVE does not show this value back, so it cannot be edited here.";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfileForm unbacked keys", () => {
  it("tax_id and duns render as disabled, captioned, non-editable — phone stays a fully editable input", async () => {
    const fetchMock = mockFetchImpl(PROFILE_HAICORE_SHAPE);
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileForm readOnly={false} />);

    await waitFor(() => expect(screen.getByDisplayValue("Acme Corporation")).toBeInTheDocument());

    const taxIdInput = screen.getByLabelText(/tax id/i);
    expect(taxIdInput).toBeDisabled();
    expect(taxIdInput.parentElement).toHaveTextContent(CAPTION);

    const dunsInput = screen.getByLabelText(/duns/i);
    expect(dunsInput).toBeDisabled();
    expect(dunsInput.parentElement).toHaveTextContent(CAPTION);

    // present control: phone is backed by primary_contact_phone and stays fully editable
    const phoneInput = screen.getByDisplayValue("+1 555 0100");
    expect(phoneInput).not.toBeDisabled();
    expect(phoneInput).not.toHaveAttribute("readonly");
  });
});
