import { z } from 'zod';
import {
  ACTUALITY_STATUSES,
  COST_CATEGORIES,
  DEPENDENCY_TYPES,
  EXECUTION_STATUSES,
  INVESTMENT_STAGES,
  PUBLICATION_STATUSES,
  ROLES,
  SOURCE_TYPES,
  TIME_HORIZONS,
  VALIDATION_STATUSES,
} from './enums';

/**
 * Schemas de validação. Fonte única do contrato de dados: valem no formulário,
 * no adaptador de persistência e na migração. As Security Rules repetem as
 * checagens críticas do lado do servidor, porque validação no cliente é
 * conveniência, não segurança.
 *
 * Regra que atravessa tudo: ausência é `null`, nunca 0, `false` ou "".
 */

export const roleSchema = z.enum(ROLES);
export const executionStatusSchema = z.enum(EXECUTION_STATUSES);
export const validationStatusSchema = z.enum(VALIDATION_STATUSES);
export const actualityStatusSchema = z.enum(ACTUALITY_STATUSES);
export const publicationStatusSchema = z.enum(PUBLICATION_STATUSES);
export const sourceTypeSchema = z.enum(SOURCE_TYPES);
export const investmentStageSchema = z.enum(INVESTMENT_STAGES);
export const timeHorizonSchema = z.enum(TIME_HORIZONS);
export const costCategorySchema = z.enum(COST_CATEGORIES);
export const dependencyTypeSchema = z.enum(DEPENDENCY_TYPES);

/** Envelope comum a toda entidade privada. Espelha `hasAuditEnvelope` nas Rules. */
export const entityMetaSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  createdAt: z.date(),
  createdBy: z.string().min(1),
  updatedAt: z.date(),
  updatedBy: z.string().min(1),
  version: z.number().int().min(1),
  lastEventId: z.string().min(1),
  changeReason: z.string().min(1).optional(),
  isArchived: z.boolean(),
  archivedAt: z.date().nullable().optional(),
  archivedBy: z.string().nullable().optional(),
  legacyId: z.string().nullable().optional(),
});

/**
 * Dinheiro em centavos inteiros — nunca float. Guarda intervalo, ano-base e
 * evidências; um valor sem fonte não é um valor, é um palpite.
 */
export const moneyRangeSchema = z
  .object({
    minCents: z.number().int().nonnegative().nullable(),
    maxCents: z.number().int().nonnegative().nullable(),
    currency: z.literal('BRL'),
    baseYear: z.number().int().min(1900).max(2100).nullable(),
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    confidenceScore: z.number().min(0).max(100).nullable(),
    evidenceIds: z.array(z.string()),
  })
  .refine(
    (v) => v.minCents === null || v.maxCents === null || v.minCents <= v.maxCents,
    { message: 'capexMinCents não pode ser maior que capexMaxCents', path: ['minCents'] },
  );

/**
 * Alegação de valor com procedência. Duas alegações no mesmo `fieldPath` são o
 * mecanismo que permite publicar 16.926 e 16.929 t/dia lado a lado, sem
 * escolher nenhuma em silêncio.
 */
export const evidenceClaimSchema = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  fieldPath: z.string().min(1),
  value: z.unknown(),
  unit: z.string().nullable().optional(),
  sourceType: sourceTypeSchema,
  sourceDocumentId: z.string().min(1),
  sourceLocation: z
    .object({
      page: z.number().int().positive().nullable().optional(),
      section: z.string().nullable().optional(),
      table: z.string().nullable().optional(),
    })
    .optional(),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  confidenceScore: z.number().min(0).max(100),
  validationStatus: validationStatusSchema,
  notes: z.string().nullable().optional(),
});

/** Nota de 0 a 5 numa dimensão, com o peso e as evidências que a sustentam. */
export const scoredDimensionSchema = z.object({
  key: z.string().min(1),
  score: z.number().int().min(0).max(5).nullable(),
  weight: z.number().min(0).max(100),
  evidenceIds: z.array(z.string()),
  rationale: z.string().nullable().optional(),
  confidenceScore: z.number().min(0).max(100).nullable().optional(),
});

/**
 * Resultado de um cálculo. `score` é opcional de propósito: sem cobertura
 * mínima de evidência, o sistema não produz número — ele informa a lacuna.
 */
