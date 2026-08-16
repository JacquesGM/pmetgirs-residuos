import type { StatusProjeto, StatusValidacao } from '../types';
import type { ActualityStatus, ExecutionStatus, SourceType, ValidationStatus } from './enums';

/**
 * Conversão dos 18 status legados (um campo só, em português) para as quatro
 * dimensões independentes do novo modelo.
 *
 * Nenhuma conversão descarta informação: o registro migrado guarda o valor
 * original em `legacyStatus`, para que a decisão seja auditável e reversível.
 *
 * O caso que motiva tudo isto é `dado_em_validacao`: hoje ele vive na união de
 * situação de execução, mas é situação do DADO. Ao migrar, ele sai da dimensão
 * de execução e deixa a execução indefinida — não vira `not_started`, porque
 * ninguém afirmou que o projeto não começou.
 */

export interface LegacyStatusMapping {
  execution?: ExecutionStatus;
  validation?: ValidationStatus;
  actuality?: ActualityStatus;
  sourceType?: SourceType;
  /** Valor original, preservado no registro migrado. */
  legacyStatus: string;
  /** Explica conversões que não são de um para um. */
  note?: string;
}

const EXECUTION_MAP: Record<StatusProjeto, LegacyStatusMapping> = {
  nao_iniciado: { execution: 'not_started', legacyStatus: 'nao_iniciado' },
  em_estruturacao: { execution: 'structuring', legacyStatus: 'em_estruturacao' },
  em_estudo: { execution: 'study', legacyStatus: 'em_estudo' },
  em_contratacao: { execution: 'procurement', legacyStatus: 'em_contratacao' },
  em_licenciamento: { execution: 'licensing', legacyStatus: 'em_licenciamento' },
  em_implantacao: { execution: 'implementation', legacyStatus: 'em_implantacao' },
  em_operacao: { execution: 'operation', legacyStatus: 'em_operacao' },
  concluido: { execution: 'completed', legacyStatus: 'concluido' },
  suspenso: { execution: 'paused', legacyStatus: 'suspenso' },
  dado_em_validacao: {
    validation: 'in_validation',
    legacyStatus: 'dado_em_validacao',
    note:
      'Situação do dado, não de execução. A execução fica indefinida na migração: ' +
      'nenhuma fonte afirmou que o projeto não começou.',
  },
};

const VALIDATION_MAP: Record<StatusValidacao, LegacyStatusMapping> = {
  dado_oficial_validado: {
    validation: 'validated',
    sourceType: 'official',
    legacyStatus: 'dado_oficial_validado',
    note: 'Um campo legado vira dois: origem oficial e validação concluída.',
  },
  dado_municipal_declarado: {
    sourceType: 'municipal_declared',
    validation: 'not_assessed',
    legacyStatus: 'dado_municipal_declarado',
    note: 'Declaração municipal é origem; não implica validação.',
  },
  estimativa_tecnica: {
    sourceType: 'technical_estimate',
    validation: 'not_assessed',
    legacyStatus: 'estimativa_tecnica',
    note: 'Estimativa é origem, não grau de confiança.',
  },
  dado_historico: {
    actuality: 'historical',
    legacyStatus: 'dado_historico',
    note: 'Passa a conviver com qualquer situação de validação.',
  },
  dado_preliminar: { validation: 'preliminary', legacyStatus: 'dado_preliminar' },
  em_atualizacao: { actuality: 'updating', legacyStatus: 'em_atualizacao' },
  em_validacao: { validation: 'in_validation', legacyStatus: 'em_validacao' },
  informacao_divergente: {
    validation: 'divergent',
    legacyStatus: 'informacao_divergente',
    note: 'Exige pelo menos duas EvidenceClaim no mesmo fieldPath.',
  },
};

export function mapLegacyProjectStatus(status: StatusProjeto): LegacyStatusMapping {
  return EXECUTION_MAP[status];
}

/**
 * Caminho de volta: do `executionStatus` publicado para o status legado que a
 * interface pública exibe.
 *
 * Derivado do próprio EXECUTION_MAP para não haver duas tabelas divergindo. Um
 * status novo passa a ser convertido nos dois sentidos sem ninguém lembrar de
 * atualizar aqui.
 *
 * Devolve null quando a execução é indefinida — caso real: `dado_em_validacao`
 * descreve o dado, não a execução, e a migração deixa a execução em branco de
 * propósito. Nesses registros a interface mostra a situação de validação.
 */
export function legacyStatusFromExecution(execution: string | null | undefined): StatusProjeto | null {
  if (!execution) return null;
  for (const [legado, mapeado] of Object.entries(EXECUTION_MAP) as Array<
    [StatusProjeto, LegacyStatusMapping]
  >) {
    if (mapeado.execution === execution) return legado;
  }
  return null;
}

/**
 * Do `sourceType` publicado para o status legado de origem do dado.
 *
 * Este é 1:1 — cada origem vem de exatamente um valor legado —, ao contrário do
 * inverso de validação, onde dois valores diferentes colapsam em `not_assessed`.
 */
export function legacyStatusFromSourceType(sourceType: string | null | undefined): StatusValidacao | null {
  if (!sourceType) return null;
  for (const [legado, mapeado] of Object.entries(VALIDATION_MAP) as Array<
    [StatusValidacao, LegacyStatusMapping]
  >) {
    if (mapeado.sourceType === sourceType) return legado;
  }
  return null;
}

/** Idem, para a família de validação. */
export function legacyStatusFromValidation(validation: string | null | undefined): StatusValidacao | null {
  if (!validation) return null;
  for (const [legado, mapeado] of Object.entries(VALIDATION_MAP) as Array<
    [StatusValidacao, LegacyStatusMapping]
  >) {
    if (mapeado.validation === validation) return legado;
  }
  return null;
}

export function mapLegacyValidationStatus(status: StatusValidacao): LegacyStatusMapping {
  return VALIDATION_MAP[status];
}

/**
 * Resolve um status legado sem saber de antemão a que família ele pertence.
 *
 * Existe porque os dados de origem nem sempre respeitam o próprio tipo: o
 * campo `situacao` de `inconsistencias.json` é declarado como StatusValidacao,
 * mas um registro traz `em_estruturacao`, que é situação de execução. Em vez
 * de quebrar ou escolher um padrão em silêncio, resolvemos pelas duas famílias
 * e devolvemos de qual delas veio, para que a migração possa relatar o desvio.
 */
export interface ResolvedLegacyStatus extends LegacyStatusMapping {
  /** Família em que o valor foi de fato encontrado. */
  resolvedFrom: 'validation' | 'execution';
  /** true quando o valor não pertence à família declarada pelo tipo. */
  outOfDeclaredFamily: boolean;
}

export function resolveLegacyStatus(
  status: string,
  declaredFamily: 'validation' | 'execution',
): ResolvedLegacyStatus | null {
  const asValidation = VALIDATION_MAP[status as StatusValidacao];
  if (asValidation) {
    return {
      ...asValidation,
      resolvedFrom: 'validation',
      outOfDeclaredFamily: declaredFamily !== 'validation',
    };
  }

  const asExecution = EXECUTION_MAP[status as StatusProjeto];
  if (asExecution) {
    return {
      ...asExecution,
      resolvedFrom: 'execution',
      outOfDeclaredFamily: declaredFamily !== 'execution',
    };
  }

  return null;
}

/** Todos os status legados conhecidos, para conferência de cobertura na migração. */
export const LEGACY_STATUS_KEYS = [
  ...(Object.keys(EXECUTION_MAP) as StatusProjeto[]),
  ...(Object.keys(VALIDATION_MAP) as StatusValidacao[]),
];
