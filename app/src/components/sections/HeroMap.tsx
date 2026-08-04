import municipiosData from '../../data/municipios.json';
import type { Municipio } from '../../types';

const municipios = municipiosData as Municipio[];

// Correção simples de longitude pela latitude média da RMRJ, para que o desenho
// não fique esticado — é um mapa estilizado, não uma projeção cartográfica exata.
const avgLatRad = (municipios.reduce((sum, m) => sum + m.lat, 0) / municipios.length) * (Math.PI / 180);
const lngCorrection = Math.cos(avgLatRad);

const pontos = municipios.map((m) => ({ ...m, xDeg: m.lng * lngCorrection, yDeg: m.lat }));

const minX = Math.min(...pontos.map((p) => p.xDeg));
const maxX = Math.max(...pontos.map((p) => p.xDeg));
const minY = Math.min(...pontos.map((p) => p.yDeg));
const maxY = Math.max(...pontos.map((p) => p.yDeg));

const WIDTH = 468;
const HEIGHT = 200;
const PADDING = 20;

function radius(populacao: number): number {
  return Math.max(2.5, Math.min(13, Math.sqrt(populacao) / 220));
}

export function HeroMap() {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-full w-full"
      role="img"
      aria-label="Mapa estilizado dos 22 municípios da Região Metropolitana do Rio de Janeiro, com o tamanho de cada ponto proporcional à população"
    >
      {pontos.map((p) => {
        const x = PADDING + ((p.xDeg - minX) / (maxX - minX)) * (WIDTH - PADDING * 2);
        const y = PADDING + ((maxY - p.yDeg) / (maxY - minY)) * (HEIGHT - PADDING * 2);
        const destaque = p.id === 'rio-de-janeiro';
        return (
          <circle
            key={p.id}
            cx={x}
            cy={y}
            r={radius(p.populacao)}
            fill="white"
            fillOpacity={destaque ? 0.55 : 0.3}
            stroke="white"
            strokeOpacity={0.85}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
