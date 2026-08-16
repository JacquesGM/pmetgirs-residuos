import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import municipiosData from '../../data/municipios.json';
import type { Municipio } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge, statusLabel } from '../ui/StatusBadge';
import { PopulationChart } from '../charts/PopulationChart';
import { DensityChart } from '../charts/DensityChart';
import { MunicipalityComparator } from './MunicipalityComparator';
import { DownloadButton } from '../ui/DownloadButton';
import type { DownloadColumn } from '../../lib/download';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const municipiosEmbutidos = municipiosData as Municipio[];

const colunasMunicipios: DownloadColumn<Municipio>[] = [
  { key: 'nome', label: 'Município' },
  { key: 'populacao', label: 'População' },
  { key: 'populacaoAno', label: 'Ano da população' },
  { key: 'areaTerritorialKm2', label: 'Área territorial (km²)' },
  { key: 'areaUrbanizadaKm2', label: 'Área urbanizada (km²)' },
  { key: 'densidadeDemografica', label: 'Densidade demográfica (hab/km²)' },
  { key: 'densidadeAno', label: 'Ano da densidade' },
  { key: 'statusDados', label: 'Situação do dado', value: (row) => statusLabel(row.statusDados) },
  { key: 'fonte', label: 'Fonte' },
];

type Metrica = 'populacao' | 'densidade';

const opcoesMetrica: { id: Metrica; label: string }[] = [
  { id: 'populacao', label: 'População' },
  { id: 'densidade', label: 'Densidade demográfica' },
];

function radiusForPopulation(populacao: number): number {
  return Math.max(6, Math.min(28, Math.sqrt(populacao) / 65));
}

export function MetropolitanMap() {
  const municipios = useColecaoPublicada<Municipio>('municipios', municipiosEmbutidos);

  const [selecionado, setSelecionado] = useState<Municipio | null>(null);
  const [metrica, setMetrica] = useState<Metrica>('populacao');

  const center = useMemo<[number, number]>(() => [-22.75, -43.25], []);

  return (
    <Section
      headingLevel={1}
      id="mapa"
      title="Mapa da Região Metropolitana"
      subtitle="Selecione um município — no mapa ou na lista abaixo dele — para ver população, área e situação dos dados."
    >
      <div className="mb-6">
        <DownloadButton
          filename="municipios-pmetgirs"
          title="Municípios da Região Metropolitana — PMetGIRS"
          data={municipios}
          columns={colunasMunicipios}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="isolate h-[420px] overflow-hidden rounded-xl border border-neutral-200 sm:h-[480px]">
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
                eventHandlers={{
                  click: () => setSelecionado(municipio),
                  // O Leaflet desenha os círculos como <path> sem foco nem nome
                  // acessível. Ao entrar no mapa, promovemos cada path a botão
                  // focável e rotulado, acionável por Enter e Espaço.
                  add: (event) => {
                    const path = (event.target as { getElement?: () => SVGPathElement | null }).getElement?.();
                    if (!path) return;
                    path.setAttribute('tabindex', '0');
                    path.setAttribute('role', 'button');
                    path.setAttribute(
                      'aria-label',
                      `${municipio.nome}: ${municipio.populacao.toLocaleString('pt-BR')} habitantes em ${municipio.populacaoAno}. Selecionar para ver os dados.`,
                    );
                    path.addEventListener('keydown', (keyEvent: KeyboardEvent) => {
                      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                        keyEvent.preventDefault();
                        setSelecionado(municipio);
                      }
                    });
                  },
                }}
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
              Selecione um dos {municipios.length} municípios para ver seus dados.
            </p>
          )}
        </Card>
      </div>

      {/* Alternativa ao mapa: mesma seleção, sem depender de leitura visual
          nem de precisão de ponteiro. */}
      <nav aria-label="Selecionar município" className="mt-4">
        <ul className="flex flex-wrap gap-2">
          {[...municipios]
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
            .map((municipio) => {
              const ativo = selecionado?.id === municipio.id;
              return (
                <li key={municipio.id}>
                  <button
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setSelecionado(municipio)}
                    className={`min-h-11 rounded-md border px-3 text-sm font-medium transition-colors ${
                      ativo
                        ? 'border-brand-blue-600 bg-brand-blue-600 text-white'
                        : 'border-neutral-300 bg-white text-neutral-700 hover:border-brand-blue-400 hover:text-brand-blue-700'
                    }`}
                  >
                    {municipio.nome}
                  </button>
                </li>
              );
            })}
        </ul>
      </nav>

      <Card className="mt-6">
        <div role="tablist" aria-label="Métrica do gráfico" className="mb-4 inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {opcoesMetrica.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              role="tab"
              aria-selected={metrica === opcao.id}
              onClick={() => setMetrica(opcao.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                metrica === opcao.id
                  ? 'bg-white text-brand-blue-700 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {opcao.label}
            </button>
          ))}
        </div>
        {metrica === 'populacao' ? <PopulationChart /> : <DensityChart />}
      </Card>

      <div className="mt-6">
        <MunicipalityComparator />
      </div>
    </Section>
  );
}
