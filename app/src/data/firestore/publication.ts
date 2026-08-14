import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { getDb, workspaceId } from '../firebase/client';
import {
  sanitizeForPublication,
  type PublicCollection,
} from '../../domain/publication/sanitize';
import type { Role } from '../../domain/enums';

/**
 * Publicação: a única passagem da árvore interna para a pública.
 *
 * Tudo acontece num writeBatch: documento público sanitizado, estado interno,
 * registro do release e evento de auditoria. Se o lote falhar, nada muda —
 * não existe estado intermediário em que o público veja algo que o sistema
 * interno não considera publicado.
 *
 * As Security Rules restringem a escrita em publicWorkspaces ao proprietário.
 * Este código não é a proteção; ele apenas não tenta contornar a proteção.
 */

export interface PublishItem {
  collection: PublicCollection;
  id: string;
  version: number;
  data: Record<string, unknown>;
}

export interface PublishResult {
  releaseId: string;
  publishedCount: number;
  droppedFieldsByItem: Record<string, string[]>;
}

export async function publishBatch(
  items: PublishItem[],
  actor: { uid: string; role: Role },
  reason: string,
): Promise<PublishResult> {
  if (actor.role !== 'owner') {
    throw new Error('Somente o proprietário publica. Revisar e aprovar não é publicar.');
  }
  if (items.length === 0) {
    throw new Error('Nada selecionado para publicar.');
  }
  if (reason.trim().length === 0) {
    throw new Error('Informe o motivo da publicação: ele fica registrado no release.');
  }

  const db = getDb();
  const wid = workspaceId();
  const base = `workspaces/${wid}`;
  const releaseRef = doc(collection(db, `${base}/publicationReleases`));
  const releaseId = releaseRef.id;

  const batch = writeBatch(db);
  const droppedFieldsByItem: Record<string, string[]> = {};

  for (const item of items) {
    const projection = sanitizeForPublication(item.collection, item.data, {
      sourceEntityId: item.id,
      sourceVersion: item.version,
      releaseId,
      publishedBy: actor.uid,
    });
    droppedFieldsByItem[`${item.collection}/${item.id}`] = projection.dropped;

    // Documento público: só os campos da allowlist, mais a rastreabilidade.
    batch.set(doc(db, `publicWorkspaces/${wid}/${item.collection}/${item.id}`), {
      ...projection.data,
      sourceEntityId: item.id,
      sourceVersion: item.version,
      releaseId,
      publishedAt: serverTimestamp(),
      publishedBy: actor.uid,
    });
  }

  batch.set(releaseRef, {
    id: releaseId,
    workspaceId: wid,
    publishedBy: actor.uid,
    publishedAt: serverTimestamp(),
    reason: reason.trim(),
    itemCount: items.length,
    items: items.map((i) => `${i.collection}/${i.id}`),
    // O que foi removido de cada item fica no release, não no documento
    // público: é registro de auditoria, não conteúdo para o cidadão.
    droppedFields: droppedFieldsByItem,
  });

  const eventRef = doc(collection(db, `${base}/auditEvents`));
  batch.set(eventRef, {
    id: eventRef.id,
    workspaceId: wid,
    entityCollection: 'publicationReleases',
    entityId: releaseId,
    action: 'publish',
    actorUid: actor.uid,
    actorRole: actor.role,
    occurredAt: serverTimestamp(),
    reason: reason.trim(),
    changedFields: items.map((i) => `${i.collection}/${i.id}`),
    toVersion: 1,
    correlationId: releaseId,
    source: 'web',
  });

  await batch.commit();

  return { releaseId, publishedCount: items.length, droppedFieldsByItem };
}

export interface ReleaseSummary {
  id: string;
  publishedAt: Date | null;
  reason: string;
  itemCount: number;
}

export async function listReleases(max = 20): Promise<ReleaseSummary[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), `workspaces/${workspaceId()}/publicationReleases`), fsLimit(max)),
  );
  return snapshot.docs
    .map((d) => {
      const data = d.data();
      const at = data.publishedAt;
      return {
        id: d.id,
        publishedAt: at && typeof at.toDate === 'function' ? (at.toDate() as Date) : null,
        reason: String(data.reason ?? ''),
        itemCount: typeof data.itemCount === 'number' ? data.itemCount : 0,
      };
    })
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
}

/** Conta o que já está visível ao cidadão numa coleção pública. */
export async function countPublic(collectionName: PublicCollection): Promise<number> {
  const snapshot = await getDocs(
    query(collection(getDb(), `publicWorkspaces/${workspaceId()}/${collectionName}`), fsLimit(500)),
  );
  return snapshot.size;
}
