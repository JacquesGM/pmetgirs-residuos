import { countByCollection, listProjects } from '../../data/firestore/portfolio';
import { useAsync } from './useAsync';
import { executionLabel, Pill, toneForExecution } from './StateLabels';

/**
 * Painel executivo.
 *
 * Conta o que existe, sem estimar o que não existe. Onde o portfólio não tem
 * dado — prazo, custo, prioridade — o painel diz que não tem, em vez de exibir
 * zero e passar a impressão de que a resposta é zero.
 */

const COLECOES = ['projects', 'axes', 'goals', 'indicators', 'municipalities', 'inconsistencies'] as const;

const ROTULOS: Record<(typeof COLECOES)[number], string> = {
  projects: 'Projetos',
  axes: 'Eixos estratégicos',
  goals: 'Metas',
  indicators: 'Indicadores',
  municipalities: 'Municípios',
  inconsistencies: 'Pendências de dado',
};

export function DashboardPage() {
  const totais = useAsync(
    async () => {
      const entries = await Promise.all(
        COLECOES.map(async (c) => [c, await countByCollection(c)] as const),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    [],
  );

  const projetos = useAsync(() => listProjects({ limit: 200 }), []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">Painel executivo</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Situação do portfólio a partir dos dados migrados.
      </p>

      {totais.status === 'error' && (
        <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-neutral-800">
          {totais.message}
        </p>
      )}

      {totais.status === 'loading' && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {COLECOES.map((c) => (
            <div key={c} className="h-24 animate-pulse rounded-lg bg-neutral-200" />
          ))}
        </div>
      )}

      {totais.status === 'ready' && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLECOES.map((c) => (
            <div key={c} className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{ROTULOS[c]}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-900">{totais.data[c] ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {projetos.status === 'ready' && projetos.data.length > 0 && (
        <>
          <h2 className="mt-10 text-base font-semibold text-neutral-900">
            Projetos por situação de execução
          </h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[420px] text-sm">
              <caption className="sr-only">Distribuição dos projetos por situação de execução</caption>
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Situação</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">Projetos</th>
                </tr>
              </thead>
              <tbody>
                {agrupar(projetos.data.map((p) => p.executionStatus)).map(([situacao, total]) => (
                  <tr key={situacao ?? 'nulo'} className="border-b border-neutral-100 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <Pill tone={toneForExecution(situacao)}>{executionLabel(situacao)}</Pill>
                    </th>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-900">O que o painel ainda não responde</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Estas perguntas dependem de dados que o portfólio ainda não tem. Elas ficam listadas em
              vez de aparecerem como zero.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
              <Pendencia texto="Projetos por horizonte de prazo" motivo="nenhum projeto tem duração estimada" />
              <Pendencia texto="Projetos por faixa de custo" motivo="não há CAPEX nem OPEX registrados" />
              <Pendencia texto="Ranking por prioridade" motivo="a matriz de priorização entra na Fase 4" />
              <Pendencia texto="Aptos e bloqueados" motivo="as dependências entram na Fase 5" />
            </ul>
          </div>
        </>
      )}

      {projetos.status === 'ready' && projetos.data.length === 0 && (
        <div className="mt-6 rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="font-medium text-neutral-800">Nenhum projeto neste workspace</p>
          <p className="mt-1 text-sm text-neutral-600">
            Rode a migração dos dados antes de usar o painel.
          </p>
        </div>
      )}
    </div>
  );
}

function Pendencia({ texto, motivo }: { texto: string; motivo: string }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium text-neutral-800">{texto}</span>
      <span className="text-neutral-500">— {motivo}</span>
    </li>
  );
}

function agrupar(valores: Array<string | null>): Array<[string | null, number]> {
  const contagem = new Map<string | null, number>();
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
}
