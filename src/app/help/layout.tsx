import { ReactNode } from 'react';

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto p-8">{children}</div>
    </div>
  );
}
