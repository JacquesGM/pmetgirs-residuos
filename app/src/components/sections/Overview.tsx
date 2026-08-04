import { CheckCircle2 } from 'lucide-react';
import evolucaoData from '../../data/evolucao.json';
import type { EvolucaoEtapa } from '../../types';
import { Section } from '../ui/Section';
import { StatusBadge } from '../ui/StatusBadge';

const etapas = evolucaoData as EvolucaoEtapa[];

const beneficios = [
  'Menos descarte irregular de resíduos',
  'Mais reciclagem e recuperação de materiais',
  'Cooperativas de catadores mais fortes',
  'Coleta e transporte mais eficientes',
  'Remediação de lixões e aterros controlados',
  'Aproveitamento de energia, quando viável',
  'Planejamento integrado entre os 22 municípios',
];

export function Overview() {
  return (
    <Section
      id="visao-geral"
      title="Visão geral do PMetGIRS"
      subtitle="O plano de gestão de resíduos sólidos dos 22 municípios da Região Metropolitana, coordenado pelo Instituto Rio Metrópole (IRM)."
    >
      <div className="space-y-4 text-neutral-700">
        <p>
          A gestão de resíduos é um desafio comum a todos os municípios da Região Metropolitana. O
          PMetGIRS organiza esse planejamento, alinhado às leis de saneamento básico e ao Estatuto
          das Metrópoles.
        </p>
        <p>
          O IRM coordena a elaboração e a implantação do plano, junto com os Conselhos da RMRJ e as
          prefeituras dos 22 municípios.
        </p>
        <div>
          <p className="font-semibold text-neutral-900">Benefícios esperados</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {beneficios.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-green-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <p className="text-lg font-semibold text-neutral-900">Evolução das ações</p>
        <p className="mt-1 text-sm text-neutral-600">
          A situação de cada etapa, do diagnóstico até a implantação.
        </p>
        <ol className="relative mt-6 space-y-6 border-l-2 border-brand-blue-200 pl-6">
          {etapas.map((etapa) => (
            <li key={etapa.id} className="relative">
              <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-blue-600 ring-2 ring-brand-blue-100" />
              <p className="font-semibold text-neutral-900">{etapa.titulo}</p>
              <p className="text-xs text-neutral-500">{etapa.periodo}</p>
              <p className="mt-1 text-sm text-neutral-600">{etapa.descricao}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={etapa.situacao} />
                <span className="text-xs text-neutral-500">Fonte: {etapa.fonte}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
