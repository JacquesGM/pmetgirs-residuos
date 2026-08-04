import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import municipiosData from '../../data/municipios.json';
import type { Municipio } from '../../types';

const municipios = (municipiosData as Municipio[])
  .slice()
  .sort((a, b) => b.densidadeDemografica - a.densidadeDemografica);

const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Municipio }> }) {
  if (!active || !payload?.length) return null;
  const municipio = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-neutral-900">{municipio.nome}</p>
      <p className="text-brand-green-700">
        <strong>{numberFormatter.format(municipio.densidadeDemografica)}</strong> hab/km² ({municipio.densidadeAno})
      </p>
    </div>
  );
}

export function DensityChart() {
  const chartHeight = 40 + municipios.length * 26;

  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900">
        Densidade demográfica por município (IBGE, {municipios[0].densidadeAno})
      </p>
      <div style={{ height: chartHeight }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={municipios}
            layout="vertical"
            margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
            barCategoryGap={4}
          >
            <CartesianGrid horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#69717d' }} axisLine={{ stroke: '#d7dbe0' }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="nome"
              width={130}
              tick={{ fontSize: 12, fill: '#3a3f47' }}
              axisLine={{ stroke: '#d7dbe0' }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(36, 128, 73, 0.06)' }} />
            <Bar dataKey="densidadeDemografica" fill="#248049" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              <LabelList
                dataKey="densidadeDemografica"
                position="right"
                formatter={(v: number) => numberFormatter.format(v)}
                style={{ fill: '#4f5560', fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Fonte: IBGE, 2010 — Diagnóstico Geral do PMetGIRS (Tabela 4). Referência mais antiga que a população,
        conforme o próprio documento.
      </p>
    </div>
  );
}
