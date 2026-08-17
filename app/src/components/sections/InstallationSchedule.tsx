import cronogramaData from '../../data/cronogramaInstalacao.json';
import type { EtapaCronograma } from '../../types';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const cronogramaEmbutido = cronogramaData as EtapaCronograma[];

const HORIZONTES = [
  { chave: 'curtoPrazo', titulo: 'Curto prazo', janela: '2 a 5 anos' },
  { chave: 'medioPrazo', titulo: 'Médio prazo', janela: '5 a 10 anos' },
  { chave: 'longoPrazo', titulo: 'Longo prazo', janela: '10 a 30 anos' },
] as const;

/**
 * Quando cada unidade deve ser instalada.
 *
 * A Infraestrutura planejada dizia o quê e não dizia o quando. O cronograma é
 * do Plano de Ações, e a soma das suas linhas discorda do Prognóstico em duas
 * tecnologias — 53 unidades contra 45. As duas contagens aparecem, porque
 * escolher uma seria decidir em silêncio qual volume vale.
 */
export function InstallationSchedule() {
  const etapas = useColecaoPublicada<EtapaCronograma>(
    'cronograma-instalacao',
    cronogramaEmbutido,
  ).slice().sort((a, b) => a.ordem - b.ordem);

  if (etapas.length === 0) return null;

  const totalGeral = etapas.reduce((s, e) => s + e.total, 0);

  /**
   * Só as unidades de TRATAMENTO, para comparar com o Prognóstico.
   *
   * O total geral inclui aterro sanitário e biodegradação, que o resumo de
   * investimentos do Prognóstico não conta — ele soma 45 usinas de triagem,
   * combustão e termodegradação. Comparar 58 com 45 seria confrontar
   * grandezas diferentes e inventar uma divergência maior que a real.
   */
  const TRATAMENTO = ['transbordo-triagem', 'ure-gaseificacao', 'ure-combustao'];
  const totalTratamento = etapas
    .filter((e) => TRATAMENTO.includes(e.id))
    .reduce((s, e) => s + e.total, 0);

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-neutral-900">Quando cada unidade deve entrar</h2>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Cronograma de instalação previsto no Plano de Ações. Os prazos são contados a partir do
        início do plano, não de uma data de calendário — o documento não fixa uma.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[620px] text-sm">
          <caption className="sr-only">
            Unidades previstas por tecnologia em cada horizonte de prazo
          </caption>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
              <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Tecnologia</th>
              {HORIZONTES.map((h) => (
                <th key={h.chave} scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">
                  {h.titulo}
                  <span className="block text-xs font-normal text-neutral-500">{h.janela}</span>
                </th>
              ))}
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {etapas.map((e) => (
              <tr key={e.id} className="border-b border-neutral-100 last:border-0 align-top">
                <th scope="row" className="px-4 py-2.5 text-left font-medium">
                  {e.tecnologia}
                  {e.observacao && (
                    <InfoDisclosure label="Ressalva">{e.observacao}</InfoDisclosure>
                  )}
                </th>
                {HORIZONTES.map((h) => {
                  const v = e[h.chave];
                  return (
                    <td key={h.chave} className="px-4 py-2.5 text-right tabular-nums">
                      {/* Travessão, não zero: a fonte não prevê unidades nesse
                          horizonte, o que é diferente de prever zero. */}
                      {v === null ? <span className="text-neutral-400">—</span> : v}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{e.total}</td>
              </tr>
            ))}
            <tr className="bg-neutral-50">
              <th scope="row" className="px-4 py-2.5 text-left font-semibold">Total</th>
              {HORIZONTES.map((h) => {
                // Se nenhuma linha prevê unidades no horizonte, o total é
                // travessão como as células — somar nulos e imprimir 0
                // afirmaria "zero unidades previstas", que não é o que a
                // fonte diz.
                const previstos = etapas.filter((e) => e[h.chave] !== null);
                return (
                  <td key={h.chave} className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {previstos.length === 0 ? (
                      <span className="font-normal text-neutral-400">—</span>
                    ) : (
                      previstos.reduce((s, e) => s + (e[h.chave] ?? 0), 0)
                    )}
                  </td>
                );
              })}
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{totalGeral}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 max-w-prose text-sm text-neutral-600">
        As duas contagens de usinas de triagem coincidem entre os volumes: 25. As térmicas não —
        este cronograma soma 13 de combustão e 15 de gaseificação, e o Prognóstico prevê 10 de
        cada. Em unidades de tratamento são {totalTratamento} aqui contra 45 lá, e o portal mostra
        as duas em vez de escolher.
      </p>
      <p className="mt-2 max-w-prose text-sm text-neutral-600">
        As outras {totalGeral - totalTratamento} unidades do cronograma — {' '}
        {etapas
          .filter((e) => !TRATAMENTO.includes(e.id))
          .map((e) => `${e.total} de ${e.tecnologia.toLowerCase()}`)
          .join(' e ')}{' '}
        — não entram nessa comparação: o resumo de investimentos do Prognóstico soma apenas as
        usinas de triagem, combustão e termodegradação.
      </p>
      <p className="mt-2 text-xs text-neutral-500">Fonte: {etapas[0].fonte}</p>
    </div>
  );
}
