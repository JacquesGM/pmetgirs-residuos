import inconsistenciasData from '../../data/inconsistencias.json';
import type { Inconsistencia, StatusValidacao } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';

const inconsistencias = inconsistenciasData as Inconsistencia[];

const selos: { status: StatusValidacao; descricao: string }[] = [
  { status: 'dado_oficial_validado', descricao: 'Dado confirmado por fonte oficial (ex.: IBGE) ou consolidado formalmente pelo IRM.' },
  { status: 'dado_municipal_declarado', descricao: 'Informação declarada por um município, ainda sem validação técnica cruzada.' },
  { status: 'estimativa_tecnica', descricao: 'Valor calculado tecnicamente pelos estudos do PMetGIRS (Diagnóstico, Prognóstico ou Plano de Ações).' },
  { status: 'dado_historico', descricao: 'Dado de referência de períodos anteriores, mantido para efeito de comparação.' },
  { status: 'dado_preliminar', descricao: 'Primeira versão de um dado, sujeita a revisão antes da consolidação final.' },
  { status: 'em_atualizacao', descricao: 'Informação aguardando nova coleta ou consolidação — evita-se exibir valor zero ou vazio.' },
  { status: 'em_validacao', descricao: 'Existem versões diferentes do mesmo dado nos documentos oficiais, ainda não conciliadas.' },
  { status: 'informacao_divergente', descricao: 'Divergência confirmada entre fontes, sinalizada explicitamente até resolução.' },
];

const divergencias = inconsistencias.filter((i) => i.categoria === 'divergencia_de_dados');
const pontosEmRevisao = inconsistencias.filter((i) => i.categoria === 'ponto_em_revisao');

function IncidentCard({ item }: { item: Inconsistencia }) {
  return (
    <Card>
      <p className="font-semibold text-neutral-900">{item.titulo}</p>
      <p className="mt-2 text-sm text-neutral-600">{item.descricao}</p>
      <p className="mt-2 text-xs text-neutral-500">
        <strong className="font-medium text-neutral-700">Impacto: </strong>
        {item.impacto}
      </p>
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
        <span className="text-xs text-neutral-500">Responsável: {item.areaResponsavel}</span>
      </div>
      {item.encaminhamento && (
        <p className="mt-2 text-xs text-neutral-500">
          <strong className="font-medium text-neutral-700">Encaminhamento: </strong>
          {item.encaminhamento}
        </p>
      )}
    </Card>
  );
}

export function Transparency() {
  return (
    <Section
      id="transparencia"
      title="Transparência dos dados"
      subtitle="Todo dado publicado nesta página informa origem, metodologia e situação de validação. Divergências entre documentos não são ocultadas — são sinalizadas até a consolidação oficial."
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

      <div>
        <p className="mb-4 font-semibold text-neutral-900">Pontos em revisão</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pontosEmRevisao.map((item) => (
            <IncidentCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </Section>
  );
}
