"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ProgressSteps } from "@/components/progress-steps";

const STEPS = ["Create Account", "Company Profile", "Platform Fee"];

const BUSINESS_TYPES = [
  "Corporation",
  "LLC",
  "Partnership",
  "Sole Proprietorship",
  "Government",
  "Nonprofit",
];

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-problem" };
  if (score <= 3) return { score, label: "Fair", color: "bg-warning" };
  if (score <= 4) return { score, label: "Good", color: "bg-teal" };
  return { score, label: "Strong", color: "bg-success" };
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 fields
  const [companyName, setCompanyName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("US");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [dba, setDba] = useState("");
  const [taxId, setTaxId] = useState("");
  const [duns, setDuns] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  // Step 3
  const [paymentMethod, setPaymentMethod] = useState<"pay_now" | "invoice">("pay_now");

  const strength = passwordStrength(password);

  function validateStep1(): string | null {
    if (!firstName.trim()) return "First name is required";
    if (!lastName.trim()) return "Last name is required";
    if (!email.trim()) return "Email is required";
    if (!password) return "Password is required";
    if (password.length < 12) return "Password must be at least 12 characters";
    if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
    if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain a digit";
    if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain a special character";
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
  }

  function validateStep2(): string | null {
    if (!companyName.trim()) return "Legal company name is required";
    if (!businessType) return "Business type is required";
    if (!address1.trim()) return "Street address is required";
    if (!city.trim()) return "City is required";
    if (!state.trim()) return "State is required";
    if (!postalCode.trim()) return "Postal code is required";
    if (!companyPhone.trim()) return "Company phone is required";
    if (!companyEmail.trim()) return "Company email is required";
    return null;
  }

  async function handleStep1(e: FormEvent) {
    e.preventDefault();
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError("");
    setStep(1);
  }

  async function handleStep2(e: FormEvent) {
    e.preventDefault();
    const err = validateStep2();
    if (err) { setError(err); return; }
    setError("");
    setStep(2);
  }

  async function handleStep3(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          job_title: jobTitle,
          phone,
          password,
          company: {
            name: companyName,
            business_type: businessType,
            address: { line1: address1, line2: address2, city, state, postal_code: postalCode, country },
            phone: companyPhone,
            email: companyEmail,
            dba, tax_id: taxId, duns, website, description,
          },
          payment_method: paymentMethod,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/account");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal";

  return (
    <div className="min-h-screen bg-light-gray flex items-center justify-center py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-4">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy">
            Join the HAIWAVE Network
          </h1>
        </div>

        <ProgressSteps steps={STEPS} current={step} />

        <div className="bg-white rounded-xl border border-slate/15 p-8">
          {error && (
            <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Create Account */}
          {step === 0 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">First Name *</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Last Name *</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@company.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Job Title</label>
                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Password *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength.score ? strength.color : "bg-slate/15"}`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate">{strength.label}</p>
                  </div>
                )}
                <p className="text-xs text-slate mt-1">
                  Min 12 characters, uppercase, lowercase, digit, and special character required.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Confirm Password *</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} required />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-problem mt-1">Passwords do not match</p>
                )}
              </div>
              <button type="submit" className="w-full bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-charcoal transition-colors">
                Continue
              </button>
            </form>
          )}

          {/* Step 2: Company Profile */}
          {step === 1 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Legal Company Name *</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Business Type *</label>
                <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputClass} required>
                  <option value="">Select...</option>
                  {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Street Address *</label>
                <input type="text" value={address1} onChange={(e) => setAddress1(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Address Line 2</label>
                <input type="text" value={address2} onChange={(e) => setAddress2(e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">City *</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">State / Province *</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Postal Code *</label>
                  <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Country</label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Company Phone *</label>
                  <input type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-1">Company Email *</label>
                  <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className={inputClass} required />
                </div>
              </div>

              <div className="border-t border-slate/15 pt-4 mt-4">
                <p className="text-xs font-medium text-slate uppercase tracking-wider mb-3">Optional</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-charcoal mb-1">DBA Name</label>
                      <input type="text" value={dba} onChange={(e) => setDba(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-charcoal mb-1">Tax ID / EIN</label>
                      <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-charcoal mb-1">DUNS Number</label>
                      <input type="text" value={duns} onChange={(e) => setDuns(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-charcoal mb-1">Website</label>
                      <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.example.com" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-1">Company Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} h-20 resize-none`} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(0)} className="flex-1 bg-white text-charcoal border border-slate/20 text-sm font-medium py-2.5 rounded-lg hover:bg-light-gray transition-colors">
                  Back
                </button>
                <button type="submit" className="flex-1 bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-charcoal transition-colors">
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Platform Fee */}
          {step === 2 && (
            <form onSubmit={handleStep3} className="space-y-6">
              <div className="text-center py-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate mb-2">Annual Platform Fee</p>
                <p className="text-4xl font-bold text-navy">$10,000<span className="text-lg text-slate font-normal">/year</span></p>
                <p className="text-sm text-slate mt-2">
                  Includes network access, agent provisioning, and manifest exchange.
                  Connection fees billed separately per trading pair.
                </p>
              </div>

              <div className="space-y-3">
                <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "pay_now" ? "border-teal bg-teal/5" : "border-slate/20 hover:border-slate/40"}`}>
                  <input type="radio" name="payment" value="pay_now" checked={paymentMethod === "pay_now"} onChange={() => setPaymentMethod("pay_now")} className="accent-teal" />
                  <div>
                    <p className="text-sm font-medium text-charcoal">Pay Now</p>
                    <p className="text-xs text-slate">Immediate activation via credit card or ACH</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "invoice" ? "border-teal bg-teal/5" : "border-slate/20 hover:border-slate/40"}`}>
                  <input type="radio" name="payment" value="invoice" checked={paymentMethod === "invoice"} onChange={() => setPaymentMethod("invoice")} className="accent-teal" />
                  <div>
                    <p className="text-sm font-medium text-charcoal">Invoice (Net-30)</p>
                    <p className="text-xs text-slate">Account activated in pending state until payment clears</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 bg-white text-charcoal border border-slate/20 text-sm font-medium py-2.5 rounded-lg hover:bg-light-gray transition-colors">
                  Back
                </button>
                <button type="submit" disabled={loading} className="flex-1 bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-charcoal transition-colors disabled:opacity-50">
                  {loading ? "Processing..." : paymentMethod === "pay_now" ? "Pay & Activate" : "Submit & Send Invoice"}
                </button>
              </div>
            </form>
          )}

          {step === 0 && (
            <div className="mt-6 text-center text-sm text-slate">
              Already have an account?{" "}
              <Link href="/login" className="text-teal-dark hover:underline">
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
