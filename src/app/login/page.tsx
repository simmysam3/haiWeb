"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LAST_ACCOUNT_PATH_KEY } from "@/components/last-path-recorder";

/**
 * Read the stored last-visited account path and validate it. Anything that
 * doesn't start with `/account` is rejected so a tampered localStorage value
 * can't redirect the user to an external origin or to a non-account surface.
 */
function readStickyRedirectTarget(): string {
  if (typeof window === "undefined") return "/account";
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LAST_ACCOUNT_PATH_KEY);
  } catch {
    return "/account";
  }
  if (!stored) return "/account";
  // Must be an in-portal path under /account. Reject schemes, protocol-relative
  // URLs (`//evil.com`), and anything that doesn't start with /account.
  if (!stored.startsWith("/account")) return "/account";
  if (stored.startsWith("//")) return "/account";
  return stored;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Read from the live form, not React state: browser autofill populates the
    // DOM value without firing a React-tracked change event, so state can still
    // be empty here on the first submit.
    const formData = new FormData(e.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "");
    const submittedPassword = String(formData.get("password") ?? "");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail, password: submittedPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      router.push(readStickyRedirectTarget());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-light-gray flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy">
            Sign in to HAIWAVE
          </h1>
          <p className="text-sm text-slate mt-2">Access your account portal</p>
        </div>

        <div className="bg-white rounded-xl border border-slate/15 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-charcoal transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-teal-dark hover:underline">
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
