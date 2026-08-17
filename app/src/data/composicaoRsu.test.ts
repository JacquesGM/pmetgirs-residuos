import { describe, expect, it } from 'vitest';
import dados from './composicaoRsu.json';
import type { ComponenteRsu } from '../types';

const componentes = dados as ComponenteRsu[];
const grupo = (g: string) => componentes.filter((c) => c.grupo === g);

/** RSU metropolitano, o mesmo total já verificado em outras três tabelas. */
const RSU_TOTAL = 16_926;

describe('composição gravimétrica do RSU — Tabela 42', () => {
  it('o grupo principal soma exatamente 100%', () => {
    const s = grupo('principal').reduce((a, c) => a + c.percentual, 0);
    expect(Math.round(s * 100) / 100).toBe(100);
  });

  it('os outros componentes somam 100% da sua própria fração', () => {
    const s = grupo('outros').reduce((a, c) => a + c.percentual, 0);
    expect(Math.round(s * 100) / 100).toBe(100);
  });

  it('os quatro recicláveis somam 38,71 — e a base NÃO é o RSU total', () => {
    // 38,71 é também a fração de recicláveis no RSU, e a coincidência dos dois
    // números é o que torna a tabela ambígua. A aritmética da Tabela 13
    // desempata: aplicados à fração de recicláveis de Duque de Caxias
    // (707 t/dia), estes percentuais reproduzem os valores impressos.
    const s = grupo('reciclaveis').reduce((a, c) => a + c.percentual, 0);
    expect(Math.round(s * 100) / 100).toBe(38.71);

    const porNome = new Map(grupo('reciclaveis').map((c) => [c.nome, c.percentual]));
    const duqueDeCaxias = 707;
    expect(Math.round(duqueDeCaxias * porNome.get('Papel')! / 100)).toBe(104);
    expect(Math.round(duqueDeCaxias * porNome.get('Plástico')! / 100)).toBe(133);
    expect(Math.round(duqueDeCaxias * porNome.get('Metal')! / 100)).toBe(12);
    expect(Math.round(duqueDeCaxias * porNome.get('Vidro')! / 100)).toBe(25);

    for (const c of grupo('reciclaveis')) {
      expect(c.baseDoPercentual).toBe('fração de recicláveis');
      expect(c.statusValidacao).toBe('informacao_divergente');
    }
  });

  it('as toneladas do grupo principal reconstroem o RSU metropolitano', () => {
    const t = grupo('principal').reduce((a, c) => a + c.toneladasDia, 0);
    expect(Math.round(t)).toBe(RSU_TOTAL);
  });

  it('a fração de recicláveis dá 6.552 t/dia, e não as 6.652 da tabela do Diagnóstico', () => {
    // A Tabela 8 do Diagnóstico imprime 6.652 na linha de total. Com os
    // percentuais da Tabela 42 o valor é 6.552 — e 6.552 é o que a Tabela 73
    // do Prognóstico usa. A linha de total do Diagnóstico tem um dígito errado.
    const reciclaveis = grupo('principal').find((c) => c.nome === 'Recicláveis')!;
    expect(Math.round(reciclaveis.toneladasDia)).toBe(6552);
    expect(Math.round(reciclaveis.toneladasDia)).not.toBe(6652);
  });

  it('cada componente declara a base do seu percentual', () => {
    // Sem a base, 18,76% de plástico seria lido como 18,76% do lixo — quase o
    // dobro do real.
    for (const c of componentes) {
      expect(c.baseDoPercentual, c.nome).toBeTruthy();
    }
  });
});
