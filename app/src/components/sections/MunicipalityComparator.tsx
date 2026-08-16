import { useMemo, useState } from 'react';
import municipiosData from '../../data/municipios.json';
import type { Municipio } from '../../types';
import { Card } from '../ui/Card';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const municipiosEmbutidos = municipiosData as Municipio[];

const MAX_SELECIONADOS = 4;

const numberFormatter = new Intl.NumberFormat('pt-BR');

function decimalFormatter(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

const linhas: { rotulo: string; valor: (m: Municipio) => string }[] = [
  { rotulo: 'População', valor: (m) => `${numberFormatter.format(m.populacao)} (${m.populacaoAno})` },
  { rotulo: 'Área territorial', valor: (m) => `${decimalFormatter(m.areaTerritorialKm2)} km²` },
  { rotulo: 'Área urbanizada', valor: (m) => `${decimalFormatter(m.areaUrbanizadaKm2)} km²` },
  { rotulo: 'Densidade demográfica', valor: (m) => `${decimalFormatter(m.densidadeDemografica)} hab/km² (${m.densidadeAno})` },
  { rotulo: 'Fonte', valor: (m) => m.fonte },
];

export function MunicipalityComparator() {
  const publicados = useColecaoPublicada<Municipio>('municipios', municipiosEmbutidos);
  const municipios = useMemo(
    () => publicados.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [publicados],
  );

  const [selecionados, setSelecionados] = useState<string[]>([]);

  const noLimite = selecionados.length >= MAX_SELECIONADOS;

  function alternar(id: string) {
    setSelecionados((atual) => {
      if (atual.includes(id)) return atual.filter((item) => item !== id);
      if (atual.length >= MAX_SELECIONADOS) return atual;
      return [...atual, id];
    });
  }

  const comparados = municipios.filter((m) => selecionados.includes(m.id));

  return (
    <Card>
      <p className="text-sm font-semibold text-neutral-900">Comparar municípios</p>
      <p className="mt-1 text-xs text-neutral-500">
        Selecione até {MAX_SELECIONADOS} municípios para comparar lado a lado.
        {noLimite && ' Limite atingido: desmarque um para trocar.'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Seleção de municípios para comparação">
        {municipios.map((m) => {
          const ativo = selecionados.includes(m.id);
          const desabilitado = !ativo && noLimite;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => alternar(m.id)}
              aria-pressed={ativo}
              disabled={desabilitado}
              className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                ativo
                  ? 'border-brand-blue-600 bg-brand-blue-600 text-white'
                  : desabilitado
                    ? 'cursor-not-allowed border-neutral-200 text-neutral-300'
                    : 'border-neutral-300 text-neutral-700 hover:border-brand-blue-400 hover:text-brand-blue-700'
              }`}
            >
              {m.nome}
            </button>
          );
        })}
      </div>

      {comparados.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="border-b border-neutral-200 py-2 pr-4 font-semibold text-neutral-600">
                  &nbsp;
                </th>
                {comparados.map((m) => (
                  <th key={m.id} scope="col" className="border-b border-neutral-200 py-2 pr-4 font-semibold text-neutral-900">
                    {m.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((linha) => (
                <tr key={linha.rotulo}>
                  <th scope="row" className="py-2 pr-4 font-medium text-neutral-600">
                    {linha.rotulo}
                  </th>
                  {comparados.map((m) => (
                    <td key={m.id} className="py-2 pr-4 text-neutral-700">
                      {linha.valor(m)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
