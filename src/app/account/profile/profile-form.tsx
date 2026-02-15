"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { MOCK_SESSION } from "@/lib/mock-data";

const BUSINESS_TYPES = ["Corporation", "LLC", "Partnership", "Sole Proprietorship", "Government", "Nonprofit"];

interface ProfileFormProps {
  readOnly: boolean;
}

export function ProfileForm({ readOnly }: ProfileFormProps) {
  const p = MOCK_SESSION.participant;

  const [companyName, setCompanyName] = useState(p.company_name);
  const [businessType, setBusinessType] = useState(p.business_type);
  const [address1, setAddress1] = useState(p.address.line1);
  const [address2, setAddress2] = useState(p.address.line2);
  const [city, setCity] = useState(p.address.city);
  const [state, setState] = useState(p.address.state);
  const [postalCode, setPostalCode] = useState(p.address.postal_code);
  const [country, setCountry] = useState(p.address.country);
  const [phone, setPhone] = useState(p.phone);
  const [email, setEmail] = useState(p.email);
  const [dba, setDba] = useState(p.dba);
  const [taxId, setTaxId] = useState(p.tax_id);
  const [duns, setDuns] = useState(p.duns);
  const [website, setWebsite] = useState(p.website);
  const [description, setDescription] = useState(p.description);
  const [saved, setSaved] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  const inputClass = `w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal ${readOnly ? "bg-light-gray cursor-not-allowed" : ""}`;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;

    // Check for sensitive field changes
    if (companyName !== p.company_name || taxId !== p.tax_id) {
      setConfirmModal(true);
      setPendingSubmit(true);
      return;
    }
    doSave();
  }

  function doSave() {
    setSaved(true);
    setConfirmModal(false);
    setPendingSubmit(false);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        {saved && (
          <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success">
            Profile saved successfully.
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
            <Button type="submit">Save Changes</Button>
          </div>
        )}
      </form>

      <Modal open={confirmModal} onClose={() => { setConfirmModal(false); setPendingSubmit(false); }} title="Confirm Changes">
        <p className="text-sm text-charcoal mb-4">
          You are changing your <strong>Legal Name</strong> or <strong>Tax ID</strong>. These fields affect your network identity and billing records. Are you sure you want to proceed?
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => { setConfirmModal(false); setPendingSubmit(false); }}>Cancel</Button>
          <Button onClick={doSave}>Confirm Changes</Button>
        </div>
      </Modal>
    </>
  );
}
