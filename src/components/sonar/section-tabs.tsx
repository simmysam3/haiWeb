'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface SectionTab {
  /** Stable id; also used as the React key and ARIA wiring suffix. */
  id: string;
  label: string;
  /** Section content, typically a server-rendered slot. */
  content: ReactNode;
}

interface Props {
  tabs: SectionTab[];
  /** Accessible name for the tablist, e.g. "Watcher sections". */
  ariaLabel: string;
  /**
   * Tab selected on first render. Falls back to the first tab when omitted
   * or when no tab carries this id (a stale or mistyped deep link).
   */
  initialId?: string;
  /** Called with the new tab id whenever the selection changes. */
  onChange?: (id: string) => void;
  /** Optional data-testid for the tablist element. */
  testId?: string;
}

/**
 * v1.85 — accessible section tabs, promoted from the Sonar dashboard so the
 * watcher definition page can split Run history from Configuration.
 *
 * All panels are rendered up front and toggled with `hidden`, so switching is
 * instant and server-rendered slots ship in one RSC payload. A proper
 * WAI-ARIA tablist: roving `tabIndex`, Left/Right/Home/End keyboard
 * navigation, `aria-controls`/`aria-labelledby` wiring. The bar scrolls
 * horizontally on narrow screens rather than wrapping.
 */
export function SectionTabs({ tabs, ariaLabel, initialId, onChange, testId }: Props) {
  const [activeId, setActiveId] = useState<string>(() =>
    initialId !== undefined && tabs.some((t) => t.id === initialId)
      ? initialId
      : (tabs[0]?.id ?? ''),
  );
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    onChange?.(id);
  }

  function focusTab(id: string) {
    select(id);
    tabRefs.current[id]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
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
        aria-label={ariaLabel}
        data-testid={testId}
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
              onClick={() => select(tab.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              data-active={isActive ? 'true' : 'false'}
              className={`flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-teal text-navy'
                  : 'border-transparent text-slate hover:text-charcoal'
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
