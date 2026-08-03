import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import municipiosData from '../../data/municipios.json';
import type { Municipio } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { PopulationChart } from '../charts/PopulationChart';

const municipios = municipiosData as Municipio[];

function radiusForPopulation(populacao: number): number {
  return Math.max(6, Math.min(28, Math.sqrt(populacao) / 65));
}

export function MetropolitanMap() {
  const [selecionado, setSelecionado] = useState<Municipio | null>(null);

  const center = useMemo<[number, number]>(() => [-22.75, -43.25], []);

  return (
    <Section
      id="mapa"
      title="Mapa da Região Metropolitana"
      subtitle="Selecione um município para consultar população, área e situação de dados. Onde não houver informação consolidada de geração de resíduos ou projetos, a página indica 'Informação em atualização'."
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-[420px] overflow-hidden rounded-xl border border-neutral-200 sm:h-[480px]">
          <MapContainer
            center={center}
            zoom={9}
            scrollWheelZoom={false}
            className="h-full w-full"
            aria-label="Mapa interativo dos 22 municípios da Região Metropolitana do Rio de Janeiro"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {municipios.map((municipio) => (
              <CircleMarker
                key={municipio.id}
                center={[municipio.lat, municipio.lng]}
                radius={radiusForPopulation(municipio.populacao)}
                pathOptions={{
                  color: '#1f5488',
                  fillColor: '#2a6ca8',
                  fillOpacity: 0.55,
                  weight: 1.5,
                }}
                eventHandlers={{ click: () => setSelecionado(municipio) }}
              >
                <Popup>
                  <strong>{municipio.nome}</strong>
                  <br />
                  População ({municipio.populacaoAno}): {municipio.populacao.toLocaleString('pt-BR')}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <Card>
          {selecionado ? (
            <div>
              <p className="font-semibold text-neutral-900">{selecionado.nome}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">População ({selecionado.populacaoAno})</dt>
                  <dd className="font-medium">{selecionado.populacao.toLocaleString('pt-BR')}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Área territorial</dt>
                  <dd className="font-medium">{selecionado.areaTerritorialKm2.toLocaleString('pt-BR')} km²</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Área urbanizada</dt>
                  <dd className="font-medium">{selecionado.areaUrbanizadaKm2.toLocaleString('pt-BR')} km²</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Densidade demográfica ({selecionado.densidadeAno})</dt>
                  <dd className="font-medium">{selecionado.densidadeDemografica.toLocaleString('pt-BR')} hab/km²</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Geração de resíduos e projetos locais</dt>
                  <dd className="italic text-neutral-500">Informação em atualização</dd>
                </div>
              </dl>
              <div className="mt-3">
                <StatusBadge status={selecionado.statusDados} />
              </div>
              <p className="mt-3 text-xs text-neutral-500">Fonte: {selecionado.fonte}</p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Clique em um dos 22 municípios no mapa para ver seus dados.
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <PopulationChart />
      </Card>
    </Section>
  );
}
