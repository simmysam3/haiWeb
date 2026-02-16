"use client";

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { MOCK_SESSION } from "@/lib/mock-data";
import { useApi } from "@/lib/use-api";

const BUSINESS_TYPES = ["Corporation", "LLC", "Partnership", "Sole Proprietorship", "Government", "Nonprofit"];

interface ProfileData {
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
}

interface ProfileFormProps {
  readOnly: boolean;
}

export function ProfileForm({ readOnly }: ProfileFormProps) {
  const { data: profile, loading } = useApi<ProfileData>({
    url: "/api/account/profile",
    fallback: MOCK_SESSION.participant,
  });

  const [companyName, setCompanyName] = useState(profile.company_name);
  const [businessType, setBusinessType] = useState(profile.business_type);
  const [address1, setAddress1] = useState(profile.address.line1);
  const [address2, setAddress2] = useState(profile.address.line2);
  const [city, setCity] = useState(profile.address.city);
  const [state, setState] = useState(profile.address.state);
  const [postalCode, setPostalCode] = useState(profile.address.postal_code);
  const [country, setCountry] = useState(profile.address.country);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [dba, setDba] = useState(profile.dba);
  const [taxId, setTaxId] = useState(profile.tax_id);
  const [duns, setDuns] = useState(profile.duns);
  const [website, setWebsite] = useState(profile.website);
  const [description, setDescription] = useState(profile.description);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Sync form fields when API data arrives
  useEffect(() => {
    setCompanyName(profile.company_name);
    setBusinessType(profile.business_type);
    setAddress1(profile.address.line1);
    setAddress2(profile.address.line2);
    setCity(profile.address.city);
    setState(profile.address.state);
    setPostalCode(profile.address.postal_code);
    setCountry(profile.address.country);
    setPhone(profile.phone);
    setEmail(profile.email);
    setDba(profile.dba);
    setTaxId(profile.tax_id);
    setDuns(profile.duns);
    setWebsite(profile.website);
    setDescription(profile.description);
  }, [profile]);

  const inputClass = `w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal ${readOnly ? "bg-light-gray cursor-not-allowed" : ""}`;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;

    // Check for sensitive field changes
    if (companyName !== profile.company_name || taxId !== profile.tax_id) {
      setConfirmModal(true);
      setPendingSubmit(true);
      return;
    }
    doSave();
  }

  async function doSave() {
    setConfirmModal(false);
    setPendingSubmit(false);
    setSaveError(null);
    setSaving(true);

    const payload: Omit<ProfileData, "id" | "status"> = {
      company_name: companyName,
      business_type: businessType,
      address: {
        line1: address1,
        line2: address2,
        city,
        state,
        postal_code: postalCode,
        country,
      },
      phone,
      email,
      dba,
      tax_id: taxId,
      duns,
      website,
      description,
    };

    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-slate">Loading profile...</div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        {saved && (
          <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success">
            Profile saved successfully.
          </div>
        )}

        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        {/* Identity */}
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-4">Identity</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Legal Company Name</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">DBA Name</label>
              <input type="text" value={dba} onChange={(e) => setDba(e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
          </div>
        </div>

        {/* Business Details */}
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-4">Business Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Business Type</label>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputClass} disabled={readOnly}>
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Tax ID / EIN</label>
              <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">DUNS Number</label>
              <input type="text" value={duns} onChange={(e) => setDuns(e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Website</label>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-4">Address</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Street Address</label>
              <input type="text" value={address1} onChange={(e) => setAddress1(e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Address Line 2</label>
              <input type="text" value={address2} onChange={(e) => setAddress2(e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} readOnly={readOnly} />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">State</label>
                <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} readOnly={readOnly} />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Postal Code</label>
                <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} readOnly={readOnly} />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Country</label>
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} readOnly={readOnly} />
              </div>
            </div>
          </div>
        </div>

        {/* Contacts */}
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-4">Contacts</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
          </div>
        </div>

        {/* Network Profile */}
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-4">Network Profile</h3>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Company Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} h-24 resize-none`} readOnly={readOnly} />
            <p className="text-xs text-slate mt-1">Shown in the HAIWAVE network directory.</p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        )}
      </form>

      <Modal open={confirmModal} onClose={() => { setConfirmModal(false); setPendingSubmit(false); }} title="Confirm Changes">
        <p className="text-sm text-charcoal mb-4">
          You are changing your <strong>Legal Name</strong> or <strong>Tax ID</strong>. These fields affect your network identity and billing records. Are you sure you want to proceed?
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => { setConfirmModal(false); setPendingSubmit(false); }}>Cancel</Button>
          <Button onClick={doSave} disabled={saving}>{saving ? "Saving..." : "Confirm Changes"}</Button>
        </div>
      </Modal>
    </>
  );
}
