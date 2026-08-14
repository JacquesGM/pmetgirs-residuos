import type { DependencyType } from '../enums';

/**
 * Grafo de dependências e concomitância.
 *
 * Tudo aqui é puro: mesmo grafo no cálculo da tela e na validação da
 * gravação. É o que permite recusar um ciclo ANTES de escrever, com o caminho
 * exato na mensagem, em vez de descobrir o problema depois.
 *
 * Duas distinções que o modelo insiste em manter:
 *
 *  1. Dependência TEMPORAL não é disputa de recurso. "A precisa terminar
 *     antes de B" é precedência; "A e B brigam pela mesma equipe" é
 *     capacidade. Misturar os dois produz cronograma que não se sustenta.
 *  2. Duração desconhecida não é duração zero. Sem a duração, o início mais
 *     cedo do sucessor é indeterminado — e o resultado diz isso, em vez de
 *     assumir que a tarefa é instantânea.
 */

export interface DependencyEdge {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
  mandatory: boolean;
  justification: string;
  sharedResourceId?: string | null;
}

export interface GraphNode {
  id: string;
  name: string;
  /** Em meses. null = não informada. */
  durationMonths: number | null;
  readinessScore?: number | null;
}

export class CycleError extends Error {
  constructor(
    message: string,
    /** Os nós do ciclo, em ordem, começando e terminando no mesmo. */
    readonly cycle: string[],
  ) {
    super(message);
  }
}

/** Só arestas temporais entram no grafo de precedência. */
const TEMPORAL_TYPES: DependencyType[] = ['finish_to_start', 'start_to_start', 'finish_to_finish'];

export function isTemporal(edge: DependencyEdge): boolean {
  return TEMPORAL_TYPES.includes(edge.type);
}

export function isResourceConflict(edge: DependencyEdge): boolean {
  return edge.type === 'resource_conflict';
}

function adjacency(edges: DependencyEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    if (!isTemporal(edge)) continue;
    const list = map.get(edge.predecessorId) ?? [];
    list.push(edge.successorId);
    map.set(edge.predecessorId, list);
  }
  return map;
}

/**
 * Procura um ciclo por busca em profundidade e devolve o caminho encontrado.
 *
 * Devolver o caminho, e não só "existe ciclo", é o que permite dizer ao
 * usuário exatamente onde está o problema: "A → B → C → A". Sem isso, num
 * portfólio com dezenas de ações, a mensagem vira uma caça ao tesouro.
 */
export function findCycle(edges: DependencyEdge[]): string[] | null {
  const graph = adjacency(edges);
  const VISITANDO = 1;
  const PRONTO = 2;
  const estado = new Map<string, number>();
  const pilha: string[] = [];

  function visitar(node: string): string[] | null {
    estado.set(node, VISITANDO);
    pilha.push(node);

    for (const vizinho of graph.get(node) ?? []) {
      if (estado.get(vizinho) === VISITANDO) {
        // Fecha o ciclo: recorta a pilha do ponto em que o vizinho aparece.
        const inicio = pilha.indexOf(vizinho);
        return [...pilha.slice(inicio), vizinho];
      }
      if (!estado.has(vizinho)) {
        const encontrado = visitar(vizinho);
        if (encontrado) return encontrado;
      }
    }

    pilha.pop();
    estado.set(node, PRONTO);
    return null;
  }

  for (const node of graph.keys()) {
    if (!estado.has(node)) {
      const encontrado = visitar(node);
      if (encontrado) return encontrado;
    }
  }

  return null;
}

/** Mensagem legível para quem vai desfazer o ciclo. */
export function describeCycle(cycle: string[], names: Map<string, string>): string {
  const caminho = cycle.map((id) => names.get(id) ?? id).join(' → ');
  return (
    `Esta dependência fecha um ciclo: ${caminho}. ` +
    'Com o ciclo, nenhuma das ações pode começar, porque cada uma espera a outra. ' +
    'Remova ou inverta uma das ligações do caminho acima.'
  );
}

/**
 * Verifica se acrescentar uma aresta criaria ciclo. Chamado ANTES de gravar.
 */
export function wouldCreateCycle(
  existing: DependencyEdge[],
  candidate: DependencyEdge,
): string[] | null {
  if (candidate.predecessorId === candidate.successorId) {
    return [candidate.predecessorId, candidate.successorId];
  }
  if (!isTemporal(candidate)) return null;
  return findCycle([...existing, candidate]);
}

/** Todos os predecessores, diretos e indiretos. */
export function transitivePredecessors(edges: DependencyEdge[], nodeId: string): Set<string> {
  const reverso = new Map<string, string[]>();
  for (const edge of edges) {
    if (!isTemporal(edge)) continue;
    const list = reverso.get(edge.successorId) ?? [];
    list.push(edge.predecessorId);
    reverso.set(edge.successorId, list);
  }

  const encontrados = new Set<string>();
  const fila = [...(reverso.get(nodeId) ?? [])];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    if (encontrados.has(atual)) continue;
    encontrados.add(atual);
    fila.push(...(reverso.get(atual) ?? []));
  }
  return encontrados;
}

