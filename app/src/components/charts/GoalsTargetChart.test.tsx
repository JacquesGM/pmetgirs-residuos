import { describe, expect, it } from 'vitest';
import metasData from '../../data/metas.json';
import type { Meta } from '../../types';
import { anoLimiteDoPrazo, montarDados } from './GoalsTargetChart';

const metas = metasData as Meta[];

describe('ano-limite do prazo', () => {
  it('usa o fim do intervalo, não o começo', () => {
    // O defeito que motivou este teste: lendo o PRIMEIRO número, "De 2 a 10
    // anos" devolvia 2, e o gráfico plotava 75% de cobertura já no ano 2 — ao
    // lado dos 50% do mesmo ano. A linha dava um salto vertical e o plano
    // aparecia mais rápido do que é.
    expect(anoLimiteDoPrazo('De 2 a 10 anos')).toBe(10);
  });

  it('lê prazo simples e prazo com "até"', () => {
    expect(anoLimiteDoPrazo('Até 2 anos')).toBe(2);
    expect(anoLimiteDoPrazo('20 anos')).toBe(20);
    expect(anoLimiteDoPrazo('Contínuo')).toBe(0);
    expect(anoLimiteDoPrazo(null)).toBe(0);
  });
});

describe('trajetória da coleta seletiva', () => {
  const dados = montarDados(metas);

  it('traz as três metas de cobertura', () => {
    expect(dados.map((d) => d.percentual)).toEqual([50, 75, 100]);
  });

  it('cada meta cai num ano distinto e crescente', () => {
    // Esta é a asserção que teria pego o defeito. Com a leitura antiga, 50% e
    // 75% caíam ambos no ano 2, e os anos não eram estritamente crescentes.
    const anos = dados.map((d) => d.ano);
    expect(anos).toEqual([2, 10, 20]);
    for (let i = 1; i < anos.length; i += 1) {
      expect(anos[i], `ano ${anos[i]} não avança sobre ${anos[i - 1]}`).toBeGreaterThan(anos[i - 1]);
    }
  });

  it('conserva o prazo como o documento o escreve', () => {
    // O eixo é uma redução: "De 2 a 10 anos" vira 10. Guardar a redação
    // original impede que a redução vire a única leitura disponível.
    expect(dados.map((d) => d.prazo)).toEqual(['Até 2 anos', 'De 2 a 10 anos', '20 anos']);
  });

  it('nenhuma das três tem resultado atual', () => {
    // Vale para as 44. A linha é alvo, nunca desempenho.
    for (const d of dados) {
      expect(d.resultadoAtual, `${d.nome} traz resultado atual inesperado`).toBeNull();
    }
  });
});
