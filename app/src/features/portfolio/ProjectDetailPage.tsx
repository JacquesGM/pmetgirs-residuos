import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, History, Save } from 'lucide-react';
import { commitMutation, getProject, listAuditEvents } from '../../data/firestore/portfolio';
import { useAuth } from '../../app/AuthProvider';
import { useAsync } from './useAsync';
import {
  actionLabel,
  actualityLabel,
  executionLabel,
  Pill,
  roleLabel,
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

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function ProjectDetailPage() {
  const { projetoId = '' } = useParams();
  const { state: auth, hasRole } = useAuth();
  const podeEditar = hasRole(['owner', 'admin', 'editor']);

  const state = useAsync(() => getProject(projetoId), [projetoId]);
  const audit = useAsync(() => listAuditEvents(projetoId, 25), [projetoId]);

  const [novaSituacao, setNovaSituacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  if (state.status === 'loading') {
    return <div className="h-40 animate-pulse rounded-lg bg-neutral-200" aria-label="Carregando projeto" />;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
        <p className="font-medium text-neutral-900">Não foi possível carregar o projeto</p>
        <p className="mt-1 text-neutral-700">{state.message}</p>
      </div>
    );
  }

  if (!state.data) {
    return (
      <div>
        <Link to="/app/projetos" className="text-sm text-brand-blue-700 hover:underline">
          ← Voltar ao portfólio
        </Link>
        <p className="mt-4 text-neutral-700">Projeto não encontrado.</p>
      </div>
    );
  }

  const { project, raw } = state.data;

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (auth.status !== 'active') return;

    setErro(null);
    setSucesso(null);
    setSalvando(true);

    try {
      const { version } = await commitMutation({
        workspaceId: raw.workspaceId as string,
        collection: 'projects',
        id: project.id,
        // Só o campo alterado muda; o resto do documento vai como está, porque
        // as Rules validam o documento inteiro a cada gravação.
        data: { ...raw, executionStatus: novaSituacao || null },
        actorUid: auth.membership.uid,
        actorRole: auth.membership.role,
        action: 'update',
        reason: motivo,
        currentVersion: project.version,
        currentData: raw,
      });

      setSucesso(`Salvo na versão ${version}. O evento de auditoria foi gravado no mesmo lote.`);
      setMotivo('');
      state.reload();
      audit.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <Link to="/app/projetos" className="inline-flex items-center gap-1 text-sm text-brand-blue-700 hover:underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Voltar ao portfólio
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-neutral-900">{project.name}</h1>

      <div className="mt-3 flex flex-wrap gap-2">
        <Pill tone={toneForExecution(project.executionStatus)}>
          Execução: {executionLabel(project.executionStatus)}
        </Pill>
        <Pill tone={toneForValidation(project.validationStatus)}>
          Validação: {validationLabel(project.validationStatus)}
        </Pill>
        <Pill>Atualidade: {actualityLabel(project.actualityStatus)}</Pill>
        <Pill>versão {project.version}</Pill>
      </div>

      {project.description && (
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-neutral-700">{project.description}</p>
      )}

      <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <Campo rotulo="Responsável" valor={project.accountable} />
        <Campo rotulo="Eixo" valor={project.axisId} />
        <Campo rotulo="Horizonte temporal" valor={project.timeHorizon === 'not_informed' ? null : project.timeHorizon} />
        <Campo rotulo="Categoria de custo" valor={project.costCategory === 'not_informed' ? null : project.costCategory} />
        <Campo rotulo="Data de referência do dado" valor={project.dataDate} />
        <Campo rotulo="Status na base antiga" valor={project.legacyStatus} />
      </dl>

      {podeEditar && (
        <form onSubmit={salvar} className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold text-neutral-900">Alterar situação de execução</h2>
          <p className="mt-1 text-sm text-neutral-600">
            O motivo é obrigatório e fica registrado no histórico junto com quem alterou e quando.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Nova situação</span>
              <select
                required
                value={novaSituacao}
                onChange={(e) => setNovaSituacao(e.target.value)}
                className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
              >
                <option value="">Selecione</option>
                {EXECUTION_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {executionLabel(v)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">
                Motivo da alteração <span className="text-status-red">*</span>
              </span>
              <input
                required
                minLength={5}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: ata da reunião do comitê de 12/08"
                className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-blue-700 px-4 text-sm font-medium text-white hover:bg-brand-blue-800 disabled:opacity-60"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {salvando ? 'Salvando...' : 'Salvar alteração'}
          </button>

          {erro && (
            <p className="mt-3 flex items-start gap-2 text-sm text-status-red" role="alert">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {erro}
            </p>
          )}
          {sucesso && (
            <p className="mt-3 text-sm text-brand-green-700" role="status">
              {sucesso}
            </p>
          )}
        </form>
      )}

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <History aria-hidden="true" className="h-4 w-4" />
          Histórico
        </h2>

        {audit.status === 'ready' && audit.data.length === 0 && (
          <p className="mt-2 text-sm text-neutral-600">Nenhum evento registrado.</p>
        )}

        {audit.status === 'ready' && audit.data.length > 0 && (
          <ol className="mt-3 space-y-3 border-l-2 border-neutral-200 pl-5">
            {audit.data.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-blue-600" />
                <p className="text-sm font-medium text-neutral-900">
                  {actionLabel(e.action)}
                  {e.fromVersion !== null ? ` — v${e.fromVersion} → v${e.toVersion}` : ` — v${e.toVersion}`}
                </p>
                <p className="text-sm text-neutral-700">{e.reason}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {e.occurredAt ? dateFormat.format(e.occurredAt) : 'sem data'} · {roleLabel(e.actorRole)} ·
                  origem {e.source}
                  {e.changedFields.length > 0 && ` · campos: ${e.changedFields.join(', ')}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</dt>
      <dd className={`mt-0.5 text-sm ${valor ? 'text-neutral-800' : 'italic text-neutral-500'}`}>
        {valor ?? 'Não informado'}
      </dd>
    </div>
  );
}