export function hasDependencyPath(edges: DependencyEdge[], from: string, to: string): boolean {
  return transitivePredecessors(edges, to).has(from);
}

// ------------------------------------------------------- o que pode começar

export interface Startability {
  id: string;
  name: string;
  /** true quando nenhum predecessor obrigatório está pendente. */
  canStart: boolean;
  blockedBy: string[];
}

/**
 * O que pode começar agora.
 *
 * Só dependências OBRIGATÓRIAS bloqueiam. Uma dependência marcada como não
 * obrigatória é preferência de sequenciamento, não impedimento — tratá-la
 * como bloqueio paralisaria o portfólio por conveniência.
 */
export function computeStartability(
  nodes: GraphNode[],
  edges: DependencyEdge[],
  completedIds: Set<string> = new Set(),
): Startability[] {
  return nodes.map((node) => {
    const blockedBy = edges
      .filter(
        (e) =>
          isTemporal(e) &&
          e.mandatory &&
          e.successorId === node.id &&
          !completedIds.has(e.predecessorId),
      )
      .map((e) => e.predecessorId);

    return { id: node.id, name: node.name, canStart: blockedBy.length === 0, blockedBy };
  });
}

// ---------------------------------------------------------- paralelização

export type PairRelation = 'parallel' | 'sequential' | 'resource_conflict' | 'not_ready';

export interface PairAssessment {
  a: string;
  b: string;
  relation: PairRelation;
  why: string;
}

export interface ParallelPolicy {
  /** Prontidão mínima para recomendar execução simultânea. */
  minimumReadiness: number;
}

export const DEFAULT_PARALLEL_POLICY: ParallelPolicy = { minimumReadiness: 40 };

export function assessPair(
  nodes: GraphNode[],
  edges: DependencyEdge[],
  aId: string,
  bId: string,
  policy: ParallelPolicy = DEFAULT_PARALLEL_POLICY,
): PairAssessment {
  const a = nodes.find((n) => n.id === aId);
  const b = nodes.find((n) => n.id === bId);
  const nome = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  if (hasDependencyPath(edges, aId, bId)) {
    return { a: aId, b: bId, relation: 'sequential', why: `${nome(aId)} precede ${nome(bId)}.` };
  }
  if (hasDependencyPath(edges, bId, aId)) {
    return { a: aId, b: bId, relation: 'sequential', why: `${nome(bId)} precede ${nome(aId)}.` };
  }

  const conflito = edges.find(
    (e) =>
      isResourceConflict(e) &&
      e.mandatory &&
      ((e.predecessorId === aId && e.successorId === bId) ||
        (e.predecessorId === bId && e.successorId === aId)),
  );
  if (conflito) {
    return {
      a: aId,
      b: bId,
      relation: 'resource_conflict',
      why: `Disputam o mesmo recurso${conflito.sharedResourceId ? ` (${conflito.sharedResourceId})` : ''}.`,
    };
  }

  const prontidaoA = a?.readinessScore ?? null;
  const prontidaoB = b?.readinessScore ?? null;
  if (prontidaoA === null || prontidaoB === null) {
    return {
      a: aId,
      b: bId,
      relation: 'not_ready',
      why: 'Falta avaliação de prontidão em pelo menos uma das ações.',
    };
  }
  if (Math.min(prontidaoA, prontidaoB) < policy.minimumReadiness) {
    return {
      a: aId,
      b: bId,
      relation: 'not_ready',
      why: `Prontidão abaixo de ${policy.minimumReadiness} em pelo menos uma das ações.`,
    };
  }

  return {
    a: aId,
    b: bId,
    relation: 'parallel',
    why: 'Sem precedência entre elas e sem disputa de recurso obrigatória.',
  };
}

// -------------------------------------------------------- ondas e caminho

export interface WaveResult {
  /** Ondas de início: a onda 0 não depende de ninguém. */
  waves: string[][];
  /** Ações cujo início mais cedo não pode ser calculado. */
  indeterminate: string[];
}

/**
 * Agrupa as ações em ondas de início (ordenação topológica por níveis).
 *
 * Uma onda é "o conjunto de ações que pode começar ao mesmo tempo, dado que
 * tudo da onda anterior terminou". É a leitura executiva de um grafo que, em
 * forma de rede, poucas pessoas conseguem interpretar.
 */
