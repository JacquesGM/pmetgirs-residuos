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
 * A chave de API é pública por natureza; identifica o projeto e não autoriza nada.
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

/**
 * Busca uma coleção publicada. Devolve `null` — e não uma lista vazia — quando
 * a leitura não é possível ou nada foi publicado.
 *
 * A distinção importa: quem chama usa `null` para manter o conteúdo embutido no
 * bundle. Uma lista vazia devolvida por engano esvaziaria o portal, e um erro
 * de rede não deve apagar o que o cidadão já estava vendo.
 */
export async function fetchPublishedCollection(
  collection: string,
  sinal?: AbortSignal,
): Promise<PublishedDocument[] | null> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const workspaceId = import.meta.env.VITE_WORKSPACE_ID;
  const usandoEmulador = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

  if (!projectId || !apiKey || !workspaceId || usandoEmulador) return null;

  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents` +
    `/publicWorkspaces/${workspaceId}/${collection}?pageSize=300&key=${apiKey}`;

  try {
    const resposta = await fetch(url, { signal: sinal });
    if (!resposta.ok) return null;
    const corpo = (await resposta.json()) as { documents?: FirestoreDocument[] };
    const documentos = corpo.documents ?? [];
    if (documentos.length === 0) return null;
    return documentos.map((doc) => ({
      id: documentId(doc),
      data: decodeFields(doc.fields ?? {}),
    }));
  } catch {
    // Rede fora, CSP, offline: o portal segue com o conteúdo embutido.
    return null;
  }
}
