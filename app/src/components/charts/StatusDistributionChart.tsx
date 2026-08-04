import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StatusProjeto } from '../../types';
import { statusColorHex, statusLabel } from '../ui/StatusBadge';

interface StatusDistributionChartProps {
  title: string;
  statuses: StatusProjeto[];
  source: string;
}

export function groupStatuses(statuses: StatusProjeto[]) {
  const counts = new Map<StatusProjeto, number>();
  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, label: statusLabel(status), count, color: statusColorHex(status) }))
    .sort((a, b) => b.count - a.count);
}

export function StatusDistributionChart({ title, statuses, source }: StatusDistributionChartProps) {
  const total = statuses.length;
  const data = groupStatuses(statuses);

  function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof data)[number] }> }) {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
    return (
      <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-md">
        <p className="font-semibold text-neutral-900">{item.label}</p>
        <p style={{ color: item.color }}>
          <strong>{item.count}</strong> de {total} ({pct}%)
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#69717d' }} axisLine={{ stroke: '#d7dbe0' }} tickLine={false} />
            <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 12, fill: '#3a3f47' }} axisLine={{ stroke: '#d7dbe0' }} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.status} fill={entry.color} />
              ))}
              <LabelList dataKey="count" position="right" style={{ fill: '#4f5560', fontSize: 12, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Fonte: {source}. Total: {total}.
      </p>
    </div>
  );
}
