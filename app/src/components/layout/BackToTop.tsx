import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

function prefereReduzirMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: prefereReduzirMovimento() ? 'auto' : 'smooth' });
        document.getElementById('hero-titulo')?.focus({ preventScroll: true });
      }}
      aria-label="Voltar ao topo"
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-700 text-white shadow-lg hover:bg-brand-blue-900"
    >
      <ArrowUp aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
