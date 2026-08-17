import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { listGutPriorities, listProjects } from '../../data/firestore/portfolio';
import { listEstimativas } from '../../data/firestore/costEstimates';
import type { CostCategoryResult } from '../../domain/scoring/score';
import { useAsync } from './useAsync';
import { Pill } from './StateLabels';

const ROTULO_DA_FAIXA: Record<CostCategoryResult, string> = {
  no_new_disbursement: 'Sem novo desembolso',
  low: 'Baixo custo',
  medium: 'Médio custo',
  high: 'Alto custo',
  estimating: 'Em estruturação',
  not_informed: 'Não informado',
};

const TOM_DA_FAIXA: Record<CostCategoryResult, 'ok' | 'info' | 'warn' | 'alert' | 'neutral'> = {
  no_new_disbursement: 'ok',
  low: 'ok',
  medium: 'info',
  high: 'warn',
  estimating: 'neutral',
  not_informed: 'neutral',
};

/**
 * Priorização, pela matriz GUT do próprio Plano de Ações.
 *
 * Esta tela já mostrou duas colunas: a prioridade da fonte e uma "prioridade
 * calculada" por uma matriz de sete critérios ponderados. A segunda saiu em
 * 16/08/2026, junto com o formulário que a alimentaria.
 *
 * A razão é a mesma que tirou os outros formulários: os sete critérios não
 * existem em documento nenhum do PMetGIRS. Sem formulário, a coluna ficaria
 * "sem nota" nas dez linhas para sempre; com formulário, ela seria preenchida
 * por quem estivesse com a tela aberta, e um ranking assim tem a aparência de
 * medida sem ser uma. A priorização que existe é a GUT, feita em 2023 sobre
 * dezesseis temas, e é ela que a tela mostra.
 *
 * O achado INC-22 continua valendo: o plano combina GUT, OKR, SMART, BSC e
 * SNIS sem modelo único de integração. Mostrar a GUT não resolve isso — apenas
 * não acrescenta um oitavo método por conta própria.
 */
export function PrioritizationPage() {
  const projetos = useAsync(() => listProjects({ limit: 200 }), []);
  const fontes = useAsync(
    async () => ({ custos: await listEstimativas(), gut: await listGutPriorities() }),
    [],
  );

  const linhas = useMemo(() => {
    if (projetos.status !== 'ready') return [];

    const porGut = new Map<string, { pontuacao: number; ranking: number; tema: string }>();
    if (fontes.status === 'ready') {
      for (const t of fontes.data.gut) {
        for (const pid of t.projetosRelacionados) {
          porGut.set(pid, { pontuacao: t.pontuacao, ranking: t.ranking, tema: t.tema });
        }
      }
    }

    const porCusto = new Map(
      fontes.status === 'ready' ? fontes.data.custos.map((c) => [c.entityId, c.costCategory]) : [],
    );

    return projetos.data
      .map((p) => ({
        projeto: p,
        gut: porGut.get(p.id) ?? null,
        custo: porCusto.get(p.id) ?? ('not_informed' as CostCategoryResult),
      }))
      // Ordem do ranking da fonte. Quem não tem tema vai para o fim — não por
      // ser menos importante, mas porque a matriz não o classificou.
      .sort((a, b) => (a.gut?.ranking ?? 99) - (b.gut?.ranking ?? 99));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projetos.status,
    projetos.status === 'ready' ? projetos.data : null,
    fontes.status,
    fontes.status === 'ready' ? fontes.data : null,
  ]);

  const semTema = linhas.filter((l) => l.gut === null).length;
  const totalTemas = fontes.status === 'ready' ? fontes.data.gut.length : 0;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-neutral-900">Priorização</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        A priorização é a do próprio Plano de Ações, pela matriz GUT. O sistema a transcreve e a
        exibe; não a recalcula nem a substitui por outra.
      </p>

      <div className="mt-5 flex items-start gap-3 rounded-lg border border-brand-blue-200 bg-brand-blue-50 p-4">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue-700" />
        <div className="text-sm text-neutral-800">
          <p className="font-medium">A pontuação apoia a decisão — não decide.</p>
          <p className="mt-1">
            Um número alto não autoriza contratação, e um número baixo não descarta um projeto.
            Contratação, concessão, PPP e financiamento seguem os procedimentos oficiais e a
            legislação aplicável.
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Como a matriz GUT pontua</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-3">
          <Criterio
            letra="G"
            nome="Gravidade"
            texto="O tamanho do dano se nada for feito."
          />
          <Criterio
            letra="U"
            nome="Urgência"
            texto="Quanto tempo resta antes que agir deixe de adiantar."
          />
          <Criterio
            letra="T"
            nome="Tendência"
            texto="Se o problema piora sozinho com o tempo."
          />
        </dl>
        <p className="mt-4 text-sm text-neutral-700">
          Cada um vale de 1 a 5 e a pontuação é o <strong>produto</strong> dos três — de 1 a 125.
          Por ser produto e não soma, uma nota baixa em qualquer um dos três derruba o total: um
          problema grave que não piora e não tem prazo pontua pouco.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Fonte: Plano de Ações do PMetGIRS, Tabelas 5 e 6 (ENGECONSULT, 2023), sobre{' '}
          {totalTemas || 16} temas. Numa das dezesseis linhas o produto impresso não fecha com os
          fatores; a divergência está registrada em Pontos em Revisão.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-neutral-900">Ranking do portfólio</h2>

        {projetos.status === 'loading' && (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-neutral-200" />
            ))}
          </div>
        )}

        {projetos.status === 'ready' && linhas.length > 0 && (
          <>
            <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">
                  Ações do portfólio na ordem da matriz GUT do Plano de Ações, com o tema
                  correspondente e a faixa de custo transcrita
                </caption>
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                    <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Projeto</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">
                      Tema na matriz
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">
                      Pontuação GUT
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">
                      Faixa de custo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ projeto, gut, custo }) => (
                    <tr key={projeto.id} className="border-b border-neutral-100 last:border-0">
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">
                        <Link
                          to={`/app/projetos/${projeto.id}`}
                          className="text-brand-blue-700 hover:underline"
                        >
                          {projeto.name}
                        </Link>
                      </th>
                      <td className="px-4 py-2.5 text-neutral-600">
                        {gut?.tema ?? <span className="italic text-neutral-500">sem tema</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {gut === null ? (
                          <span className="italic text-neutral-500">—</span>
                        ) : (
                          <>
                            <span className="font-semibold">{gut.pontuacao}</span>
                            <span className="block text-xs font-normal text-neutral-500">
                              {gut.ranking}º de {totalTemas || 16}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill tone={TOM_DA_FAIXA[custo]}>{ROTULO_DA_FAIXA[custo]}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {semTema > 0 && (
              <p className="mt-3 max-w-prose text-sm text-neutral-600">
                {semTema} de {linhas.length} ações não têm tema na matriz: são ações do Anexo III, e
                a GUT cobre os dezesseis temas do capítulo 2, não todas as ações do plano. Ficar sem
                pontuação aqui não as torna menos importantes — significa que a fonte não as
                priorizou.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Criterio({ letra, nome, texto }: { letra: string; nome: string; texto: string }) {
  return (
    <div>
      <dt className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-blue-100 text-sm font-bold text-brand-blue-800"
        >
          {letra}
        </span>
        <span className="font-medium text-neutral-800">{nome}</span>
      </dt>
      <dd className="mt-1 text-sm text-neutral-600">{texto}</dd>
    </div>
  );
}
