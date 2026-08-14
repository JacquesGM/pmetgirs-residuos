import { collection, getDocs, limit as fsLimit, query } from 'firebase/firestore';
import { getDb, workspaceId } from '../firebase/client';
import { commitMutation } from './portfolio';
import { describeCycle, wouldCreateCycle, type DependencyEdge } from '../../domain/dependencies/graph';
import type { DependencyType, Role } from '../../domain/enums';

/**
 * Dependências entre ações.
 *
 * A validação de ciclo roda ANTES da gravação, contra o grafo já existente.
 * Um ciclo gravado paralisa o portfólio — nenhuma das ações do ciclo pode
 * começar, porque cada uma espera a outra — e a mensagem de recusa nomeia o
 * caminho exato, em vez de mandar o usuário procurar.
 */

export class CycleBlocked extends Error {
  constructor(
    message: string,
    readonly cycle: string[],
  ) {
    super(message);
  }
}

function base(): string {
  return `workspaces/${workspaceId()}`;
}

export async function listDependencies(max = 300): Promise<DependencyEdge[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), `${base()}/dependencies`), fsLimit(max)),
  );
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      predecessorId: String(data.predecessorId ?? ''),
      successorId: String(data.successorId ?? ''),
      type: (data.type ?? 'finish_to_start') as DependencyType,
      lagDays: typeof data.lagDays === 'number' ? data.lagDays : 0,
      mandatory: data.mandatory !== false,
      justification: String(data.justification ?? ''),
      sharedResourceId: typeof data.sharedResourceId === 'string' ? data.sharedResourceId : null,
    };
  });
}

export interface CreateDependencyInput {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
  mandatory: boolean;
  justification: string;
  sharedResourceId?: string | null;
  actorUid: string;
  actorRole: Role;
  /** Nomes para a mensagem de ciclo ficar legível. */
  names: Map<string, string>;
}

export async function createDependency(input: CreateDependencyInput): Promise<{ id: string }> {
  if (input.justification.trim().length === 0) {
    throw new Error('Justifique a dependência: sem o porquê, ninguém consegue revisá-la depois.');
  }

  const id = `${input.predecessorId}--${input.successorId}`;
  const candidate: DependencyEdge = {
    id,
    predecessorId: input.predecessorId,
    successorId: input.successorId,
    type: input.type,
    lagDays: input.lagDays,
    mandatory: input.mandatory,
    justification: input.justification,
    sharedResourceId: input.sharedResourceId ?? null,
  };

  // Recusa antes de gravar, com o caminho do ciclo na mensagem.
  const existentes = await listDependencies();
  const ciclo = wouldCreateCycle(existentes, candidate);
  if (ciclo) {
    throw new CycleBlocked(
      input.predecessorId === input.successorId
        ? 'Uma ação não pode depender de si mesma.'
        : describeCycle(ciclo, input.names),
      ciclo,
    );
  }

  await commitMutation({
    workspaceId: workspaceId(),
    collection: 'dependencies',
    id,
    data: {
      predecessorId: candidate.predecessorId,
      successorId: candidate.successorId,
      type: candidate.type,
      lagDays: candidate.lagDays,
      mandatory: candidate.mandatory,
      justification: candidate.justification,
      sharedResourceId: candidate.sharedResourceId,
      validationStatus: 'not_assessed',
    },
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    action: 'create',
    reason: `Dependência registrada: ${input.justification}`,
  });

  return { id };
}
