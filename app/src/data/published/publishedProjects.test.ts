import { describe, expect, it } from 'vitest';
import projetosData from '../../data/projetos.json';
import { transformProject } from '../../domain/migration/transform';
import { sanitizeForPublication } from '../../domain/publication/sanitize';
import type { Projeto } from '../../types';
import { decodeFields, decodeValue, documentId } from './firestoreRest';
import { toProjeto } from './publishedProjects';

const projetos = projetosData as Projeto[];

describe('decodificação do formato REST do Firestore', () => {
  it('converte os tipos que a projeção usa', () => {
    expect(decodeValue({ stringValue: 'texto' })).toBe('texto');
    expect(decodeValue({ integerValue: '42' })).toBe(42);
    expect(decodeValue({ doubleValue: 1.5 })).toBe(1.5);
    expect(decodeValue({ booleanValue: true })).toBe(true);
    expect(decodeValue({ nullValue: null })).toBeNull();
    expect(decodeValue({ timestampValue: '2026-08-15T21:07:34.956Z' })).toBe(
      '2026-08-15T21:07:34.956Z',
    );
  });

  it('converte lista de textos', () => {
    const valor = { arrayValue: { values: [{ stringValue: 'a' }, { stringValue: 'b' }] } };
    expect(decodeValue(valor)).toEqual(['a', 'b']);
  });

  it('trata lista vazia e campo ausente sem quebrar', () => {
    expect(decodeValue({ arrayValue: {} })).toEqual([]);
    expect(decodeValue(undefined)).toBeNull();
  });

  it('devolve null para tipo que não usamos, em vez de objeto cru', () => {
    // Renderizar um objeto cru na interface quebraria a página.
    expect(decodeValue({ geoPointValue: { latitude: 1, longitude: 2 } })).toBeNull();
  });

  it('extrai o id do caminho completo do documento', () => {
    expect(
      documentId({
        name: 'projects/teste/databases/(default)/documents/publicWorkspaces/w/projects/proj-1',
      }),
    ).toBe('proj-1');
  });

  it('decodifica um conjunto de campos', () => {
    expect(decodeFields({ name: { stringValue: 'Projeto' }, n: { integerValue: '3' } })).toEqual({
      name: 'Projeto',
      n: 3,
    });
  });
});

describe('ida e volta: projeto legado → publicado → interface', () => {
  /**
   * O teste que importa. Um projeto real percorre o caminho inteiro — migração,
   * sanitização por allowlist e volta — e os campos que atravessam a fronteira
   * têm de chegar iguais. Se os dois sentidos divergirem, o cidadão vê dado
   * errado sem que nada falhe.
   */
  for (const original of projetos.slice(0, 3)) {
    it(original.nome, () => {
      const migrado = transformProject(original);
      const projecao = sanitizeForPublication('projects', migrado.data, {
        sourceEntityId: original.id,
        sourceVersion: 1,
        releaseId: 'rel-teste',
      });
      const devolta = toProjeto({ id: original.id, data: projecao.data });

      expect(devolta.id).toBe(original.id);
      expect(devolta.nome).toBe(original.nome);
      expect(devolta.eixo).toBe(original.eixo);
      expect(devolta.descricao).toBe(original.descricao);
      expect(devolta.abrangencia).toBe(original.abrangencia);
      expect(devolta.responsavel).toBe(original.responsavel);
      expect(devolta.participantes).toEqual(original.participantes);
      expect(devolta.proximosPassos).toEqual(original.proximosPassos);
      expect(devolta.riscos).toEqual(original.riscos);
      expect(devolta.documentosRelacionados).toEqual(original.documentosRelacionados);
      expect(devolta.fonte).toBe(original.fonte);
      expect(devolta.ultimaAtualizacao).toBe(original.ultimaAtualizacao);
      expect(devolta.status).toBe(original.status);
    });
  }

  it('não inventa valor para campo que não atravessa a fronteira', () => {
    const original = projetos[0];
    const migrado = transformProject(original);
    const projecao = sanitizeForPublication('projects', migrado.data, {
      sourceEntityId: original.id,
      sourceVersion: 1,
      releaseId: 'rel-teste',
    });
    const devolta = toProjeto({ id: original.id, data: projecao.data });

    // A allowlist não publica avanço, datas de plano nem dependências.
    // Ausência é a resposta honesta; zero seria uma afirmação falsa.
    expect(devolta.percentualAvanco).toBeNull();
    expect(devolta.inicioPrevisto).toBeNull();
    expect(devolta.terminoPrevisto).toBeNull();
    expect(devolta.dependencias).toEqual([]);
  });

  it('sobrevive a documento com campos faltando', () => {
    const devolta = toProjeto({ id: 'proj-x', data: { name: 'Só o nome' } });
    expect(devolta.nome).toBe('Só o nome');
    expect(devolta.participantes).toEqual([]);
    expect(devolta.riscos).toEqual([]);
    expect(devolta.fonte).toBe('');
  });
});
