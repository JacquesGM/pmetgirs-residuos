import { useEffect, useMemo, useState } from 'react';
import projetosData from '../../data/projetos.json';
import eixosData from '../../data/eixos.json';
import { carregarColecaoPublicada } from '../../data/snapshot/loadSnapshot';
import type { Eixo, Projeto, StatusProjeto } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge, statusLabel } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { DataValue } from '../ui/DataValue';
import { DownloadButton } from '../ui/DownloadButton';
import type { DownloadColumn } from '../../lib/download';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { eixoIcons, iconFor } from '../../lib/icons';
import { uniqueOptions } from '../../lib/filters';

/**
 * Conteúdo embutido no bundle — o que o cidadão vê no primeiro quadro, e o que
 * ele continua vendo se o snapshot não puder ser lido.
 */
const projetosEmbutidos = projetosData as Projeto[];
const eixos = eixosData as Eixo[];

function eixoNome(id: string): string {
  return eixos.find((eixo) => eixo.id === id)?.nome ?? id;
}

const colunasProjetos: DownloadColumn<Projeto>[] = [
  { key: 'nome', label: 'Projeto' },
  { key: 'eixo', label: 'Eixo', value: (row) => eixoNome(row.eixo) },
  { key: 'status', label: 'Situação', value: (row) => statusLabel(row.status) },
  { key: 'responsavel', label: 'Responsável' },
  { key: 'abrangencia', label: 'Abrangência' },
  { key: 'percentualAvanco', label: 'Avanço (%)' },
  { key: 'fonte', label: 'Fonte' },
];

const ALL = 'todos';

export function Projects() {
  const [eixoFiltro, setEixoFiltro] = useState(ALL);
  const [statusFiltro, setStatusFiltro] = useState(ALL);
  const [responsavelFiltro, setResponsavelFiltro] = useState(ALL);

  /**
   * Embutido primeiro, publicado depois.
   *
   * A página renderiza na hora com o bundle — sem spinner e sem salto de
   * layout — e troca pelo snapshot quando ele chega. Se a leitura falhar, ou
   * se a contagem não bater com o manifesto, o cidadão segue vendo o que já
   * via. Um portal de transparência em branco porque a rede oscilou é pior que
   * um portal mostrando o release anterior.
   */
  const [projetos, setProjetos] = useState<Projeto[]>(projetosEmbutidos);

  useEffect(() => {
    const controle = new AbortController();
    carregarColecaoPublicada<Projeto>('projetos', controle.signal)
      .then((publicados) => {
        if (publicados) setProjetos(publicados);
      })
      .catch(() => {
        /* mantém o conteúdo embutido */
      });
    return () => controle.abort();
  }, []);

  const statusOptions = useMemo(
    () => uniqueOptions(projetos, (p) => p.status) as StatusProjeto[],
    [projetos],
  );
  const responsavelOptions = useMemo(
    () => uniqueOptions(projetos, (p) => p.responsavel),
    [projetos],
  );

  const filtrados = useMemo(() => {
    return projetos.filter((projeto) => {
      if (eixoFiltro !== ALL && projeto.eixo !== eixoFiltro) return false;
      if (statusFiltro !== ALL && projeto.status !== statusFiltro) return false;
      if (responsavelFiltro !== ALL && projeto.responsavel !== responsavelFiltro) return false;
      return true;
    });
  }, [projetos, eixoFiltro, statusFiltro, responsavelFiltro]);

  const limparFiltros = () => {
    setEixoFiltro(ALL);
    setStatusFiltro(ALL);
    setResponsavelFiltro(ALL);
  };

  return (
    <Section
      headingLevel={1}
      id="projetos"
      title="Portfólio de projetos"
      subtitle="Ações do PMetGIRS, com situação e responsável de cada uma."
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
        <DownloadButton
          filename="projetos-pmetgirs"
          title="Portfólio de projetos — PMetGIRS"
          data={projetos}
          columns={colunasProjetos}
        />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState message="Nenhum projeto encontrado para os filtros selecionados." onClear={limparFiltros} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((projeto) => {
            const Icon = iconFor(eixoIcons, projeto.eixo);
            return (
              <Card key={projeto.id} className="flex flex-col bg-white">
                <div className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-blue-600" />
                  <p className="text-left text-xs font-medium uppercase tracking-wide text-brand-blue-600">
                    {eixoNome(projeto.eixo)}
                  </p>
                </div>
                <p className="mt-1 font-semibold text-neutral-900">{projeto.nome}</p>
                <p className="mt-2 text-sm text-neutral-600">{projeto.descricao}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={projeto.status} />
                  <span className="text-xs text-neutral-500">{projeto.responsavel}</span>
                </div>
                {projeto.riscos.length > 0 && (
                  <p className="mt-3 text-xs text-status-amber">Risco: {projeto.riscos.join('; ')}</p>
                )}
                <InfoDisclosure label="Avanço, atualização e fonte">
                  <span className="block">
                    Avanço validado: <DataValue value={projeto.percentualAvanco} status="em_atualizacao" />
                  </span>
                  <span className="mt-1 block">
                    Última atualização: <DataValue value={projeto.ultimaAtualizacao} status="em_atualizacao" />
                  </span>
                  <span className="mt-1 block">Fonte: {projeto.fonte}</span>
                </InfoDisclosure>
              </Card>
            );
          })}
        </div>
      )}
    </Section>
  );
}
