import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import infraestruturasData from '../../data/infraestruturas.json';
import type { Infraestrutura } from '../../types';

const infraestruturas = infraestruturasData as Infraestrutura[];

const ITENS_COMPOSICAO = [
  'usinas-triagem',
  'total-unidades-termicas',
  'usinas-asfalto',
  'unidade-biodigestao',
  'areas-energia-solar',
];

export function parseQuantidade(valor: string): { numero: number; aproximado: boolean } {
  const aproximado = /^até/i.test(valor.trim());
  const match = valor.match(/\d+/);
  return { numero: match ? Number(match[0]) : 0, aproximado };
}

const chartData = ITENS_COMPOSICAO.map((id) => infraestruturas.find((item) => item.id === id))
  .filter((item): item is Infraestrutura => Boolean(item))
  .map((item) => {
    const { numero, aproximado } = parseQuantidade(item.quantidade);
    return {
      nome: item.nome,
      unidade: item.unidade,
      numero,
      aproximado,
      rotulo: aproximado ? `até ${numero}` : `${numero}`,
    };
  });

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof chartData)[number] }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-neutral-900">{item.nome}</p>
      <p className="text-brand-blue-700">
        <strong>{item.rotulo}</strong> {item.unidade}
      </p>
    </div>
  );
}

export function InfrastructureCompositionChart() {
  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900">Infraestrutura planejada, por tipo</p>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }} barCategoryGap={12}>
            <CartesianGrid horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#69717d' }} axisLine={{ stroke: '#d7dbe0' }} tickLine={false} />
            <YAxis type="category" dataKey="nome" width={170} tick={{ fontSize: 12, fill: '#3a3f47' }} axisLine={{ stroke: '#d7dbe0' }} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(31, 84, 136, 0.06)' }} />
            <Bar dataKey="numero" fill="#1f5488" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
              <LabelList dataKey="rotulo" position="right" style={{ fill: '#4f5560', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Não inclui as unidades de combustão e gaseificação, cuja divisão diverge entre os documentos (gráfico
        acima). Fonte: Plano de Ações e Prognóstico Geral do PMetGIRS.
      </p>
    </div>
  );
}
