import { CartesianGrid, Label, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import metasData from '../../data/metas.json';
import type { Meta } from '../../types';

const metas = metasData as Meta[];

function parseLeadingNumber(text: string): number {
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

const chartData = ['coleta-seletiva-50', 'coleta-seletiva-75', 'coleta-seletiva-100']
  .map((id) => metas.find((m) => m.id === id))
  .filter((m): m is Meta => Boolean(m))
  .map((meta) => ({
    ano: parseLeadingNumber(meta.prazo),
    percentual: parseLeadingNumber(meta.resultadoEsperado),
    nome: meta.nome,
  }));

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof chartData)[number] }> }) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload;
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-neutral-900">{ponto.nome}</p>
      <p className="text-brand-green-700">
        Meta: <strong>{ponto.percentual}%</strong> em até {ponto.ano} anos
      </p>
    </div>
  );
}

export function GoalsTargetChart() {
  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900">
        Trajetória-alvo da coleta seletiva
      </p>
      <p className="text-xs text-neutral-500">
        Linha tracejada = metas do Plano de Ações. Não representa resultado obtido: o resultado atual
        de cada meta segue "Em atualização" (ver cards abaixo).
      </p>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="ano"
              type="number"
              domain={[0, 20]}
              ticks={[2, 10, 20]}
              tick={{ fontSize: 12, fill: '#69717d' }}
              axisLine={{ stroke: '#d7dbe0' }}
              tickLine={false}
            >
              <Label value="Anos desde o início do plano" position="insideBottom" offset={-4} style={{ fontSize: 11, fill: '#69717d' }} />
            </XAxis>
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 75, 100]}
              tick={{ fontSize: 12, fill: '#69717d' }}
              axisLine={{ stroke: '#d7dbe0' }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="percentual"
              name="Meta de cobertura"
              stroke="#248049"
              strokeWidth={2}
              strokeDasharray="6 4"
              isAnimationActive={false}
              dot={{ r: 5, fill: '#248049', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              label={{ position: 'top', formatter: (v: number) => `${v}%`, fontSize: 12, fill: '#1a5f37' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
