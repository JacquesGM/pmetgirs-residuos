import eixosData from '../../data/eixos.json';
import documentosData from '../../data/documentos.json';
import type { Documento, Eixo } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';

const eixos = eixosData as Eixo[];
const documentos = documentosData as Documento[];

function documentTitle(id: string): string {
  return documentos.find((doc) => doc.id === id)?.titulo ?? id;
}

export function Axes() {
  return (
    <Section
      id="eixos"
      title="Eixos estratégicos"
      subtitle="O PMetGIRS organiza suas ações em 12 eixos estratégicos, cada um com objetivo, responsável e situação próprios."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {eixos.map((eixo) => (
          <Card key={eixo.id} className="flex flex-col">
            <p className="font-semibold text-neutral-900">{eixo.nome}</p>
            <p className="mt-2 text-sm text-neutral-600">{eixo.descricao}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Objetivo
            </p>
            <p className="text-sm text-neutral-600">{eixo.objetivo}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={eixo.situacao} />
              <span className="text-xs text-neutral-500">Responsável: {eixo.responsavel}</span>
            </div>
            {eixo.documentosRelacionados.length > 0 && (
              <p className="mt-3 text-xs text-neutral-500">
                Documentos: {eixo.documentosRelacionados.map(documentTitle).join(', ')}
              </p>
            )}
          </Card>
        ))}
      </div>
    </Section>
  );
}
