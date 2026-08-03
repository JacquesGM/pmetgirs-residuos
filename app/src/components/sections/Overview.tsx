import { CheckCircle2 } from 'lucide-react';
import evolucaoData from '../../data/evolucao.json';
import type { EvolucaoEtapa } from '../../types';
import { Section } from '../ui/Section';
import { StatusBadge } from '../ui/StatusBadge';

const etapas = evolucaoData as EvolucaoEtapa[];

const beneficios = [
  'Redução esperada da disposição inadequada de resíduos',
  'Aumento potencial da reciclagem e da recuperação de materiais',
  'Fortalecimento das cooperativas de catadores',
  'Melhoria da logística de coleta e transporte',
  'Remediação de passivos ambientais (lixões e aterros controlados)',
  'Aproveitamento energético condicionado à viabilidade técnica e financeira',
  'Informação pública e planejamento integrado entre os 22 municípios',
];

export function Overview() {
  return (
    <Section
      id="visao-geral"
      title="Visão geral do PMetGIRS"
      subtitle="O Plano Metropolitano de Gestão Integrada de Resíduos Sólidos (PMetGIRS) organiza o planejamento da gestão de resíduos sólidos para os 22 municípios da Região Metropolitana do Rio de Janeiro, sob coordenação do Instituto Rio Metrópole (IRM), autoridade executiva da RMRJ criada pela Lei Complementar nº 184/2018."
    >
      <div className="space-y-4 text-neutral-700">
        <p>
          A gestão de resíduos sólidos é um desafio compartilhado por todos os municípios da
          Região Metropolitana. O PMetGIRS busca aprimorar o planejamento de políticas públicas de
          resíduos, alinhando-se ao novo marco legal do saneamento básico e às leis federais de
          resíduos sólidos, consórcios públicos e ao Estatuto das Metrópoles.
        </p>
        <p>
          O papel do IRM é coordenar tecnicamente a elaboração, a aprovação e a implantação do
          plano em conjunto com os Conselhos Deliberativo e Consultivo da RMRJ e com as
          prefeituras dos 22 municípios envolvidos.
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
          Do diagnóstico técnico à implantação, cada etapa do plano com sua situação atual —
          concluída, em estruturação, em validação ou ainda não iniciada.
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
