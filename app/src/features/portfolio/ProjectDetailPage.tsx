import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { getProject, listAuditEvents } from '../../data/firestore/portfolio';
import { ProjectCostEstimate } from './ProjectCostEstimate';
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

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function ProjectDetailPage() {
  const { projetoId = '' } = useParams();

  const state = useAsync(() => getProject(projetoId), [projetoId]);
  const audit = useAsync(
    () => listAuditEvents({ collection: 'projects', id: projetoId }, 25),
    [projetoId],
  );

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

  const { project } = state.data;

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
        <Abrangencia
          texto={project.territorialScale}
          municipios={project.municipalityIds}
        />
        <Campo rotulo="Horizonte temporal" valor={project.timeHorizon === 'not_informed' ? null : project.timeHorizon} />
        {/* A faixa de custo NÃO entra aqui. O documento do projeto carrega um
            `costCategory` que a migração deixa em "not_informed", enquanto a
            estimativa transcrita — logo abaixo, com fonte e ano-base — traz a
            faixa real. Mostrar os dois punha "Não informado" e "Alto custo" na
            mesma tela. Quem tem a fonte é a estimativa; é ela que responde. */}
        <Campo rotulo="Data de referência do dado" valor={project.dataDate} />
        <Campo rotulo="Status na base antiga" valor={project.legacyStatus} />
      </dl>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-5">
        <h2 className="text-base font-semibold text-neutral-900">Procedência do registro</h2>
        <p className="mt-1.5 text-sm text-neutral-800">
          {project.sourceLabel ?? 'Origem não declarada.'}
        </p>
        <p className="mt-3 max-w-prose text-sm text-neutral-600">
          Este registro é transcrição de documento técnico, não digitação. Corrigir um campo aqui
          significa corrigir a transcrição na origem e migrar de novo — assim a conferência contra o
          documento continua possível, e nenhum valor passa a existir sem fonte.
        </p>
      </section>

      <ProjectCostEstimate projetoId={project.id} />

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <History aria-hidden="true" className="h-4 w-4" />
          Histórico
        </h2>

        {audit.status === 'loading' && (
          <div className="mt-3 h-16 animate-pulse rounded-md bg-neutral-100" aria-label="Carregando histórico" />
        )}

        {/* Sem este ramo, uma consulta recusada por falta de índice deixava a
            seção em branco — indistinguível de "nunca aconteceu nada". */}
        {audit.status === 'error' && (
          <p className="mt-2 text-sm text-status-red" role="alert">
            Não foi possível carregar o histórico: {audit.message}
          </p>
        )}

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

/**
 * Abrangência: o texto da fonte e a sua leitura em municípios.
 *
 * Os dois aparecem juntos de propósito. A contagem é derivada, e derivação
 * sem o original ao lado não pode ser conferida contra o documento.
 */
function Abrangencia({ texto, municipios }: { texto: string | null; municipios: string[] | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Abrangência</dt>
      <dd className={`mt-0.5 text-sm ${texto ? 'text-neutral-800' : 'italic text-neutral-500'}`}>
        {texto ?? 'Não informada'}
        {municipios !== null ? (
          <span className="mt-0.5 block text-xs text-neutral-500">
            {municipios.length} municípios
          </span>
        ) : (
          texto && (
            <span className="mt-0.5 block text-xs text-neutral-500">
              Sem lista de municípios: a fonte não a determina.
            </span>
          )
        )}
      </dd>
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
