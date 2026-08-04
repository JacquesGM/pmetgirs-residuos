import inconsistenciasData from '../../data/inconsistencias.json';
import glossarioData from '../../data/glossario.json';
import type { Inconsistencia, StatusValidacao, TermoGlossario } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { InfoDisclosure } from '../ui/InfoDisclosure';

const inconsistencias = inconsistenciasData as Inconsistencia[];
const glossario = glossarioData as TermoGlossario[];

const selos: { status: StatusValidacao; descricao: string }[] = [
  { status: 'dado_oficial_validado', descricao: 'Confirmado por fonte oficial (ex.: IBGE) ou pelo IRM.' },
  { status: 'dado_municipal_declarado', descricao: 'Declarado por um município, sem validação cruzada ainda.' },
  { status: 'estimativa_tecnica', descricao: 'Calculado pelos estudos técnicos do PMetGIRS.' },
  { status: 'dado_historico', descricao: 'Referência de períodos anteriores, para comparação.' },
  { status: 'dado_preliminar', descricao: 'Primeira versão, sujeita a revisão.' },
  { status: 'em_atualizacao', descricao: 'Aguardando nova coleta ou consolidação.' },
  { status: 'em_validacao', descricao: 'Versões diferentes do mesmo dado, ainda não conciliadas.' },
  { status: 'informacao_divergente', descricao: 'Divergência confirmada entre fontes.' },
];

const divergencias = inconsistencias.filter((i) => i.categoria === 'divergencia_de_dados');
const pontosEmRevisao = inconsistencias.filter((i) => i.categoria === 'ponto_em_revisao');

function IncidentCard({ item }: { item: Inconsistencia }) {
  return (
    <Card>
      <p className="font-semibold text-neutral-900">{item.titulo}</p>
      <p className="mt-2 text-sm text-neutral-600">{item.descricao}</p>
      {item.fontes && (
        <ul className="mt-2 space-y-0.5 text-xs text-neutral-500">
          {item.fontes.map((f) => (
            <li key={f.fonte}>
              {f.fonte}: {f.valor}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={item.situacao} />
        <span className="text-xs text-neutral-500">{item.areaResponsavel}</span>
      </div>
      <InfoDisclosure label="Impacto e encaminhamento">
        <span className="block">{item.impacto}</span>
        {item.encaminhamento && <span className="mt-1 block">{item.encaminhamento}</span>}
      </InfoDisclosure>
    </Card>
  );
}

export function Transparency() {
  return (
    <Section
      id="transparencia"
      title="Transparência dos dados"
      subtitle="Cada dado mostra sua origem e situação de validação. Divergências entre documentos ficam sinalizadas, nunca escondidas."
      tone="muted"
    >
      <div className="mb-10">
        <p className="mb-4 font-semibold text-neutral-900">Selos de dado</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {selos.map((selo) => (
            <div key={selo.status} className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3">
              <StatusBadge status={selo.status} />
              <p className="text-sm text-neutral-600">{selo.descricao}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10">
        <p className="mb-4 font-semibold text-neutral-900">Divergências de dados confirmadas</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {divergencias.map((item) => (
            <IncidentCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      <div className="mb-10">
        <p className="mb-4 font-semibold text-neutral-900">Pontos em revisão</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pontosEmRevisao.map((item) => (
            <IncidentCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-4 font-semibold text-neutral-900">Glossário de siglas e termos técnicos</p>
        <dl className="grid gap-x-8 gap-y-3 rounded-xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
          {glossario.map((termo) => (
            <div key={termo.sigla} className="border-b border-neutral-100 pb-3 sm:border-0 sm:pb-0">
              <dt className="font-semibold text-neutral-900">{termo.sigla}</dt>
              <dd className="text-sm text-neutral-600">{termo.significado}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
