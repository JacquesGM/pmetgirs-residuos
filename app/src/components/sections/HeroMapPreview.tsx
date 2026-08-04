import { useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import municipiosData from '../../data/municipios.json';
import type { Municipio } from '../../types';

const municipios = municipiosData as Municipio[];

function radius(populacao: number): number {
  return Math.max(4, Math.min(16, Math.sqrt(populacao) / 200));
}

/**
 * Prévia não interativa do mapa real da RMRJ, usada como imagem institucional
 * no Hero — mesmas coordenadas e população de municipios.json (nada
 * inventado), com tiles CARTO Voyager para um visual mais colorido e lúdico
 * do que o estilo padrão do OpenStreetMap.
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
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {municipios.map((m) => {
        const destaque = m.id === 'rio-de-janeiro';
        return (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={radius(m.populacao)}
            pathOptions={{
              color: '#ffffff',
              fillColor: destaque ? '#fbbf24' : '#2f9e5c',
              fillOpacity: 0.85,
              weight: 2,
              opacity: 0.95,
            }}
          />
        );
      })}
    </MapContainer>
  );
}
