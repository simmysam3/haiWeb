"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { href: "/why-free-agent", label: "Why Free Agent" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/deployment-guide", label: "Deployment Guide" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-md border-b border-navy/6">
      <div className="max-w-[1200px] mx-auto px-10 flex items-center justify-between h-[72px]">
        <Link href="/">
          <Image
            src="/img/haiwave-logo.png"
            alt="hAIWave"
            width={120}
            height={36}
            className="h-9 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? "text-navy font-bold"
                  : "text-slate hover:text-navy"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="text-sm text-slate hover:text-navy transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium text-white bg-navy px-5 py-2 rounded-md hover:bg-charcoal transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className="block w-6 h-0.5 bg-navy mb-[5px]" />
          <span className="block w-6 h-0.5 bg-navy mb-[5px]" />
          <span className="block w-6 h-0.5 bg-navy" />
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-slate/15 px-10 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? "text-navy font-bold"
                  : "text-slate hover:text-navy"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="text-sm text-slate hover:text-navy transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            onClick={() => setMobileOpen(false)}
            className="text-sm font-medium text-white bg-navy px-5 py-2 rounded-md hover:bg-charcoal transition-colors text-center"
          >
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
}
