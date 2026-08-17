import { describe, expect, it } from 'vitest';
import dados from './vazadouros.json';
import municipiosData from './municipios.json';
import type { Vazadouro } from '../types';

const vazadouros = dados as Vazadouro[];
const municipios = (municipiosData as { id: string }[]).map((m) => m.id);

describe('vazadouros — Tabelas 29 e 30 do Prognóstico', () => {
  it('são as 23 áreas que o documento declara', () => {
    expect(vazadouros).toHaveLength(23);
  });

  it('todo vazadouro aponta para um município existente', () => {
    for (const v of vazadouros) {
      expect(municipios, `${v.id}`).toContain(v.municipioId);
    }
  });

  /**
   * As contagens que o texto da própria página afirma.
   *
   * Duas conferem e duas não — e as que não conferem são o achado, não um erro
   * de transcrição. Fixá-las em teste impede que alguém "arrume" a tabela para
   * casar com o texto, que seria escolher em silêncio entre duas afirmações da
   * fonte.
   */
  it('dez áreas concluíram a Primeira Etapa, como o texto afirma', () => {
    expect(vazadouros.filter((v) => v.primeiraEtapa === 'feito')).toHaveLength(10);
  });

  it('cinco concluíram o Tratamento Secundário, como o texto afirma', () => {
    expect(vazadouros.filter((v) => v.tratamentoSecundario === 'feito')).toHaveLength(5);
  });

  it('a tabela mostra DOIS em tratamento primário; o texto diz um', () => {
    const emPrimario = vazadouros.filter((v) => v.tratamentoPrimario === 'fazendo');
    expect(emPrimario.map((v) => v.id).sort()).toEqual(['itaguai-santana', 'japeri']);
  });

  it('a tabela mostra TRÊS em tratamento secundário; o texto diz dois', () => {
    const emSecundario = vazadouros.filter((v) => v.tratamentoSecundario === 'fazendo');
    expect(emSecundario.map((v) => v.id).sort()).toEqual([
      'mage',
      'marica-caxito',
      'sao-goncalo-itaoca',
    ]);
  });

  it('Maricá — Caxito carrega a contradição escrita, não resolvida', () => {
    // A Tabela 29 o mostra em Tratamento Secundário; o texto da mesma página o
    // lista entre os treze que "ainda não realizaram nenhuma ação". É por causa
    // dele que a nossa contagem de "nenhuma ação" dá 12 e o texto diz 13.
    const caxito = vazadouros.find((v) => v.id === 'marica-caxito')!;
    expect(caxito.tratamentoSecundario).toBe('fazendo');
    expect(caxito.statusValidacao).toBe('informacao_divergente');
    expect(caxito.observacao).toMatch(/nenhuma ação de remediação/);

    const semAcao = vazadouros.filter((v) => v.estagio === 'Nenhuma ação de remediação');
    expect(semAcao).toHaveLength(12);
  });

  it('registra quem trata sem ter concluído a etapa que vem antes', () => {
    // O documento define a Primeira Etapa como o estudo para licenciamento.
    // Tratar antes dele inverte a ordem que a própria fonte estabelece.
    const forDeOrdem = vazadouros.filter(
      (v) =>
        v.primeiraEtapa !== 'feito' &&
        (v.tratamentoPrimario || v.tratamentoSecundario || v.tratamentoTerciario),
    );
    expect(forDeOrdem.map((v) => v.id)).toEqual(['marica-caxito']);
    expect(forDeOrdem[0].observacao).toMatch(/inverte a ordem/);
  });

  it('as áreas paradas foram fechadas entre 2011 e 2015', () => {
    // O texto fala em "cerca de 10 anos (em média) do fechamento". São treze
    // áreas, e em 2026 fazem de onze a quinze anos sem nenhuma ação.
    const comAno = vazadouros.filter((v) => v.anoEncerramento !== null);
    expect(comAno).toHaveLength(13);
    const anos = comAno.map((v) => v.anoEncerramento!);
    expect(Math.min(...anos)).toBe(2011);
    expect(Math.max(...anos)).toBe(2015);
  });

  it('dezenove dos vinte e dois municípios têm vazadouro identificado', () => {
    const comVazadouro = new Set(vazadouros.map((v) => v.municipioId));
    expect(comVazadouro.size).toBe(19);
    const sem = municipios.filter((m) => !comVazadouro.has(m)).sort();
    expect(sem).toEqual(['mesquita', 'nilopolis', 'sao-joao-de-meriti']);
  });

  it('Itaguaí — Cidade Industrial guarda a contestação da prefeitura', () => {
    const v = vazadouros.find((x) => x.id === 'itaguai-cidade-industrial')!;
    expect(v.observacao).toMatch(/contesta/);
    expect(v.statusValidacao).toBe('informacao_divergente');
  });
});
