import centraisData from '../../data/centraisDeTratamento.json';
import municipiosData from '../../data/municipios.json';
import type { CentralDeTratamento, Municipio } from '../../types';
import { Card } from '../ui/Card';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const centraisEmbutidas = centraisData as CentralDeTratamento[];
const municipiosEmbutidos = municipiosData as Municipio[];

const inteiro = new Intl.NumberFormat('pt-BR');
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function anos(v: number | null): string | null {
  if (v === null) return null;
  const inteiros = Math.floor(v);
  const meses = Math.round((v - inteiros) * 12);
  if (meses === 0) return `${inteiros} anos`;
  return `${inteiros} anos e ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

function dataBr(iso: string | null): string | null {
  if (!iso) return null;
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/**
 * As centrais de tratamento que já operam.
 *
 * O portal mostrava só infraestrutura planejada — "25 usinas de triagem",
 * nenhuma construída. Estas quatro recebem resíduos de dezenove dos vinte e
 * dois municípios hoje, e não apareciam em lugar nenhum. Quem chegasse ao
 * portal concluiria que a região não trata nada.
 */
export function TreatmentCentrals() {
  const centrais = useColecaoPublicada<CentralDeTratamento>(
    'centrais-de-tratamento',
    centraisEmbutidas,
  );
  const municipios = useColecaoPublicada<Municipio>('municipios', municipiosEmbutidos);
  const nomeDe = new Map(municipios.map((m) => [m.id, m.nome]));

  const atendidos = new Set(centrais.flatMap((c) => c.municipiosAtendidos));
  const semCentral = municipios.filter((m) => !atendidos.has(m.id));

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-neutral-900">Centrais de tratamento em operação</h2>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Diferente da infraestrutura acima, que é planejada: estas quatro centrais recebem resíduos
        hoje.
      </p>

      {/* A ressalva é da p. 155 do Diagnóstico e vale para as quatro. Sem ela,
          "capacidade diária" seria lida como capacidade real de operação. */}
      <p className="mt-3 max-w-prose rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-neutral-800">
        As capacidades diárias e anuais são as <strong>previstas na licença de operação</strong>, e
        não necessariamente a capacidade operacional real de cada unidade. A vida útil se refere ao
        volume licenciado, sem considerar área adjacente que possa ser incorporada numa expansão.
      </p>

      <ul className="mt-5 grid gap-5 lg:grid-cols-2">
        {centrais.map((c) => (
          <li key={c.id}>
            <Card className="h-full">
              <p className="text-sm font-semibold text-neutral-900">{c.nome}</p>
              <p className="mt-0.5 text-sm text-neutral-600">{c.operadora}</p>

              <dl className="mt-4 space-y-2 text-sm">
                <Linha rotulo="Capacidade licenciada" valor={
                  c.capacidadeDiariaTdia !== null
                    ? `${inteiro.format(c.capacidadeDiariaTdia)} t/dia`
                    : null
                } />
                <Linha rotulo="Recebimento médio" valor={
                  c.recebimentoDiarioMedioTdia !== null
                    ? `${inteiro.format(c.recebimentoDiarioMedioTdia)} t/dia`
                    : null
                } />
                <Linha rotulo="Vida útil" valor={anos(c.vidaUtilAnos)} />
                <Linha rotulo="Início da operação" valor={dataBr(c.inicioOperacao)} />
                <Linha rotulo="Lixiviado gerado" valor={
                  c.lixiviadoDiarioM3 !== null ? `${decimal.format(c.lixiviadoDiarioM3)} m³/dia` : null
                } />
                <Linha rotulo="Tratamento do chorume" valor={c.tecnologiaChorume} />
                <Linha rotulo="Biogás" valor={c.biogas} />
                <Linha rotulo="Energia gerada" valor={c.geracaoEnergia} />
                <Linha rotulo="Crédito de carbono" valor={
                  c.creditoCarbonoTco2e !== null
                    ? `${inteiro.format(c.creditoCarbonoTco2e)} tCO₂e no último ano`
                    : null
                } />
              </dl>

              <div className="mt-4 border-t border-neutral-200 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Municípios atendidos ({c.municipiosAtendidos.length})
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  {c.municipiosAtendidos.map((m) => nomeDe.get(m) ?? m).join(', ')}
                  {c.municipiosAtendidosForaDaRmrj.length > 0 && (
                    <span className="mt-1 block text-neutral-500">
                      Fora da região metropolitana: {c.municipiosAtendidosForaDaRmrj.join(', ')}.
                    </span>
                  )}
                </p>
              </div>

              {(c.opexPorTonelada !== null || c.custoNovaCelulaPorM2 !== null) && (
                <div className="mt-3 border-t border-neutral-200 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Custos declarados pela operadora
                  </p>
                  <dl className="mt-1 space-y-1 text-sm">
                    <Linha rotulo="OPEX" valor={
                      c.opexPorTonelada !== null ? `${brl.format(c.opexPorTonelada)}/t` : null
                    } />
                    <Linha rotulo="Nova célula" valor={
                      c.custoNovaCelulaPorM2 !== null ? `${brl.format(c.custoNovaCelulaPorM2)}/m²` : null
                    } />
                    <Linha rotulo="Tratamento do chorume" valor={
                      c.custoTratamentoChorumePorM3 !== null
                        ? `${brl.format(c.custoTratamentoChorumePorM3)}/m³`
                        : null
                    } />
                  </dl>
                </div>
              )}

              <InfoDisclosure label="Fonte e ressalvas">
                {c.fonte}
                {c.observacao && <span className="mt-1 block">{c.observacao}</span>}
              </InfoDisclosure>
            </Card>
          </li>
        ))}
      </ul>

      {/* Dizer quem NÃO é atendido é metade da informação. Sem isto, a lista
          acima parece cobrir a região inteira. */}
      {semCentral.length > 0 && (
        <p className="mt-5 max-w-prose text-sm text-neutral-600">
          {semCentral.length} dos {municipios.length} municípios não aparecem como atendidos por
          nenhuma destas centrais: {semCentral.map((m) => m.nome).join(', ')}. O Diagnóstico
          menciona que Petrópolis é atendida pela CTR de Três Rios, fora da região metropolitana;
          para os demais, os documentos transcritos não declaram a central de destino.
        </p>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-500">{rotulo}</dt>
      <dd className={`shrink-0 text-right font-medium ${valor ? 'text-neutral-800' : 'italic font-normal text-neutral-500'}`}>
        {valor ?? 'não informado'}
      </dd>
    </div>
  );
}
