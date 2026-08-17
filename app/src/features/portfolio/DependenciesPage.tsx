import { useMemo } from 'react';
import { CheckCircle2, GitBranch, Lock } from 'lucide-react';
import { listProjects } from '../../data/firestore/portfolio';
import { listDependencies } from '../../data/firestore/dependencies';
import {
  assessPair,
  computeStartability,
  type DependencyEdge,
  type GraphNode,
} from '../../domain/dependencies/graph';
import type { DependencyType } from '../../domain/enums';
import { useAsync } from './useAsync';
import { Pill } from './StateLabels';

const TIPO_LABEL: Record<DependencyType, string> = {
  finish_to_start: 'Término → Início',
  start_to_start: 'Início → Início',
  finish_to_finish: 'Término → Término',
  independent: 'Independente',
  resource_conflict: 'Disputa de recurso',
};

export function DependenciesPage() {
  const projetos = useAsync(() => listProjects({ limit: 200 }), []);
  const deps = useAsync(() => listDependencies(), []);

  const nodes: GraphNode[] = useMemo(() => {
    if (projetos.status !== 'ready') return [];
    return projetos.data.map((p) => ({
      id: p.id,
      name: p.name,
      durationMonths: null,
      readinessScore: null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetos.status, projetos.status === 'ready' ? projetos.data : null]);

  const edges: DependencyEdge[] = deps.status === 'ready' ? deps.data : [];
  const nomes = useMemo(() => new Map(nodes.map((n) => [n.id, n.name])), [nodes]);

  const startability = useMemo(
    () => (nodes.length > 0 ? computeStartability(nodes, edges) : []),
    [nodes, edges],
  );

  const podemComecar = startability.filter((s) => s.canStart);
  const bloqueados = startability.filter((s) => !s.canStart);

  // Ação que não aparece em nenhuma aresta: os documentos não dizem nada sobre
  // o que ela espera nem sobre o que espera por ela.
  const comAresta = new Set(edges.flatMap((e) => [e.predecessorId, e.successorId]));
  const semPrecedencia = nodes.filter((n) => !comAresta.has(n.id)).length;

  const paresParalelos = useMemo(() => {
    if (nodes.length < 2 || edges.length === 0) return [];
    const resultado = [];
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        resultado.push(assessPair(nodes, edges, nodes[i].id, nodes[j].id));
      }
    }
    // Só os pares que os documentos permitem afirmar. `not_ready` significa
    // "falta avaliação de prontidão", e a prontidão saiu do sistema junto com
    // o formulário que a produziria — listar 45 pares com esse mesmo aviso
    // seria encher a tela de uma pendência que não tem como ser resolvida.
    return resultado.filter((p) => p.relation === 'sequential' || p.relation === 'resource_conflict');
  }, [nodes, edges]);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-neutral-900">Dependências e concomitância</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        O que precede o quê, o que pode começar agora e o que pode andar em paralelo. As
        precedências são as declaradas nos documentos técnicos; ciclos são recusados na migração,
        antes de qualquer gravação.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-brand-green-300 bg-brand-green-50 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-green-800">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            O que pode começar agora
          </h2>
          {podemComecar.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-600">Nada liberado.</p>
          ) : (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums text-brand-green-800">
                {podemComecar.length}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                {podemComecar.slice(0, 6).map((s) => (
                  <li key={s.id}>{s.name}</li>
                ))}
                {podemComecar.length > 6 && (
                  <li className="text-neutral-500">e mais {podemComecar.length - 6}</li>
                )}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-status-amber">
            <Lock aria-hidden="true" className="h-4 w-4" />
            Bloqueados por dependência
          </h2>
          {bloqueados.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-600">Nenhum bloqueio registrado.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
              {bloqueados.map((s) => (
                <li key={s.id}>
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-xs text-neutral-600">
                    espera: {s.blockedBy.map((id) => nomes.get(id) ?? id).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <GitBranch aria-hidden="true" className="h-4 w-4" />
          Dependências registradas
        </h2>

        {edges.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm">
            <p className="font-medium text-neutral-800">Nenhuma dependência registrada</p>
            <p className="mt-1 text-neutral-600">
              Nenhuma precedência foi encontrada nos documentos técnicos transcritos.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Dependências entre ações do portfólio</caption>
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Precede</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Depende de</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Tipo</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Justificativa</th>
                </tr>
              </thead>
              <tbody>
                {edges.map((e) => (
                  <tr key={e.id} className="border-b border-neutral-100 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">
                      {nomes.get(e.predecessorId) ?? e.predecessorId}
                    </th>
                    <td className="px-4 py-2.5">{nomes.get(e.successorId) ?? e.successorId}</td>
                    <td className="px-4 py-2.5">
                      <Pill tone={e.type === 'resource_conflict' ? 'warn' : 'info'}>
                        {TIPO_LABEL[e.type]}
                      </Pill>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{e.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {semPrecedencia > 0 && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-neutral-800">
            <p className="font-medium">
              {semPrecedencia} de {nodes.length} ações não declaram precedência nos documentos.
            </p>
            <p className="mt-1">
              Ausência de dependência declarada não é ausência de dependência. O Relatório de
              Inconsistências aponta a lacuna como crítica: grandes obras foram programadas sem
              comprovar a conclusão de governança, estudos e licenciamento. O que aparece na tabela
              acima é o que os documentos declaram — não o encadeamento real do programa.
            </p>
          </div>
        )}
      </section>

      {paresParalelos.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-semibold text-neutral-900">Pares que não podem andar juntos</h2>
          <p className="mt-1 max-w-prose text-sm text-neutral-600">
            Apenas o que decorre das precedências declaradas. Se dois projetos podem de fato ser
            tocados ao mesmo tempo depende também de equipe, orçamento e capacidade institucional —
            nada disso está nos documentos técnicos, e o sistema não deduz.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {paresParalelos.slice(0, 12).map((p) => (
              <li key={`${p.a}-${p.b}`} className="rounded-md border border-neutral-200 bg-white p-3">
                <span className="font-medium text-neutral-800">
                  {nomes.get(p.a) ?? p.a} × {nomes.get(p.b) ?? p.b}
                </span>
                <span className="block text-neutral-600">{p.why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
