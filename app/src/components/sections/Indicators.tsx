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

const indicadores = indicadoresData as Indicador[];
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

const prefixosQualificadores = ['aproximadamente', 'até'];

function splitValorExibicao(valor: string): { prefixo: string | null; valor: string } {
  for (const prefixo of prefixosQualificadores) {
    if (valor.toLowerCase().startsWith(prefixo)) {
      return { prefixo: valor.slice(0, prefixo.length), valor: valor.slice(prefixo.length).trim() };
    }
  }
  return { prefixo: null, valor };
}

export function Indicators() {
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
    </Section>
  );
}
