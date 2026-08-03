import { useMemo, useState } from 'react';
import projetosData from '../../data/projetos.json';
import eixosData from '../../data/eixos.json';
import type { Eixo, Projeto, StatusProjeto } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge, statusLabel } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { DataValue } from '../ui/DataValue';
import { DownloadButton } from '../ui/DownloadButton';
import { uniqueOptions } from '../../lib/filters';

const projetos = projetosData as Projeto[];
const eixos = eixosData as Eixo[];

const statusOptions = uniqueOptions(projetos, (p) => p.status) as StatusProjeto[];
const responsavelOptions = uniqueOptions(projetos, (p) => p.responsavel);

function eixoNome(id: string): string {
  return eixos.find((eixo) => eixo.id === id)?.nome ?? id;
}

const ALL = 'todos';

export function Projects() {
  const [eixoFiltro, setEixoFiltro] = useState(ALL);
  const [statusFiltro, setStatusFiltro] = useState(ALL);
  const [responsavelFiltro, setResponsavelFiltro] = useState(ALL);

  const filtrados = useMemo(() => {
    return projetos.filter((projeto) => {
      if (eixoFiltro !== ALL && projeto.eixo !== eixoFiltro) return false;
      if (statusFiltro !== ALL && projeto.status !== statusFiltro) return false;
      if (responsavelFiltro !== ALL && projeto.responsavel !== responsavelFiltro) return false;
      return true;
    });
  }, [eixoFiltro, statusFiltro, responsavelFiltro]);

  const limparFiltros = () => {
    setEixoFiltro(ALL);
    setStatusFiltro(ALL);
    setResponsavelFiltro(ALL);
  };

  return (
    <Section
      id="projetos"
      title="Portfólio de projetos"
      subtitle="Ações do Plano de Ações do PMetGIRS, com eixo, responsável, situação e próximos passos. Nenhum percentual de avanço é calculado sem metodologia formal."
      tone="muted"
    >
      <form
        className="mb-8 grid gap-3 sm:grid-cols-3"
        role="search"
        aria-label="Filtros de projetos"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="text-sm">
          <span className="mb-1 block font-medium text-neutral-700">Eixo</span>
          <select
            className="min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={eixoFiltro}
            onChange={(e) => setEixoFiltro(e.target.value)}
          >
            <option value={ALL}>Todos os eixos</option>
            {eixos.map((eixo) => (
              <option key={eixo.id} value={eixo.id}>
                {eixo.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-neutral-700">Situação</span>
          <select
            className="min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
          >
            <option value={ALL}>Todas as situações</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-neutral-700">Responsável</span>
          <select
            className="min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            value={responsavelFiltro}
            onChange={(e) => setResponsavelFiltro(e.target.value)}
          >
            <option value={ALL}>Todos os responsáveis</option>
            {responsavelOptions.map((responsavel) => (
              <option key={responsavel} value={responsavel}>
                {responsavel}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500" role="status">
          {filtrados.length} {filtrados.length === 1 ? 'projeto encontrado' : 'projetos encontrados'}
        </p>
        <DownloadButton filename="projetos-pmetgirs.json" data={projetos} />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState message="Nenhum projeto encontrado para os filtros selecionados." onClear={limparFiltros} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((projeto) => (
            <Card key={projeto.id} className="flex flex-col bg-white">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-blue-600">
                {eixoNome(projeto.eixo)}
              </p>
              <p className="mt-1 font-semibold text-neutral-900">{projeto.nome}</p>
              <p className="mt-2 text-sm text-neutral-600">{projeto.descricao}</p>
              <div className="mt-3">
                <StatusBadge status={projeto.status} />
              </div>
              <dl className="mt-4 space-y-1 text-xs text-neutral-500">
                <div className="flex justify-between gap-2">
                  <dt>Responsável</dt>
                  <dd className="text-right">{projeto.responsavel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Avanço validado</dt>
                  <dd>
                    <DataValue value={projeto.percentualAvanco} status="em_atualizacao" />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Última atualização</dt>
                  <dd>
                    <DataValue value={projeto.ultimaAtualizacao} status="em_atualizacao" />
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Fonte</dt>
                  <dd className="text-right">{projeto.fonte}</dd>
                </div>
              </dl>
              {projeto.riscos.length > 0 && (
                <p className="mt-3 text-xs text-status-amber">Risco: {projeto.riscos.join('; ')}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}
