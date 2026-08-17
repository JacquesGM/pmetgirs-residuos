import { describe, expect, it } from 'vitest';
import indicadoresMunicipais from './indicadoresMunicipais.json';
import municipios from './municipios.json';
import type { IndicadorMunicipal, Municipio } from '../types';

/**
 * A transcrição de 242 valores de tabela em PDF se prova por soma.
 *
 * Um dígito trocado passa despercebido em revisão visual e não é pego por
 * nenhum outro teste — o registro continua bem formado. O que o denuncia é o
 * total: cada indicador abaixo tem um total publicado pelo próprio Diagnóstico,
 * e a soma das 22 linhas precisa fechar com ele.
 */
describe('indicadores municipais', () => {
  const dados = indicadoresMunicipais as IndicadorMunicipal[];
  const ids = new Set((municipios as Municipio[]).map((m) => m.id));

  function somar(indicador: string): number {
    return dados
      .filter((d) => d.indicador === indicador)
      .reduce((total, d) => total + (d.valor ?? 0), 0);
  }

  it('todo indicador cobre os 22 municípios, sem sobra nem falta', () => {
    const porIndicador = new Map<string, number>();
    for (const d of dados) porIndicador.set(d.indicador, (porIndicador.get(d.indicador) ?? 0) + 1);
    for (const [indicador, n] of porIndicador) {
      expect(n, `indicador "${indicador}"`).toBe(22);
    }
    expect(porIndicador.size * 22).toBe(dados.length);
  });

  it('todo valor aponta para um município que existe', () => {
    for (const d of dados) {
      expect(ids.has(d.municipioId), `município desconhecido: ${d.municipioId}`).toBe(true);
    }
  });

  it('a soma bate com o total publicado no Diagnóstico', () => {
    // Tabela 9, linha TOTAL, base SNIS 2021.
    expect(somar('rsu-diario-snis')).toBeCloseTo(16926.09, 1);
    // Tabela 9, linha TOTAL, base do questionário de 2022.
    expect(somar('rsu-diario-questionario')).toBeCloseTo(13673.04, 1);
    // "As 49 cooperativas sediadas na Região Metropolitana" — capítulo 6.
    expect(somar('entidades-catadores')).toBe(49);
  });

  it('a coleta seletiva registra os 11 municípios em zero, como a Tabela 44', () => {
    const zeros = dados.filter((d) => d.indicador === 'reciclaveis-coleta-seletiva' && d.valor === 0);
    expect(zeros).toHaveLength(11);
  });

  it('ausência ficou nula e nunca virou zero', () => {
    // Guapimirim não declarou despesa; Seropédica não declarou custo por
    // habitante. Zero ali significaria "não gasta nada".
    const guapimirim = dados.find(
      (d) => d.municipioId === 'guapimirim' && d.indicador === 'despesa-manejo',
    );
    expect(guapimirim?.valor).toBeNull();
    expect(guapimirim?.valorExibicao).toBeNull();

    const seropedica = dados.find(
      (d) => d.municipioId === 'seropedica' && d.indicador === 'custo-por-habitante',
    );
    expect(seropedica?.valor).toBeNull();
  });

  it('todo valor carrega fonte e período de referência', () => {
    for (const d of dados) {
      expect(d.fonte, `${d.id} sem fonte`).toMatch(/Diagnóstico Geral do PMetGIRS, Tabela \d+/);
      expect(d.periodoReferencia, `${d.id} sem período`).toBeTruthy();
    }
  });

  it('a despesa de Niterói vai publicada com a ressalva, não corrigida em silêncio', () => {
    const niteroi = dados.find(
      (d) => d.municipioId === 'niteroi' && d.indicador === 'despesa-manejo',
    );
    // O valor permanece o do documento — escolher outro seria publicar um
    // número que nenhuma fonte declara.
    expect(niteroi?.valor).toBe(273275031.32);
    expect(niteroi?.statusValidacao).toBe('informacao_divergente');
    expect(niteroi?.observacao).toMatch(/idêntico, ao centavo, à sua arrecadação/);
  });
});
