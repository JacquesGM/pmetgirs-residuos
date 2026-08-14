import type { SourceType, ValidationStatus } from '../enums';

/**
 * Contrato da migração dos 11 JSON legados para o Firestore.
 *
 * Tudo aqui é puro: o mesmo código que produz o relatório de dry-run é o que
 * escreve em produção. Um relatório que não vem do caminho real é ficção.
 */

/** Coleção de destino no workspace privado. */
export type TargetCollection =
  | 'municipalities'
  | 'axes'
  | 'projects'
  | 'goals'
  | 'infrastructures'
  | 'documents'
  | 'inconsistencies'
  | 'indicators'
  | 'milestones'
  | 'glossary'
  | 'imports';

/** Alegação de valor extraída da origem, com procedência. */
export interface EvidenceDraft {
  id: string;
  entityType: TargetCollection;
  entityId: string;
  fieldPath: string;
  value: unknown;
  unit: string | null;
  sourceType: SourceType;
  sourceDocumentId: string;
  referenceDate: string | null;
  confidenceScore: number | null;
  validationStatus: ValidationStatus;
  notes: string | null;
}

export interface MigrationRecord {
  collection: TargetCollection;
  /** Igual ao ID legado: preservá-lo mantém links e URLs existentes. */
  id: string;
  legacyId: string;
  data: Record<string, unknown>;
  /**
   * Campos que permanecem nulos porque a origem não informa.
   * Vão para o relatório como lacunas a preencher, nunca como zero.
   */
  gaps: string[];
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface MigrationIssue {
  severity: IssueSeverity;
  /** Identificador estável, para filtrar e contar entre execuções. */
  code: string;
  collection?: TargetCollection;
  recordId?: string;
  message: string;
}

export interface MigrationPlan {
  workspaceId: string;
  /** Impressão digital da origem. Muda se qualquer JSON mudar. */
  sourceFingerprint: string;
  /** Quantos registros cada arquivo de origem trouxe. */
  sourceCounts: Record<string, number>;
  totalSourceRecords: number;
  records: MigrationRecord[];
  evidence: EvidenceDraft[];
  issues: MigrationIssue[];
}

export interface MigrationSources {
  municipios: unknown[];
  eixos: unknown[];
  projetos: unknown[];
  metas: unknown[];
  infraestruturas: unknown[];
  documentos: unknown[];
  inconsistencias: unknown[];
  indicadores: unknown[];
  evolucao: unknown[];
  glossario: unknown[];
  atualizacoes: unknown[];
}
