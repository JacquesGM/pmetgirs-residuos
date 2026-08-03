import { Link } from 'react-router-dom';
import indicadoresData from '../../data/indicadores.json';
import type { Indicador } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { DownloadButton } from '../ui/DownloadButton';

const indicadores = indicadoresData as Indicador[];

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
    <Section
      id="indicadores"
      title="Indicadores de destaque"
      subtitle="Números que resumem a escala do desafio metropolitano de resíduos sólidos. Cada indicador informa fonte, período e situação de validação."
    >
      <div className="mb-6">
        <DownloadButton filename="indicadores-pmetgirs.json" data={indicadores} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {indicadores.map((indicador) => {
          const { prefixo, valor } = splitValorExibicao(indicador.valorExibicao);
          return (
          <Card key={indicador.id} className="flex flex-col">
            <p className="text-sm font-medium text-neutral-600">{indicador.nome}</p>
            {prefixo && <p className="mt-2 text-xs font-medium text-neutral-500">{prefixo}</p>}
            <p className="mt-1 break-words text-3xl font-extrabold text-brand-blue-700">{valor}</p>
            <p className="text-sm text-neutral-500">{indicador.unidade}</p>
            <div className="mt-3">
              <StatusBadge status={indicador.statusValidacao} />
            </div>
            <dl className="mt-4 space-y-1 text-xs text-neutral-500">
              <div className="flex justify-between gap-2">
                <dt>Período</dt>
                <dd className="text-right">{indicador.periodoReferencia}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Fonte</dt>
                <dd className="text-right">{indicador.fonte}</dd>
              </div>
            </dl>
            <InfoDisclosure label="Entenda este indicador">
              {indicador.observacao ?? 'Sem observações adicionais registradas para este indicador.'}
            </InfoDisclosure>
          </Card>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-neutral-600">
        Quer mais detalhes sobre as usinas e unidades previstas?{' '}
        <Link to="/infraestrutura" className="font-medium text-brand-blue-600 hover:underline">
          Consulte a infraestrutura planejada
        </Link>
        .
      </p>
    </Section>
  );
}
