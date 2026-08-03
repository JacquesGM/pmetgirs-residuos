import { Download } from 'lucide-react';
import { downloadJSON } from '../../lib/download';

export function DownloadButton({ filename, data, label = 'Baixar dados (JSON)' }: { filename: string; data: unknown; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => downloadJSON(filename, data)}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
    >
      <Download aria-hidden="true" className="h-4 w-4" />
      {label}
    </button>
  );
}
