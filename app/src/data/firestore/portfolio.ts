import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDb, workspaceId } from '../firebase/client';
import { buildMutation, SERVER_TIME, type MutationInput } from '../../domain/mutation';

/**
 * Acesso ao portfólio no Firestore.
 *
 * Nenhum componente React importa `firebase/firestore`. Tudo passa por aqui,
 * o que permite trocar a implementação, testar o domínio sem rede e manter os
 * tipos do SDK longe do resto da aplicação.
 */

export interface PortfolioProject {
  id: string;
  name: string;
  axisId: string | null;
  description: string | null;
  accountable: string | null;
  executionStatus: string | null;
  validationStatus: string | null;
  actualityStatus: string | null;
  legacyStatus: string | null;
  timeHorizon: string | null;
  costCategory: string | null;
  priorityScore: number | null;
  dataDate: string | null;
  version: number;
  updatedAt: Date | null;
  isArchived: boolean;
}

export interface AuditEntry {
  id: string;
  entityCollection: string;
  entityId: string;
  action: string;
  actorUid: string;
  actorRole: string;
  occurredAt: Date | null;
  reason: string;
  changedFields: string[];
  fromVersion: number | null;
  toVersion: number;
  source: string;
}

/** Converte Timestamp em Date. Nenhum tipo do SDK escapa deste arquivo. */
function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function mapProject(id: string, data: DocumentData): PortfolioProject {
  return {
    id,
    name: str(data.name) ?? '(sem nome)',
    axisId: str(data.axisId),
    description: str(data.description),
    accountable: str(data.accountable),
    executionStatus: str(data.executionStatus),
    validationStatus: str(data.validationStatus),
    actualityStatus: str(data.actualityStatus),
    legacyStatus: str(data.legacyStatus),
    timeHorizon: str(data.timeHorizon),
    costCategory: str(data.costCategory),
    priorityScore: num(data.priorityScore),
    dataDate: str(data.dataDate),
    version: num(data.version) ?? 1,
    updatedAt: toDate(data.updatedAt),
    isArchived: data.isArchived === true,
  };
}

function base(): string {
  return `workspaces/${workspaceId()}`;
}

export interface ProjectQuery {
  axisId?: string;
  executionStatus?: string;
  limit?: number;
}

export async function listProjects(filters: ProjectQuery = {}): Promise<PortfolioProject[]> {
  const constraints: QueryConstraint[] = [];
  if (filters.axisId) constraints.push(where('axisId', '==', filters.axisId));
  if (filters.executionStatus) constraints.push(where('executionStatus', '==', filters.executionStatus));
  constraints.push(orderBy('nameNormalized'));
  // Sempre paginado: uma listagem sem limite é uma conta que cresce sozinha.
  constraints.push(fsLimit(filters.limit ?? 100));

  const snapshot = await getDocs(query(collection(getDb(), `${base()}/projects`), ...constraints));
  return snapshot.docs.map((d) => mapProject(d.id, d.data()));
}

/** Item publicável, como a tela de publicação precisa listar. */
export interface PublishableItem {
  id: string;
  rotulo: string;
  version: number;
}

/**
 * Lista qualquer coleção publicável para a tela de publicação.
 *
 * Devolve apenas id, rótulo e versão — o suficiente para escolher o que vai ao
 * ar. O documento completo só é lido na hora de publicar, por
 * `readDocsForPublication`.
 */
export async function listForPublication(
  collection_: string,
  max = 200,
): Promise<PublishableItem[]> {
  const snapshot = await getDocs(
    query(collection(getDb(), `${base()}/${collection_}`), fsLimit(max)),
  );
  return snapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        // Projetos e indicadores usam `name`; documentos usam `title`.
        rotulo: str(data.name) ?? str(data.title) ?? d.id,
        version: num(data.version) ?? 1,
      };
    })
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

/**
 * Documentos armazenados de qualquer coleção, para publicar.
 *
 * Mesma razão de `readProjectsForPublication`: a allowlist só preserva o que
 * recebe, e um view model de listagem não serve como entrada.
 */
