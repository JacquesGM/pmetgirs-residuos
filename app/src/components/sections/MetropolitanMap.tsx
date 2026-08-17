import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import municipiosData from '../../data/municipios.json';
import indicadoresMunicipaisData from '../../data/indicadoresMunicipais.json';
import projetosData from '../../data/projetos.json';
import vazadourosData from '../../data/vazadouros.json';
import arranjosData from '../../data/arranjosDeTratamento.json';
import type { ArranjoDeTratamento, IndicadorMunicipal, Municipio, Projeto, Vazadouro } from '../../types';
import { municipiosDoProjeto } from '../../domain/abrangencia';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge, statusLabel } from '../ui/StatusBadge';
import { PopulationChart } from '../charts/PopulationChart';
import { DensityChart } from '../charts/DensityChart';
import { MunicipalityComparator } from './MunicipalityComparator';
import { DownloadButton } from '../ui/DownloadButton';
import type { DownloadColumn } from '../../lib/download';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { DataValue } from '../ui/DataValue';

const municipiosEmbutidos = municipiosData as Municipio[];
const indicadoresMunicipaisEmbutidos = indicadoresMunicipaisData as IndicadorMunicipal[];
const projetosEmbutidos = projetosData as Projeto[];
const vazadourosEmbutidos = vazadourosData as Vazadouro[];
const arranjosEmbutidos = arranjosData as ArranjoDeTratamento[];

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

  const todosIndicadores = useColecaoPublicada<IndicadorMunicipal>(
    'indicadores-municipais',
    indicadoresMunicipaisEmbutidos,
  );
  const indicadoresDoMunicipio = useMemo(
    () => (selecionado ? todosIndicadores.filter((i) => i.municipioId === selecionado.id) : []),
    [todosIndicadores, selecionado],
  );

  const projetos = useColecaoPublicada<Projeto>('projetos', projetosEmbutidos);
  const vazadouros = useColecaoPublicada<Vazadouro>('vazadouros', vazadourosEmbutidos);

  const arranjos = useColecaoPublicada<ArranjoDeTratamento>(
    'arranjos-de-tratamento',
    arranjosEmbutidos,
  );

  /** O arranjo de tratamento a que o município pertence, se houver. */
  const arranjoDoMunicipio = useMemo(
    () =>
      selecionado
        ? (arranjos.find((a) => a.municipiosAtendidos.includes(selecionado.id)) ?? null)
        : null,
    [arranjos, selecionado],
  );

  /** Vazadouros encerrados no município selecionado. */
  const vazadourosDoMunicipio = useMemo(
    () => (selecionado ? vazadouros.filter((v) => v.municipioId === selecionado.id) : []),
    [vazadouros, selecionado],
  );

  /**
   * Ações que alcançam o município selecionado.
   *
   * A lista é derivada da abrangência pela mesma regra que a migração usa —
   * `municipiosDoProjeto` —, e não de um campo pronto. O dado embutido no
   * bundle não passa pela migração e não carrega `municipalityIds`; ler o
   * campo faria o mapa funcionar só depois de publicado.
   */
  const acoesDoMunicipio = useMemo(() => {
    if (!selecionado) return { alcancam: [] as Projeto[], indeterminadas: [] as Projeto[] };
    const ids = municipios.map((m) => m.id);
    const alcancam: Projeto[] = [];
    const indeterminadas: Projeto[] = [];
    for (const projeto of projetos) {
      const cobertos = municipiosDoProjeto(projeto.abrangencia, ids);
      if (cobertos === null) indeterminadas.push(projeto);
      else if (cobertos.includes(selecionado.id)) alcancam.push(projeto);
    }
    return { alcancam, indeterminadas };
  }, [projetos, municipios, selecionado]);

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

      {/* Dito antes do mapa, não depois: quem navega por teclado precisa saber
          o que vem pela frente antes de entrar nos 22 marcadores. */}
      <p className="mb-3 text-sm text-neutral-600">
        Cada município é um marcador acionável por teclado: use Tab para percorrê-los e Enter ou
        Espaço para selecionar. A lista abaixo do mapa faz a mesma seleção, sem depender do mapa.
      </p>

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
                    // O Leaflet dispara `add` de novo ao trocar de pane ou
                    // reanimar o zoom. Sem esta marca, cada disparo empilha mais
                    // um ouvinte no mesmo elemento.
                    if (path.dataset.tecladoLigado === 'sim') return;
                    path.dataset.tecladoLigado = 'sim';
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

        {/* `role="status"` porque a seleção muda este painel sem recarregar
            nada: sem ele, quem aciona um marcador por teclado ouve silêncio e
            não tem como saber que a escolha surtiu efeito. `atomic` faz o leitor
            ler o município inteiro, e não só o trecho que mudou. */}
        <Card role="status" aria-live="polite" aria-atomic="true">
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
              </dl>

              {/* Cada valor traz a sua própria unidade, ano e tabela de origem:
                  vêm de levantamentos diferentes e não podem herdar uma data
                  de referência comum. */}
              {indicadoresDoMunicipio.length > 0 && (
                <div className="mt-4 border-t border-neutral-200 pt-3">
                  <h3 className="text-sm font-semibold text-neutral-900">Resíduos sólidos</h3>
                  <dl className="mt-2 space-y-2 text-sm">
                    {indicadoresDoMunicipio.map((ind) => (
                      <div key={ind.id}>
                        <div className="flex justify-between gap-2">
                          <dt className="text-neutral-500">
                            {ind.nome}
                            {ind.unidade ? ` (${ind.unidade})` : ''}
                          </dt>
                          <dd className="shrink-0 font-medium">
                            <DataValue value={ind.valorExibicao} status={ind.statusValidacao} />
                          </dd>
                        </div>
                        <InfoDisclosure label="Fonte e período">
                          {ind.periodoReferencia} · {ind.fonte}
                          {ind.observacao && <span className="mt-1 block">{ind.observacao}</span>}
                        </InfoDisclosure>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {arranjoDoMunicipio && (
                <div className="mt-4 border-t border-neutral-200 pt-3">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    Usinas previstas para este município
                  </h3>
                  {/* O plano agrupa municípios que dividem as mesmas usinas.
                      Dizer "1 usina de triagem" sem dizer com quem ela é
                      dividida faria o leitor supor uma usina só sua. */}
                  {arranjoDoMunicipio.municipiosAtendidos.length > 1 ? (
                    <p className="mt-1 text-sm text-neutral-600">
                      Compartilhadas com{' '}
                      {arranjoDoMunicipio.municipiosAtendidos
                        .filter((m) => m !== selecionado.id)
                        .map((m) => municipios.find((x) => x.id === m)?.nome ?? m)
                        .join(', ')}
                      .
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-neutral-600">
                      Não compartilhadas: o plano trata este município sozinho.
                    </p>
                  )}
                  <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                    {[
                      ['triagem', arranjoDoMunicipio.usinasTriagem],
                      ['de combustão', arranjoDoMunicipio.usinasCombustao],
                      ['de termodegradação', arranjoDoMunicipio.usinasTermodegradacao],
                      ['de asfalto', arranjoDoMunicipio.usinasAsfalto],
                      ['de biodigestão', arranjoDoMunicipio.usinasBiodigestao],
                    ]
                      .filter(([, n]) => (n as number) > 0)
                      .map(([rotulo, n]) => (
                        <li key={rotulo as string}>
                          {n as number} usina{(n as number) > 1 ? 's' : ''} {rotulo as string}
                        </li>
                      ))}
                  </ul>
                  {arranjoDoMunicipio.observacao && (
                    <InfoDisclosure label="Ressalva da fonte">
                      {arranjoDoMunicipio.observacao}
                    </InfoDisclosure>
                  )}
                </div>
              )}

              {/* Passivo ambiental antes das ações: é o que já existe no
                  território, e o tema tem 125 pontos na matriz GUT — 2º de 16. */}
              <div className="mt-4 border-t border-neutral-200 pt-3">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Vazadouros encerrados
                </h3>
                {vazadourosDoMunicipio.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-600">
                    Nenhum vazadouro identificado neste município pelo Prognóstico.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {vazadourosDoMunicipio.map((v) => (
                      <li key={v.id}>
                        <span className="font-medium text-neutral-800">{v.nome}</span>
                        <span className="block text-neutral-600">
                          {v.estagio}
                          {v.anoEncerramento !== null &&
                            ` · fechado em ${v.anoEncerramento}, há ${new Date().getFullYear() - v.anoEncerramento} anos`}
                        </span>
                        {v.observacao && (
                          <InfoDisclosure label="Ressalva da fonte">{v.observacao}</InfoDisclosure>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 border-t border-neutral-200 pt-3">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Ações que alcançam {selecionado.nome}
                </h3>
                {acoesDoMunicipio.alcancam.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                    {acoesDoMunicipio.alcancam.map((p) => (
                      <li key={p.id}>{p.nome}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-neutral-600">
                    Nenhuma ação com abrangência declarada sobre este município.
                  </p>
                )}

                {/* A ressalva não é rodapé: sem ela, a lista acima seria lida
                    como "estas são todas as ações do município", e duas ações
                    reais ficariam invisíveis por um silêncio do documento. */}
                {acoesDoMunicipio.indeterminadas.length > 0 && (
                  <p className="mt-2 text-xs text-neutral-500">
                    Mais {acoesDoMunicipio.indeterminadas.length} ação(ões) do plano têm abrangência
                    que os documentos não determinam, e podem ou não alcançar este município:{' '}
                    {acoesDoMunicipio.indeterminadas.map((p) => p.nome).join('; ')}.
                  </p>
                )}
              </div>

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
