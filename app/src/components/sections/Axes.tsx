import eixosData from '../../data/eixos.json';
import documentosData from '../../data/documentos.json';
import type { Documento, Eixo } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { eixoIcons, iconFor } from '../../lib/icons';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const eixosEmbutidos = eixosData as Eixo[];
const documentos = documentosData as Documento[];

function documentTitle(id: string): string {
  return documentos.find((doc) => doc.id === id)?.titulo ?? id;
}

export function Axes() {
  const eixos = useColecaoPublicada<Eixo>('eixos', eixosEmbutidos);

  return (
    <Section headingLevel={1} id="eixos" title="Eixos estratégicos" subtitle="As 12 frentes de trabalho do PMetGIRS.">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {eixos.map((eixo) => {
          const Icon = iconFor(eixoIcons, eixo.id);
          return (
            <Card key={eixo.id} className="flex flex-col">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green-50 text-brand-green-700">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="mt-3 font-semibold text-neutral-900">{eixo.nome}</p>
              <p className="mt-2 text-sm text-neutral-600">{eixo.descricao}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={eixo.situacao} />
                <span className="text-xs text-neutral-500">{eixo.responsavel}</span>
              </div>
              <InfoDisclosure label="Objetivo e documentos">
                {eixo.objetivo}
                {eixo.documentosRelacionados.length > 0 && (
                  <span className="mt-1 block">
                    Documentos: {eixo.documentosRelacionados.map(documentTitle).join(', ')}
                  </span>
                )}
              </InfoDisclosure>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
