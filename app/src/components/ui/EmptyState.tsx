import { SearchX } from 'lucide-react';

export function EmptyState({ message, onClear }: { message: string; onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
      <SearchX aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <p className="text-center text-neutral-600">{message}</p>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
