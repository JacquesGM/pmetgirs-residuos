import metasData from '../../data/metas.json';
import type { Meta } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { DataValue } from '../ui/DataValue';

const metas = metasData as Meta[];

export function Goals() {
  return (
    <Section
      id="metas"
      title="Metas de coleta e atendimento"
      subtitle="Linha do tempo de universalização da coleta domiciliar e ampliação progressiva da coleta seletiva nos 22 municípios da Região Metropolitana."
      tone="muted"
    >
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {metas.map((meta) => (
          <li key={meta.id}>
            <Card className="h-full">
              <p className="text-sm font-semibold text-neutral-900">{meta.nome}</p>
              <p className="mt-2 text-2xl font-bold text-brand-green-700">{meta.resultadoEsperado}</p>
              <p className="mt-1 text-sm text-neutral-500">Prazo: {meta.prazo}</p>
              <div className="mt-3">
                <StatusBadge status={meta.situacao} />
              </div>
              <dl className="mt-4 space-y-1 text-xs text-neutral-500">
                <div className="flex justify-between gap-2">
                  <dt>Linha de base</dt>
                  <dd>
                    <DataValue value={meta.linhaBase} status="em_atualizacao" />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Resultado atual</dt>
                  <dd>
                    <DataValue value={meta.resultadoAtual} status="em_atualizacao" />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Fonte</dt>
                  <dd className="text-right">{meta.fonte}</dd>
                </div>
              </dl>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}
