import type { Role } from './enums';

/**
 * Construtor de mutação com auditoria atômica.
 *
 * O invariante que este módulo existe para garantir: nenhuma alteração de
 * conteúdo acontece sem um evento de auditoria gravado no MESMO commit. As
 * Security Rules exigem isso com getAfter(), então uma escrita sem evento é
 * recusada pelo servidor — não é uma convenção que dá para esquecer.
 *
 * A construção é pura e o relógio é injetado. Assim o formato do lote pode ser
 * testado sem rede, e os testes das Rules exercitam o mesmo formato contra o
 * Emulator.
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'archive'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'access_change';

export interface MutationInput {
  workspaceId: string;
  collection: string;
  id: string;
  /** Campos de domínio. O envelope de auditoria é acrescentado aqui. */
  data: Record<string, unknown>;
  actorUid: string;
  actorRole: Role;
  action: AuditAction;
  /** Obrigatório: uma alteração sem motivo é uma alteração sem prestação de contas. */
  reason: string;
  /** Ausente em criação; presente em atualização. */
  currentVersion?: number;
  /** Estado atual, para calcular o que mudou. Ausente em criação. */
  currentData?: Record<string, unknown>;
}

export interface MutationPlan {
  eventId: string;
  eventPath: string;
  docPath: string;
  /** Documento de domínio, com envelope completo. */
  doc: Record<string, unknown>;
  event: Record<string, unknown>;
  nextVersion: number;
  changedFields: string[];
}

/** Marcador substituído pelo carimbo de servidor no adaptador de persistência. */
export const SERVER_TIME = Symbol('serverTimestamp');

export class MutationError extends Error {}

/** Campos que o cliente nunca pode redefinir numa atualização. */
const IMMUTABLE_FIELDS = ['id', 'workspaceId', 'createdAt', 'createdBy'];

export function diffFields(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): string[] {
  if (!before) return Object.keys(after).sort();
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed.push(key);
  }
  return changed.sort();
}

export function buildMutation(input: MutationInput, newEventId: string): MutationPlan {
  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new MutationError('Toda alteração exige um motivo. Sem motivo não há prestação de contas.');
  }

  const currentVersion = input.currentVersion;
  const isCreate = currentVersion === undefined;
  const nextVersion = currentVersion === undefined ? 1 : currentVersion + 1;

  for (const field of IMMUTABLE_FIELDS) {
    if (!isCreate && field in input.data && input.data[field] !== input.currentData?.[field]) {
      throw new MutationError(
        `Campo imutável alterado: ${field}. Identidade e origem de um registro não mudam.`,
      );
    }
  }

  const changedFields = diffFields(input.currentData, input.data);
  if (!isCreate && changedFields.length === 0) {
    throw new MutationError('Nada mudou. Uma gravação sem alteração só polui o histórico.');
  }

  // As Rules exigem que createdAt e createdBy cheguem idênticos ao que está
  // gravado. Sem eles no estado atual, o documento sairia sem esses campos e o
  // servidor recusaria com um "permission-denied" que não explica nada.
  // Falhar aqui, com a causa nomeada, poupa a caçada.
  if (!isCreate) {
    for (const field of ['createdAt', 'createdBy']) {
      if (input.currentData?.[field] === undefined) {
        throw new MutationError(
          `Atualização exige ${field} no estado atual: as Security Rules conferem que ele não mudou. ` +
            'Carregue o documento inteiro antes de editar.',
        );
      }
    }
  }

  const base = `workspaces/${input.workspaceId}`;
  const docPath = `${base}/${input.collection}/${input.id}`;
  const eventPath = `${base}/auditEvents/${newEventId}`;

  const doc: Record<string, unknown> = {
    ...input.data,
    id: input.id,
    workspaceId: input.workspaceId,
    schemaVersion: 1,
    version: nextVersion,
    // As Rules conferem que este evento existe ao fim do commit e casa com a
    // entidade, o ator, a hora e a versão.
    lastEventId: newEventId,
    updatedAt: SERVER_TIME,
    updatedBy: input.actorUid,
    changeReason: reason,
    isArchived: input.action === 'archive' ? true : (input.data.isArchived ?? false),
  };

  if (isCreate) {
    doc.createdAt = SERVER_TIME;
    doc.createdBy = input.actorUid;
  } else {
    doc.createdAt = input.currentData?.createdAt;
    doc.createdBy = input.currentData?.createdBy;
  }

  if (input.action === 'archive') {
    doc.archivedAt = SERVER_TIME;
    doc.archivedBy = input.actorUid;
  }

  const event: Record<string, unknown> = {
    id: newEventId,
    workspaceId: input.workspaceId,
    entityCollection: input.collection,
    entityId: input.id,
    action: input.action,
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    occurredAt: SERVER_TIME,
    reason,
    changedFields,
    fromVersion: currentVersion ?? null,
    toVersion: nextVersion,
    correlationId: newEventId,
    source: 'web',
  };

  return { eventId: newEventId, eventPath, docPath, doc, event, nextVersion, changedFields };
}
