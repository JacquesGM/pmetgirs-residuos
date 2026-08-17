import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Search } from 'lucide-react';
import { listProjects } from '../../data/firestore/portfolio';
import { useAsync } from './useAsync';
import {
  actualityLabel,
  executionLabel,
  Pill,
  toneForExecution,
  toneForValidation,
  validationLabel,
} from './StateLabels';

const EXECUTION_OPTIONS = [
  'not_started',
  'structuring',
  'study',
  'procurement',
  'licensing',
  'implementation',
  'operation',
  'completed',
  'paused',
  'cancelled',
];

export function ProjectsPage() {
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');

  const state = useAsync(() => listProjects({ executionStatus: situacao || undefined }), [situacao]);

  const filtrados = useMemo(() => {
    if (state.status !== 'ready') return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return state.data;
    return state.data.filter((p) => p.name.toLowerCase().includes(termo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.status === 'ready' ? state.data : null, busca]);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Projetos</h1>
        <p className="mt-1 max-w-prose text-sm text-neutral-600">
          Portfólio transcrito dos documentos técnicos do PMetGIRS. Cada registro cita o documento,
          a tabela e a página de onde veio; a entrada é por transcrição conferida, não por digitação.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-neutral-700">Buscar por nome</span>
          <span className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do projeto"
              className="min-h-11 w-72 rounded-md border border-neutral-300 pl-9 pr-3 text-sm"
            />
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-neutral-700">Situação de execução</span>
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            className="min-h-11 w-56 rounded-md border border-neutral-300 px-3 text-sm"
          >
            <option value="">Todas</option>
            {EXECUTION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {executionLabel(value)}
              </option>
            ))}
          </select>
        </label>

        {(busca || situacao) && (
          <button
            type="button"
            onClick={() => {
              setBusca('');
              setSituacao('');
            }}
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {state.status === 'loading' && (
        <div className="mt-6 space-y-2" aria-live="polite">
          <span className="sr-only">Carregando projetos...</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-neutral-200" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="mt-6 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-status-amber" />
          <div className="text-sm">
            <p className="font-medium text-neutral-900">Não foi possível carregar os projetos</p>
            <p className="mt-1 text-neutral-700">{state.message}</p>
            <button
              type="button"
              onClick={state.reload}
              className="mt-3 min-h-11 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <p className="mt-6 text-sm text-neutral-600" aria-live="polite">
            {filtrados.length} {filtrados.length === 1 ? 'projeto' : 'projetos'}
            {state.data.length !== filtrados.length && ` de ${state.data.length}`}
          </p>

          {filtrados.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
              <p className="font-medium text-neutral-800">Nenhum projeto encontrado</p>
              <p className="mt-1 text-sm text-neutral-600">
                {state.data.length === 0
                  ? 'Nenhum dado foi migrado para este workspace ainda.'
                  : 'Ajuste os filtros para ver outros resultados.'}
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full min-w-[820px] text-sm">
                <caption className="sr-only">
                  Projetos do portfólio, com situação de execução, validação e atualidade
                </caption>
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                    <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Projeto</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Execução</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Validação</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Atualidade</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">Versão</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                      <th scope="row" className="px-4 py-3 text-left font-medium">
                        <Link to={`/app/projetos/${p.id}`} className="text-brand-blue-700 hover:underline">
                          {p.name}
                        </Link>
                        {p.accountable && (
                          <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                            {p.accountable}
                          </span>
                        )}
                      </th>
                      <td className="px-4 py-3">
                        <Pill tone={toneForExecution(p.executionStatus)}>
                          {executionLabel(p.executionStatus)}
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={toneForValidation(p.validationStatus)}>
                          {validationLabel(p.validationStatus)}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{actualityLabel(p.actualityStatus)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-600">v{p.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
