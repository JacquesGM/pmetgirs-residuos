import { useMemo } from 'react';
import { AlertTriangle, Layers } from 'lucide-react';
import { listProjects } from '../../data/firestore/portfolio';
import { listDependencies } from '../../data/firestore/dependencies';
import {
  computeCriticalPath,
  computeWaves,
  CycleError,
  type GraphNode,
} from '../../domain/dependencies/graph';
import { useAsync } from './useAsync';

/**
 * Cronograma em ondas de início.
 *
 * Uma onda é "o conjunto de ações que pode começar ao mesmo tempo, dado que a
 * onda anterior terminou". É a leitura executiva de um grafo que, em forma de
 * rede, poucas pessoas conseguem interpretar — e não exige biblioteca de Gantt
 * na primeira dobra.
 */
export function SchedulePage() {
  const projetos = useAsync(() => listProjects({ limit: 200 }), []);
  const deps = useAsync(() => listDependencies(), []);

  const resultado = useMemo(() => {
    if (projetos.status !== 'ready' || deps.status !== 'ready') return null;

    const nodes: GraphNode[] = projetos.data.map((p) => ({
      id: p.id,
      name: p.name,
      durationMonths: null,
      readinessScore: null,
    }));

    try {
      return {
        nodes,
        waves: computeWaves(nodes, deps.data),
        critical: computeCriticalPath(nodes, deps.data),
        cycleError: null as string | null,
      };
    } catch (e) {
      return {
        nodes,
        waves: null,
        critical: null,
        cycleError: e instanceof CycleError ? e.message : 'Falha ao calcular o cronograma.',
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetos.status, deps.status, projetos.status === 'ready' ? projetos.data : null, deps.status === 'ready' ? deps.data : null]);

  const nomes = useMemo(
    () => new Map((resultado?.nodes ?? []).map((n) => [n.id, n.name])),
    [resultado],
  );

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-neutral-900">Cronograma</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Ondas de início a partir das dependências registradas. Cada onda só começa quando a anterior
        termina.
      </p>

      {resultado?.cycleError && (
        <div className="mt-6 flex items-start gap-3 rounded-md border border-status-red bg-red-50 p-4" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-status-red" />
          <p className="text-sm text-neutral-800">{resultado.cycleError}</p>
        </div>
      )}

      {resultado?.waves && (
        <>
          <section className="mt-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
              <Layers aria-hidden="true" className="h-4 w-4" />
              Ondas de início
            </h2>

            <ol className="mt-3 space-y-3">
              {resultado.waves.waves.map((onda, indice) => (
                <li key={indice} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <p className="text-sm font-semibold text-neutral-900">
                    Onda {indice + 1}
                    <span className="ml-2 font-normal text-neutral-500">
                      {onda.length} {onda.length === 1 ? 'ação' : 'ações'}
                      {indice === 0 && ' — não dependem de nada'}
                    </span>
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {onda.map((id) => (
                      <li
                        key={id}
                        className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-sm text-neutral-700"
                      >
                        {nomes.get(id) ?? id}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>

            {resultado.waves.waves.length === 1 && (
              <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                Tudo em uma onda só: sem dependências registradas, o sistema não tem como afirmar que
                alguma ação precede outra. Isso não significa que todas possam começar de fato — o
                Relatório de Inconsistências aponta que as precedências reais (governança, estudos,
                licenciamento) não foram formalizadas no Plano de Ações.
              </p>
            )}
          </section>

          {resultado.critical && (
            <section className="mt-8">
              <h2 className="text-base font-semibold text-neutral-900">Caminho crítico</h2>
              <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-700">
                  {resultado.critical.path.length > 1
                    ? resultado.critical.path.map((id) => nomes.get(id) ?? id).join(' → ')
                    : 'Sem cadeia de precedência para formar um caminho crítico.'}
                </p>
                <p className="mt-3 text-sm">
                  <span className="font-medium text-neutral-800">Prazo total: </span>
                  {resultado.critical.totalMonths === null ? (
                    <span className="italic text-neutral-500">não calculável</span>
                  ) : (
                    <span className="font-semibold tabular-nums">
                      {resultado.critical.totalMonths} meses
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{resultado.critical.reason}</p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