export function computeWaves(nodes: GraphNode[], edges: DependencyEdge[]): WaveResult {
  const cycle = findCycle(edges);
  if (cycle) {
    throw new CycleError('Não é possível calcular ondas com um ciclo no grafo.', cycle);
  }

  const grauEntrada = new Map<string, number>();
  const sucessores = new Map<string, string[]>();

  for (const node of nodes) grauEntrada.set(node.id, 0);
  for (const edge of edges) {
    if (!isTemporal(edge)) continue;
    grauEntrada.set(edge.successorId, (grauEntrada.get(edge.successorId) ?? 0) + 1);
    const list = sucessores.get(edge.predecessorId) ?? [];
    list.push(edge.successorId);
    sucessores.set(edge.predecessorId, list);
  }

  const waves: string[][] = [];
  let atual = nodes.filter((n) => (grauEntrada.get(n.id) ?? 0) === 0).map((n) => n.id);
  const restantes = new Map(grauEntrada);

  while (atual.length > 0) {
    waves.push([...atual].sort());
    const proxima: string[] = [];
    for (const id of atual) {
      for (const sucessor of sucessores.get(id) ?? []) {
        const grau = (restantes.get(sucessor) ?? 0) - 1;
        restantes.set(sucessor, grau);
        if (grau === 0) proxima.push(sucessor);
      }
    }
    atual = proxima;
  }

  // Uma ação cuja cadeia de predecessores tem duração desconhecida não tem
  // início mais cedo calculável. Isso é reportado, não estimado.
  const semDuracao = new Set(nodes.filter((n) => n.durationMonths === null).map((n) => n.id));
  const indeterminate = nodes
    .filter((n) => {
      const predecessores = transitivePredecessors(edges, n.id);
      return [...predecessores].some((p) => semDuracao.has(p));
    })
    .map((n) => n.id)
    .sort();

  return { waves, indeterminate };
}

export interface CriticalPathResult {
  path: string[];
  /** Duração total em meses, ou null se algum elo não tem duração informada. */
  totalMonths: number | null;
  reason: string;
}

/**
 * Caminho crítico — a sequência mais longa, que define o prazo total.
 *
 * Devolve null na duração quando algum elo não tem duração informada. Somar
 * zero por um valor desconhecido produziria um prazo otimista e falso.
 */
export function computeCriticalPath(nodes: GraphNode[], edges: DependencyEdge[]): CriticalPathResult {
  const cycle = findCycle(edges);
  if (cycle) {
    throw new CycleError('Não é possível calcular caminho crítico com um ciclo no grafo.', cycle);
  }

  const porId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, { length: number; path: string[]; determinate: boolean }>();

  function maisLongo(id: string): { length: number; path: string[]; determinate: boolean } {
    const existente = memo.get(id);
    if (existente) return existente;

    const duracao = porId.get(id)?.durationMonths;
    const proprioDeterminado = duracao !== null && duracao !== undefined;

    const entradas = edges.filter((e) => isTemporal(e) && e.successorId === id);
    let melhor = { length: 0, path: [] as string[], determinate: true };

    for (const entrada of entradas) {
      const anterior = maisLongo(entrada.predecessorId);
      const lagMeses = entrada.lagDays / 30;
      const candidato = {
        length: anterior.length + lagMeses,
        path: anterior.path,
        determinate: anterior.determinate,
      };
      if (candidato.length > melhor.length || !candidato.determinate) {
        melhor = candidato;
      }
    }

    const resultado = {
      length: melhor.length + (proprioDeterminado ? duracao : 0),
      path: [...melhor.path, id],
      determinate: melhor.determinate && proprioDeterminado,
    };
    memo.set(id, resultado);
    return resultado;
  }

  let melhorGeral = { length: 0, path: [] as string[], determinate: true };
  for (const node of nodes) {
    const r = maisLongo(node.id);
    if (r.path.length > melhorGeral.path.length || r.length > melhorGeral.length) {
      melhorGeral = r;
    }
  }

  return {
    path: melhorGeral.path,
    totalMonths: melhorGeral.determinate ? Math.round(melhorGeral.length * 10) / 10 : null,
    reason: melhorGeral.determinate
      ? 'Todas as ações do caminho têm duração informada.'
      : 'Ao menos uma ação do caminho não tem duração informada; somar zero produziria um prazo falso.',
  };
}

// ------------------------------------------------------ conflitos de recurso

export interface ResourceAllocation {
  resourceId: string;
  projectId: string;
  /** Datas ISO YYYY-MM-DD. */
  start: string;
  end: string;
  amount: number;
}

export interface ResourceConflict {
  resourceId: string;
  projectIds: string[];
  period: { start: string; end: string };
  demanded: number;
  capacity: number;
}

/** Sobreposição de janelas com demanda acima da capacidade do recurso. */
export function findResourceConflicts(
  allocations: ResourceAllocation[],
  capacities: Map<string, number>,
): ResourceConflict[] {
  const conflicts: ResourceConflict[] = [];
  const porRecurso = new Map<string, ResourceAllocation[]>();

  for (const a of allocations) {
    const list = porRecurso.get(a.resourceId) ?? [];
    list.push(a);
    porRecurso.set(a.resourceId, list);
  }

  for (const [resourceId, list] of porRecurso) {
    const capacity = capacities.get(resourceId) ?? 0;

    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const inicio = a.start > b.start ? a.start : b.start;
        const fim = a.end < b.end ? a.end : b.end;
        if (inicio > fim) continue;

        const demanded = a.amount + b.amount;
        if (demanded > capacity) {
          conflicts.push({
            resourceId,
            projectIds: [a.projectId, b.projectId].sort(),
            period: { start: inicio, end: fim },
            demanded,
            capacity,
          });
        }
      }
    }
  }

  return conflicts;
}
