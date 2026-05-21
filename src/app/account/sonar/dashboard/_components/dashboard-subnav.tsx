"use client";

import { useEffect, useState } from "react";

interface Section {
  id: string;
  label: string;
}

const sections: Section[] = [
  { id: "section-coverage", label: "Coverage" },
  { id: "section-cross-modality", label: "Cross-modality" },
  { id: "section-activity", label: "Activity" },
];

/**
 * v1.37 polish — slim sticky sub-nav for the (now long) Sonar Dashboard.
 *
 * Uses sentinel-based `IntersectionObserver`: each section root carries the
 * `Section.id` so the observer can highlight the link whose corresponding
 * section is currently most-visible in the viewport.
 *
 * Visual treatment: single-row anchor nav (not tab bar) — borrows the
 * teal-on-navy active-state from `posture-tabs.tsx` /
 * `request-management-tabs.tsx` but renders as anchor links since these are
 * in-page jumps rather than route changes.
 */
export function DashboardSubNav() {
  const [activeId, setActiveId] = useState<string>(sections[0].id);

  useEffect(() => {
    // SSR-safe: bail if IntersectionObserver isn't available (Node test
    // env without polyfill — tests inject their own mock).
    if (typeof IntersectionObserver === "undefined") return;

    const observed: Element[] = [];
    // Pick the most-visible currently-intersecting section. When multiple
    // overlap (e.g. while scrolling past a boundary) the one with the
    // largest `intersectionRatio` wins; this matches user intuition
    // ("I'm reading this section right now").
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // Bias the active band to the upper-middle of the viewport so the
        // highlight tracks where the user's eye lands as they scroll, not
        // the bottom edge of the viewport.
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) {
        observer.observe(el);
        observed.push(el);
      }
    }

    return () => {
      for (const el of observed) observer.unobserve(el);
      observer.disconnect();
    };
  }, []);

  return (
    <nav
      aria-label="Dashboard sections"
      data-testid="dashboard-subnav"
      // `top-0` pins below any browser chrome; the account portal has no
      // fixed top header above the page content, so 0 is correct here.
      //
      // v.1.37 mobile pass: on small screens the row uses `overflow-x-auto`
      // with `whitespace-nowrap` on each link, so when the bar is too narrow
      // for all three labels it horizontally scrolls instead of wrapping
      // (which would push the page content down on every dashboard load).
      // Touch-target height ≥44px via `py-2.5` on mobile; tighter `py-2` on
      // ≥md to preserve the slim desktop chrome.
      className="sticky top-0 z-10 -mx-4 mb-2 flex gap-1 overflow-x-auto border-b border-slate/15 bg-white/95 px-4 py-2.5 backdrop-blur md:-mx-6 md:px-6 md:py-2"
    >
      {sections.map((s) => {
        const isActive = activeId === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            data-active={isActive ? "true" : "false"}
            className={`flex-shrink-0 whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors md:py-1 ${
              isActive
                ? "bg-teal/10 text-navy"
                : "text-slate hover:text-charcoal"
            }`}
          >
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}
