import type { ReactNode } from 'react';

export function Section({
  id,
  title,
  subtitle,
  children,
  tone = 'default',
  headingLevel = 2,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  tone?: 'default' | 'muted';
  /**
   * Cada rota precisa de exatamente um h1. A seção principal de cada página
   * recebe headingLevel={1}; as demais seções da mesma página ficam em h2.
   */
  headingLevel?: 1 | 2;
}) {
  const headingId = `${id}-heading`;
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={`scroll-mt-28 px-4 py-14 sm:px-6 lg:px-8 ${tone === 'muted' ? 'bg-neutral-50' : 'bg-white'}`}
    >
      <div className="mx-auto max-w-6xl">
        <Heading id={headingId} className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          {title}
        </Heading>
        {subtitle && <p className="mt-2 max-w-3xl text-neutral-600">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
