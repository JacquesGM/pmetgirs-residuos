import { type ReactNode } from 'react';

export interface ChartTable {
  columns: string[];
  rows: Array<Array<string | number>>;
}

interface ChartFigureProps {
  /** Título visível do gráfico. Vira a legenda da figura. */
  title: string;
  /**
   * Frase completa anunciada por leitores de tela no lugar do SVG.
   * O Recharts gera dezenas de nós sem significado; o resumo textual
   * substitui esse ruído e a tabela abaixo entrega os números exatos.
   */
  description: string;
  /** Equivalente textual obrigatório: mesmos dados do gráfico, em tabela. */
  table: ChartTable;
  height: number | string;
  /** Texto explicativo exibido entre o título e o gráfico. */
  intro?: ReactNode;
  /** Fonte e observações, exibidas abaixo da tabela. */
  note?: ReactNode;
  children: ReactNode;
}

export function ChartFigure({
  title,
  description,
  table,
  height,
  intro,
  note,
  children,
}: ChartFigureProps) {
  return (
    <figure className="m-0">
      <figcaption className="text-sm font-semibold text-neutral-900">{title}</figcaption>
      {intro}
      <div role="img" aria-label={description} style={{ height }} className="mt-3">
        {children}
      </div>

      <details className="mt-3 rounded-md border border-neutral-200 bg-neutral-50">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-brand-blue-700">
          Ver os dados em tabela
        </summary>
        <div className="overflow-x-auto border-t border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">{description}</caption>
            <thead>
              <tr>
                {table.columns.map((column, index) => (
                  <th
                    key={column}
                    scope="col"
                    className={`border-b border-neutral-200 px-3 py-2 font-semibold text-neutral-700 ${
                      index === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={String(row[0])}>
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th
                        key={index}
                        scope="row"
                        className="border-b border-neutral-100 px-3 py-2 text-left font-medium text-neutral-800"
                      >
                        {cell}
                      </th>
                    ) : (
                      <td
                        key={index}
                        className="border-b border-neutral-100 px-3 py-2 text-right tabular-nums text-neutral-700"
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {note && <p className="mt-2 text-xs text-neutral-500">{note}</p>}
    </figure>
  );
}
