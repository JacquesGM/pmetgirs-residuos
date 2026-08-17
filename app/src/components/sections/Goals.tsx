import metasData from '../../data/metas.json';
import type { Meta } from '../../types';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { DataValue } from '../ui/DataValue';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { GoalsTargetChart } from '../charts/GoalsTargetChart';
import { metaIcons, iconFor } from '../../lib/icons';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const metasEmbutidos = metasData as Meta[];

/**
 * A data de referência é do dado, não da página. Exibi-la só faz sentido quando
 * existe: sem ela, o `DataValue` diz "Em atualização" em vez de inventar hoje.
 */
function formatarDataDeReferencia(iso: string | null): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split('-');
  return dia && mes ? `${dia}/${mes}/${ano}` : ano;
}

export function Goals() {
  const metas = useColecaoPublicada<Meta>('metas', metasEmbutidos);

  return (
    <Section
      headingLevel={1}
      id="metas"
      title="Metas de coleta e atendimento"
      subtitle="Universalização da coleta e ampliação da coleta seletiva nos 22 municípios."
      tone="muted"
    >
      <Card className="mb-6">
        <GoalsTargetChart />
      </Card>

      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {metas.map((meta) => {
          const Icon = iconFor(metaIcons, meta.id);
          return (
            <li key={meta.id}>
              <Card className="h-full">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green-50 text-brand-green-700">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-neutral-900">{meta.nome}</p>

                {/* Prosa, e apresentada como prosa. Este texto já ocupou o
                    lugar do número — 2xl, negrito, verde —, a tipografia que o
                    resto do portal reserva a valor medido. Nenhuma das 44
                    metas declara alvo numérico: o plano as enuncia como ações
                    com resultado esperado em palavras. Um "Queima de Metano em
                    Flares" em corpo de indicador faz uma intenção parecer uma
                    medição. */}
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Resultado esperado
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-neutral-800">
                  {meta.resultadoEsperado}
                </p>

                <p className="mt-2 text-sm text-neutral-500">Prazo: {meta.prazo ?? 'não informado'}</p>
                <div className="mt-3">
                  <StatusBadge status={meta.situacao} />
                </div>
                <InfoDisclosure label="Como esta meta é medida, e o que ainda não se mede">
                  <span className="block">Unidade de medida: {meta.metodologia}</span>

                  {/* "Em atualização" promete um número a caminho. Para a linha
                      de base isso vale quando o Diagnóstico a traz — foi de lá
                      que vieram as dez que existem. Onde não vem, o certo é
                      dizer que a fonte não declara, e não sugerir espera. */}
                  <span className="mt-1 block">
                    Linha de base:{' '}
                    {meta.linhaBase ? (
                      <DataValue value={meta.linhaBase} status="dado_oficial_validado" />
                    ) : (
                      <span className="italic text-neutral-500">
                        os documentos do PMetGIRS não declaram linha de base para esta meta
                      </span>
                    )}
                  </span>

                  {/* Vale para as 44, sem exceção: nenhuma tem resultado
                      atual. Não é atraso de carga deste sistema — o valor não
                      consta dos documentos do PMetGIRS.

                      A frase para aqui de propósito. É tentador explicar a
                      ausência pelo Sistema de Informações Gerenciais, que o
                      plano prevê e que não existe; mas o achado que o Relatório
                      documenta trata de INDICADORES dependerem do Banco de
                      Dados, e não do resultado destas metas. Ligar as duas
                      coisas seria inferência apresentada como fato. */}
                  <span className="mt-1 block">
                    Resultado atual:{' '}
                    <span className="italic text-neutral-500">
                      não consta dos documentos do PMetGIRS — nenhuma das 44 metas traz medição
                    </span>
                  </span>

                  <span className="mt-1 block">Fonte: {meta.fonte}</span>
                  {meta.linhaBase && (
                    <span className="mt-1 block">
                      Data de referência da linha de base:{' '}
                      <DataValue
                        value={formatarDataDeReferencia(meta.ultimaAtualizacao)}
                        status="em_atualizacao"
                      />
                    </span>
                  )}
                </InfoDisclosure>
              </Card>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
