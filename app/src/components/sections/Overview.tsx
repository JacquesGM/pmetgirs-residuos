import { ArrowRight, CheckCircle2, Circle, FileSearch, LineChart, Wrench } from 'lucide-react';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';

const fluxo = [
  { label: 'Diagnóstico', done: true, Icon: FileSearch },
  { label: 'Prognóstico', done: true, Icon: LineChart },
  { label: 'Plano de Ações', done: true, Icon: CheckCircle2 },
  { label: 'Implementação', done: false, Icon: Wrench },
  { label: 'Monitoramento', done: false, Icon: Circle },
];

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
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
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

        <Card>
          <p className="text-sm font-semibold text-neutral-900">Ciclo do plano</p>
          <ol className="mt-4 space-y-3">
            {fluxo.map((etapa, index) => (
              <li key={etapa.label} className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                    etapa.done
                      ? 'border-brand-green-300 bg-brand-green-50 text-brand-green-700'
                      : 'border-neutral-300 bg-neutral-50 text-neutral-500'
                  }`}
                >
                  <etapa.Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className={etapa.done ? 'font-medium text-neutral-900' : 'text-neutral-500'}>
                  {etapa.label}
                </span>
                {index < fluxo.length - 1 && (
                  <ArrowRight aria-hidden="true" className="ml-auto h-4 w-4 text-neutral-300" />
                )}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-neutral-500">
            Diagnóstico, Prognóstico e Plano de Ações concluídos (2024). Implementação e
            monitoramento em estruturação — ver Portfólio de Projetos.
          </p>
        </Card>
      </div>
    </Section>
  );
}
