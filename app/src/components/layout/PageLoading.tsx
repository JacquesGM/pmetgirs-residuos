import { Loader2 } from 'lucide-react';

export function PageLoading({ label = 'Carregando conteúdo...' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-neutral-500">
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-brand-blue-500" />
      <p className="text-center">{label}</p>
    </div>
  );
}