export const scoreResultSchema = z.object({
  score: z.number().min(0).max(100).nullable(),
  coverage: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100).nullable(),
  policyVersion: z.number().int().positive(),
  gaps: z.array(z.string()),
});

export const auditEventSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  entityCollection: z.string().min(1),
  entityId: z.string().min(1),
  action: z.enum(['create', 'update', 'archive', 'submit', 'approve', 'reject', 'publish', 'access_change']),
  actorUid: z.string().min(1),
  actorRole: roleSchema,
  occurredAt: z.date(),
  reason: z.string().min(1),
  changedFields: z.array(z.string()),
  fromVersion: z.number().int().positive().nullable().optional(),
  toVersion: z.number().int().positive(),
  correlationId: z.string().min(1),
  source: z.enum(['web', 'migration', 'bootstrap_admin']),
});

export const memberSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().nullable().optional(),
  photoURL: z.string().url().nullable().optional(),
  role: roleSchema,
  status: z.enum(['active', 'suspended', 'revoked']),
  invitationId: z.string().nullable().optional(),
  createdAt: z.date(),
  lastAccessAt: z.date().nullable().optional(),
});

export const invitationSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  role: roleSchema.exclude(['owner']),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expiresAt: z.date(),
  createdBy: z.string().min(1),
  createdAt: z.date(),
  acceptedAt: z.date().nullable().optional(),
  acceptedByUid: z.string().nullable().optional(),
});

export const dependencySchema = z
  .object({
    id: z.string().min(1),
    predecessorId: z.string().min(1),
    successorId: z.string().min(1),
    type: dependencyTypeSchema,
    lagDays: z.number().int(),
    mandatory: z.boolean(),
    justification: z.string().min(1),
    sharedResourceId: z.string().nullable().optional(),
    validationStatus: validationStatusSchema,
  })
  .refine((v) => v.predecessorId !== v.successorId, {
    message: 'Uma ação não pode depender de si mesma',
    path: ['successorId'],
  });

export const projectSchema = entityMetaSchema.extend({
  planId: z.string().min(1),
  axisId: z.string().min(1),
  programId: z.string().nullable().optional(),
  name: z.string().min(3).max(180),
  slug: z.string().min(1),
  nameNormalized: z.string().min(1),
  executiveSummary: z.string().nullable().optional(),
  problem: z.string().nullable().optional(),
  solution: z.string().nullable().optional(),
  objectives: z.array(z.string()).default([]),
  municipalityIds: z.array(z.string()).default([]),
  beneficiaryPopulation: z.number().int().nonnegative().nullable().optional(),
  executionStatus: executionStatusSchema,
  validationStatus: validationStatusSchema,
  actualityStatus: actualityStatusSchema,
  publicationStatus: publicationStatusSchema,
  investmentStage: investmentStageSchema.nullable().optional(),
  timeHorizon: timeHorizonSchema,
  durationMonths: z.number().int().positive().nullable().optional(),
  costCategory: costCategorySchema,
  capexMinCents: z.number().int().nonnegative().nullable().optional(),
  capexMaxCents: z.number().int().nonnegative().nullable().optional(),
  annualOpexCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.literal('BRL'),
  valueBaseYear: z.number().int().min(1900).max(2100).nullable().optional(),
  socialImpactScore: z.number().min(0).max(100).nullable().optional(),
  environmentalImpactScore: z.number().min(0).max(100).nullable().optional(),
  readinessScore: z.number().min(0).max(100).nullable().optional(),
  investmentReadinessScore: z.number().min(0).max(100).nullable().optional(),
  priorityScore: z.number().min(0).max(100).nullable().optional(),
  sourceIds: z.array(z.string()).default([]),
  dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  verifiedAt: z.date().nullable().optional(),
  nextReviewAt: z.date().nullable().optional(),
  legacyStatus: z.string().nullable().optional(),
});

export type EntityMeta = z.infer<typeof entityMetaSchema>;
export type MoneyRange = z.infer<typeof moneyRangeSchema>;
export type EvidenceClaim = z.infer<typeof evidenceClaimSchema>;
export type ScoredDimension = z.infer<typeof scoredDimensionSchema>;
export type ScoreResult = z.infer<typeof scoreResultSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type Dependency = z.infer<typeof dependencySchema>;
export type Project = z.infer<typeof projectSchema>;
