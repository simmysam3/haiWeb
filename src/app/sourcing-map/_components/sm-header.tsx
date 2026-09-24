'use client';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from './theme-root';

export interface SmCrumb {
  label: string;
  href?: string;
}

/** App header (spec §9.1): reversed logo, title, breadcrumb, page actions, theme toggle, Console. */
export function SmHeader({ crumbs, actions }: { crumbs: SmCrumb[]; actions?: ReactNode }) {
  return (
    <header className="sm-header flex flex-wrap items-center gap-4 px-6 py-3">
      <Link href="/sourcing-map" className="flex items-center gap-3">
        <Image src="/img/haiwave-logo-reversed.svg" alt="HAIWAVE" width={132} height={32} unoptimized priority />
        <span className="font-[family-name:var(--font-display)] text-base font-semibold">Sourcing Map</span>
      </Link>
      <div className="ml-auto flex items-center gap-3">
        {actions}
        <ThemeToggle />
        <Link href="/account" className="sm-btn sm-btn-ghost text-sm">
          Console
        </Link>
      </div>
    </header>
  );
}
