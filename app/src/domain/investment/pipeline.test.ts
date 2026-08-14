import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '../scoring/policy';
import {
  assertTransition,
  canAdvance,
  PARTICIPATION_NOTICE,
  StageTransitionError,
  summarizeFlows,
  type FinancialFlow,
} from './pipeline';
import { buildReadinessReport } from './readiness';

function flow(overrides: Partial<FinancialFlow> = {}): FinancialFlow {
  return {
    id: 'f1',
    type: 'contractual_revenue',
    certainty: 'contracted',
    beneficiary: 'Operador',
    amountCentsPerYear: 1_000_000_00,
    assumptions: ['tarifa definida em contrato'],
    evidenceIds: ['ev-1'],
    ...overrides,
  };
}

describe('funil de estruturação', () => {
  it('avança um estágio por vez', () => {
    expect(canAdvance('identified', 'prioritized')).toBe(true);
    expect(canAdvance('study', 'study_complete')).toBe(true);
  });

  it('recusa saltar estágios, dizendo quais faltam', () => {
    expect(() => assertTransition('identified', 'ready_for_fundraising')).toThrow(StageTransitionError);
    try {
      assertTransition('identified', 'ready_for_fundraising');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('Priorizado');
      expect(msg).toContain('Em estudo');
      expect(msg).toContain('Estudo concluído');
    }
  });

  it('permite recuar — um estudo pode revelar que não estava maduro', () => {
    expect(canAdvance('ready_for_fundraising', 'structuring')).toBe(true);
  });

  it('arquivar é sempre possível', () => {
    expect(canAdvance('identified', 'archived')).toBe(true);
    expect(canAdvance('contracted', 'archived')).toBe(true);
  });

  it('não ressuscita o que foi arquivado sem procedimento próprio', () => {
    expect(canAdvance('archived', 'structuring')).toBe(false);
  });
});

describe('integridade financeira', () => {
  it('não soma economia pública à receita do operador', () => {
    const r = summarizeFlows([
      flow({ id: 'a', type: 'contractual_revenue', amountCentsPerYear: 100_00 }),
      flow({ id: 'b', type: 'public_saving', amountCentsPerYear: 900_00, beneficiary: 'Município' }),
    ]);
    // O achado INC-07: agregar as duas infla a receita disponível ao operador.
    expect(r.operatorCashCents).toBe(100_00);
    expect(r.publicSavingCents).toBe(900_00);
    expect(r.warnings.some((w) => w.includes('não entra no caixa do operador'))).toBe(true);
  });

  it('avisa quando receita de mercado não está contratada', () => {
    const r = summarizeFlows([
      flow({ type: 'market_revenue', certainty: 'projected', amountCentsPerYear: 500_00 }),
    ]);
    expect(r.warnings.some((w) => w.includes('cenário, não garantia'))).toBe(true);
  });

  it('receita contratada não gera aviso de incerteza', () => {
    const r = summarizeFlows([flow({ type: 'market_revenue', certainty: 'contracted' })]);
    expect(r.warnings.some((w) => w.includes('cenário, não garantia'))).toBe(false);
  });

  it('benefício socioambiental fica fora da soma monetária', () => {
    const r = summarizeFlows([
      flow({ id: 'a', amountCentsPerYear: 100_00 }),
      flow({
        id: 'b',
        type: 'socioenvironmental_benefit',
        amountCentsPerYear: null,
        beneficiary: 'Sociedade',
        assumptions: [],
      }),
    ]);
    expect(r.operatorCashCents).toBe(100_00);
    expect(r.nonMonetary).toHaveLength(1);
  });

  it('valor ausente não é somado nem zerado', () => {
    const r = summarizeFlows([flow({ amountCentsPerYear: null, assumptions: [] })]);
    expect(r.operatorCashCents).toBeNull();
    expect(r.missingAmounts).toBe(1);
    expect(r.warnings.some((w) => w.includes('não foram somados nem zerados'))).toBe(true);
  });

  it('cobra premissa de todo valor declarado', () => {
    const r = summarizeFlows([flow({ assumptions: [] })]);
    expect(r.warnings.some((w) => w.includes('sem premissa declarada'))).toBe(true);
  });
});

describe('prontidão para captação', () => {
  const todosCriterios = DEFAULT_POLICY.investmentReadiness.map((c) => ({
    key: c.key,
    score: 5,
    evidenceIds: ['ev-1'],
  }));

  it('lista as lacunas ordenadas por peso, com próximo passo', () => {
    const parciais = todosCriterios.filter((c) => !['licensing', 'risks', 'capacity'].includes(c.key));
    const r = buildReadinessReport(DEFAULT_POLICY, parciais, 'structuring', 'ready_for_fundraising', null);

    expect(r.gapsDetailed.map((g) => g.label)).toEqual([
      'Licenciamento',
      'Matriz de riscos',
      'Capacidade de execução',
    ]);
    expect(r.gapsDetailed[0].nextAction).toContain('órgão ambiental');
  });

  it('sem lacuna e com nota alta, fica pronta para apresentar', () => {
    const r = buildReadinessReport(DEFAULT_POLICY, todosCriterios, 'study_complete', 'ready_for_fundraising', null);
    expect(r.score).toBe(100);
    expect(r.readyToPresent).toBe(true);
  });

  it('recém-identificada não é apresentável, mesmo com nota alta', () => {
    const r = buildReadinessReport(DEFAULT_POLICY, todosCriterios, 'identified', 'prioritized', null);
    expect(r.readyToPresent).toBe(false);
  });

  it('sem evidência suficiente, diz que não sabe', () => {
    const r = buildReadinessReport(DEFAULT_POLICY, [], 'structuring', 'study', null);
    expect(r.score).toBeNull();
    expect(r.readyReason).toContain('Sem cobertura');
  });

  it('com receita não contratada, condiciona a apresentação', () => {
    const fluxos = summarizeFlows([
      flow({ type: 'market_revenue', certainty: 'projected', amountCentsPerYear: 100_00 }),
    ]);
    const r = buildReadinessReport(DEFAULT_POLICY, todosCriterios, 'study_complete', 'ready_for_fundraising', fluxos);
    expect(r.readyReason).toContain('cenários');
  });
});

describe('participação do mercado', () => {
  it('o aviso deixa claro que manifestar interesse não habilita ninguém', () => {
    expect(PARTICIPATION_NOTICE).toContain('não habilita');
    expect(PARTICIPATION_NOTICE).toContain('não contrata');
    expect(PARTICIPATION_NOTICE).toContain('procedimentos oficiais');
  });
});
