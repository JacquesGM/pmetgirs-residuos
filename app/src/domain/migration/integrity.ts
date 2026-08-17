import { findCycle, type DependencyEdge } from '../dependencies/graph';
import type { MigrationIssue, MigrationPlan, MigrationRecord } from './types';

/**
 * Verificações de integridade do plano de migração.
 *
 * São checagens sobre o conjunto — não sobre um registro isolado — e por isso
 * rodam depois de todos os transformadores. Um erro barra a importação; um
 * aviso segue para o relatório e para a decisão humana.
 */

function issue(
  severity: MigrationIssue['severity'],
  code: string,
  message: string,
  extra: Partial<MigrationIssue> = {},
): MigrationIssue {
  return { severity, code, message, ...extra };
}

/** IDs duplicados dentro da mesma coleção destruiriam registros na escrita. */
export function checkDuplicateIds(records: MigrationRecord[]): MigrationIssue[] {
  const seen = new Map<string, number>();
  const issues: MigrationIssue[] = [];

  for (const record of records) {
    const key = `${record.collection}/${record.id}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 2) {
      issues.push(
        issue('error', 'id_duplicado', `ID repetido na mesma coleção: ${key}`, {
          collection: record.collection,
          recordId: record.id,
        }),
      );
    }
  }

  return issues;
}

/** Todo ID legado precisa sobreviver: é o que mantém links e URLs existentes. */
export function checkLegacyIdsPreserved(records: MigrationRecord[]): MigrationIssue[] {
  return records
    .filter((record) => !record.legacyId || record.legacyId.length === 0)
    .map((record) =>
      issue('error', 'legacy_id_ausente', `Registro sem legacyId: ${record.collection}/${record.id}`, {
        collection: record.collection,
        recordId: record.id,
      }),
    );
}

/** Referências apontando para registros que não existem no plano. */
export function checkOrphanReferences(records: MigrationRecord[]): MigrationIssue[] {
  const issues: MigrationIssue[] = [];
  const idsBy = (collection: string) =>
    new Set(records.filter((r) => r.collection === collection).map((r) => r.id));

  const axes = idsBy('axes');
  const documents = idsBy('documents');
  const indicators = idsBy('indicators');

  for (const record of records) {
    const data = record.data;

    if (record.collection === 'projects') {
      const axisId = data.axisId as string | undefined;
      if (axisId && !axes.has(axisId)) {
        issues.push(
          issue('error', 'eixo_inexistente', `Projeto aponta para eixo inexistente: ${axisId}`, {
            collection: record.collection,
            recordId: record.id,
          }),
        );
      }
    }

    for (const documentId of (data.relatedDocumentIds as string[] | undefined) ?? []) {
      if (!documents.has(documentId)) {
        issues.push(
          issue('warning', 'documento_inexistente', `Documento relacionado não encontrado: ${documentId}`, {
            collection: record.collection,
            recordId: record.id,
          }),
        );
      }
    }

    for (const indicatorId of (data.relatedIndicatorIds as string[] | undefined) ?? []) {
      if (!indicators.has(indicatorId)) {
        issues.push(
          issue('warning', 'indicador_inexistente', `Indicador relacionado não encontrado: ${indicatorId}`, {
            collection: record.collection,
            recordId: record.id,
          }),
        );
      }
    }
  }

  return issues;
}

/**
 * A regra que este projeto inteiro defende: ausência não vira zero.
 *
 * Se um campo de valor, prazo ou pontuação chegou como 0, false ou string
 * vazia onde a origem tinha null, alguém "arrumou" o dado. Isso é erro, não
 * aviso.
 */
const NULLABLE_NUMERIC_FIELDS = [
  'progressPercent',
  'priorityScore',
  'socialImpactScore',
  'capexMinCents',
  'capexMaxCents',
  'annualOpexCents',
  'value',
];

export function checkNoInventedZeros(records: MigrationRecord[]): MigrationIssue[] {
  const issues: MigrationIssue[] = [];

  for (const record of records) {
    for (const field of NULLABLE_NUMERIC_FIELDS) {
      if (!(field in record.data)) continue;
      const value = record.data[field];
      // Zero legítimo existe (um indicador pode valer 0). O que se procura é
      // zero num campo que a origem declarou ausente — sinalizado pela
      // presença do campo em `gaps`.
      if (value === 0 && record.gaps.includes(field)) {
        issues.push(
          issue('error', 'ausencia_virou_zero', `Campo ausente convertido em zero: ${field}`, {
            collection: record.collection,
            recordId: record.id,
          }),
        );
      }
    }
  }

  return issues;
}

/** Faixas monetárias e de pontuação dentro dos limites do domínio. */
export function checkRanges(records: MigrationRecord[]): MigrationIssue[] {
  const issues: MigrationIssue[] = [];

  for (const record of records) {
    const min = record.data.capexMinCents as number | null | undefined;
    const max = record.data.capexMaxCents as number | null | undefined;
    if (typeof min === 'number' && typeof max === 'number' && min > max) {
      issues.push(
        issue('error', 'capex_invertido', `capexMinCents (${min}) maior que capexMaxCents (${max})`, {
          collection: record.collection,
          recordId: record.id,
        }),
      );
    }

    for (const field of ['priorityScore', 'socialImpactScore']) {
      const score = record.data[field];
      if (typeof score === 'number' && (score < 0 || score > 100)) {
        issues.push(
          issue('error', 'score_fora_de_faixa', `${field} fora de 0–100: ${score}`, {
            collection: record.collection,
            recordId: record.id,
          }),
        );
      }
    }
  }

  return issues;
}

/**
 * Um agregado só pode ser 'divergent' se houver de fato mais de uma alegação
 * para o mesmo campo. Declarar divergência sem as duas fontes é afirmar algo
 * que não se pode demonstrar.
 */
export function checkDivergenceHasEvidence(plan: MigrationPlan): MigrationIssue[] {
  const issues: MigrationIssue[] = [];
  const claimsByEntity = new Map<string, number>();

  for (const claim of plan.evidence) {
    const key = `${claim.entityId}::${claim.fieldPath}`;
    claimsByEntity.set(key, (claimsByEntity.get(key) ?? 0) + 1);
  }

  for (const record of plan.records) {
    if (record.data.hasDivergentSources !== true) continue;
    const total = [...claimsByEntity.entries()]
      .filter(([key]) => key.startsWith(`${record.id}::`))
      .reduce((sum, [, count]) => Math.max(sum, count), 0);

    if (total < 2) {
      issues.push(
        issue(
          'error',
          'divergencia_sem_evidencia',
          `Marcado como divergente, mas há ${total} alegação(ões) registrada(s)`,
          { collection: record.collection, recordId: record.id },
        ),
      );
    }
  }

  return issues;
}

/**
 * Ciclo no grafo de dependências.
 *
 * A verificação existia no `createDependency`, que recusava a aresta antes de
 * gravar. Quando o formulário de dependências saiu — em 16/08/2026, porque as
 * dependências vêm dos documentos — a verificação veio para cá: agora a
 * transcrição é o único caminho, e um ciclo vindo dela paralisaria o portfólio
 * inteiro sem que ninguém fosse avisado.
 *
 * É `error`, não `warning`: com um ciclo, nenhuma das ações pode começar,
 * porque cada uma espera a outra.
 */
export function checkDependencyCycles(records: MigrationRecord[]): MigrationIssue[] {
  const edges: DependencyEdge[] = records
    .filter((r) => r.collection === 'dependencies')
    .map((r) => ({
      id: r.id,
      predecessorId: String(r.data.predecessorId ?? ''),
      successorId: String(r.data.successorId ?? ''),
      type: r.data.type as DependencyEdge['type'],
      lagDays: Number(r.data.lagDays ?? 0),
      mandatory: r.data.mandatory === true,
      justification: String(r.data.justification ?? ''),
    }));

  const cycle = findCycle(edges);
  if (cycle === null) return [];
  return [
    issue(
      'error',
      'ciclo_de_dependencias',
      `As dependências transcritas fecham um ciclo: ${cycle.join(' → ')}. ` +
        'Com o ciclo, nenhuma das ações pode começar, porque cada uma espera a outra.',
      { collection: 'dependencies' },
    ),
  ];
}

/** A contagem final tem que bater com a de origem: nem um a mais, nem a menos. */
export function checkRecordCount(plan: MigrationPlan): MigrationIssue[] {
  if (plan.records.length === plan.totalSourceRecords) return [];
  return [
    issue(
      'error',
      'contagem_divergente',
      `Origem tem ${plan.totalSourceRecords} registros, plano tem ${plan.records.length}`,
    ),
  ];
}

export function runIntegrityChecks(plan: MigrationPlan): MigrationIssue[] {
  return [
    ...checkRecordCount(plan),
    ...checkDuplicateIds(plan.records),
    ...checkLegacyIdsPreserved(plan.records),
    ...checkOrphanReferences(plan.records),
    ...checkNoInventedZeros(plan.records),
    ...checkRanges(plan.records),
    ...checkDivergenceHasEvidence(plan),
    ...checkDependencyCycles(plan.records),
  ];
}
