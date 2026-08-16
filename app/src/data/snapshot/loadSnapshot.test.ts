import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { carregarColecaoPublicada, carregarManifesto, limparCacheDoManifesto } from './loadSnapshot';

const HASH = 'ab'.repeat(32);

const manifesto = {
  schemaVersion: 1,
  generatedAt: '2026-08-15T00:00:00.000Z',
  workspaceId: 'pmetgirs-rmrj',
  sourceReleaseIds: ['rel-1'],
  recordCounts: { projetos: 2 },
  files: [{ path: 'current/projetos.json', sha256: HASH, bytes: 100, registros: 2 }],
};

const doisProjetos = [{ id: 'a' }, { id: 'b' }];

/** Simula o CDN: cada URL responde o que o teste definir. */
function servir(rotas: Record<string, unknown | 'erro'>) {
  const chamadas: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      chamadas.push(url);
      const chave = Object.keys(rotas).find((k) => url.includes(k));
      if (chave === undefined || rotas[chave] === 'erro') {
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => rotas[chave] } as Response;
    }),
  );
  return chamadas;
}

beforeEach(() => limparCacheDoManifesto());
afterEach(() => vi.unstubAllGlobals());

describe('manifesto', () => {
  it('é buscado uma única vez, mesmo com várias coleções', async () => {
    const chamadas = servir({
      'manifest.json': manifesto,
      'projetos.json': doisProjetos,
    });

    await Promise.all([
      carregarColecaoPublicada('projetos'),
      carregarColecaoPublicada('projetos'),
      carregarManifesto(),
    ]);

    const doManifesto = chamadas.filter((u) => u.includes('manifest.json'));
    expect(doManifesto).toHaveLength(1);
  });

  it('devolve null quando não existe', async () => {
    servir({ 'manifest.json': 'erro' });
    expect(await carregarManifesto()).toBeNull();
  });

  it('devolve null quando vem malformado', async () => {
    servir({ 'manifest.json': { schemaVersion: 1 } });
    expect(await carregarManifesto()).toBeNull();
  });
});

describe('leitura de uma coleção', () => {
  it('devolve os registros publicados', async () => {
    servir({ 'manifest.json': manifesto, 'projetos.json': doisProjetos });
    expect(await carregarColecaoPublicada('projetos')).toEqual(doisProjetos);
  });

  it('versiona a URL pelo hash do manifesto', async () => {
    // É o que permite cache imutável no arquivo e revalidação só do manifesto.
    const chamadas = servir({ 'manifest.json': manifesto, 'projetos.json': doisProjetos });
    await carregarColecaoPublicada('projetos');
    const doArquivo = chamadas.find((u) => u.includes('projetos.json'));
    expect(doArquivo).toContain(`?v=${HASH.slice(0, 12)}`);
  });

  it('devolve null para coleção ausente do manifesto', async () => {
    servir({ 'manifest.json': manifesto });
    expect(await carregarColecaoPublicada('municipios')).toBeNull();
  });

  it('devolve null quando o arquivo não carrega', async () => {
    servir({ 'manifest.json': manifesto, 'projetos.json': 'erro' });
    expect(await carregarColecaoPublicada('projetos')).toBeNull();
  });

  it('devolve null quando o manifesto não carrega', async () => {
    servir({ 'manifest.json': 'erro', 'projetos.json': doisProjetos });
    expect(await carregarColecaoPublicada('projetos')).toBeNull();
  });
});

describe('recusa de dado truncado', () => {
  /**
   * Uma resposta parcial do CDN é indistinguível de uma publicação que removeu
   * registros. Na dúvida, o portal fica com o conteúdo embutido: mostrar o
   * release anterior é honesto, mostrar uma lista que perdeu itens no caminho
   * não é.
   */
  it('recusa arquivo com menos registros do que o manifesto declara', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    servir({ 'manifest.json': manifesto, 'projetos.json': [{ id: 'a' }] });

    expect(await carregarColecaoPublicada('projetos')).toBeNull();
    expect(aviso).toHaveBeenCalledOnce();
    aviso.mockRestore();
  });

  it('recusa arquivo com mais registros do que o declarado', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    servir({ 'manifest.json': manifesto, 'projetos.json': [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });

    expect(await carregarColecaoPublicada('projetos')).toBeNull();
    aviso.mockRestore();
  });

  it('recusa resposta que não é lista', async () => {
    servir({ 'manifest.json': manifesto, 'projetos.json': { erro: 'html da página 404' } });
    expect(await carregarColecaoPublicada('projetos')).toBeNull();
  });
});
