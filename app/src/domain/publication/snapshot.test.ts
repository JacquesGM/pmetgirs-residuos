import { describe, expect, it } from 'vitest';
import { sanitizeForPublication, PUBLIC_ALLOWLIST } from './sanitize';
import {
  montarManifesto,
  serializarDeterministico,
  validarSnapshot,
  varrerPii,
  nomeDaColecao,
  type ArquivoDoSnapshot,
} from './snapshot';

describe('determinismo da serialização', () => {
  it('produz os mesmos bytes independentemente da ordem das chaves', () => {
    const a = serializarDeterministico({ nome: 'Projeto', id: 'p1', eixo: 'e1' });
    const b = serializarDeterministico({ eixo: 'e1', id: 'p1', nome: 'Projeto' });
    expect(a).toBe(b);
  });

  it('ordena chaves aninhadas também', () => {
    const a = serializarDeterministico([{ z: 1, meta: { b: 2, a: 1 } }]);
    const b = serializarDeterministico([{ meta: { a: 1, b: 2 }, z: 1 }]);
    expect(a).toBe(b);
  });

  it('preserva a ordem dos arrays, que carrega significado', () => {
    // Ordenar chaves é normalização; ordenar arrays seria alterar o dado.
    const a = serializarDeterministico(['segundo', 'primeiro']);
    const b = serializarDeterministico(['primeiro', 'segundo']);
    expect(a).not.toBe(b);
  });

  it('termina com quebra de linha', () => {
    expect(serializarDeterministico({ a: 1 }).endsWith('\n')).toBe(true);
  });
});

describe('varredura de dado pessoal', () => {
  it('encontra e-mail escondido dentro de um texto livre', () => {
    // A allowlist protege o formato, não o conteúdo: `description` é um campo
    // autorizado, e um e-mail digitado dentro dele atravessa sem esforço.
    const conteudo = JSON.stringify([{ descricao: 'Falar com fulano@prefeitura.rj.gov.br' }]);
    const achados = varrerPii(conteudo, 'current/projetos.json');
    expect(achados).toHaveLength(1);
    expect(achados[0].tipo).toBe('email');
  });

  it('encontra CPF com e sem pontuação', () => {
    expect(varrerPii('{"x":"123.456.789-00"}', 'a.json')).toHaveLength(1);
    expect(varrerPii('{"x":"12345678900"}', 'a.json')).toHaveLength(1);
  });

  it('encontra chave proibida', () => {
    const achados = varrerPii('{"publishedBy":"uid-123"}', 'a.json');
    expect(achados[0]).toMatchObject({ tipo: 'chave_proibida', valor: 'publishedBy' });
  });

  it('não acusa conteúdo legítimo', () => {
    const conteudo = JSON.stringify([
      { nome: 'Licitação das usinas', responsavel: 'IRM', fonte: 'Plano de Ações' },
    ]);
    expect(varrerPii(conteudo, 'a.json')).toEqual([]);
  });
});

describe('validação antes de publicar', () => {
  const arquivo = (over: Partial<ArquivoDoSnapshot> = {}): ArquivoDoSnapshot => ({
    path: 'current/projetos.json',
    sha256: 'a'.repeat(64),
    bytes: 100,
    registros: 10,
    ...over,
  });

  it('aceita um snapshot íntegro', () => {
    expect(validarSnapshot([arquivo()], [])).toEqual([]);
  });

  it('bloqueia arquivo sem nenhum registro', () => {
    // Publicar zero por engano apaga uma seção inteira do portal, e é
    // indistinguível de uma remoção intencional.
    const problemas = validarSnapshot([arquivo({ registros: 0 })], []);
    expect(problemas).toHaveLength(1);
    expect(problemas[0].gravidade).toBe('bloqueia');
  });

  it('bloqueia quando nada foi gerado', () => {
    expect(validarSnapshot([], [])[0].gravidade).toBe('bloqueia');
  });

  it('bloqueia hash malformado', () => {
    expect(validarSnapshot([arquivo({ sha256: 'curto' })], [])[0].gravidade).toBe('bloqueia');
  });

  it('qualquer achado de PII bloqueia', () => {
    const problemas = validarSnapshot(
      [arquivo()],
      [{ tipo: 'email', valor: 'a@b.com', onde: 'current/projetos.json' }],
    );
    expect(problemas.some((p) => p.gravidade === 'bloqueia')).toBe(true);
  });
});

