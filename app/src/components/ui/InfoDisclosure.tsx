import type { ReactNode } from 'react';

export function InfoDisclosure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group mt-3 text-sm">
      <summary className="cursor-pointer list-none font-medium text-brand-blue-600 underline-offset-2 hover:underline focus-visible:underline">
        {label}
      </summary>
      <div className="mt-2 text-neutral-600">{children}</div>
    </details>
  );
}
