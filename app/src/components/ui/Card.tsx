import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
