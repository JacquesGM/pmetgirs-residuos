import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COST_THRESHOLDS,
  DEFAULT_POLICY,
  PolicyError,
  validatePolicy,
  validateWeights,
} from './policy';
import {
  classifyCost,
  classifyHorizon,
  computeActuality,
  computePriority,
  computeSocialImpact,
  recommend,
  ScoringError,
} from './score';

describe('política', () => {
  it('a política padrão é válida', () => {
    expect(() => validatePolicy(DEFAULT_POLICY)).not.toThrow();
  });

  it('cada conjunto de pesos soma exatamente 100', () => {
    for (const grupo of ['priority', 'socialImpact', 'investmentReadiness'] as const) {
      const total = DEFAULT_POLICY[grupo].reduce((s, c) => s + c.weight, 0);
      expect(total).toBe(100);
    }
  });

  it('recusa pesos que não somam 100', () => {
    expect(() =>
      validateWeights([{ key: 'a', label: 'A', weight: 60, help: '' }], 'teste'),
    ).toThrow(PolicyError);
  });

  it('recusa critério repetido', () => {
    expect(() =>
      validateWeights(
        [
          { key: 'a', label: 'A', weight: 50, help: '' },
          { key: 'a', label: 'A2', weight: 50, help: '' },
        ],
        'teste',
      ),
    ).toThrow(/repetido/);
  });
});

describe('ausência de evidência não vira zero', () => {
  it('dimensão sem nota reduz a cobertura, sem puxar a média para baixo', () => {
    // Impacto social (25) + urgência (20) = 45% de cobertura, acima do mínimo.
    const parcial = computePriority(DEFAULT_POLICY, [
      { key: 'socialImpact', score: 5 },
      { key: 'urgency', score: 5 },
    ]);
    // Tudo avaliado, também com nota máxima.
    const completo = computePriority(
      DEFAULT_POLICY,
      DEFAULT_POLICY.priority.map((c) => ({ key: c.key, score: 5 })),
    );

    expect(parcial.coverage).toBe(45);
    expect(completo.coverage).toBe(100);

    // A média normalizada é 100 nos dois casos: as notas são idênticas.
    // O que separa os dois é o fator de cobertura — a diferença de confiança
    // aparece no número, não só numa nota de rodapé.
    expect(parcial.score).toBeLessThan(completo.score!);
    expect(completo.score).toBe(100);
    expect(parcial.score).toBe(78); // 100 × (0,60 + 0,40 × 0,45)
  });

  it('lista as dimensões que faltam avaliar', () => {
    const r = computePriority(DEFAULT_POLICY, [{ key: 'socialImpact', score: 3 }]);
    expect(r.gaps).toHaveLength(6);
    expect(r.gaps).toContain('Urgência e obrigação');
  });

  it('nota zero é diferente de dimensão sem nota', () => {
    const comZero = computePriority(DEFAULT_POLICY, [
      { key: 'socialImpact', score: 0 },
      { key: 'urgency', score: 5 },
      { key: 'readiness', score: 5 },
      { key: 'benefitCost', score: 5 },
    ]);
    const semNota = computePriority(DEFAULT_POLICY, [
      { key: 'urgency', score: 5 },
      { key: 'readiness', score: 5 },
      { key: 'benefitCost', score: 5 },
    ]);

    // Zero conta no denominador e derruba a média; ausência só reduz cobertura.
    expect(comZero.coverage).toBe(75);
    expect(semNota.coverage).toBe(50);
    expect(comZero.score).toBeLessThan(semNota.score!);
  });

  it('sem nenhuma nota, não produz número', () => {
    const r = computePriority(DEFAULT_POLICY, []);
    expect(r.score).toBeNull();
    expect(r.coverage).toBe(0);
    expect(r.formula).toContain('abaixo do mínimo');
  });

  it('abaixo da cobertura mínima, prefere não responder', () => {
    const r = computePriority(DEFAULT_POLICY, [{ key: 'parallelization', score: 5 }]);
    expect(r.coverage).toBe(5);
    expect(r.score).toBeNull();
  });
});

describe('cálculo da nota', () => {
  it('todas as notas máximas dão 100', () => {
    const r = computeSocialImpact(
      DEFAULT_POLICY,
      DEFAULT_POLICY.socialImpact.map((c) => ({ key: c.key, score: 5 })),
    );
    expect(r.score).toBe(100);
    expect(r.coverage).toBe(100);
  });

  it('todas as notas mínimas dão 0, mas com cobertura total', () => {
    const r = computeSocialImpact(
      DEFAULT_POLICY,
      DEFAULT_POLICY.socialImpact.map((c) => ({ key: c.key, score: 0 })),
    );
    expect(r.score).toBe(0);
    expect(r.coverage).toBe(100);
  });

  it('expõe a fórmula junto do número', () => {
    const r = computeSocialImpact(
      DEFAULT_POLICY,
      DEFAULT_POLICY.socialImpact.map((c) => ({ key: c.key, score: 4 })),
    );
    expect(r.formula).toContain('fator de cobertura');
    expect(r.breakdown).toHaveLength(8);
  });

  it('registra a versão da política usada', () => {
    const r = computePriority(DEFAULT_POLICY, [{ key: 'socialImpact', score: 5 }]);
    expect(r.policyVersion).toBe(DEFAULT_POLICY.version);
  });

  it('a confiança sobe quando as notas têm evidência', () => {
    const semEvidencia = computeSocialImpact(
      DEFAULT_POLICY,
      DEFAULT_POLICY.socialImpact.map((c) => ({ key: c.key, score: 4 })),
    );
    const comEvidencia = computeSocialImpact(
      DEFAULT_POLICY,
      DEFAULT_POLICY.socialImpact.map((c) => ({ key: c.key, score: 4, evidenceIds: ['ev-1'] })),
    );
    expect(semEvidencia.confidence).toBe(0);
    expect(comEvidencia.confidence).toBe(100);
    // A nota é a mesma: evidência muda a confiança, não o resultado.
    expect(semEvidencia.score).toBe(comEvidencia.score);
  });

  it('recusa nota fora da escala', () => {
    expect(() => computePriority(DEFAULT_POLICY, [{ key: 'socialImpact', score: 7 }])).toThrow(ScoringError);
    expect(() => computePriority(DEFAULT_POLICY, [{ key: 'socialImpact', score: 2.5 }])).toThrow(/0 a 5/);
  });
});

