import viabilidadeData from '../../data/viabilidadeEconomica.json';
import type { ViabilidadeEconomica } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { DownloadButton } from '../ui/DownloadButton';
import type { DownloadColumn } from '../../lib/download';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const viabilidadeEmbutida = viabilidadeData as ViabilidadeEconomica[];

const inteiro = new Intl.NumberFormat('pt-BR');

/**
 * Reais em escala legível.
 *
 * "R$ 9.150.000.000,00" é ilegível numa comparação; "R$ 9,15 bilhões" é a
 * grandeza que a pessoa consegue reter. O valor exato continua disponível no
 * arquivo para download e na ficha de fonte — o arredondamento é de
 * apresentação, e não do dado.
 */
function escala(v: number | null): string | null {
  if (v === null) return null;
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} bi`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  return `R$ ${inteiro.format(v)}`;
}

const colunas: DownloadColumn<ViabilidadeEconomica>[] = [
  { key: 'nome', label: 'Cenário ou tecnologia' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'rsuTdia', label: 'RSU (t/dia)' },
  { key: 'usinasCombustao', label: 'Usinas de combustão' },
  { key: 'usinasTermodegradacao', label: 'Usinas de termodegradação' },
  { key: 'usinasTriagem', label: 'Usinas de triagem' },
  { key: 'capexTotalReais', label: 'CAPEX total (R$)' },
  { key: 'receitaAnualReais', label: 'Receita anual (R$)' },
  { key: 'capexPorUsinaReais', label: 'CAPEX por usina (R$)' },
  { key: 'receitaAnualPorUsinaReais', label: 'Receita anual por usina (R$)' },
  { key: 'opexAnualReais', label: 'OPEX anual por usina (R$)' },
  { key: 'fonte', label: 'Fonte' },
  { key: 'observacao', label: 'Ressalvas' },
];

/**
 * O que o plano custa e o que ele promete arrecadar.
 *
 * Estes números vêm do Estudo de Viabilidade Técnica e Econômica do
 * Prognóstico e são estimativa de projeto, não contrato nem orçamento
 * aprovado. A tela diz isso antes de mostrar qualquer valor — R$ 9,15 bilhões
 * lido como decisão tomada seria uma leitura errada e cara.
 */
export function Investments() {
  const registros = useColecaoPublicada<ViabilidadeEconomica>(
    'viabilidade-economica',
    viabilidadeEmbutida,
  );
  const cenarios = registros.filter((r) => r.tipo === 'cenario');
  const tecnologias = registros.filter((r) => r.tipo === 'tecnologia');
  const total = cenarios.find((c) => c.id === 'cenario-rmrj-total');

  return (
    <Section
      headingLevel={1}
      id="investimentos"
      title="Investimento previsto"
      subtitle="O que o plano estima custar e arrecadar, por cenário e por tecnologia."
      tone="muted"
    >
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-neutral-800">
        <p className="font-medium">Estimativa de estudo, não orçamento aprovado.</p>
        <p className="mt-1 max-w-prose">
          Os valores vêm do Estudo de Viabilidade Técnica e Econômica do Prognóstico do PMetGIRS.
          Não há contrato, licitação ou dotação orçamentária correspondente. Nenhuma das 45 usinas
          foi construída.
        </p>
      </div>

      <div className="mt-6">
        <DownloadButton
          filename="pmetgirs-viabilidade-economica"
          title="Viabilidade econômica do PMetGIRS"
          columns={colunas}
          data={registros}
        />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-neutral-900">Cenários</h2>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        O estudo separa a capital do restante da região. Os 21 municípios fora do Rio geram mais
        resíduo por dia que a capital sozinha, e exigem menos investimento.
      </p>

      <ul className="mt-4 grid gap-5 md:grid-cols-3">
        {cenarios.map((c) => (
          <li key={c.id}>
            <Card className="h-full">
              <p className="text-sm font-semibold text-neutral-900">{c.nome}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-brand-blue-800">
                {escala(c.capexTotalReais)}
              </p>
              <p className="text-xs text-neutral-500">de investimento estimado</p>

              <dl className="mt-4 space-y-1.5 text-sm">
                <Linha rotulo="Receita anual estimada" valor={escala(c.receitaAnualReais)} />
                <Linha
                  rotulo="RSU tratado"
                  valor={c.rsuTdia !== null ? `${inteiro.format(c.rsuTdia)} t/dia` : null}
                />
                <Linha
                  rotulo="Usinas"
                  valor={
                    c.usinasCombustao !== null
                      ? `${c.usinasCombustao + c.usinasTermodegradacao! + c.usinasTriagem!} no total`
                      : null
                  }
                />
                <Linha rotulo="— de combustão" valor={c.usinasCombustao?.toString() ?? null} />
                <Linha rotulo="— de termodegradação" valor={c.usinasTermodegradacao?.toString() ?? null} />
                <Linha rotulo="— de triagem" valor={c.usinasTriagem?.toString() ?? null} />
              </dl>

              <InfoDisclosure label="Fonte e ressalvas">
                {c.fonte}
                {c.observacao && <span className="mt-1 block">{c.observacao}</span>}
              </InfoDisclosure>
            </Card>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-neutral-900">Por tecnologia</h2>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Custo e retorno de uma unidade de cada tipo. Multiplicados pelo número de usinas do cenário
        metropolitano, estes valores reproduzem exatamente o investimento total acima — foi assim
        que a transcrição foi conferida.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[680px] text-sm">
          <caption className="sr-only">
            Custo de implantação, receita e custo operacional anual por unidade de tratamento
          </caption>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
              <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Tecnologia</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">
                Implantação
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">
                Receita/ano
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">
                Custo operacional/ano
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">
                Unidades previstas
              </th>
            </tr>
          </thead>
          <tbody>
            {tecnologias.map((t) => {
              const unidades =
                t.id === 'tecnologia-combustao'
                  ? total?.usinasCombustao
                  : t.id === 'tecnologia-gaseificacao'
                    ? total?.usinasTermodegradacao
                    : t.id === 'tecnologia-triagem'
                      ? total?.usinasTriagem
                      : null;
              return (
                <tr key={t.id} className="border-b border-neutral-100 last:border-0 align-top">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium">
                    {t.nome}
                    {t.observacao && (
                      <InfoDisclosure label="Ressalvas">{t.observacao}</InfoDisclosure>
                    )}
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {escala(t.capexPorUsinaReais) ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {escala(t.receitaAnualPorUsinaReais) ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {escala(t.opexAnualReais) ?? (
                      <span className="italic text-neutral-500">não informado</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {unidades ?? (
                      <span className="italic text-neutral-500">fora do plano</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Os critérios de aprovação do próprio EVTE. Sem eles, "viável" é uma
          palavra sem régua. */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
        <h3 className="text-base font-semibold text-neutral-900">
          Como o estudo definiu "viável"
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>Fluxo de caixa projetado para 35 anos.</li>
          <li>Taxa mínima de atratividade: 13,75%, a Selic de junho de 2023.</li>
          <li>Retorno do investimento desejável em menos de 10 anos.</li>
          <li>Taxa interna de retorno maior que a taxa mínima de atratividade.</li>
          <li>Valor presente líquido positivo.</li>
        </ul>
        <p className="mt-3 max-w-prose text-sm text-neutral-600">
          O estudo conclui que triagem, gaseificação e combustão atendem a todos os critérios. O
          biogás ficou fora da comparação por decisão declarada: está vinculado ao uso de aterros
          sanitários, e o seu fluxo foi simulado para 15 anos, não 35.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Fonte: Prognóstico Geral do PMetGIRS, seção 8.8 e Tabelas 72 e 73 (ENGECONSULT, 2023).
        </p>
      </div>
    </Section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-500">{rotulo}</dt>
      <dd className={`shrink-0 font-medium ${valor ? 'text-neutral-800' : 'italic font-normal text-neutral-500'}`}>
        {valor ?? 'não informado'}
      </dd>
    </div>
  );
}
