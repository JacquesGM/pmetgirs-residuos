import { describe, expect, it } from 'vitest';
import {
  assessPair,
  computeCriticalPath,
  computeStartability,
  computeWaves,
  CycleError,
  describeCycle,
  findCycle,
  findResourceConflicts,
  hasDependencyPath,
  transitivePredecessors,
  wouldCreateCycle,
  type DependencyEdge,
  type GraphNode,
} from './graph';

function edge(
  predecessorId: string,
  successorId: string,
  overrides: Partial<DependencyEdge> = {},
): DependencyEdge {
  return {
    id: `${predecessorId}->${successorId}`,
    predecessorId,
    successorId,
    type: 'finish_to_start',
    lagDays: 0,
    mandatory: true,
    justification: 'teste',
    ...overrides,
  };
}

function node(id: string, durationMonths: number | null = 1, readinessScore: number | null = 80): GraphNode {
  return { id, name: id.toUpperCase(), durationMonths, readinessScore };
}

describe('detecção de ciclo', () => {
  it('grafo sem ciclo não acusa nada', () => {
    expect(findCycle([edge('a', 'b'), edge('b', 'c')])).toBeNull();
  });

  it('detecta ciclo simples e devolve o caminho', () => {
    const ciclo = findCycle([edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]);
    expect(ciclo).not.toBeNull();
    // O caminho começa e termina no mesmo nó.
    expect(ciclo![0]).toBe(ciclo![ciclo!.length - 1]);
    expect(new Set(ciclo)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('produz mensagem que nomeia o caminho do ciclo', () => {
    const ciclo = findCycle([edge('a', 'b'), edge('b', 'a')])!;
    const nomes = new Map([
      ['a', 'Plano de Negócios'],
      ['b', 'Licitação das usinas'],
    ]);
    const msg = describeCycle(ciclo, nomes);
    expect(msg).toContain('Plano de Negócios');
    expect(msg).toContain('Licitação das usinas');
    expect(msg).toContain('→');
    expect(msg).toContain('Remova ou inverta');
  });

  it('bloqueia a aresta que fecharia o ciclo, antes de gravar', () => {
    const existentes = [edge('a', 'b'), edge('b', 'c')];
    expect(wouldCreateCycle(existentes, edge('c', 'a'))).not.toBeNull();
    expect(wouldCreateCycle(existentes, edge('c', 'd'))).toBeNull();
  });

  it('recusa autorrelação', () => {
    expect(wouldCreateCycle([], edge('a', 'a'))).toEqual(['a', 'a']);
  });

  it('disputa de recurso não entra no grafo de precedência', () => {
    // A e B disputam recurso nos dois sentidos: isso não é ciclo temporal.
    const arestas = [
      edge('a', 'b', { type: 'resource_conflict' }),
      edge('b', 'a', { type: 'resource_conflict' }),
    ];
    expect(findCycle(arestas)).toBeNull();
  });
});

describe('predecessores transitivos', () => {
  const arestas = [edge('a', 'b'), edge('b', 'c'), edge('x', 'c')];

  it('alcança predecessores indiretos', () => {
    expect(transitivePredecessors(arestas, 'c')).toEqual(new Set(['b', 'a', 'x']));
  });

  it('nó inicial não tem predecessor', () => {
    expect(transitivePredecessors(arestas, 'a').size).toBe(0);
  });

  it('detecta caminho entre dois nós', () => {
    expect(hasDependencyPath(arestas, 'a', 'c')).toBe(true);
    expect(hasDependencyPath(arestas, 'c', 'a')).toBe(false);
  });
});

describe('o que pode começar agora', () => {
  const nodes = [node('a'), node('b'), node('c')];

  it('sem predecessor pendente, pode começar', () => {
    const r = computeStartability(nodes, [edge('a', 'b')]);
    expect(r.find((x) => x.id === 'a')?.canStart).toBe(true);
    expect(r.find((x) => x.id === 'b')?.canStart).toBe(false);
    expect(r.find((x) => x.id === 'b')?.blockedBy).toEqual(['a']);
  });

  it('predecessor concluído desbloqueia', () => {
    const r = computeStartability(nodes, [edge('a', 'b')], new Set(['a']));
    expect(r.find((x) => x.id === 'b')?.canStart).toBe(true);
  });

  it('dependência não obrigatória não bloqueia', () => {
    // Preferência de sequenciamento não é impedimento — tratá-la como
    // bloqueio paralisaria o portfólio por conveniência.
    const r = computeStartability(nodes, [edge('a', 'b', { mandatory: false })]);
    expect(r.find((x) => x.id === 'b')?.canStart).toBe(true);
  });
});

describe('paralelização', () => {
  const nodes = [node('a'), node('b'), node('c')];

  it('sem precedência nem conflito, podem andar juntas', () => {
    expect(assessPair(nodes, [], 'a', 'b').relation).toBe('parallel');
  });

  it('precedência torna a relação sequencial, nos dois sentidos', () => {
    expect(assessPair(nodes, [edge('a', 'b')], 'a', 'b').relation).toBe('sequential');
    expect(assessPair(nodes, [edge('a', 'b')], 'b', 'a').relation).toBe('sequential');
  });

  it('precedência indireta também sequencia', () => {
    const r = assessPair(nodes, [edge('a', 'b'), edge('b', 'c')], 'a', 'c');
    expect(r.relation).toBe('sequential');
  });

  it('disputa de recurso impede o paralelo', () => {
    const arestas = [edge('a', 'b', { type: 'resource_conflict', sharedResourceId: 'equipe-licitacao' })];
    const r = assessPair(nodes, arestas, 'a', 'b');
    expect(r.relation).toBe('resource_conflict');
    expect(r.why).toContain('equipe-licitacao');
  });

  it('sem prontidão avaliada, não recomenda paralelo', () => {
    const semProntidao = [node('a', 1, null), node('b')];
    expect(assessPair(semProntidao, [], 'a', 'b').relation).toBe('not_ready');
  });

  it('prontidão baixa não recomenda paralelo', () => {
    const baixa = [node('a', 1, 10), node('b', 1, 90)];
    expect(assessPair(baixa, [], 'a', 'b').relation).toBe('not_ready');
  });

  it('sempre explica o porquê', () => {
    expect(assessPair(nodes, [], 'a', 'b').why.length).toBeGreaterThan(10);
  });
});

describe('ondas de início', () => {
  it('agrupa por nível de dependência', () => {
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const arestas = [edge('a', 'c'), edge('b', 'c'), edge('c', 'd')];
    const r = computeWaves(nodes, arestas);
    expect(r.waves).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('tudo independente cabe numa onda só', () => {
    const r = computeWaves([node('a'), node('b')], []);
    expect(r.waves).toEqual([['a', 'b']]);
  });

  it('recusa calcular com ciclo, dizendo qual é', () => {
    expect(() => computeWaves([node('a'), node('b')], [edge('a', 'b'), edge('b', 'a')])).toThrow(
      CycleError,
    );
  });

  it('marca como indeterminada a ação que depende de duração desconhecida', () => {
    const nodes = [node('a', null), node('b', 2)];
    const r = computeWaves(nodes, [edge('a', 'b')]);
    expect(r.indeterminate).toEqual(['b']);
  });
});

describe('caminho crítico', () => {
  it('encontra a sequência mais longa', () => {
    const nodes = [node('a', 2), node('b', 5), node('c', 1)];
    const r = computeCriticalPath(nodes, [edge('a', 'b'), edge('b', 'c')]);
    expect(r.path).toEqual(['a', 'b', 'c']);
    expect(r.totalMonths).toBe(8);
  });

  it('escolhe o ramo mais demorado', () => {
    const nodes = [node('inicio', 1), node('curto', 1), node('longo', 6), node('fim', 1)];
    const arestas = [
      edge('inicio', 'curto'),
      edge('inicio', 'longo'),
      edge('curto', 'fim'),
      edge('longo', 'fim'),
    ];
    const r = computeCriticalPath(nodes, arestas);
    expect(r.path).toContain('longo');
    expect(r.totalMonths).toBe(8);
  });

  it('soma o lag entre as ações', () => {
    const nodes = [node('a', 1), node('b', 1)];
    const r = computeCriticalPath(nodes, [edge('a', 'b', { lagDays: 30 })]);
    expect(r.totalMonths).toBe(3);
  });

  it('sem duração informada, não estima o prazo', () => {
    // Somar zero por um valor desconhecido produziria prazo otimista e falso.
    const nodes = [node('a', null), node('b', 3)];
    const r = computeCriticalPath(nodes, [edge('a', 'b')]);
    expect(r.totalMonths).toBeNull();
    expect(r.reason).toContain('prazo falso');
  });

  it('recusa calcular com ciclo', () => {
    expect(() => computeCriticalPath([node('a'), node('b')], [edge('a', 'b'), edge('b', 'a')])).toThrow(
      CycleError,
    );
  });
});

describe('conflitos de recurso', () => {
  const capacidades = new Map([['equipe-licitacao', 1]]);

  it('sobreposição acima da capacidade vira conflito', () => {
    const conflitos = findResourceConflicts(
      [
        { resourceId: 'equipe-licitacao', projectId: 'a', start: '2026-01-01', end: '2026-06-30', amount: 1 },
        { resourceId: 'equipe-licitacao', projectId: 'b', start: '2026-03-01', end: '2026-09-30', amount: 1 },
      ],
      capacidades,
    );
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].projectIds).toEqual(['a', 'b']);
    expect(conflitos[0].period).toEqual({ start: '2026-03-01', end: '2026-06-30' });
    expect(conflitos[0].demanded).toBe(2);
  });

  it('sem sobreposição de período, não há conflito', () => {
    const conflitos = findResourceConflicts(
      [
        { resourceId: 'equipe-licitacao', projectId: 'a', start: '2026-01-01', end: '2026-02-28', amount: 1 },
        { resourceId: 'equipe-licitacao', projectId: 'b', start: '2026-03-01', end: '2026-04-30', amount: 1 },
      ],
      capacidades,
    );
    expect(conflitos).toEqual([]);
  });

  it('dentro da capacidade, não há conflito', () => {
    const conflitos = findResourceConflicts(
      [
        { resourceId: 'equipe-licitacao', projectId: 'a', start: '2026-01-01', end: '2026-06-30', amount: 1 },
        { resourceId: 'equipe-licitacao', projectId: 'b', start: '2026-03-01', end: '2026-09-30', amount: 1 },
      ],
      new Map([['equipe-licitacao', 3]]),
    );
    expect(conflitos).toEqual([]);
  });
});
