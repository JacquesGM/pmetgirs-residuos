/**
 * Regras puras do snapshot público.
 *
 * O snapshot é o único caminho pelo qual um dado interno chega ao cidadão. Três
 * propriedades importam, e as três são verificáveis:
 *
 *  1. **Determinismo** — a mesma entrada produz bytes idênticos. Sem isso o
 *     SHA-256 muda sem o conteúdo mudar, e a verificação de integridade vira
 *     ruído que todo mundo aprende a ignorar.
 *  2. **Ausência de dado pessoal** — a allowlist da publicação já filtra campos,
 *     mas ela protege o formato, não o conteúdo. Um e-mail digitado dentro de
 *     uma descrição atravessa a allowlist sem esforço.
 *  3. **Contagem declarada** — o manifesto diz quantos registros deveriam estar
 *     ali, para que uma perda silenciosa não passe por atualização legítima.
 */

/** Campos que não podem existir num arquivo público, mesmo aninhados. */
export const CHAVES_PROIBIDAS = [
  'publishedBy',
  'updatedBy',
  'createdBy',
  'actorUid',
  'ownerUid',
  'teamUids',
  'internalNotes',
  'contactEmail',
  'changeReason',
  'lastEventId',
  'workspaceId',
];

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

export interface AchadoPii {
  tipo: 'email' | 'cpf' | 'chave_proibida';
  valor: string;
  onde: string;
}

/**
 * Procura dado pessoal no conteúdo serializado.
 *
 * Trabalha sobre o texto final, não sobre os objetos: é assim que se pega o
 * e-mail escondido numa descrição, que nenhuma allowlist de campos veria.
 */
export function varrerPii(conteudo: string, arquivo: string): AchadoPii[] {
  const achados: AchadoPii[] = [];

  for (const valor of conteudo.match(EMAIL) ?? []) {
    achados.push({ tipo: 'email', valor, onde: arquivo });
  }
  for (const valor of conteudo.match(CPF) ?? []) {
    achados.push({ tipo: 'cpf', valor, onde: arquivo });
  }
  for (const chave of CHAVES_PROIBIDAS) {
    if (new RegExp(`"${chave}"\\s*:`).test(conteudo)) {
      achados.push({ tipo: 'chave_proibida', valor: chave, onde: arquivo });
    }
  }

  return achados;
}

/**
 * Serializa com ordem de chaves estável e quebra de linha final.
 *
 * `JSON.stringify` preserva a ordem de inserção das chaves, que depende de como
 * o objeto foi construído. Dois processos podem produzir o mesmo dado com bytes
 * diferentes — e hashes diferentes.
 */
export function serializarDeterministico(dados: unknown): string {
  return JSON.stringify(dados, ordenarChaves, 2) + '\n';
}

function ordenarChaves(_chave: string, valor: unknown): unknown {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return valor;
  const entradas = Object.entries(valor as Record<string, unknown>);
  entradas.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entradas);
}

export interface ArquivoDoSnapshot {
  path: string;
  sha256: string;
  bytes: number;
  registros: number;
}

export interface Manifesto {
  schemaVersion: number;
  generatedAt: string;
  workspaceId: string;
  /** Releases de origem dos documentos, ordenados. Uma publicação parcial mistura mais de um. */
  sourceReleaseIds: string[];
  recordCounts: Record<string, number>;
  files: ArquivoDoSnapshot[];
}

export const SNAPSHOT_SCHEMA_VERSION = 1;

export function montarManifesto(entrada: {
  workspaceId: string;
  generatedAt: string;
  sourceReleaseIds: string[];
  arquivos: ArquivoDoSnapshot[];
}): Manifesto {
  const recordCounts: Record<string, number> = {};
  for (const a of entrada.arquivos) {
    recordCounts[nomeDaColecao(a.path)] = a.registros;
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: entrada.generatedAt,
    workspaceId: entrada.workspaceId,
    sourceReleaseIds: [...new Set(entrada.sourceReleaseIds)].sort(),
    recordCounts,
    files: [...entrada.arquivos].sort((a, b) => (a.path < b.path ? -1 : 1)),
  };
}

/** `current/projetos.json` → `projetos` */
export function nomeDaColecao(path: string): string {
  return path.split('/').pop()?.replace(/\.json$/, '') ?? path;
}

export interface ProblemaDoSnapshot {
  gravidade: 'bloqueia' | 'alerta';
  mensagem: string;
}

/**
 * Validações que decidem se o snapshot pode ir ao ar.
 *
 * Um arquivo vazio bloqueia: publicar zero registro por engano apaga uma seção
 * inteira do portal, e é indistinguível de uma publicação legítima que remove
 * tudo. Se a intenção for essa, que seja declarada.
 */
export function validarSnapshot(
  arquivos: ArquivoDoSnapshot[],
  achadosPii: AchadoPii[],
): ProblemaDoSnapshot[] {
  const problemas: ProblemaDoSnapshot[] = [];

  if (arquivos.length === 0) {
    problemas.push({ gravidade: 'bloqueia', mensagem: 'Nenhum arquivo gerado.' });
  }

  for (const a of arquivos) {
    if (a.registros === 0) {
      problemas.push({
        gravidade: 'bloqueia',
        mensagem: `${a.path} não tem nenhum registro. Publicar isso esvazia a seção no portal.`,
      });
    }
    if (a.sha256.length !== 64) {
      problemas.push({ gravidade: 'bloqueia', mensagem: `${a.path} tem hash inválido.` });
    }
  }

  for (const achado of achadosPii) {
    problemas.push({
      gravidade: 'bloqueia',
      mensagem: `${achado.onde}: ${achado.tipo} — "${achado.valor}"`,
    });
  }

  return problemas;
}
