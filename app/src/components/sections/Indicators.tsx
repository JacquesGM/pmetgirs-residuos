import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import indicadoresData from '../../data/indicadores.json';
import projetosData from '../../data/projetos.json';
import eixosData from '../../data/eixos.json';
import type { Eixo, Indicador, Projeto } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge, statusLabel } from '../ui/StatusBadge';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { DownloadButton } from '../ui/DownloadButton';
import type { DownloadColumn } from '../../lib/download';
import { indicadorIcons, iconFor } from '../../lib/icons';
import { StatusDistributionChart } from '../charts/StatusDistributionChart';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';
import { WasteComposition } from './WasteComposition';

const indicadoresEmbutidos = indicadoresData as Indicador[];
const projetos = projetosData as Projeto[];
const eixos = eixosData as Eixo[];

const colunasIndicadores: DownloadColumn<Indicador>[] = [
  { key: 'nome', label: 'Indicador' },
  { key: 'valorExibicao', label: 'Valor' },
  { key: 'unidade', label: 'Unidade' },
  { key: 'periodoReferencia', label: 'Período de referência' },
  { key: 'statusValidacao', label: 'Situação do dado', value: (row) => statusLabel(row.statusValidacao) },
  { key: 'fonte', label: 'Fonte' },
  { key: 'observacao', label: 'Observação' },
];

const colunasCatalogo: DownloadColumn<Indicador>[] = [
  { key: 'nome', label: 'Indicador' },
  { key: 'fonte', label: 'Fonte' },
  { key: 'observacao', label: 'Observação' },
];

const prefixosQualificadores = ['aproximadamente', 'até'];

function splitValorExibicao(valor: string | null): { prefixo: string | null; valor: string } {
  // Sem valor exibido não há número: o rótulo diz isso em vez de mostrar vazio.
  if (!valor) return { prefixo: null, valor: 'Não informado' };
  for (const prefixo of prefixosQualificadores) {
    if (valor.toLowerCase().startsWith(prefixo)) {
      return { prefixo: valor.slice(0, prefixo.length), valor: valor.slice(prefixo.length).trim() };
    }
  }
  return { prefixo: null, valor };
}

export function Indicators() {
  const todos = useColecaoPublicada<Indicador>('indicadores', indicadoresEmbutidos);

  // Os cards de destaque são medição. O catálogo do SNIS é definição do que
  // deve ser observado, e não traz um único valor apurado para a RMRJ —
  // misturá-lo aqui faria 48 fichas vazias parecerem medida faltante.
  const indicadores = useMemo(() => todos.filter((i) => i.natureza === 'medido'), [todos]);
  const catalogo = useMemo(() => todos.filter((i) => i.natureza === 'catalogo_snis'), [todos]);

  return (
    <Section headingLevel={1} id="indicadores" title="Indicadores de destaque" subtitle="Os principais números do desafio metropolitano de resíduos sólidos.">
      <div className="mb-6">
        <DownloadButton
          filename="indicadores-pmetgirs"
          title="Indicadores de destaque — PMetGIRS"
          data={indicadores}
          columns={colunasIndicadores}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((indicador) => {
          const { prefixo, valor } = splitValorExibicao(indicador.valorExibicao);
          const Icon = iconFor(indicadorIcons, indicador.id);
          return (
            <Card key={indicador.id} className="flex flex-col">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue-600">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-medium text-neutral-600">{indicador.nome}</p>
              {prefixo && <p className="mt-2 text-xs font-medium text-neutral-500">{prefixo}</p>}
              <p className="mt-1 break-words text-3xl font-extrabold text-brand-blue-700">{valor}</p>
              <p className="text-sm text-neutral-500">{indicador.unidade}</p>
              <div className="mt-3">
                <StatusBadge status={indicador.statusValidacao} />
              </div>
              <InfoDisclosure label="Fonte e período">
                {indicador.periodoReferencia} · {indicador.fonte}
                {indicador.observacao && <span className="mt-1 block">{indicador.observacao}</span>}
              </InfoDisclosure>
            </Card>
          );
        })}
      </div>
      {catalogo.length > 0 && (
        <Card className="mt-8">
          <h3 className="text-lg font-semibold text-neutral-800">
            Indicadores do SNIS a monitorar
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            A Tabela 25 do Plano de Ações lista {catalogo.length} indicadores do Sistema Nacional de
            Informações sobre Saneamento que devem ser acompanhados. O documento define o que medir;
            ele <strong>não publica valores apurados</strong> para a Região Metropolitana.
          </p>
          <div className="mt-4">
            <DownloadButton
              filename="indicadores-snis-pmetgirs"
              title="Indicadores do SNIS a monitorar — PMetGIRS"
              data={catalogo}
              columns={colunasCatalogo}
            />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">
                Indicadores do SNIS listados na Tabela 25 do Plano de Ações, sem valor apurado.
              </caption>
              <thead>
                <tr className="border-b border-neutral-300 text-neutral-700">
                  <th scope="col" className="py-2 pr-4 font-semibold">Código</th>
                  <th scope="col" className="py-2 font-semibold">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {catalogo.map((i) => {
                  const [codigo, ...resto] = i.nome.split(' — ');
                  return (
                    <tr key={i.id} className="border-b border-neutral-200 align-top">
                      <th scope="row" className="py-2 pr-4 font-mono font-medium text-neutral-700">
                        {codigo}
                      </th>
                      <td className="py-2 text-neutral-600">{resto.join(' — ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-500">Fonte: SNIS, 2023.</p>
        </Card>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <StatusDistributionChart
            title="Situação dos projetos"
            statuses={projetos.map((p) => p.status)}
            source="Plano de Ações do PMetGIRS"
          />
        </Card>
        <Card>
          <StatusDistributionChart
            title="Situação dos eixos estratégicos"
            statuses={eixos.map((e) => e.situacao)}
            source="Plano de Ações do PMetGIRS"
          />
        </Card>
      </div>

      <p className="mt-6 text-sm text-neutral-600">
        Veja também a{' '}
        <Link to="/infraestrutura" className="font-medium text-brand-blue-600 hover:underline">
          infraestrutura planejada
        </Link>
        .
      </p>

      <WasteComposition />
    </Section>
  );
}
