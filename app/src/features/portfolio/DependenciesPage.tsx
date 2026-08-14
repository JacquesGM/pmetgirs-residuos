import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitBranch, Lock, Plus } from 'lucide-react';
import { listProjects } from '../../data/firestore/portfolio';
import { CycleBlocked, createDependency, listDependencies } from '../../data/firestore/dependencies';
import {
  assessPair,
  computeStartability,
  type DependencyEdge,
  type GraphNode,
} from '../../domain/dependencies/graph';
import type { DependencyType } from '../../domain/enums';
import { useAuth } from '../../app/AuthProvider';
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
  const { state: auth, hasRole } = useAuth();
  const podeEditar = hasRole(['owner', 'admin', 'editor']);

  const projetos = useAsync(() => listProjects({ limit: 200 }), []);
  const deps = useAsync(() => listDependencies(), []);

  const [predecessor, setPredecessor] = useState('');
  const [sucessor, setSucessor] = useState('');
  const [tipo, setTipo] = useState<DependencyType>('finish_to_start');
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

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

  const paresParalelos = useMemo(() => {
    if (nodes.length < 2 || edges.length === 0) return [];
    const resultado = [];
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        resultado.push(assessPair(nodes, edges, nodes[i].id, nodes[j].id));
      }
    }
    return resultado.filter((p) => p.relation !== 'parallel');
  }, [nodes, edges]);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (auth.status !== 'active') return;
    setErro(null);
    setSucesso(null);
    setSalvando(true);

    try {
      await createDependency({
        predecessorId: predecessor,
        successorId: sucessor,
        type: tipo,
        lagDays: 0,
        mandatory: true,
        justification: justificativa,
        actorUid: auth.membership.uid,
        actorRole: auth.membership.role,
        names: nomes,
      });
      setSucesso('Dependência registrada.');
      setJustificativa('');
      deps.reload();
    } catch (e) {
      setErro(e instanceof CycleBlocked ? e.message : e instanceof Error ? e.message : 'Falhou.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-neutral-900">Dependências e concomitância</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        O que precede o quê, o que pode começar agora e o que pode andar em paralelo. Ciclos são
        recusados na gravação.
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

      {podeEditar && (
        <form onSubmit={salvar} className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Registrar dependência
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Precede</span>
              <select
                required
                value={predecessor}
                onChange={(e) => setPredecessor(e.target.value)}
                className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
              >
                <option value="">Selecione</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Depende de</span>
              <select
                required
                value={sucessor}
                onChange={(e) => setSucessor(e.target.value)}
                className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
              >
                <option value="">Selecione</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Tipo</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as DependencyType)}
                className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
              >
                {(Object.keys(TIPO_LABEL) as DependencyType[]).map((t) => (
                  <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">
                Justificativa <span className="text-status-red">*</span>
              </span>
              <input
                required
                minLength={5}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Por que uma precisa da outra"
                className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="mt-4 min-h-11 rounded-md bg-brand-blue-700 px-4 text-sm font-medium text-white hover:bg-brand-blue-800 disabled:opacity-60"
          >
            {salvando ? 'Verificando...' : 'Registrar dependência'}
          </button>

          {erro && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-status-red bg-red-50 p-3" role="alert">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-status-red" />
              <p className="text-sm text-neutral-800">{erro}</p>
            </div>
          )}
          {sucesso && <p className="mt-3 text-sm text-brand-green-700" role="status">{sucesso}</p>}
        </form>
      )}

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <GitBranch aria-hidden="true" className="h-4 w-4" />
          Dependências registradas
        </h2>

        {edges.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm">
            <p className="font-medium text-neutral-800">Nenhuma dependência registrada</p>
            <p className="mt-1 text-neutral-600">
              Os projetos migrados vieram dos documentos técnicos com a lista de dependências vazia.
              O Relatório de Inconsistências aponta isso como lacuna crítica: grandes obras foram
              programadas sem comprovar a conclusão de governança, estudos e licenciamento.
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
      </section>

      {paresParalelos.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-semibold text-neutral-900">Pares que não podem andar juntos</h2>
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
