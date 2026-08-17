import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
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
  /** Documento, tabela e página de onde o registro veio. É o único caminho de entrada. */
  sourceLabel: string | null;
  /** Abrangência como a fonte escreveu. */
  territorialScale: string | null;
  /** Leitura estruturada da abrangência. `null` quando a fonte não determina. */
  municipalityIds: string[] | null;
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
    sourceLabel: str(data.sourceLabel),
    territorialScale: str(data.territorialScale),
    municipalityIds: Array.isArray(data.municipalityIds)
      ? (data.municipalityIds as string[])
      : null,
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
/**
 * Tamanho da página de leitura, não teto do que existe.
 *
 * Nasceu como teto: 200, e truncava em silêncio — 42 dos 242 indicadores
 * municipais não apareciam para publicar. Virou 500 com erro em vez de corte
 * silencioso, e em 17/08/2026 os indicadores chegaram a 550 e o erro disparou.
 * Teto ajustável é dívida com prazo; hoje  pagina até o fim.
 */
export const LIMITE_PUBLICACAO = 500;

/** Teto de páginas: 25.000 registros. Protege contra laço, não contra volume. */
const MAX_PAGINAS_PUBLICACAO = 50;

export interface EixoResumo {
  id: string;
  name: string;
}

/** Eixos para preencher seletor. São doze; não há paginação a fazer. */
export async function listAxes(): Promise<EixoResumo[]> {
  const snap = await getDocs(collection(getDb(), `${base()}/axes`));
  return snap.docs
    .map((d) => ({ id: d.id, name: str(d.data().name) ?? d.id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * Lista uma coleção inteira para publicação, paginando por `startAfter`.
 *
 * Já foi uma leitura única com teto: 200, depois 500, e a cada crescimento dos
 * dados o teto voltava a ser alcançado. Em 17/08/2026 os indicadores
 * municipais chegaram a 550 e a guarda disparou — corretamente, mas a tela de
 * publicação não tinha ramo de erro e ficou em branco.
 *
 * Teto ajustável é dívida com prazo. Aqui a coleção é lida até o fim, em
 * páginas, e `LIMITE_PUBLICACAO` passa a ser tamanho de página, não limite do
 * que existe. O guarda contra laço infinito continua, mas agora protege contra
 * defeito, não contra volume.
 */
export async function listForPublication(
  collection_: string,
  pagina = LIMITE_PUBLICACAO,
): Promise<PublishableItem[]> {
  const docs: QueryDocumentSnapshot[] = [];
  let cursor: QueryDocumentSnapshot | undefined;

  for (let i = 0; i < MAX_PAGINAS_PUBLICACAO; i += 1) {
    const restricoes: QueryConstraint[] = [orderBy('__name__'), fsLimit(pagina)];
    if (cursor) restricoes.push(startAfter(cursor));
    const snapshot = await getDocs(
      query(collection(getDb(), `${base()}/${collection_}`), ...restricoes),
    );
    docs.push(...snapshot.docs);
    if (snapshot.size < pagina) return mapearPublicaveis(docs);
    cursor = snapshot.docs[snapshot.size - 1];
  }

  throw new Error(
    `A coleção "${collection_}" passou de ${MAX_PAGINAS_PUBLICACAO * pagina} registros na ` +
      'listagem para publicação. Publicar com a lista truncada deixaria registros de fora sem aviso.',
  );
}

function mapearPublicaveis(docs: QueryDocumentSnapshot[]): PublishableItem[] {
  return docs
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

/**
 * Histórico de auditoria, do workspace inteiro ou de uma entidade.
 *
 * Filtrar por entidade exige TAMBÉM a coleção: o índice composto declarado é
 * `entityCollection + entityId + occurredAt`, e uma consulta que só filtre
 * `entityId` não usa esse prefixo — o Firestore recusa por falta de índice.
 * Era o que acontecia no detalhe do projeto: a consulta falhava, a tela não
 * tinha ramo de erro e o Histórico aparecia vazio, como se não houvesse eventos.
 *
 * Exigir a coleção também é mais correto: dois documentos de coleções
 * diferentes podem ter o mesmo id.
 */
export async function listAuditEvents(
  entity?: { collection: string; id: string },
  max = 50,
): Promise<AuditEntry[]> {
  const constraints: QueryConstraint[] = [];
  if (entity) {
    constraints.push(where('entityCollection', '==', entity.collection));
    constraints.push(where('entityId', '==', entity.id));
  }
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
 *
 * SEM CHAMADOR desde 17/08/2026, e isso é intencional, não esquecimento. O
 * conteúdo entra por transcrição, pela migração, que usa o Admin SDK; nenhuma
 * tela escreve em coleção de conteúdo, e as Rules agora só aceitam a escrita do
 * proprietário.
 *
 * Fica porque é a implementação de referência do envelope de auditoria que as
 * Rules exigem — os testes de Rules a exercitam pelo caminho real, e é ela que
 * qualquer caminho de escrita futuro deve usar em vez de reinventar. Apagá-la
 * convidaria a próxima gravação a nascer sem rastro.
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

export interface TemaGutGravado {
  id: string;
  tema: string;
  gravidade: number;
  urgencia: number;
  tendencia: number;
  pontuacao: number;
  ranking: number;
  projetosRelacionados: string[];
  observacao: string | null;
}

/**
 * A priorização que o Plano de Ações já fez, por Gravidade, Urgência e
 * Tendência. Dezesseis temas; não há paginação a fazer.
 */
export async function listGutPriorities(): Promise<TemaGutGravado[]> {
  const snap = await getDocs(collection(getDb(), `${base()}/gutPriorities`));
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        tema: str(x.name) ?? d.id,
        gravidade: num(x.severity) ?? 0,
        urgencia: num(x.urgency) ?? 0,
        tendencia: num(x.trend) ?? 0,
        pontuacao: num(x.score) ?? 0,
        ranking: num(x.ranking) ?? 99,
        projetosRelacionados: Array.isArray(x.relatedProjectIds) ? (x.relatedProjectIds as string[]) : [],
        observacao: str(x.note) ?? null,
      };
    })
    .sort((a, b) => a.ranking - b.ranking);
}
