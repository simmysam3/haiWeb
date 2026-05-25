"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface DashboardTab {
  /** Stable id; also used as the React key and ARIA wiring suffix. */
  id: string;
  label: string;
  /** Server-rendered section content, passed in as an RSC slot. */
  content: ReactNode;
}

/**
 * v1.41 — the Sonar Dashboard's three surfaces (Coverage / Cross-modality /
 * Activity) used to stack in one long scroll with a sticky anchor sub-nav
 * (`DashboardSubNav`, removed). They are now real tabs: exactly one panel
 * visible at a time.
 *
 * The sections are still rendered server-side and handed in as `content`
 * slots, so switching tabs is instant (no re-fetch) and all three panels
 * ship in the initial RSC payload — we just toggle visibility client-side.
 *
 * Accessibility: a proper WAI-ARIA tablist with roving `tabIndex` and
 * Left/Right/Home/End keyboard navigation; inactive panels carry `hidden`.
 * Visual treatment matches the route-based tabs elsewhere in Sonar
 * (`backlog-tabs.tsx` / `request-management-tabs.tsx`): teal underline on
 * the active tab. The bar scrolls horizontally on narrow screens rather
 * than wrapping.
 */
export function DashboardTabs({ tabs }: { tabs: DashboardTab[] }) {
  const [activeId, setActiveId] = useState<string>(tabs[0]?.id ?? "");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(id: string) {
    setActiveId(id);
    tabRefs.current[id]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    switch (e.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    focusTab(tabs[nextIndex].id);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Dashboard sections"
        data-testid="dashboard-tabs"
        className="flex border-b border-slate/15 mb-6 overflow-x-auto"
      >
        {tabs.map((tab, index) => {
          const isActive = activeId === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              data-active={isActive ? "true" : "false"}
              className={`flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-teal text-navy"
                  : "border-transparent text-slate hover:text-charcoal"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`tabpanel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeId !== tab.id}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
