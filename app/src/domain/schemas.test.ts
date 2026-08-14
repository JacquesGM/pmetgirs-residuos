import { describe, expect, it } from 'vitest';
import { dependencySchema, evidenceClaimSchema, moneyRangeSchema, scoreResultSchema } from './schemas';

const dinheiroBase = {
  currency: 'BRL' as const,
  baseYear: 2024,
  asOfDate: '2024-06-30',
  confidenceScore: 60,
  evidenceIds: ['ev-1'],
};

describe('moneyRange', () => {
  it('aceita intervalo válido', () => {
    expect(
      moneyRangeSchema.safeParse({ ...dinheiroBase, minCents: 100_000, maxCents: 500_000 }).success,
    ).toBe(true);
  });

  it('recusa mínimo maior que máximo', () => {
    expect(
      moneyRangeSchema.safeParse({ ...dinheiroBase, minCents: 500_000, maxCents: 100_000 }).success,
    ).toBe(false);
  });

  it('aceita valor ausente como null, sem convertê-lo em zero', () => {
    const resultado = moneyRangeSchema.safeParse({ ...dinheiroBase, minCents: null, maxCents: null });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.minCents).toBeNull();
      expect(resultado.data.minCents).not.toBe(0);
    }
  });

  it('recusa valor negativo', () => {
    expect(moneyRangeSchema.safeParse({ ...dinheiroBase, minCents: -1, maxCents: 10 }).success).toBe(false);
  });
});

describe('evidenceClaim', () => {
  const base = {
    id: 'claim-1',
    entityType: 'indicator',
    entityId: 'geracao-rsu-diaria',
    fieldPath: 'value',
    value: 16929,
    unit: 't/dia',
    sourceType: 'official' as const,
    sourceDocumentId: 'diagnostico-geral',
    confidenceScore: 80,
    validationStatus: 'in_validation' as const,
  };

  it('aceita duas alegações divergentes para o mesmo campo', () => {
    const a = evidenceClaimSchema.safeParse(base);
    const b = evidenceClaimSchema.safeParse({ ...base, id: 'claim-2', value: 16926 });
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(a.data.fieldPath).toBe(b.data.fieldPath);
      expect(a.data.value).not.toBe(b.data.value);
    }
  });

  it('recusa confiança fora de 0 a 100', () => {
    expect(evidenceClaimSchema.safeParse({ ...base, confidenceScore: 120 }).success).toBe(false);
  });

  it('exige documento de origem', () => {
    expect(evidenceClaimSchema.safeParse({ ...base, sourceDocumentId: '' }).success).toBe(false);
  });
});

describe('dependency', () => {
  const base = {
    id: 'dep-1',
    predecessorId: 'proj-a',
    successorId: 'proj-b',
    type: 'finish_to_start' as const,
    lagDays: 0,
    mandatory: true,
    justification: 'O plano de negócios precede a licitação',
    validationStatus: 'validated' as const,
  };

  it('aceita dependência entre ações distintas', () => {
    expect(dependencySchema.safeParse(base).success).toBe(true);
  });

  it('recusa autorrelação', () => {
    expect(dependencySchema.safeParse({ ...base, successorId: 'proj-a' }).success).toBe(false);
  });
});

describe('scoreResult', () => {
  it('permite ausência de nota quando não há cobertura de evidência', () => {
    const resultado = scoreResultSchema.safeParse({
      score: null,
      coverage: 12,
      confidence: null,
      policyVersion: 1,
      gaps: ['impacto social sem evidência'],
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.score).toBeNull();
  });

  it('recusa nota acima de 100', () => {
    expect(
      scoreResultSchema.safeParse({ score: 101, coverage: 100, confidence: 90, policyVersion: 1, gaps: [] })
        .success,
    ).toBe(false);
  });
});
