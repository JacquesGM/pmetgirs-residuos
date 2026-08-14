import { useMemo } from 'react';
import { AlertTriangle, ShieldAlert, TrendingUp } from 'lucide-react';
import { listProjects } from '../../data/firestore/portfolio';
import { DEFAULT_POLICY } from '../../domain/scoring/policy';
import { buildReadinessReport } from '../../domain/investment/readiness';
import { STAGE_LABEL, STAGE_ORDER } from '../../domain/investment/pipeline';
import type { InvestmentStage } from '../../domain/enums';
import { useAsync } from './useAsync';
import { Pill } from './StateLabels';

/**
 * Funil de estruturação de investimento.
 *
 * O valor prático desta tela não é a nota de prontidão — é a lista de lacunas.
 * "62 pontos" não diz nada a quem precisa agir; "faltam licenciamento e matriz
 * de riscos" diz.
 */
export function InvestmentsPage() {
  const projetos = useAsync(() => listProjects({ limit: 200 }), []);

  // Nenhum projeto migrado tem avaliação de prontidão: o relatório sai vazio
  // de propósito, com as 13 lacunas listadas.
  const relatorio = useMemo(
    () => buildReadinessReport(DEFAULT_POLICY, [], 'identified', 'ready_for_fundraising', null),
    [],
  );

  const porEstagio = useMemo(() => {
    const contagem = new Map<InvestmentStage, number>();
    if (projetos.status === 'ready') {
      // Sem estágio registrado, tudo fica em "identificado".
      contagem.set('identified', projetos.data.length);
    }
    return contagem;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetos.status, projetos.status === 'ready' ? projetos.data : null]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-neutral-900">Investimentos</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Funil de estruturação e o que falta fechar em cada oportunidade antes de ir ao mercado.
      </p>

      <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-status-amber" />
        <div className="text-sm text-neutral-800">
          <p className="font-medium">Receita potencial não é receita garantida.</p>
          <p className="mt-1">
            Energia, recicláveis e créditos de carbono dependem de preço de mercado. Economia do
            poder público não entra no caixa do operador. O sistema mantém os quatro tipos de fluxo
            separados, com o beneficiário de cada um — somá-los infla o retorno e distorce a análise.
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <TrendingUp aria-hidden="true" className="h-4 w-4" />
          Funil
        </h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {STAGE_ORDER.map((stage) => {
            const total = porEstagio.get(stage) ?? 0;
            return (
              <li
                key={stage}
                className={`rounded-lg border p-3 ${
                  total > 0 ? 'border-brand-blue-300 bg-brand-blue-50' : 'border-neutral-200 bg-white'
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {STAGE_LABEL[stage]}
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">{total}</p>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-neutral-500">
          O funil não deixa saltar estágios: passar de &quot;identificado&quot; direto para
          &quot;pronto para captação&quot; esconderia exatamente os estudos que dão segurança à
          decisão.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-neutral-900">
          Prontidão para captação — o que falta fechar
        </h2>
        <p className="mt-1 text-sm text-neutral-600">{relatorio.readyReason}</p>

        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full min-w-[620px] text-sm">
            <caption className="sr-only">
              Itens de prontidão pendentes, ordenados pelo peso na avaliação
            </caption>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Item pendente</th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Próximo passo</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">Peso</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.gapsDetailed.map((gap) => (
                <tr key={gap.label} className="border-b border-neutral-100 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-neutral-800">
                    {gap.label}
                  </th>
                  <td className="px-4 py-2.5 text-neutral-600">{gap.nextAction}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{gap.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Ordenado pelo peso: o que mais destrava a avaliação aparece primeiro.
        </p>
      </section>

      <section className="mt-10 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 text-status-amber" />
          Pendências do plano que afetam a captação
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Levantadas no Relatório de Inconsistências e ainda abertas. Enquanto não forem
          conciliadas, os números não sustentam decisão de investimento.
        </p>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li>
            <Pill tone="alert">crítica</Pill>{' '}
            <span className="font-medium">Investimentos não conciliados</span> — o Prognóstico aponta
            R$ 4,73 bilhões de CAPEX; o Plano de Ações, R$ 12,5 bilhões. Sem memória de cálculo
            única, não há como estimar financiamento nem atratividade.
          </li>
          <li>
            <Pill tone="alert">crítica</Pill>{' '}
            <span className="font-medium">Escopo dos valores indefinido</span> — não está demonstrado
            se incluem terreno, desapropriação, conexão elétrica, licenciamento e contingências.
          </li>
          <li>
            <Pill tone="warn">alta</Pill>{' '}
            <span className="font-medium">Paybacks otimistas</span> — retornos de 1 a 5 anos para
            ativos de alto CAPEX exigem análise de sensibilidade antes de ir ao mercado.
          </li>
        </ul>
      </section>
    </div>
  );
}