describe('horizonte temporal', () => {
  it('classifica pelas faixas padrão', () => {
    expect(classifyHorizon(6)).toBe('short');
    expect(classifyHorizon(12)).toBe('short');
    expect(classifyHorizon(13)).toBe('medium');
    expect(classifyHorizon(36)).toBe('medium');
    expect(classifyHorizon(37)).toBe('long');
  });

  it('sem duração informada, não chuta', () => {
    expect(classifyHorizon(null)).toBe('not_informed');
  });

  it('respeita faixas configuradas', () => {
    expect(classifyHorizon(18, { shortMaxMonths: 24, mediumMaxMonths: 48 })).toBe('short');
  });
});

describe('faixa de custo', () => {
  const base = { requiresNewDisbursement: true, capexMinCents: null, capexMaxCents: null };

  it('reconhece execução sem novo desembolso', () => {
    expect(classifyCost({ ...base, requiresNewDisbursement: false })).toBe('no_new_disbursement');
  });

  it('usa o teto do intervalo, não o piso', () => {
    // Piso na faixa baixa, teto na alta: decide pelo pior caso.
    expect(
      classifyCost({ ...base, capexMinCents: 100_000_00, capexMaxCents: 9_000_000_00 }),
    ).toBe('high');
  });

  it('classifica pelas faixas padrão', () => {
    expect(classifyCost({ ...base, capexMaxCents: DEFAULT_COST_THRESHOLDS.lowMaxCents })).toBe('low');
    expect(classifyCost({ ...base, capexMaxCents: 1_000_000_00 })).toBe('medium');
    expect(classifyCost({ ...base, capexMaxCents: 50_000_000_00 })).toBe('high');
  });

  it('distingue "em estimativa" de "não informado"', () => {
    expect(classifyCost({ ...base, underEstimation: true })).toBe('estimating');
    expect(classifyCost(base)).toBe('not_informed');
  });

  it('recusa custo negativo', () => {
    expect(() => classifyCost({ ...base, capexMaxCents: -1 })).toThrow(ScoringError);
  });
});

describe('recomendação', () => {
  const base = { priorityScore: 80, readinessScore: 80, costCategory: 'low' as const, isBlocked: false };

  it('ganho rápido: prioridade e prontidão altas, custo baixo', () => {
    expect(recommend(base).recommendation).toBe('quick_win');
  });

  it('custo alto empurra para captação', () => {
    expect(recommend({ ...base, costCategory: 'high' }).recommendation).toBe('estruturar_para_captacao');
  });

  it('sem prontidão, manda preparar', () => {
    expect(recommend({ ...base, readinessScore: 20 }).recommendation).toBe('iniciar_preparacao');
  });

  it('dependência pendente bloqueia, mesmo com nota alta', () => {
    expect(recommend({ ...base, isBlocked: true }).recommendation).toBe('bloqueado');
  });

  it('sem nota, manda reavaliar em vez de decidir', () => {
    expect(recommend({ ...base, priorityScore: null }).recommendation).toBe('reavaliar');
  });

  it('sempre explica o porquê', () => {
    expect(recommend(base).why.length).toBeGreaterThan(10);
  });
});

describe('atualidade', () => {
  const hoje = new Date('2026-08-14T12:00:00Z');

  it('dado recente está atual', () => {
    expect(computeActuality('2026-08-01', 'projectStatus', hoje).status).toBe('current');
  });

  it('dado além do prazo de revisão está desatualizado', () => {
    expect(computeActuality('2026-01-01', 'projectStatus', hoje).status).toBe('outdated');
  });

  it('sem data, diz que não tem data — não chuta', () => {
    const r = computeActuality(null, 'indicator', hoje);
    expect(r.status).toBe('no_date');
    expect(r.ageDays).toBeNull();
  });

  it('calcula a próxima revisão', () => {
    expect(computeActuality('2026-08-01', 'projectStatus', hoje).nextReviewAt).toBe('2026-08-31');
  });

  it('cada tipo de dado tem prazo próprio', () => {
    const data = '2026-05-01';
    expect(computeActuality(data, 'projectStatus', hoje).status).toBe('outdated');
    expect(computeActuality(data, 'demographics', hoje).status).toBe('current');
  });
});
