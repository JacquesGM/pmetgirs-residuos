import {
  DEFAULT_COST_THRESHOLDS,
  DEFAULT_HORIZON,
  validateWeights,
  type CostThresholds,
  type HorizonConfig,
  type ScoringPolicy,
  type WeightedCriterion,
} from './policy';

/**
 * Fórmulas de análise.
 *
 * A regra que atravessa tudo: DIMENSÃO SEM EVIDÊNCIA FICA NULA E REDUZ A
 * COBERTURA. Nunca vira zero. Zero é uma afirmação — "isto não tem impacto
 * social" — e ninguém fez essa afirmação; o que houve foi ausência de dado.
 *
 * Quando a cobertura fica abaixo do mínimo, o resultado sai sem nota. É melhor
 * dizer "não sei" do que publicar um número que ninguém pode defender.
 */

/** Nota atribuída a uma dimensão, de 0 a 5, com a evidência que a sustenta. */
export interface DimensionInput {
  key: string;
  /** null = não avaliado. Diferente de 0, que seria "avaliado como nulo". */
  score: number | null;
  evidenceIds?: string[];
  rationale?: string | null;
}

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  /** Contribuição desta dimensão para a nota final, em pontos de 0 a 100. */
  contribution: number | null;
  hasEvidence: boolean;
}

export interface ScoreResult {
  /** 0–100, ou null quando a cobertura é insuficiente. */
  score: number | null;
  /** Percentual do peso total que tinha nota. */
  coverage: number;
  /** Confiança: cobertura ajustada pela presença de evidência declarada. */
  confidence: number | null;
  policyVersion: number;
  /** Dimensões sem nota — o que falta avaliar. */
  gaps: string[];
  breakdown: ScoreBreakdownItem[];
  /** Fórmula em texto, para exibir junto do número. */
  formula: string;
}

export class ScoringError extends Error {}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Média ponderada das dimensões avaliadas, penalizada pela cobertura.
 *
 * O fator de cobertura vale 0,60 quando nada foi avaliado e 1,00 quando tudo
 * foi. Ele existe para que um projeto avaliado numa única dimensão não empate
 * com outro avaliado em todas — a diferença de confiança precisa aparecer no
 * número, não só numa nota de rodapé.
 */
export function computeWeightedScore(
  criteria: WeightedCriterion[],
  inputs: DimensionInput[],
  policyVersion: number,
  minimumCoverage: number,
  label: string,
): ScoreResult {
  validateWeights(criteria, label);

  const byKey = new Map(inputs.map((i) => [i.key, i]));
  const breakdown: ScoreBreakdownItem[] = [];
  const gaps: string[] = [];

  let availableWeight = 0;
  let weightedSum = 0;
  let evidencedWeight = 0;

  for (const criterion of criteria) {
    const input = byKey.get(criterion.key);
    const score = input?.score ?? null;

    if (score === null) {
      gaps.push(criterion.label);
      breakdown.push({
        key: criterion.key,
        label: criterion.label,
        weight: criterion.weight,
        score: null,
        contribution: null,
        hasEvidence: false,
      });
      continue;
    }

    if (score < 0 || score > 5 || !Number.isInteger(score)) {
      throw new ScoringError(`Nota inválida em "${criterion.label}": ${score}. Use inteiro de 0 a 5.`);
    }

    const hasEvidence = (input?.evidenceIds?.length ?? 0) > 0;
    availableWeight += criterion.weight;
    if (hasEvidence) evidencedWeight += criterion.weight;

    // Nota de 0–5 vira 0–100 na proporção do peso do critério.
    const contribution = (score / 5) * criterion.weight;
    weightedSum += contribution;

    breakdown.push({
      key: criterion.key,
      label: criterion.label,
      weight: criterion.weight,
      score,
      contribution: round(contribution),
      hasEvidence,
    });
  }

  const coverage = round(availableWeight);

  if (availableWeight === 0 || coverage < minimumCoverage) {
    return {
      score: null,
      coverage,
      confidence: null,
      policyVersion,
      gaps,
      breakdown,
      formula: `Sem nota: a cobertura de ${coverage}% está abaixo do mínimo de ${minimumCoverage}%.`,
    };
  }

  // Normaliza pelo peso disponível, para que a nota continue numa escala de
  // 0 a 100 mesmo com dimensões faltando.
  const normalized = (weightedSum / availableWeight) * 100;
  const coverageFactor = 0.6 + 0.4 * (availableWeight / 100);
  const score = round(normalized * coverageFactor);
  const confidence = round((evidencedWeight / 100) * 100);

  return {
    score,
    coverage,
    confidence,
    policyVersion,
    gaps,
    breakdown,
    formula:
      `média ponderada ${round(normalized)} × fator de cobertura ${round(coverageFactor, 2)} = ${score}. ` +
      `O fator penaliza avaliação incompleta: ${coverage}% do peso tinha nota.`,
  };
}

export function computeSocialImpact(
  policy: ScoringPolicy,
  inputs: DimensionInput[],
): ScoreResult {
  return computeWeightedScore(
    policy.socialImpact,
    inputs,
    policy.version,
    policy.minimumCoverage,
    'impacto social',
  );
}

export function computePriority(policy: ScoringPolicy, inputs: DimensionInput[]): ScoreResult {
  return computeWeightedScore(
    policy.priority,
    inputs,
    policy.version,
    policy.minimumCoverage,
    'priorização',
  );
}

export function computeReadiness(policy: ScoringPolicy, inputs: DimensionInput[]): ScoreResult {
  return computeWeightedScore(
    policy.investmentReadiness,
    inputs,
    policy.version,
    policy.minimumCoverage,
    'prontidão para investimento',
  );
}

