import type { ReactNode } from 'react';

interface PageIntroProps {
  children: ReactNode;
}

export function PageIntro({ children }: PageIntroProps) {
  return (
    <p className="italic text-slate text-sm leading-relaxed max-w-3xl mb-6 -mt-2">
      {children}
    </p>
  );
}
