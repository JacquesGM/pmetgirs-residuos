import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublishedCollection } from './firestoreRest';

const ACESSO = { projectId: 'proj', apiKey: 'chave', workspaceId: 'ws' };

/** Documento no formato REST do Firestore, o que a API devolve de fato. */
function doc(i: number) {
  return {
    name: `projects/proj/databases/(default)/documents/publicWorkspaces/ws/x/doc-${i}`,
    fields: { name: { stringValue: `Registro ${i}` } },
  };
}

function respostaOk(corpo: unknown) {
  return { ok: true, json: async () => corpo } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('leitura paginada da projeção pública', () => {
  it('segue o nextPageToken e devolve a coleção inteira', async () => {
    // O defeito que motivou este teste: a leitura pedia pageSize=300 e ignorava
    // o nextPageToken. Em 17/08/2026 os indicadores municipais passaram de 242
    // para 418 e o portal passou a exibir 300 — sem erro e sem aviso.
    const paginas = [
      { documents: Array.from({ length: 300 }, (_, i) => doc(i)), nextPageToken: 't1' },
      { documents: Array.from({ length: 118 }, (_, i) => doc(300 + i)) },
    ];
    let chamada = 0;
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      return respostaOk(paginas[chamada++]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = await fetchPublishedCollection('municipalIndicators', ACESSO);

    expect(r).not.toBeNull();
    expect(r).toHaveLength(418);
    expect(urls).toHaveLength(2);
    // A segunda chamada tem de carregar o token da primeira.
    expect(urls[1]).toContain('pageToken=t1');
  });

  it('uma página só, sem token, encerra em uma chamada', async () => {
    const fetchMock = vi.fn(async () => respostaOk({ documents: [doc(1), doc(2)] }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await fetchPublishedCollection('documents', ACESSO);
    expect(r).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('devolve nulo se a paginação não terminar dentro do teto', async () => {
    // Devolver o que foi lido afirmaria que a coleção acabou. Nulo faz o portal
    // cair no dado embutido — incompleto, mas honesto sobre a própria origem.
    const fetchMock = vi.fn(async () =>
      respostaOk({ documents: [doc(1)], nextPageToken: 'sempre' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchPublishedCollection('x', ACESSO)).toBeNull();
  });

  it('devolve nulo quando a rede falha no meio da paginação', async () => {
    // Meia coleção apresentada como inteira é o pior resultado possível.
    let chamada = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      chamada += 1;
      if (chamada === 1) return respostaOk({ documents: [doc(1)], nextPageToken: 't1' });
      return { ok: false } as Response;
    }));

    expect(await fetchPublishedCollection('x', ACESSO)).toBeNull();
  });

  it('coleção vazia devolve nulo, para o portal manter o conteúdo embutido', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaOk({})));
    expect(await fetchPublishedCollection('x', ACESSO)).toBeNull();
  });
});
