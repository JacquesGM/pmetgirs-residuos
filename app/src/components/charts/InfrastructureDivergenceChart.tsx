import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import infraestruturasData from '../../data/infraestruturas.json';
import type { Infraestrutura } from '../../types';
import { ChartFigure } from '../ui/ChartFigure';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const infraestruturasEmbutidos = infraestruturasData as Infraestrutura[];

/**
 * Uma série por fonte, derivada do dado.
 *
 * Este gráfico já teve duas séries fixas — "Plano de Ações" e "Prognóstico
 * Geral" — casadas por prefixo com `find()`. Quando a leitura dos volumes, em
 * 16/08/2026, revelou que o Plano de Ações diverge de si mesmo (a sua tabela
 * diz 13 usinas de combustão, o seu texto corrido diz 15), o `find()` passou a
 * devolver a primeira e **descartar a segunda em silêncio** — o oposto do que
 * a legenda do gráfico promete. Agora as fontes vêm dos dados: se aparecer uma
 * quarta, ela é desenhada.
 */
const IDS = [
  { id: 'unidades-combustao', categoria: 'Usinas de combustão' },
  { id: 'gaseificacao-termodegradacao', categoria: 'Gaseificação / termodegradação' },
] as const;

/** Distinguíveis também em escala de cinza e por posição, nunca só por matiz. */
const CORES = ['#2a6ca8', '#2f9e5c', '#8a4fbd', '#b26a12'];

function parseQuantidade(valor: string): number | null {
  const match = valor.match(/^\d+/);
  return match ? Number(match[0]) : null;
}

/** Fontes na ordem em que aparecem, sem repetir. */
function fontesDistintas(infraestruturas: Infraestrutura[]): string[] {
  const vistas: string[] = [];
  for (const { id } of IDS) {
    for (const v of infraestruturas.find((i) => i.id === id)?.valoresDivergentes ?? []) {
      if (!vistas.includes(v.fonte)) vistas.push(v.fonte);
    }
  }
  return vistas;
}

function montarDados(infraestruturas: Infraestrutura[], fontes: string[]) {
  return IDS.map(({ id, categoria }) => {
    const divergentes = infraestruturas.find((i) => i.id === id)?.valoresDivergentes ?? [];
    const linha: Record<string, string | number | null> = { categoria };
    for (const fonte of fontes) {
      const achado = divergentes.find((v) => v.fonte === fonte);
      linha[fonte] = achado ? parseQuantidade(achado.valor) : null;
    }
    return linha;
  });
}

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
  const infraestruturas = useColecaoPublicada<Infraestrutura>('infraestruturas', infraestruturasEmbutidos);
  const fontes = useMemo(() => fontesDistintas(infraestruturas), [infraestruturas]);
  const chartData = useMemo(() => montarDados(infraestruturas, fontes), [infraestruturas, fontes]);

  const resumo = chartData
    .map((d) =>
      `${d.categoria} — ` +
      fontes.map((f) => `${f}: ${d[f] ?? 'não informado'}`).join(', '),
    )
    .join('; ');

  return (
    <ChartFigure
      title="Distribuição divergente das unidades térmicas, por fonte"
      description={
        `Gráfico de barras agrupadas comparando o que cada documento oficial afirma sobre a ` +
        `divisão das unidades térmicas entre combustão e gaseificação. ${resumo}. ` +
        `As ${fontes.length} fontes são apresentadas lado a lado, sem escolher nenhuma delas.`
      }
      height="18rem"
      table={{
        columns: ['Tecnologia', ...fontes],
        rows: chartData.map((d) => [
          String(d.categoria),
          ...fontes.map((f) => (d[f] === null || d[f] === undefined ? 'Não informado' : String(d[f]))),
        ]),
      }}
      note={
        <>
          As fontes são apresentadas lado a lado, sem escolher nenhuma delas silenciosamente. O total
          também diverge — ver aviso de transparência acima.
        </>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="categoria"
            tick={{ fontSize: 12, fill: '#3a3f47' }}
            axisLine={{ stroke: '#d7dbe0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#69717d' }}
            axisLine={{ stroke: '#d7dbe0' }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          {fontes.map((fonte, i) => (
            <Bar
              key={fonte}
              dataKey={fonte}
              fill={CORES[i % CORES.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
