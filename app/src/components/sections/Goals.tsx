import metasData from '../../data/metas.json';
import type { Meta } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { DataValue } from '../ui/DataValue';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { GoalsTargetChart } from '../charts/GoalsTargetChart';
import { metaIcons, iconFor } from '../../lib/icons';

const metas = metasData as Meta[];

export function Goals() {
  return (
    <Section
      headingLevel={1}
      id="metas"
      title="Metas de coleta e atendimento"
      subtitle="Universalização da coleta e ampliação da coleta seletiva nos 22 municípios."
      tone="muted"
    >
      <Card className="mb-6">
        <GoalsTargetChart />
      </Card>

      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {metas.map((meta) => {
          const Icon = iconFor(metaIcons, meta.id);
          return (
            <li key={meta.id}>
              <Card className="h-full">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green-50 text-brand-green-700">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-neutral-900">{meta.nome}</p>
                <p className="mt-2 text-2xl font-bold text-brand-green-700">{meta.resultadoEsperado}</p>
                <p className="mt-1 text-sm text-neutral-500">Prazo: {meta.prazo}</p>
                <div className="mt-3">
                  <StatusBadge status={meta.situacao} />
                </div>
                <InfoDisclosure label="Linha de base, resultado e fonte">
                  <span className="block">
                    Linha de base: <DataValue value={meta.linhaBase} status="em_atualizacao" />
                  </span>
                  <span className="mt-1 block">
                    Resultado atual: <DataValue value={meta.resultadoAtual} status="em_atualizacao" />
                  </span>
                  <span className="mt-1 block">Fonte: {meta.fonte}</span>
                </InfoDisclosure>
              </Card>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
