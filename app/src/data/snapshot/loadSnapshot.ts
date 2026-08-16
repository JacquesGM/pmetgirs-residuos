import type { Manifesto } from '../../domain/publication/snapshot';

/**
 * Leitura do snapshot público pelo portal.
 *
 * O portal lê arquivo, nunca o banco. Este módulo busca o manifesto do release
 * corrente e, a partir dele, os arquivos de dados — tudo servido pelo CDN, sem
 * SDK, sem autenticação e sem consumir a cota de leituras do Firestore.
 *
 * Duas propriedades importam aqui:
 *
 *  - **Nunca esvaziar o portal.** Toda falha devolve `null`, e `null` significa
 *    "continue com o que você já tem". Um erro de rede não pode apagar o que o
 *    cidadão estava vendo.
 *  - **Nunca servir dado truncado.** O manifesto declara quantos registros cada
 *    arquivo deveria ter. Se a contagem não bater, o arquivo é recusado — uma
 *    resposta parcial de CDN é indistinguível de uma publicação legítima que
 *    removeu registros, e a diferença importa.
 */

/** O manifesto é buscado uma vez por carregamento da página, não por seção. */
let manifestoEmVoo: Promise<Manifesto | null> | null = null;

function urlBase(): string {
  // BASE_URL respeita o destino do build: raiz no Firebase Hosting, subpasta no
  // GitHub Pages. Concatenar '/data/...' cru quebraria no segundo.
  return import.meta.env.BASE_URL ?? '/';
}

export function carregarManifesto(sinal?: AbortSignal): Promise<Manifesto | null> {
  if (!manifestoEmVoo) {
    manifestoEmVoo = (async () => {
      try {
        const resposta = await fetch(`${urlBase()}data/manifest.json`, { signal: sinal });
        if (!resposta.ok) return null;
        const manifesto = (await resposta.json()) as Manifesto;
        return Array.isArray(manifesto.files) ? manifesto : null;
      } catch {
        return null;
      }
    })();
  }
  return manifestoEmVoo;
}

/**
 * Cada coleção é buscada uma vez por carregamento da página.
 *
 * Cinco componentes leem `municipios` na mesma tela — mapa, dois gráficos,
 * comparador e prévia. Sem memorizar, seriam cinco requisições e, pior, cinco
 * resultados que poderiam divergir se uma delas falhasse: a página mostraria o
 * snapshot num gráfico e o bundle no outro.
 */
const colecoesEmVoo = new Map<string, Promise<unknown[] | null>>();

/** Só para os testes: descarta manifesto e coleções memorizados. */
export function limparCacheDoManifesto(): void {
  manifestoEmVoo = null;
  colecoesEmVoo.clear();
}

/**
 * Registros publicados de uma coleção, ou `null` para manter o conteúdo
 * embutido no bundle.
 *
 * `colecao` é o nome do arquivo sem extensão — `projetos` para
 * `current/projetos.json`.
 */
export function carregarColecaoPublicada<T>(
  colecao: string,
  sinal?: AbortSignal,
): Promise<T[] | null> {
  const memorizada = colecoesEmVoo.get(colecao);
  if (memorizada) return memorizada as Promise<T[] | null>;

  const promessa = buscarColecao<T>(colecao, sinal);
  colecoesEmVoo.set(colecao, promessa as Promise<unknown[] | null>);
  return promessa;
}

async function buscarColecao<T>(colecao: string, sinal?: AbortSignal): Promise<T[] | null> {
  const manifesto = await carregarManifesto(sinal);
  if (!manifesto) return null;

  const arquivo = manifesto.files.find((f) => f.path === `current/${colecao}.json`);
  if (!arquivo) return null;

  try {
    // O hash no query string dá URL própria a cada versão, o que permite cache
    // longo no arquivo e revalidação apenas do manifesto.
    const resposta = await fetch(`${urlBase()}data/${arquivo.path}?v=${arquivo.sha256.slice(0, 12)}`, {
      signal: sinal,
    });
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as T[];
    if (!Array.isArray(dados)) return null;

    if (dados.length !== arquivo.registros) {
      // Recusa em silêncio e mantém o bundle: melhor um dado do release
      // anterior do que uma lista que perdeu registros no caminho.
      console.warn(
        `[snapshot] ${colecao}: manifesto declara ${arquivo.registros} registros, ` +
          `arquivo trouxe ${dados.length}. Mantendo o conteúdo embutido.`,
      );
      return null;
    }

    return dados;
  } catch {
    return null;
  }
}
