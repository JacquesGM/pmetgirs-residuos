import { useAsync } from './useAsync';
import { getEstimativa } from '../../data/firestore/costEstimates';
import { deCentavos } from '../../domain/costEstimate';
import { DEFAULT_COST_THRESHOLDS } from '../../domain/scoring/policy';
import type { CostCategoryResult } from '../../domain/scoring/score';

const ROTULO_DA_FAIXA: Record<CostCategoryResult, string> = {
  no_new_disbursement: 'Sem novo desembolso',
  low: 'Baixo custo',
  medium: 'Médio custo',
  high: 'Alto custo',
  estimating: 'Em estruturação',
  not_informed: 'Não informado',
};

/**
 * Custo estimado, como os documentos o registram.
 *
 * Até 16/08/2026 esta seção era um formulário. Ela deixou de ser porque a
 * pergunta certa não era "quem digita o valor" e sim "o valor existe": existe
 * no Anexo I do Plano de Ações e nas Tabelas 37 e 40 do Prognóstico, com a
 * ressalva — também dos documentos — de que seis dos dez projetos têm a
 * orçamentação remetida a um Plano de Negócios ainda não contratado.
 *
 * "Em estruturação" é esse estado declarado pela fonte, e é diferente de
 * "não informado": alguém disse que o número virá, só não veio ainda.
 */
export function ProjectCostEstimate({ projetoId }: { projetoId: string }) {
  const gravada = useAsync(() => getEstimativa(projetoId), [projetoId]);

  return (
    <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-neutral-900">Custo estimado</h2>

      {gravada.status === 'loading' && (
        <div className="mt-4 h-20 animate-pulse rounded-md bg-neutral-100" aria-label="Carregando estimativa" />
      )}

      {gravada.status === 'error' && (
        <p className="mt-3 text-sm text-status-red">{gravada.message}</p>
      )}

      {gravada.status === 'ready' && gravada.data === null && (
        <p className="mt-3 text-sm text-neutral-600">
          Nenhuma estimativa transcrita para este projeto.
        </p>
      )}

      {gravada.status === 'ready' && gravada.data !== null && (
        <Estimativa registro={gravada.data} />
      )}
    </section>
  );
}

function Estimativa({
  registro,
}: {
  registro: NonNullable<Awaited<ReturnType<typeof getEstimativa>>>;
}) {
  const { estimativa: e, costCategory } = registro;
  const temIntervalo =
    e.capexMinCents !== null && e.capexMaxCents !== null && e.capexMinCents !== e.capexMaxCents;

  return (
    <>
      <p className="mt-2 text-sm">
        Faixa: <strong>{ROTULO_DA_FAIXA[costCategory]}</strong>
        {costCategory === 'no_new_disbursement' && (
          <span className="mt-1 block text-xs text-neutral-600">
            Não é o mesmo que custo zero: o serviço tem custo, ele já está pago.
          </span>
        )}
        {costCategory === 'estimating' && (
          <span className="mt-1 block text-xs text-neutral-600">
            A própria fonte remete a orçamentação a um estudo posterior.
          </span>
        )}
      </p>

      {(e.capexMinCents !== null || e.annualOpexCents !== null) && (
        <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
          {e.capexMinCents !== null && (
            <Valor
              rotulo={temIntervalo ? 'CAPEX (intervalo)' : 'CAPEX'}
              valor={
                temIntervalo
                  ? `R$ ${deCentavos(e.capexMinCents)} a ${deCentavos(e.capexMaxCents)}`
                  : `R$ ${deCentavos(e.capexMinCents)}`
              }
            />
          )}
          {e.annualOpexCents !== null && (
            <Valor rotulo="OPEX anual" valor={`R$ ${deCentavos(e.annualOpexCents)}`} />
          )}
          {e.baseYear !== null && <Valor rotulo="Ano-base" valor={String(e.baseYear)} />}
        </dl>
      )}

      {e.sourceLabel !== null && (
        <p className="mt-4 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Fonte do valor
          </span>
          <span className="mt-0.5 block text-neutral-800">{e.sourceLabel}</span>
        </p>
      )}

      {e.assumptions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Premissas registradas na fonte
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {e.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
        A faixa usa o teto do intervalo: para saber se cabe no orçamento, o que importa é o pior
        caso. Até {deCentavos(DEFAULT_COST_THRESHOLDS.lowMaxCents)} é baixo; até{' '}
        {deCentavos(DEFAULT_COST_THRESHOLDS.mediumMaxCents)} é médio; acima disso, alto. Estes
        limiares são parâmetros de governança, não números do PMetGIRS.
      </p>
    </>
  );
}

function Valor({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums text-neutral-800">{valor}</dd>
    </div>
  );
}
