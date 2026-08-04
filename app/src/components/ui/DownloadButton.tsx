import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { downloadCSV, downloadPDF, type DownloadColumn } from '../../lib/download';

interface DownloadButtonProps<T> {
  filename: string;
  title: string;
  data: T[];
  columns: DownloadColumn<T>[];
}

export function DownloadButton<T>({ filename, title, data, columns }: DownloadButtonProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        Baixar dados
        <ChevronDown aria-hidden="true" className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              downloadCSV(filename, data, columns);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />
            Planilha (CSV)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void downloadPDF(filename, title, data, columns);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <FileText aria-hidden="true" className="h-4 w-4" />
            Documento (PDF)
          </button>
        </div>
      )}
    </div>
  );
}
