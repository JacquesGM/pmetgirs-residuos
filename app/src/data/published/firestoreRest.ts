/**
 * Leitura da projeção pública pela API REST do Firestore, sem o SDK.
 *
 * NÃO É USADO PELO PORTAL. Este módulo está fora do caminho de execução do site
 * desde 15/08/2026, e nenhum componente o importa — o portal público lê arquivo,
 * nunca o banco. Tráfego público consumindo a cota diária de leituras do Spark
 * é risco de interrupção do serviço, e a arquitetura resolve isso publicando um
 * snapshot estático servido pelo CDN.
 *
 * O que ele existe para atender é o **gerador de snapshot**: um job que lê
 * `publicWorkspaces` uma vez por release, monta os arquivos com manifesto e
 * SHA-256 e publica. Nesse contexto a leitura é única e não escala com visitas.
 *
 * Por que REST e não o SDK, mesmo no gerador: a projeção é legível sem
 * autenticação — garantia da regra `allow read: if true` em `publicWorkspaces` —,
 * então um GET basta, sem dependência pesada nem credencial.
 *
 * Nenhuma credencial é usada. Verificado em 15/08/2026: a leitura responde 200
 * sem chave alguma — o CI confere o snapshot sem precisar de secret.
 */

/** Valor no formato REST do Firestore: `{ stringValue: 'x' }` e afins. */
type FirestoreValue = Record<string, unknown>;

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

/**
 * Converte um valor do formato REST para JavaScript.
 *
 * `integerValue` chega como string por decisão da API — inteiros de 64 bits não
 * cabem em `number` com segurança. Os nossos cabem, então convertemos; se
 * algum dia não couber, `Number` perde precisão em silêncio, e é por isso que
 * este comentário existe.
 */
export function decodeValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue as string;
  if ('booleanValue' in value) return value.booleanValue as boolean;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue as number;
  if ('timestampValue' in value) return value.timestampValue as string;
  if ('arrayValue' in value) {
    const arr = (value.arrayValue as { values?: FirestoreValue[] })?.values ?? [];
    return arr.map((item) => decodeValue(item));
  }
  if ('mapValue' in value) {
    const map = (value.mapValue as { fields?: Record<string, FirestoreValue> })?.fields ?? {};
    return decodeFields(map);
  }
  // Tipo que não usamos (bytes, geoPoint, reference). Melhor devolver null do
  // que um objeto cru que a interface tentaria renderizar.
  return null;
}

export function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(fields)) {
    saida[chave] = decodeValue(valor);
  }
  return saida;
}

/** Extrai o id do documento do campo `name`, que vem como caminho completo. */
export function documentId(doc: FirestoreDocument): string {
  return (doc.name ?? '').split('/').pop() ?? '';
}

export interface PublishedDocument {
  id: string;
  data: Record<string, unknown>;
}

export interface AcessoPublico {
  projectId: string;
  workspaceId: string;
  /**
   * Opcional, e normalmente ausente.
   *
   * A leitura de `publicWorkspaces` responde 200 **sem chave nenhuma** — quem
   * autoriza é a Security Rule `allow read: if true`, não a chave. Ela existe
   * aqui só para o caso de o projeto passar a exigir identificação de cliente
   * em algum contexto; o gerador roda sem ela.
   */
  apiKey?: string;
}

/**
 * Busca uma coleção publicada. Devolve `null` — e não uma lista vazia — quando
 * a leitura não é possível ou nada foi publicado.
 *
 * A distinção importa: quem chama usa `null` para manter o conteúdo embutido no
 * bundle. Uma lista vazia devolvida por engano esvaziaria o portal, e um erro
 * de rede não deve apagar o que o cidadão já estava vendo.
 */
/** Máximo que a API do Firestore aceita por página. */
const PAGINA = 300;

/** Teto de páginas: 6.000 documentos. Protege contra laço infinito, não contra volume. */
const MAX_PAGINAS = 20;

export async function fetchPublishedCollection(
  collection: string,
  acesso: AcessoPublico,
  sinal?: AbortSignal,
): Promise<PublishedDocument[] | null> {
  const { projectId, apiKey, workspaceId } = acesso;
  if (!projectId || !workspaceId) return null;

  const base =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents` +
    `/publicWorkspaces/${workspaceId}/${collection}?pageSize=${PAGINA}` +
    (apiKey ? `&key=${apiKey}` : '');

  const documentos: FirestoreDocument[] = [];
  let token: string | undefined;

  try {
    // Segue o nextPageToken até o fim.
    //
    // Sem isto, a leitura parava na primeira página e devolvia o pedaço como se
    // fosse o todo. Em 17/08/2026 os indicadores municipais passaram de 242
    // para 418 e o portal exibiu 300 — sem erro, sem aviso, sem nada que
    // indicasse que faltavam 118. Truncar em silêncio é pior que falhar: o
    // portal continua parecendo completo.
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      const url = token ? `${base}&pageToken=${encodeURIComponent(token)}` : base;
      const resposta = await fetch(url, { signal: sinal });
      if (!resposta.ok) return null;
      const corpo = (await resposta.json()) as {
        documents?: FirestoreDocument[];
        nextPageToken?: string;
      };
      documentos.push(...(corpo.documents ?? []));
      token = corpo.nextPageToken;
      if (!token) {
        if (documentos.length === 0) return null;
        return documentos.map((doc) => ({
          id: documentId(doc),
          data: decodeFields(doc.fields ?? {}),
        }));
      }
    }

    // Ainda havia token depois do teto. Devolver o que foi lido seria afirmar
    // que a coleção acabou; devolver nulo faz o portal cair no dado embutido,
    // que é incompleto mas honesto sobre a sua origem.
    return null;
  } catch {
    // Rede fora, CSP, offline: o portal segue com o conteúdo embutido.
    return null;
  }
}
