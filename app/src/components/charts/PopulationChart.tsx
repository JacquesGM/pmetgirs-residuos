import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import municipiosData from '../../data/municipios.json';
import type { Municipio } from '../../types';
import { ChartFigure } from '../ui/ChartFigure';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const municipiosEmbutidos = municipiosData as Municipio[];

const compactFormatter = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const fullFormatter = new Intl.NumberFormat('pt-BR');

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Municipio }> }) {
  if (!active || !payload?.length) return null;
  const municipio = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-neutral-900">{municipio.nome}</p>
      <p className="text-brand-blue-700">
        <strong>{fullFormatter.format(municipio.populacao)}</strong> habitantes ({municipio.populacaoAno})
      </p>
    </div>
  );
}

export function PopulationChart() {
  const publicados = useColecaoPublicada<Municipio>('municipios', municipiosEmbutidos);
  const municipios = useMemo(() => publicados.slice().sort((a, b) => b.populacao - a.populacao), [publicados]);

  const chartHeight = 40 + municipios.length * 26;
  const ano = municipios[0].populacaoAno;
  const maior = municipios[0];
  const menor = municipios[municipios.length - 1];

  return (
    <ChartFigure
      title={`População por município (IBGE, ${ano})`}
      description={
        `Gráfico de barras com a população dos ${municipios.length} municípios da Região Metropolitana ` +
        `do Rio de Janeiro em ${ano}, do maior para o menor. Vai de ${maior.nome}, com ` +
        `${fullFormatter.format(maior.populacao)} habitantes, a ${menor.nome}, com ` +
        `${fullFormatter.format(menor.populacao)}.`
      }
      height={chartHeight}
      table={{
        columns: ['Município', 'População'],
        rows: municipios.map((m) => [m.nome, fullFormatter.format(m.populacao)]),
      }}
      note={<>Fonte: IBGE, {ano} — Diagnóstico Geral do PMetGIRS (Tabela 4).</>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={municipios}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
          barCategoryGap={4}
        >
          <CartesianGrid horizontal={false} stroke="#e5e7eb" />
          <XAxis
            type="number"
            tickFormatter={(v) => compactFormatter.format(v)}
            tick={{ fontSize: 12, fill: '#69717d' }}
            axisLine={{ stroke: '#d7dbe0' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={130}
            tick={{ fontSize: 12, fill: '#3a3f47' }}
            axisLine={{ stroke: '#d7dbe0' }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(42, 108, 168, 0.06)' }} />
          <Bar dataKey="populacao" fill="#1f5488" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
            <LabelList
              dataKey="populacao"
              position="right"
              formatter={(v: number) => compactFormatter.format(v)}
              style={{ fill: '#4f5560', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
