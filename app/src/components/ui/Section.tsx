import type { ReactNode } from 'react';

export function Section({
  id,
  title,
  subtitle,
  children,
  tone = 'default',
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  tone?: 'default' | 'muted';
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={`scroll-mt-28 px-4 py-14 sm:px-6 lg:px-8 ${tone === 'muted' ? 'bg-neutral-50' : 'bg-white'}`}
    >
      <div className="mx-auto max-w-6xl">
        <h2 id={headingId} className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          {title}
        </h2>
        {subtitle && <p className="mt-2 max-w-3xl text-neutral-600">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
