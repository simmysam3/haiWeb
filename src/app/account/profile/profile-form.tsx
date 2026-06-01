"use client";

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { useApi } from "@/lib/use-api";
import { AliasEditor, type AliasItem } from "@/components/alias-editor";

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

const EMPTY_PROFILE: ProfileData = {
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
};

interface ProfileFormProps {
  readOnly: boolean;
}

export function ProfileForm({ readOnly }: ProfileFormProps) {
  const { data: profile, loading } = useApi<ProfileData>({
    url: "/api/account/profile",
    fallback: EMPTY_PROFILE,
  });

  const [form, setForm] = useState<ProfileData>(profile);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [aliases, setAliases] = useState<AliasItem[]>([]);
  const [aliasError, setAliasError] = useState<string | null>(null);

  // Sync form fields when API data arrives
  useEffect(() => {
    setForm(profile);
  }, [profile]);

  // Load existing aliases once the participant id is known.
  useEffect(() => {
    if (!profile.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/aliases");
        if (!res.ok) return;
        const body = (await res.json()) as AliasItem[];
        if (!cancelled) setAliases(Array.isArray(body) ? body : []);
      } catch {
        /* leave empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  async function addAlias(alias: string) {
    setAliasError(null);
    try {
      const res = await fetch("/api/account/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias }),
      });
      if (res.status === 403) {
        setAliasError("You need account-admin permissions to edit aliases.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rec = (await res.json()) as AliasItem;
      setAliases((prev) =>
        prev.some((a) => a.alias.toLowerCase() === rec.alias.toLowerCase()) ? prev : [...prev, rec],
      );
    } catch {
      setAliasError("Couldn't add that alias. Try again in a moment.");
    }
  }

  async function removeAlias(item: AliasItem) {
    setAliasError(null);
    if (!item.id) {
      setAliases((prev) => prev.filter((a) => a !== item));
      return;
    }
    try {
      const res = await fetch(`/api/account/aliases/${item.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setAliases((prev) => prev.filter((a) => a.id !== item.id));
    } catch {
      setAliasError("Couldn't remove that alias. Try again in a moment.");
    }
  }

  const inputClass = `w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal ${readOnly ? "bg-light-gray cursor-not-allowed" : ""}`;

  function update<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAddress<K extends keyof ProfileData["address"]>(key: K, value: ProfileData["address"][K]) {
    setForm((prev) => ({ ...prev, address: { ...prev.address, [key]: value } }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;

    // Check for sensitive field changes
    if (form.company_name !== profile.company_name || form.tax_id !== profile.tax_id) {
      setConfirmModal(true);
      return;
    }
    doSave();
  }

  async function doSave() {
    setConfirmModal(false);
    setSaveError(null);
    setSaving(true);

    const { id: _id, status: _status, ...payload } = form;
    void _id;
    void _status;

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
              <input type="text" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">DBA Name</label>
              <input type="text" value={form.dba} onChange={(e) => update("dba", e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
          </div>
        </div>

        {/* Business Details */}
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-4">Business Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Business Type</label>
              <select value={form.business_type} onChange={(e) => update("business_type", e.target.value)} className={inputClass} disabled={readOnly}>
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Tax ID / EIN</label>
              <input type="text" value={form.tax_id} onChange={(e) => update("tax_id", e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">DUNS Number</label>
              <input type="text" value={form.duns} onChange={(e) => update("duns", e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Website</label>
              <input type="url" value={form.website} onChange={(e) => update("website", e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-4">Address</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Street Address</label>
              <input type="text" value={form.address.line1} onChange={(e) => updateAddress("line1", e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Address Line 2</label>
              <input type="text" value={form.address.line2} onChange={(e) => updateAddress("line2", e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">City</label>
                <input type="text" value={form.address.city} onChange={(e) => updateAddress("city", e.target.value)} className={inputClass} readOnly={readOnly} />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">State</label>
                <input type="text" value={form.address.state} onChange={(e) => updateAddress("state", e.target.value)} className={inputClass} readOnly={readOnly} />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Postal Code</label>
                <input type="text" value={form.address.postal_code} onChange={(e) => updateAddress("postal_code", e.target.value)} className={inputClass} readOnly={readOnly} />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Country</label>
                <input type="text" value={form.address.country} onChange={(e) => updateAddress("country", e.target.value)} className={inputClass} readOnly={readOnly} />
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
              <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClass} readOnly={readOnly} />
            </div>
          </div>
        </div>

        {/* Network Profile */}
        <div className="bg-white rounded-lg border border-slate/15 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-navy mb-4">Network Profile</h3>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Company Description</label>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} className={`${inputClass} h-24 resize-none`} readOnly={readOnly} />
            <p className="text-xs text-slate mt-1">Shown in the HAIWAVE network directory.</p>
          </div>
          <div className="mt-5">
            <label className="block text-sm font-medium text-charcoal mb-1">Other names &amp; abbreviations</label>
            <p className="text-xs text-slate mb-2">
              Alternate names buyers use to find you in search (e.g. &ldquo;US Steel&rdquo;, &ldquo;USS&rdquo;). Saved
              immediately.
            </p>
            {aliasError && <p className="text-xs text-problem mb-2">{aliasError}</p>}
            <AliasEditor
              aliases={aliases}
              suggestContext={{
                legal_name: form.company_name,
                dba_name: form.dba || undefined,
                website_url: form.website || undefined,
                vendor_description: form.description || undefined,
              }}
              onAdd={addAlias}
              onRemove={removeAlias}
              disabled={readOnly}
            />
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        )}
      </form>

      <Modal open={confirmModal} onClose={() => setConfirmModal(false)} title="Confirm Changes">
        <p className="text-sm text-charcoal mb-4">
          You are changing your <strong>Legal Name</strong> or <strong>Tax ID</strong>. These fields affect your network identity and billing records. Are you sure you want to proceed?
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setConfirmModal(false)}>Cancel</Button>
          <Button onClick={doSave} disabled={saving}>{saving ? "Saving..." : "Confirm Changes"}</Button>
        </div>
      </Modal>
    </>
  );
}
