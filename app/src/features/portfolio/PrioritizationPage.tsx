import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { listProjects } from '../../data/firestore/portfolio';
import { DEFAULT_POLICY } from '../../domain/scoring/policy';
import { classifyHorizon, computePriority, recommend } from '../../domain/scoring/score';
import type { Recommendation } from '../../domain/scoring/score';
import { useAsync } from './useAsync';
import { Pill } from './StateLabels';

const RECOMENDACAO_LABEL: Record<Recommendation, string> = {
  quick_win: 'Ganho rápido',
  iniciar_preparacao: 'Iniciar preparação',
  estruturar_para_captacao: 'Estruturar para captação',
  estrategico_longo_prazo: 'Estratégico de longo prazo',
  bloqueado: 'Bloqueado',
  reavaliar: 'Reavaliar',
};

const RECOMENDACAO_TONE: Record<Recommendation, 'ok' | 'info' | 'warn' | 'alert' | 'neutral'> = {
  quick_win: 'ok',
  iniciar_preparacao: 'info',
  estruturar_para_captacao: 'info',
  estrategico_longo_prazo: 'neutral',
  bloqueado: 'alert',
  reavaliar: 'warn',
};

/**
 * Priorização.
 *
 * Nenhum projeto do PMetGIRS tem avaliação por dimensão ainda — as notas
 * entram por aqui quando alguém avaliar, com evidência. Enquanto isso, a tela
 * mostra a política vigente, a fórmula e o estado real: sem cobertura, sem
 * nota. Exibir um ranking inventado seria pior que não exibir ranking.
 */
export function PrioritizationPage() {
  const [mostrarFormula, setMostrarFormula] = useState(false);
  const projetos = useAsync(() => listProjects({ limit: 200 }), []);

  const linhas = useMemo(() => {
    if (projetos.status !== 'ready') return [];
    return projetos.data
      .map((p) => {
        // Sem avaliação por dimensão registrada, a entrada é vazia — e o
        // resultado sai sem nota, como deve.
        const prioridade = computePriority(DEFAULT_POLICY, []);
        const recomendacao = recommend({
          priorityScore: prioridade.score,
          readinessScore: null,
          costCategory: 'not_informed',
          isBlocked: false,
        });
        return { projeto: p, prioridade, recomendacao, horizonte: classifyHorizon(null) };
      })
      .sort((a, b) => (b.prioridade.score ?? -1) - (a.prioridade.score ?? -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetos.status, projetos.status === 'ready' ? projetos.data : null]);

  const semNota = linhas.filter((l) => l.prioridade.score === null).length;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-neutral-900">Priorização</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Matriz de critérios com pesos configuráveis. A pontuação organiza a conversa; ela não aprova,
        não contrata e não publica projeto.
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

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-900">
            Política vigente — versão {DEFAULT_POLICY.version}
          </h2>
          <button
            type="button"
            onClick={() => setMostrarFormula((v) => !v)}
            aria-expanded={mostrarFormula}
            className="text-sm font-medium text-brand-blue-700 hover:underline"
          >
            {mostrarFormula ? 'Ocultar a fórmula' : 'Como a nota é calculada?'}
          </button>
        </div>

        {mostrarFormula && (
          <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <p>
              A nota de cada critério vai de 0 a 5 e é convertida para a escala do peso. A soma é
              normalizada pelo peso efetivamente avaliado, e depois multiplicada por um{' '}
              <strong>fator de cobertura</strong>:
            </p>
            <p className="mt-2 font-mono text-xs text-neutral-800">
              fator = 0,60 + 0,40 × (peso avaliado ÷ 100)
            </p>
            <p className="mt-2">
              O fator existe para que um projeto avaliado em uma única dimensão não empate com outro
              avaliado em todas. A diferença de confiança aparece no número, e não só numa nota de
              rodapé.
            </p>
            <p className="mt-2">
              Critério sem avaliação fica <strong>sem nota</strong> e reduz a cobertura — nunca vira
              zero. Zero é uma afirmação; ausência de dado não é.
            </p>
            <p className="mt-2">
              Abaixo de {DEFAULT_POLICY.minimumCoverage}% de cobertura, o sistema não publica nota.
            </p>
          </div>
        )}

        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Critérios de priorização e seus pesos</caption>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Critério</th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">O que mede</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">Peso</th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_POLICY.priority.map((c) => (
                <tr key={c.key} className="border-b border-neutral-100 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-neutral-800">{c.label}</th>
                  <td className="px-4 py-2.5 text-neutral-600">{c.help}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">{c.weight}%</td>
                </tr>
              ))}
              <tr className="bg-neutral-50">
                <th scope="row" className="px-4 py-2.5 text-left font-semibold">Total</th>
                <td />
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Estes pesos são parâmetros de governança, não números do PMetGIRS. Precisam de aprovação
          antes de uso institucional e podem ser alterados pelo proprietário em Configurações.
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
            {semNota === linhas.length && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-neutral-800">
                <p className="font-medium">Nenhum projeto tem avaliação registrada ainda.</p>
                <p className="mt-1">
                  Os {linhas.length} projetos migrados vieram dos documentos técnicos sem notas por
                  dimensão. Sem cobertura de evidência, o sistema não produz nota — e um ranking
                  inventado seria pior que nenhum ranking.
                </p>
              </div>
            )}

            <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">
                  Projetos ordenados por prioridade, com cobertura de evidência e encaminhamento sugerido
                </caption>
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                    <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Projeto</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">Prioridade</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">Cobertura</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Encaminhamento sugerido</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ projeto, prioridade, recomendacao }) => (
                    <tr key={projeto.id} className="border-b border-neutral-100 last:border-0">
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">
                        <Link to={`/app/projetos/${projeto.id}`} className="text-brand-blue-700 hover:underline">
                          {projeto.name}
                        </Link>
                      </th>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {prioridade.score === null ? (
                          <span className="italic text-neutral-500">sem nota</span>
                        ) : (
                          <span className="font-semibold">{prioridade.score}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600">
                        {prioridade.coverage}%
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill tone={RECOMENDACAO_TONE[recomendacao.recommendation]}>
                          {RECOMENDACAO_LABEL[recomendacao.recommendation]}
                        </Pill>
                        <span className="mt-0.5 block text-xs text-neutral-500">{recomendacao.why}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
