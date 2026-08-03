import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import infraestruturasData from '../../data/infraestruturas.json';
import type { Infraestrutura } from '../../types';

const infraestruturas = infraestruturasData as Infraestrutura[];

const PLANO_ACOES = 'Plano de Ações';
const PROGNOSTICO = 'Prognóstico Geral';

function parseQuantidade(valor: string): number {
  const match = valor.match(/^\d+/);
  return match ? Number(match[0]) : 0;
}

function buildSerie(id: string) {
  const item = infraestruturas.find((i) => i.id === id);
  const divergentes = item?.valoresDivergentes ?? [];
  const planoAcoes = divergentes.find((v) => v.fonte.startsWith('Plano de Ações'));
  const prognostico = divergentes.find((v) => v.fonte.startsWith('Prognóstico'));
  return {
    [PLANO_ACOES]: planoAcoes ? parseQuantidade(planoAcoes.valor) : null,
    [PROGNOSTICO]: prognostico ? parseQuantidade(prognostico.valor) : null,
  };
}

const chartData = [
  { categoria: 'Usinas de combustão', ...buildSerie('unidades-combustao') },
  { categoria: 'Gaseificação / termodegradação', ...buildSerie('gaseificacao-termodegradacao') },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-neutral-900">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          <strong>{entry.value}</strong> — {entry.name}
        </p>
      ))}
    </div>
  );
}

export function InfrastructureDivergenceChart() {
  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900">
        Distribuição divergente das unidades térmicas, por fonte
      </p>
      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="categoria" tick={{ fontSize: 12, fill: '#3a3f47' }} axisLine={{ stroke: '#d7dbe0' }} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#69717d' }} axisLine={{ stroke: '#d7dbe0' }} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar dataKey={PLANO_ACOES} fill="#2a6ca8" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
            <Bar dataKey={PROGNOSTICO} fill="#2f9e5c" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        As duas fontes são apresentadas lado a lado — nenhuma foi escolhida silenciosamente. Ver aviso de
        transparência acima e a tabela abaixo para os valores exatos.
      </p>
    </div>
  );
}