describe('manifesto', () => {
  const arquivo: ArquivoDoSnapshot = {
    path: 'current/projetos.json',
    sha256: 'b'.repeat(64),
    bytes: 200,
    registros: 7,
  };

  it('conta registros por coleção', () => {
    const m = montarManifesto({
      workspaceId: 'w',
      generatedAt: '2026-08-15T00:00:00.000Z',
      sourceReleaseIds: ['rel-1'],
      arquivos: [arquivo],
    });
    expect(m.recordCounts).toEqual({ projetos: 7 });
  });

  it('remove releases repetidos e ordena', () => {
    // Uma publicação parcial mistura releases; o manifesto declara todos.
    const m = montarManifesto({
      workspaceId: 'w',
      generatedAt: '2026-08-15T00:00:00.000Z',
      sourceReleaseIds: ['rel-b', 'rel-a', 'rel-b'],
      arquivos: [arquivo],
    });
    expect(m.sourceReleaseIds).toEqual(['rel-a', 'rel-b']);
  });

  it('deriva o nome da coleção do caminho', () => {
    expect(nomeDaColecao('current/projetos.json')).toBe('projetos');
  });
});

describe('a allowlist não protege documento truncado', () => {
  /**
   * O defeito de 15/08/2026, travado em teste.
   *
   * A publicação lia o view model da listagem — 15 campos escolhidos para
   * aquela tela — em vez do documento armazenado. A allowlist só preserva o que
   * recebe, então seis campos autorizados sumiam da projeção pública **sem erro
   * algum**: nenhuma exceção, nenhum aviso, nada nos testes.
   *
   * Este teste existe para que a propriedade fique explícita: sanitizar é
   * filtrar, não completar. Quem alimenta a sanitização precisa entregar o
   * documento inteiro — é o que `readProjectsForPublication` garante.
   */
  const completo = {
    name: 'Licitação das usinas de triagem',
    axisId: 'triagem',
    description: 'Descrição',
    territorialScale: 'Região Metropolitana do Rio de Janeiro',
    accountable: 'IRM',
    participants: ['Municípios'],
    nextSteps: ['Publicar edital'],
    risks: ['Atraso no licenciamento'],
    relatedDocumentIds: ['plano-de-acoes'],
    sourceLabel: 'Plano de Ações do PMetGIRS',
    executionStatus: 'structuring',
    validationStatus: 'not_assessed',
    updatedBy: 'uid-interno',
  };

  const contexto = { sourceEntityId: 'p1', sourceVersion: 1, releaseId: 'rel-1' };

  it('documento completo entrega todos os campos autorizados presentes nele', () => {
    const { data } = sanitizeForPublication('projects', completo, contexto);
    for (const campo of ['territorialScale', 'participants', 'risks', 'sourceLabel']) {
      expect(data[campo], campo).toBeDefined();
    }
    expect(data.updatedBy).toBeUndefined();
  });

  it('documento truncado passa em silêncio, sem erro — por isso a leitura é bruta', () => {
    // Simula o que o view model da listagem entregava.
    const truncado = {
      name: completo.name,
      axisId: completo.axisId,
      description: completo.description,
      accountable: completo.accountable,
      executionStatus: completo.executionStatus,
      validationStatus: completo.validationStatus,
    };

    const { data, dropped } = sanitizeForPublication('projects', truncado, contexto);

    // Nada falha. Nada é descartado. E ainda assim a projeção está incompleta.
    expect(dropped).toEqual([]);
    for (const campo of ['territorialScale', 'participants', 'risks', 'sourceLabel']) {
      expect(data[campo], campo).toBeUndefined();
    }

    const autorizadosPresentes = PUBLIC_ALLOWLIST.projects.filter((c) => c in data);
    expect(autorizadosPresentes.length).toBeLessThan(PUBLIC_ALLOWLIST.projects.length);
  });
});
