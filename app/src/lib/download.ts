export interface DownloadColumn<T> {
  key: keyof T & string;
  label: string;
  value?: (row: T) => string | number | null | undefined;
}

export function cellValue<T>(row: T, column: DownloadColumn<T>): string {
  const raw = column.value ? column.value(row) : row[column.key];
  return raw === null || raw === undefined || raw === '' ? '—' : String(raw);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string): string {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv<T>(rows: T[], columns: DownloadColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvField(cellValue(row, c) === '—' ? '' : cellValue(row, c))).join(','),
  );
  return [header, ...lines].join('\r\n');
}

export function downloadCSV<T>(filename: string, rows: T[], columns: DownloadColumn<T>[]): void {
  const csv = buildCsv(rows, columns);
  // BOM no início para o Excel reconhecer acentuação em UTF-8.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export async function downloadPDF<T>(
  filename: string,
  title: string,
  rows: T[],
  columns: DownloadColumn<T>[],
): Promise<void> {
  // Import dinâmico: jsPDF arrasta html2canvas/purify (~340 kB), usados só se alguém clicar em "PDF".
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });

  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(105, 113, 125);
  doc.text(
    `PMetGIRS — Instituto Rio Metrópole · Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    21,
  );

  autoTable(doc, {
    startY: 26,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => cellValue(row, c))),
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 84, 136] },
    alternateRowStyles: { fillColor: [248, 249, 250] },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
