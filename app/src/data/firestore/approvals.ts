import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDb, workspaceId } from '../firebase/client';
import type { Role } from '../../domain/enums';

/**
 * Pedidos de publicação.
 *
 * O fluxo editorial deste sistema governa a PUBLICAÇÃO, não a entrada de
 * dados. Depois que os formulários de conteúdo saíram — em 16/08/2026, porque
 * os dados vêm dos documentos técnicos —, publicar passou a ser a única
 * escrita que a interface oferece. É ela, portanto, que precisa de revisão.
 *
 * Três papéis, três atos distintos, cada um com a sua regra no Firestore:
 *
 *   editor       cria o pedido        status 'pending', createdBy == si mesmo
 *   revisor      decide o pedido      status aprovado/recusado/mudanças
 *   proprietário publica              escreve em publicWorkspaces
 *
 * O proprietário continua podendo publicar direto, sem pedido. Não é atalho:
 * é o que impede o sistema de travar. Com um único membro, exigir aprovação de
 * terceiro deixaria o portal sem forma de publicar — ou obrigaria o
 * proprietário a aprovar o próprio pedido, que é pior que não ter revisão,
 * porque tem a aparência dela.
 */

export type StatusDoPedido = 'pending' | 'approved' | 'changes_requested' | 'rejected';

export interface PedidoDePublicacao {
  id: string;
  /** Chaves `colecao/id`, no mesmo formato que a tela de publicação usa. */
  itens: string[];
  motivo: string;
  status: StatusDoPedido;
  createdBy: string;
  createdAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  /** Por que o revisor decidiu assim. Obrigatório para recusar. */
  parecer: string | null;
}

function base(): string {
  return `workspaces/${workspaceId()}`;
}

function paraData(valor: unknown): Date | null {
  return valor && typeof (valor as { toDate?: unknown }).toDate === 'function'
    ? ((valor as { toDate: () => Date }).toDate())
    : null;
}

export async function listarPedidos(max = 50): Promise<PedidoDePublicacao[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), `${base()}/approvalRequests`), fsLimit(max)),
  );
  return snapshot.docs
    .map((d) => {
      const x = d.data();
      const texto = (k: string) =>
        typeof x[k] === 'string' && x[k] !== '' ? (x[k] as string) : null;
      return {
        id: d.id,
        itens: Array.isArray(x.items) ? (x.items as string[]) : [],
        motivo: String(x.reason ?? ''),
        status: (texto('status') ?? 'pending') as StatusDoPedido,
        createdBy: String(x.createdBy ?? ''),
        createdAt: paraData(x.createdAt),
        reviewedBy: texto('reviewedBy'),
        reviewedAt: paraData(x.reviewedAt),
        parecer: texto('reviewNote'),
      };
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export interface CriarPedidoInput {
  itens: string[];
  motivo: string;
  actorUid: string;
  actorRole: Role;
}

/**
 * Cria o pedido e o evento de auditoria no mesmo lote.
 *
 * Mesma disciplina de `commitMutation`: pedido sem rastro de quem pediu e por
 * quê não é pedido, é intenção anônima.
 */
export async function criarPedido(input: CriarPedidoInput): Promise<{ id: string }> {
  if (input.itens.length === 0) {
    throw new Error('Selecione o que entra no pedido antes de enviá-lo.');
  }
  if (input.motivo.trim().length < 5) {
    throw new Error(
      'Descreva o motivo do pedido. Quem revisa precisa saber o que está sendo proposto e por quê.',
    );
  }

  const db = getDb();
  const wid = workspaceId();
  const ref = doc(collection(db, `${base()}/approvalRequests`));
  const batch = writeBatch(db);

  batch.set(ref, {
    id: ref.id,
    workspaceId: wid,
    items: input.itens,
    reason: input.motivo.trim(),
    itemCount: input.itens.length,
    status: 'pending',
    createdBy: input.actorUid,
    createdAt: serverTimestamp(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  });

  const eventoRef = doc(collection(db, `${base()}/auditEvents`));
  batch.set(eventoRef, {
    id: eventoRef.id,
    workspaceId: wid,
    entityCollection: 'approvalRequests',
    entityId: ref.id,
    action: 'create',
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    occurredAt: serverTimestamp(),
    reason: input.motivo.trim(),
    changedFields: input.itens,
    toVersion: 1,
    correlationId: ref.id,
    source: 'web',
  });

  await batch.commit();
  return { id: ref.id };
}

export interface DecidirPedidoInput {
  pedidoId: string;
  decisao: Exclude<StatusDoPedido, 'pending'>;
  parecer: string;
  actorUid: string;
}

/**
 * Decisão do revisor.
 *
 * Recusar e pedir mudanças exigem parecer. Aprovar não: um "sim" sem ressalva
 * é uma posição completa, e exigir texto onde não há o que dizer treina quem
 * revisa a escrever "ok" — o que destrói o valor do campo justamente nos casos
 * em que ele importa.
 */
export async function decidirPedido(input: DecidirPedidoInput): Promise<void> {
  if (input.decisao !== 'approved' && input.parecer.trim().length < 5) {
    throw new Error(
      'Recusar ou pedir mudanças exige parecer: quem propôs precisa saber o que corrigir.',
    );
  }

  await updateDoc(doc(getDb(), `${base()}/approvalRequests/${input.pedidoId}`), {
    status: input.decisao,
    reviewedBy: input.actorUid,
    reviewedAt: serverTimestamp(),
    reviewNote: input.parecer.trim() || null,
  });
}

/**
 * O elo entre pedido e publicação NÃO fica no pedido.
 *
 * Duas razões. As Rules exigem `reviewedAt == request.time` em toda
 * atualização de `approvalRequests` — um `updateDoc` que gravasse só o
 * `releaseId` seria recusado. E, mais importante que a mecânica: registro de
 * decisão não deve mudar depois de tomada.
 *
 * Quem guarda o elo é o release, que é append-only por regra
 * (`allow update, delete: if false`). Ver `approvalRequestId` em
 * `publishBatch`.
 */
