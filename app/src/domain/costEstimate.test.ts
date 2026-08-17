import { describe, expect, it } from 'vitest';
import {
  CostEstimateError,
  categoriaDe,
  deCentavos,
  estimativaEmBranco,
  paraCentavos,
  validarEstimativa,
  type EstimativaDeCusto,
} from './costEstimate';

function comValor(patch: Partial<EstimativaDeCusto> = {}): EstimativaDeCusto {
  return {
    ...estimativaEmBranco(),
    requiresNewDisbursement: true,
    capexMinCents: 100_000_00,
    capexMaxCents: 200_000_00,
    baseYear: 2024,
    sourceLabel: 'Prognóstico Geral, Tabela 73',
    ...patch,
  };
}

describe('conversão de dinheiro', () => {
  it('não perde centavo onde o float perderia', () => {
    // Math.round(19.99 * 100) dá 1999 por sorte; 8,07 e 1,10 são os que quebram.
    expect(paraCentavos('19,99')).toBe(1999);
    expect(paraCentavos('8,07')).toBe(807);
    expect(paraCentavos('1,10')).toBe(110);
    expect(paraCentavos('0,01')).toBe(1);
  });

  it('aceita ponto de milhar e valores grandes do plano', () => {
    expect(paraCentavos('6.300.000.000,00')).toBe(630_000_000_000);
    expect(paraCentavos('70.000.000')).toBe(7_000_000_000);
  });

  it('recusa o que não é número em vez de virar zero em silêncio', () => {
    for (const ruim of ['abc', '10,999', '1.2.3,4', '-5']) {
      expect(() => paraCentavos(ruim), `entrada "${ruim}"`).toThrow(CostEstimateError);
    }
  });

  it('vazio é ausência, não zero', () => {
    expect(paraCentavos('')).toBeNull();
    expect(paraCentavos('   ')).toBeNull();
  });

  it('a volta preserva o valor', () => {
    for (const texto of ['19,99', '6.300.000.000,00', '0,01']) {
      expect(deCentavos(paraCentavos(texto))).toBe(texto);
    }
  });
});

describe('validação da estimativa', () => {
  it('recusa valor sem ano-base', () => {
    expect(() => validarEstimativa(comValor({ baseYear: null }))).toThrow(/ano-base/);
  });

  it('recusa valor sem fonte', () => {
    expect(() => validarEstimativa(comValor({ sourceLabel: null }))).toThrow(/sem fonte/);
    expect(() => validarEstimativa(comValor({ sourceLabel: 'x' }))).toThrow(/sem fonte/);
  });

  it('recusa intervalo invertido', () => {
    expect(() =>
      validarEstimativa(comValor({ capexMinCents: 500_00, capexMaxCents: 100_00 })),
    ).toThrow(/invertido/);
  });

  it('recusa valor negativo', () => {
    expect(() => validarEstimativa(comValor({ capexMinCents: -1 }))).toThrow(/negativo/);
  });

  it('recusa "sem novo desembolso" acompanhado de valor', () => {
    expect(() => validarEstimativa(comValor({ requiresNewDisbursement: false })))
      .toThrow(/sem novo desembolso/);
  });

  it('aceita "sem novo desembolso" sem valor nenhum', () => {
    expect(() =>
      validarEstimativa({ ...estimativaEmBranco(), requiresNewDisbursement: false }),
    ).not.toThrow();
  });

  it('recusa estimativa que não diz nada', () => {
    expect(() => validarEstimativa(estimativaEmBranco())).toThrow(/não diz nada/);
  });

  it('aceita "em estruturação" sem número', () => {
    expect(() =>
      validarEstimativa({ ...estimativaEmBranco(), underEstimation: true }),
    ).not.toThrow();
  });

  it('recusa confiança fora de 0 a 100', () => {
    expect(() => validarEstimativa(comValor({ confidenceScore: 101 }))).toThrow(/0 a 100/);
  });
});

describe('faixa de custo', () => {
  it('classifica pelo teto do intervalo, não pelo piso', () => {
    // Piso de R$ 100 mil e teto de R$ 6 milhões: o que decide se cabe no
    // orçamento é o pior caso.
    expect(categoriaDe(comValor({ capexMinCents: 100_000_00, capexMaxCents: 6_000_000_00 })))
      .toBe('high');
  });

  it('sem novo desembolso não é custo baixo, é outra categoria', () => {
    expect(categoriaDe({ ...estimativaEmBranco(), requiresNewDisbursement: false }))
      .toBe('no_new_disbursement');
  });

  it('distingue não informado de em estruturação', () => {
    expect(categoriaDe(estimativaEmBranco())).toBe('not_informed');
    expect(categoriaDe({ ...estimativaEmBranco(), underEstimation: true })).toBe('estimating');
  });
});
