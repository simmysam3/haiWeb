"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LAST_ACCOUNT_PATH_KEY } from "@/components/last-path-recorder";

function readStickyNext(): string {
  if (typeof window === "undefined") return "/account";
  let stored: string | null = null;
  try { stored = window.localStorage.getItem(LAST_ACCOUNT_PATH_KEY); } catch { return "/account"; }
  if (!stored || !stored.startsWith("/account") || stored.startsWith("//")) return "/account";
  return stored;
}

export default function LoginPage() {
  const [href, setHref] = useState("/api/auth/login");
  useEffect(() => {
    setHref(`/api/auth/login?next=${encodeURIComponent(readStickyNext())}`);
  }, []);

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
          <a
            href={href}
            className="block w-full text-center bg-navy text-white text-sm font-medium py-2.5 rounded-lg hover:bg-charcoal transition-colors"
          >
            Sign In
          </a>
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
