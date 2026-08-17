import { describe, expect, it } from 'vitest';
import dados from './viabilidadeEconomica.json';
import type { ViabilidadeEconomica } from '../types';

const registros = dados as ViabilidadeEconomica[];
const por = (id: string) => registros.find((r) => r.id === id)!;

const rio = por('cenario-rio-de-janeiro');
const semRio = por('cenario-rmrj-sem-rio');
const total = por('cenario-rmrj-total');

describe('cenários de investimento — Tabela 73', () => {
  /**
   * A conferência que prova a transcrição.
   *
   * Não é contagem de linhas: é a soma de duas partes contra o todo que o
   * próprio documento imprime, em oito colunas independentes. Errar uma
   * transcrição e ainda assim fechar as oito é praticamente impossível.
   */
  it('Rio somado à região sem o Rio dá o total, nas oito colunas', () => {
    const colunas = [
      'rsuTdia',
      'crdTdia',
      'reciclaveisTdia',
      'usinasCombustao',
      'usinasTermodegradacao',
      'usinasTriagem',
      'capexTotalReais',
      'receitaAnualReais',
    ] as const;

    for (const c of colunas) {
      expect(rio[c]! + semRio[c]!, `coluna ${c}`).toBe(total[c]);
    }
  });

  it('somam as 45 usinas que o documento declara', () => {
    const usinas = (c: ViabilidadeEconomica) =>
      c.usinasCombustao! + c.usinasTermodegradacao! + c.usinasTriagem!;
    expect(usinas(rio)).toBe(19);
    expect(usinas(semRio)).toBe(26);
    expect(usinas(total)).toBe(45);
  });

  it('o RSU total é o mesmo já transcrito em outra tabela', () => {
    // 16.926 t/dia aparece também na conferência dos indicadores municipais,
    // vindo do Diagnóstico. Duas leituras independentes, mesmo número.
    expect(total.rsuTdia).toBe(16926);
  });
});

describe('tecnologias — Tabelas 46, 52, 58 e 72', () => {
  const triagem = por('tecnologia-triagem');
  const combustao = por('tecnologia-combustao');
  const gaseificacao = por('tecnologia-gaseificacao');

  /**
   * Conferência CRUZADA entre tabelas de capítulos diferentes.
   *
   * O CAPEX de cada tecnologia sai das Tabelas 46, 52 e 58; o número de usinas
   * e o CAPEX total saem da Tabela 73. Que o produto feche ao real prova que as
   * quatro transcrições concordam — e que o documento é internamente coerente
   * neste ponto, o que não se podia presumir.
   */
  it('CAPEX por usina vezes o número de usinas dá o CAPEX total do cenário', () => {
    const soma =
      total.usinasCombustao! * combustao.capexPorUsinaReais! +
      total.usinasTermodegradacao! * gaseificacao.capexPorUsinaReais! +
      total.usinasTriagem! * triagem.capexPorUsinaReais!;
    expect(soma).toBe(total.capexTotalReais);
    expect(soma).toBe(9_150_000_000);
  });

  it('a receita por usina fecha do mesmo modo, ao real', () => {
    const soma =
      total.usinasCombustao! * combustao.receitaAnualPorUsinaReais! +
      total.usinasTermodegradacao! * gaseificacao.receitaAnualPorUsinaReais! +
      total.usinasTriagem! * triagem.receitaAnualPorUsinaReais!;
    expect(soma).toBe(total.receitaAnualReais);
    expect(soma).toBe(3_624_854_925);
  });

  it('o biogás fica fora da comparação, por decisão declarada da fonte', () => {
    // "O processo de biogás não será considerado na análise, pois está
    // vinculado ao uso dos aterros sanitários." Se ele entrasse nas somas
    // acima, elas não fechariam — e é isso que confirma a exclusão.
    const biogas = por('tecnologia-biogas');
    expect(biogas.observacao).toMatch(/FORA da comparação/);
    const comBiogas =
      total.capexTotalReais! + biogas.capexPorUsinaReais!;
    expect(comBiogas).not.toBe(total.capexTotalReais);
  });
});

describe('divergências da fonte, registradas e não corrigidas', () => {
  it('o valor por extenso do CAPEX total não bate com o numeral', () => {
    // R$ 9.150.000.000 no numeral e na tabela; "nove bilhões, cento e dezesseis
    // milhões, trezentos e vinte e três mil e oitocentos e trinta e seis" por
    // extenso, que é R$ 9.116.323.836. Diferença de R$ 33.676.164.
    expect(total.statusValidacao).toBe('informacao_divergente');
    expect(total.observacao).toMatch(/9\.116\.323\.836/);
    expect(9_150_000_000 - 9_116_323_836).toBe(33_676_164);
  });

  it('a taxa de depreciação da triagem diverge entre tabela e texto', () => {
    const triagem = por('tecnologia-triagem');
    expect(triagem.observacao).toMatch(/2,86%/);
    expect(triagem.observacao).toMatch(/1,97%/);
    // 2.000.000 sobre 70.000.000 dá 2,857% — a tabela é que fecha.
    expect(Math.round((2_000_000 / triagem.capexPorUsinaReais!) * 10_000) / 100).toBe(2.86);
  });
});
