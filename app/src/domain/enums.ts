/**
 * Dimensões de estado do PMetGIRS.
 *
 * A regra central: execução, validação, atualidade e publicação são
 * INDEPENDENTES. Um dado pode ser simultaneamente oficial, validado e
 * histórico. O modelo antigo comprimia tudo em um campo só — por isso
 * `dado_em_validacao` aparecia como se fosse situação de execução.
 *
 * Código em inglês, rótulo em português (ver `labels.ts`).
 */

export const ROLES = ['owner', 'admin', 'editor', 'reviewer', 'viewer', 'external_partner'] as const;
export type Role = (typeof ROLES)[number];

/** Em que ponto a ação está. */
export const EXECUTION_STATUSES = [
  'not_started',
  'structuring',
  'study',
  'procurement',
  'licensing',
  'implementation',
  'operation',
  'completed',
  'paused',
  'cancelled',
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

/** Quanto se pode confiar no dado. */
export const VALIDATION_STATUSES = [
  'not_assessed',
  'preliminary',
  'in_validation',
  'validated',
  'divergent',
  'rejected',
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

/** Se o dado ainda vale. */
export const ACTUALITY_STATUSES = ['current', 'historical', 'outdated', 'updating', 'no_date'] as const;
export type ActualityStatus = (typeof ACTUALITY_STATUSES)[number];

/** Se o cidadão pode ver. */
export const PUBLICATION_STATUSES = [
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'published',
  'archived',
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/** De onde o dado veio. */
export const SOURCE_TYPES = [
  'official',
  'municipal_declared',
  'technical_estimate',
  'academic_study',
  'responsible_statement',
  'other',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** Estágio no funil de investimento. */
export const INVESTMENT_STAGES = [
  'identified',
  'prioritized',
  'structuring',
  'study',
  'study_complete',
  'ready_for_fundraising',
  'market_consultation',
  'procurement',
  'contracted',
  'archived',
] as const;
export type InvestmentStage = (typeof INVESTMENT_STAGES)[number];

/** Horizonte temporal. Limites configuráveis em settings/horizonPolicy. */
export const TIME_HORIZONS = ['short', 'medium', 'long', 'not_informed'] as const;
export type TimeHorizon = (typeof TIME_HORIZONS)[number];

/**
 * Categoria de custo. Note `no_new_disbursement`: a expressão "sem custo" foi
 * banida — executar com equipe própria tem custo, só não exige novo desembolso.
 */
export const COST_CATEGORIES = [
  'no_new_disbursement',
  'low',
  'medium',
  'high',
  'estimating',
  'not_informed',
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

/** Relação entre duas ações. */
export const DEPENDENCY_TYPES = [
  'finish_to_start',
  'start_to_start',
  'finish_to_finish',
  'independent',
  'resource_conflict',
] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];
