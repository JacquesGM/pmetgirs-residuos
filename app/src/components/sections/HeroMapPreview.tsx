import { useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import municipiosData from '../../data/municipios.json';
import type { Municipio } from '../../types';

const municipios = municipiosData as Municipio[];

function radius(populacao: number): number {
  return Math.max(3, Math.min(14, Math.sqrt(populacao) / 300));
}

/**
 * Prévia não interativa do mapa real (ver /municipios), usada apenas como
 * imagem institucional decorativa no Hero — mesmas coordenadas e população
 * de municipios.json, sem inventar geografia.
 */
export function HeroMapPreview() {
  const center = useMemo<[number, number]>(() => [-22.75, -43.25], []);

  return (
    <MapContainer
      center={center}
      zoom={9}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      className="h-full w-full"
      aria-label="Mapa da Região Metropolitana do Rio de Janeiro com os 22 municípios"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {municipios.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={radius(m.populacao)}
          pathOptions={{
            color: '#ffffff',
            fillColor: '#2a6ca8',
            fillOpacity: 0.65,
            weight: 1.5,
            opacity: 0.9,
          }}
        />
      ))}
    </MapContainer>
  );
}