// ------------------------------------------------------------------ horizonte

export type TimeHorizonResult = 'short' | 'medium' | 'long' | 'not_informed';

/**
 * O horizonte não é só a duração da obra.
 *
 * Esta função classifica pela duração informada; a decisão final considera
 * também maturidade, estudos, licenciamento, contratação, dependências e
 * capacidade institucional — por isso o resultado é sugestão, e a tela deixa
 * isso claro.
 */
export function classifyHorizon(
  months: number | null,
  config: HorizonConfig = DEFAULT_HORIZON,
): TimeHorizonResult {
  if (months === null || months === undefined) return 'not_informed';
  if (months <= config.shortMaxMonths) return 'short';
  if (months <= config.mediumMaxMonths) return 'medium';
  return 'long';
}

// ---------------------------------------------------------------------- custo

export type CostCategoryResult =
  | 'no_new_disbursement'
  | 'low'
  | 'medium'
  | 'high'
  | 'estimating'
  | 'not_informed';

export interface CostInput {
  /** false = executável com equipe e recursos existentes. */
  requiresNewDisbursement: boolean | null;
  capexMinCents: number | null;
  capexMaxCents: number | null;
  /** true quando o valor está em estruturação, mesmo sem número. */
  underEstimation?: boolean;
}

/**
 * Classifica a faixa de custo.
 *
 * Usa o teto do intervalo: para decidir se um projeto cabe no orçamento,
 * interessa o pior caso, não o melhor.
 */
export function classifyCost(
  input: CostInput,
  thresholds: CostThresholds = DEFAULT_COST_THRESHOLDS,
): CostCategoryResult {
  if (input.requiresNewDisbursement === false) return 'no_new_disbursement';

  const teto = input.capexMaxCents ?? input.capexMinCents;
  if (teto === null || teto === undefined) {
    return input.underEstimation ? 'estimating' : 'not_informed';
  }
  if (teto < 0) throw new ScoringError('Custo negativo não faz sentido.');

  if (teto <= thresholds.lowMaxCents) return 'low';
  if (teto <= thresholds.mediumMaxCents) return 'medium';
  return 'high';
}

// ------------------------------------------------------------- recomendação

export type Recommendation =
  | 'quick_win'
  | 'iniciar_preparacao'
  | 'estruturar_para_captacao'
  | 'estrategico_longo_prazo'
  | 'bloqueado'
  | 'reavaliar';

export interface RecommendationInput {
  priorityScore: number | null;
  readinessScore: number | null;
  costCategory: CostCategoryResult;
  isBlocked: boolean;
}

/**
 * Sugere um encaminhamento.
 *
 * IMPORTANTE: isto é recomendação explicável, não decisão. Nenhuma pontuação
 * aprova, contrata ou publica projeto. A tela precisa dizer isso junto do
 * resultado — o sistema apoia a decisão humana, não a substitui.
 */
export function recommend(input: RecommendationInput): { recommendation: Recommendation; why: string } {
  if (input.isBlocked) {
    return { recommendation: 'bloqueado', why: 'Existe dependência obrigatória ainda não concluída.' };
  }

  if (input.priorityScore === null || input.readinessScore === null) {
    return {
      recommendation: 'reavaliar',
      why: 'Falta evidência para calcular prioridade ou prontidão com confiança suficiente.',
    };
  }

  const altaPrioridade = input.priorityScore >= 60;
  const altaProntidao = input.readinessScore >= 60;
  const baratoOuSemDesembolso =
    input.costCategory === 'no_new_disbursement' || input.costCategory === 'low';

  if (altaPrioridade && altaProntidao && baratoOuSemDesembolso) {
    return { recommendation: 'quick_win', why: 'Prioridade alta, pronto para executar e sem exigir grande desembolso.' };
  }
  if (altaPrioridade && altaProntidao) {
    return { recommendation: 'estruturar_para_captacao', why: 'Prioridade e prontidão altas, mas o custo exige fonte de recursos.' };
  }
  if (altaPrioridade) {
    return { recommendation: 'iniciar_preparacao', why: 'Prioridade alta, mas ainda falta maturidade para executar.' };
  }
  return { recommendation: 'estrategico_longo_prazo', why: 'Relevante, sem urgência frente ao restante do portfólio.' };
}

// ------------------------------------------------------------------ atualidade

export type ActualityResult = 'current' | 'outdated' | 'no_date';

/** Prazos iniciais de revisão, em dias, por tipo de dado. */
export const REVIEW_WINDOWS: Record<string, number> = {
  projectStatus: 30,
  indicator: 90,
  costEstimate: 180,
  fundingSource: 90,
  demographics: 365,
};

/**
 * Calcula a atualidade de um dado. NÃO altera o dado — devolve a situação e a
 * data da próxima revisão, para que uma pessoa autorizada confirme a mudança e
 * registre o evento.
 */
export function computeActuality(
  dataDate: string | null,
  type: keyof typeof REVIEW_WINDOWS,
  now: Date,
): { status: ActualityResult; nextReviewAt: string | null; ageDays: number | null } {
  if (!dataDate) return { status: 'no_date', nextReviewAt: null, ageDays: null };

  const parsed = new Date(`${dataDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { status: 'no_date', nextReviewAt: null, ageDays: null };
  }

  const window = REVIEW_WINDOWS[type] ?? 90;
  const ageDays = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
  const next = new Date(parsed.getTime() + window * 86_400_000);

  return {
    status: ageDays > window ? 'outdated' : 'current',
    nextReviewAt: next.toISOString().slice(0, 10),
    ageDays,
  };
}
