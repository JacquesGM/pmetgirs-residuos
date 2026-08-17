import { collection, getDocs, limit as fsLimit, query } from 'firebase/firestore';
import { getDb, workspaceId } from '../firebase/client';
import type { DependencyEdge } from '../../domain/dependencies/graph';
import type { DependencyType } from '../../domain/enums';

/**
 * Leitura das dependências entre ações.
 *
 * Só leitura: as precedências vêm do campo `dependencias` dos projetos, pela
 * migração. O caminho de escrita pela interface saiu em 16/08/2026, junto com
 * os demais formulários — quem sabe o que precede o quê é o documento técnico,
 * não quem está com a tela aberta.
 *
 * A recusa de ciclo foi junto, para `checkDependencyCycles` na migração: um
 * ciclo paralisa o portfólio, porque nenhuma das ações do ciclo pode começar,
 * e a verificação precisa existir onde os dados entram.
 */

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
