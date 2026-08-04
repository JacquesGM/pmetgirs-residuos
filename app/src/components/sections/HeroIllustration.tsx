import municipiosData from '../../data/municipios.json';
import type { Municipio } from '../../types';

const municipios = municipiosData as Municipio[];

// Correção simples de longitude pela latitude média da RMRJ, só para o
// aglomerado de pontos não ficar esticado — é uma ilustração lúdica, não
// uma projeção cartográfica.
const avgLatRad = (municipios.reduce((sum, m) => sum + m.lat, 0) / municipios.length) * (Math.PI / 180);
const lngCorrection = Math.cos(avgLatRad);

const pontos = municipios.map((m) => ({ ...m, xDeg: m.lng * lngCorrection, yDeg: m.lat }));
const minX = Math.min(...pontos.map((p) => p.xDeg));
const maxX = Math.max(...pontos.map((p) => p.xDeg));
const minY = Math.min(...pontos.map((p) => p.yDeg));
const maxY = Math.max(...pontos.map((p) => p.yDeg));

const WIDTH = 468;
const HEIGHT = 200;
const PAD_X = 40;
const TOP_PAD = 24;
const SEA_TOP = 148; // onde a faixa de "mar" começa

function radius(populacao: number): number {
  return Math.max(3, Math.min(14, Math.sqrt(populacao) / 220));
}

function project(p: { xDeg: number; yDeg: number }) {
  const x = PAD_X + ((p.xDeg - minX) / (maxX - minX)) * (WIDTH - PAD_X * 2);
  const y = TOP_PAD + ((maxY - p.yDeg) / (maxY - minY)) * (SEA_TOP - TOP_PAD - 10);
  return { x, y };
}

// Onda simples e repetida para sugerir o litoral, sem pretender ser um traçado real.
function wavePath(baseY: number, amplitude: number, humps: number): string {
  const step = WIDTH / humps;
  let d = `M 0 ${baseY}`;
  for (let i = 0; i < humps; i++) {
    const controlX = step * i + step / 2;
    const controlY = baseY + (i % 2 === 0 ? -amplitude : amplitude);
    const endX = step * (i + 1);
    d += ` Q ${controlX} ${controlY} ${endX} ${baseY}`;
  }
  d += ` L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;
  return d;
}

const hubIds = ['rio-de-janeiro', 'niteroi', 'duque-de-caxias', 'sao-goncalo'];

export function HeroIllustration() {
  const porId = Object.fromEntries(pontos.map((p) => [p.id, { ...p, ...project(p) }]));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-full w-full"
      role="img"
      aria-label="Ilustração lúdica da Região Metropolitana do Rio de Janeiro, com um ponto para cada um dos 22 municípios, proporcional à população"
    >
      {/* sol */}
      <circle cx={WIDTH - 56} cy={40} r={16} fill="#fde68a" fillOpacity={0.85} />
      {[0, 45, 90, 135].map((angle) => (
        <line
          key={angle}
          x1={WIDTH - 56 + Math.cos((angle * Math.PI) / 180) * 24}
          y1={40 + Math.sin((angle * Math.PI) / 180) * 24}
          x2={WIDTH - 56 + Math.cos((angle * Math.PI) / 180) * 32}
          y2={40 + Math.sin((angle * Math.PI) / 180) * 32}
          stroke="#fde68a"
          strokeOpacity={0.7}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}

      {/* nuvens */}
      {[
        { cx: 70, cy: 30 },
        { cx: 150, cy: 52 },
      ].map((cloud, i) => (
        <g key={i} opacity={0.5}>
          <circle cx={cloud.cx} cy={cloud.cy} r={10} fill="white" />
          <circle cx={cloud.cx + 12} cy={cloud.cy + 3} r={8} fill="white" />
          <circle cx={cloud.cx - 11} cy={cloud.cy + 4} r={7} fill="white" />
        </g>
      ))}

      {/* mar */}
      <path d={wavePath(SEA_TOP, 6, 12)} fill="white" fillOpacity={0.16} />
      <path d={wavePath(SEA_TOP + 14, 5, 10)} fill="white" fillOpacity={0.12} />

      {/* conexões entre os principais polos, sugerindo integração metropolitana */}
      {hubIds.slice(1).map((id) => (
        <line
          key={id}
          x1={porId['rio-de-janeiro'].x}
          y1={porId['rio-de-janeiro'].y}
          x2={porId[id].x}
          y2={porId[id].y}
          stroke="white"
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
      ))}

      {/* municípios */}
      {pontos.map((p) => {
        const { x, y } = project(p);
        const destaque = p.id === 'rio-de-janeiro';
        return (
          <circle
            key={p.id}
            cx={x}
            cy={y}
            r={radius(p.populacao)}
            fill={destaque ? '#fde68a' : 'white'}
            fillOpacity={destaque ? 0.9 : 0.55}
            stroke="white"
            strokeOpacity={0.9}
            strokeWidth={1.25}
          />
        );
      })}
    </svg>
  );
}