export async function readDocsForPublication(
  collection_: string,
  ids: string[],
): Promise<Array<{ id: string; version: number; data: DocumentData }>> {
  const lidos = await Promise.all(
    ids.map(async (id) => {
      const snapshot = await getDoc(doc(getDb(), `${base()}/${collection_}/${id}`));
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      return { id: snapshot.id, version: num(data.version) ?? 1, data };
    }),
  );
  return lidos.filter((x): x is { id: string; version: number; data: DocumentData } => x !== null);
}

/**
 * Documentos armazenados dos projetos indicados, sem passar por `mapProject`.
 *
 * A publicação PRECISA do documento como está no banco. `mapProject` monta um
 * view model para a listagem, com os 15 campos que aquela tela usa — e a
 * allowlist da publicação só consegue preservar o que recebe. Publicar a partir
 * do view model descartava em silêncio seis campos autorizados
 * (`territorialScale`, `participants`, `nextSteps`, `risks`,
 * `relatedDocumentIds`, `sourceLabel`), e o cidadão via registros incompletos
 * sem que nada falhasse. Aconteceu em 15/08/2026.
 *
 * Uma leitura por item selecionado; publicação é rara e correção vale mais que
 * economia de leitura.
 */
export async function readProjectsForPublication(
  ids: string[],
): Promise<Array<{ id: string; version: number; data: DocumentData }>> {
  const lidos = await Promise.all(
    ids.map(async (id) => {
      const snapshot = await getDoc(doc(getDb(), `${base()}/projects/${id}`));
      if (!snapshot.exists()) return null;
      const data = snapshot.data();
      return { id: snapshot.id, version: num(data.version) ?? 1, data };
    }),
  );
  return lidos.filter((x): x is { id: string; version: number; data: DocumentData } => x !== null);
}

export async function getProject(id: string): Promise<{
  project: PortfolioProject;
  raw: DocumentData;
} | null> {
  const snapshot = await getDoc(doc(getDb(), `${base()}/projects/${id}`));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { project: mapProject(snapshot.id, data), raw: data };
}

export async function countByCollection(name: string, max = 500): Promise<number> {
  const snapshot = await getDocs(query(collection(getDb(), `${base()}/${name}`), fsLimit(max)));
  return snapshot.size;
}

export async function listAuditEvents(entityId?: string, max = 50): Promise<AuditEntry[]> {
  const constraints: QueryConstraint[] = [];
  if (entityId) constraints.push(where('entityId', '==', entityId));
  constraints.push(orderBy('occurredAt', 'desc'));
  constraints.push(fsLimit(max));

  const snapshot = await getDocs(query(collection(getDb(), `${base()}/auditEvents`), ...constraints));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      entityCollection: str(data.entityCollection) ?? '',
      entityId: str(data.entityId) ?? '',
      action: str(data.action) ?? '',
      actorUid: str(data.actorUid) ?? '',
      actorRole: str(data.actorRole) ?? '',
      occurredAt: toDate(data.occurredAt),
      reason: str(data.reason) ?? '',
      changedFields: Array.isArray(data.changedFields) ? (data.changedFields as string[]) : [],
      fromVersion: num(data.fromVersion),
      toVersion: num(data.toVersion) ?? 1,
      source: str(data.source) ?? '',
    };
  });
}

/** Substitui o marcador do domínio pelo carimbo real do servidor. */
function materialize(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = value === SERVER_TIME ? serverTimestamp() : value;
  }
  return out;
}

/**
 * Grava documento e evento de auditoria no MESMO lote.
 *
 * Se o lote falhar, nada é escrito — e as Security Rules recusam a gravação do
 * documento se o evento não estiver presente no commit. Não existe caminho
 * neste código que altere conteúdo sem deixar rastro.
 */
export async function commitMutation(input: MutationInput): Promise<{ version: number; eventId: string }> {
  const db = getDb();
  const eventRef = doc(collection(db, `${base()}/auditEvents`));
  const plan = buildMutation(input, eventRef.id);

  const batch = writeBatch(db);
  batch.set(doc(db, plan.eventPath), materialize(plan.event));
  batch.set(doc(db, plan.docPath), materialize(plan.doc));
  await batch.commit();

  return { version: plan.nextVersion, eventId: plan.eventId };
}
