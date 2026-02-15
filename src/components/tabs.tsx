"use client";

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex border-b border-slate/15 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            active === tab.key
              ? "border-teal text-navy"
              : "border-transparent text-slate hover:text-charcoal"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
              active === tab.key ? "bg-teal/10 text-teal-dark" : "bg-slate/10 text-slate"
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
