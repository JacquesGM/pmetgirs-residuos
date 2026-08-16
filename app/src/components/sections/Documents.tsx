import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import documentosData from '../../data/documentos.json';
import type { Documento } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { uniqueOptions } from '../../lib/filters';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const documentosEmbutidos = documentosData as Documento[];

const ALL = 'todas';

export function Documents() {
  const [categoriaFiltro, setCategoriaFiltro] = useState(ALL);
  const documentos = useColecaoPublicada<Documento>('documentos', documentosEmbutidos);
  const categoriaOptions = useMemo(() => uniqueOptions(documentos, (d) => d.categoria), [documentos]);

  const filtrados = useMemo(
    () => documentos.filter((doc) => categoriaFiltro === ALL || doc.categoria === categoriaFiltro),
    [documentos, categoriaFiltro],
  );

  return (
    <Section
      headingLevel={1}
      id="documentos"
      title="Documentos oficiais"
      subtitle="Biblioteca de documentos técnicos que fundamentam o PMetGIRS."
    >
      <label className="mb-6 block max-w-xs text-sm">
        <span className="mb-1 block font-medium text-neutral-700">Categoria</span>
        <select
          className="min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
        >
          <option value={ALL}>Todas as categorias</option>
          {categoriaOptions.map((categoria) => (
            <option key={categoria} value={categoria}>
              {categoria}
            </option>
          ))}
        </select>
      </label>

      {filtrados.length === 0 ? (
        <EmptyState message="Nenhum documento encontrado para esta categoria." onClear={() => setCategoriaFiltro(ALL)} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((doc) => (
            <Card key={doc.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <FileText aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-brand-blue-600" />
                <div>
                  <p className="font-semibold text-neutral-900">{doc.titulo}</p>
                  <p className="text-xs text-neutral-500">{doc.categoria} · {doc.ano}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-neutral-600">{doc.descricao}</p>
              <p className="mt-4 text-xs text-neutral-500">
                {doc.orgao} · {doc.formato} {doc.tamanho ?? ''}
                {doc.versao ? ` · v.${doc.versao}` : ''}
              </p>
              <p className="mt-2 text-xs italic text-neutral-500">Link do PDF em breve.</p>
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}
