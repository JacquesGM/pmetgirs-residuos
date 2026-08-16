import type { PublicationStatus } from '../enums';

/**
 * Sanitização da projeção pública.
 *
 * A regra é ALLOWLIST, não denylist: só atravessa a fronteira o campo que
 * aparece explicitamente na lista do seu tipo. Uma denylist falha em silêncio
 * — basta alguém acrescentar um campo interno novo e ele vaza sem que ninguém
 * perceba. Com allowlist, o campo novo simplesmente não passa até que alguém
 * decida que ele deve passar.
 *
 * O que nunca atravessa, por construção: quem editou, motivo da alteração,
 * notas internas, e-mails, identificadores de usuário, status legado e
 * qualquer campo de controle.
 */

export type PublicCollection =
  | 'projects'
  | 'axes'
  | 'indicators'
  | 'municipalities'
  | 'goals'
  | 'infrastructures'
  | 'documents'
  | 'inconsistencies'
  | 'glossary'
  | 'evidence';

/** Campos que podem ser vistos pelo cidadão, por tipo de entidade. */
export const PUBLIC_ALLOWLIST: Record<PublicCollection, string[]> = {
  projects: [
    'name',
    'description',
    'axisId',
    'accountable',
    'participants',
    'territorialScale',
    'executionStatus',
    'validationStatus',
    'actualityStatus',
    'timeHorizon',
    'costCategory',
    'nextSteps',
    'risks',
    'relatedDocumentIds',
    'sourceLabel',
    'dataDate',
    // Exceção documentada em EXCECOES_AO_NEVER_PUBLIC.
    'legacyStatus',
  ],
  axes: [
    'name',
    'description',
    'objective',
    'accountable',
    'executionStatus',
    'relatedDocumentIds',
    // Quais indicadores medem este eixo. Já é público no portal desde sempre.
    'relatedIndicatorIds',
  ],
  indicators: [
    'name',
    'value',
    'displayValue',
    'unit',
    'referencePeriod',
    'sourceLabel',
    'sourceType',
    'validationStatus',
    'actualityStatus',
    'dataDate',
    'note',
  ],
  municipalities: [
    'name',
    'territorialAreaKm2',
    'urbanizedAreaKm2',
    'population',
    'populationYear',
    'populationDensity',
    'densityYear',
    'lat',
    'lng',
    'sourceLabel',
    'validationStatus',
    // Observação do município — conteúdo editorial, não nota interna.
    'note',
  ],
  goals: [
    'name',
    'baseline',
    'currentResult',
    'expectedResult',
    'deadline',
    'scope',
    'executionStatus',
    'methodology',
    'sourceLabel',
    // Data de referência: sem ela o cidadão não distingue meta revisada de meta antiga.
    'dataDate',
  ],
  infrastructures: [
    'name',
    'quantityLabel',
    'unit',
    'sourceLabel',
    'validationStatus',
    'hasDivergentSources',
    'note',
    // Exceção documentada em EXCECOES_AO_NEVER_PUBLIC.
    'legacyStatus',
  ],
  documents: [
    'title',
    'description',
    'category',
    'year',
    'organization',
    'format',
    'size',
    'url',
    'linkStatus',
    // 'version' NÃO entra: o campo de domínio "versão do documento" colidiu com
    // o `version` do envelope — o contador de concorrência otimista — e o
    // envelope venceu na migração. Publicá-lo mostraria ao cidadão "v.1"
    // significando "editado uma vez". Ver runbook: exige renomear o campo de
    // domínio e remigrar a coleção.
  ],
  /**
   * Glossário: sigla e significado. Não há o que proteger — é vocabulário.
   */
  glossary: ['acronym', 'meaning'],

  /**
   * Alegações de valor — o que cada fonte afirma sobre um mesmo campo.
   *
   * A lista é deliberadamente curta. Ela reconstrói exatamente o par
   * "fonte: valor" que o portal já exibe hoje a partir do bundle, mais a
   * ligação com a entidade de origem. Publicar isto é **paridade**, não
   * divulgação nova.
   *
   * Ficam de fora `confidenceScore` e `notes`: hoje são nulos em todos os
   * registros migrados, mas são campos de avaliação interna. Se um dia
   * receberem conteúdo, não devem atravessar por inércia de uma decisão
   * tomada quando estavam vazios.
   */
  evidence: ['entityType', 'entityId', 'fieldPath', 'value', 'unit', 'sourceDocumentId'],

  inconsistencies: [
    'title',
    'category',
    'description',
    'impact',
    'validationStatus',
    'accountableArea',
    'nextStep',
    'hasDivergentSources',
    // Idem. Uma inconsistência sem data não diz se ainda vale.
    'dataDate',
    // Exceção documentada em EXCECOES_AO_NEVER_PUBLIC.
    'legacyStatus',
  ],
};

/**
 * Campos internos que, se algum dia aparecerem numa allowlist por engano,
 * devem falhar o teste em vez de vazar em produção.
 */
export const NEVER_PUBLIC = [
  'updatedBy',
  'createdBy',
  'changeReason',
  'lastEventId',
  'legacyStatus',
  'legacyTypeStatus',
  'legacyValidationStatus',
  'internalNotes',
  'contactEmail',
  'ownerUid',
  'teamUids',
  'workspaceId',
];

/**
 * Metadados de rastreabilidade que acompanham todo documento público — a lista
 * é exaustiva.
 *
 * A allowlist acima protege os campos que vêm do documento interno. Ela não
 * protege o que a camada de publicação acrescenta **depois** de sanitizar, e foi
 * exatamente por aí que o `publishedBy` escapou: o UID do proprietário ficou
 * legível por qualquer visitante, contradizendo a promessa de que
 * identificadores de usuário nunca atravessam.
 *
 * Quem publicou fica registrado em `publicationReleases`, na área interna. O
 * cidadão precisa saber de qual release o dado veio, não de quem apertou o
 * botão.
 */
export const PUBLIC_METADATA_FIELDS = [
  'sourceEntityId',
  'sourceVersion',
  'releaseId',
  'publishedAt',
] as const;

/**
 * Exceções deliberadas a NEVER_PUBLIC, por coleção.
 *
 * A proibição global continua valendo em todo o resto: um campo listado aqui
 * atravessa **apenas** na coleção nomeada, e apenas porque alguém decidiu.
 * Remover a entrada de NEVER_PUBLIC seria mais simples e muito pior — o campo
 * passaria a poder vazar em qualquer coleção, por descuido, sem decisão.
 *
 * `legacyStatus` guarda o valor original da coluna de situação. Foi proibido
 * por ser artefato de migração, mas o conteúdo dele é o texto que o portal
 * exibe publicamente desde sempre.
 *
 * A alternativa era reconstruí-lo a partir dos campos publicados, e ela tem um
 * piso: a coluna legada é um valor único sorteado de três famílias — execução,
 * validação e atualidade —, e a migração a espalhou em quatro campos
 * preenchendo defaults. Pior, em infraestruturas com divergência o
 * `validationStatus` é sobrescrito para 'divergent', apagando o original.
 * Quatro tentativas de reconstrução produziram rótulos falsos, entre eles
 * "dado municipal declarado" para dados que ninguém declarou.
 *
 * Decidido em 15/08/2026: num portal de transparência, publicar o valor real
 * vale mais que preservar a pureza de uma lista contra um campo cujo conteúdo
 * já é público.
 */
export const EXCECOES_AO_NEVER_PUBLIC: Partial<Record<PublicCollection, string[]>> = {
  projects: ['legacyStatus'],
  infrastructures: ['legacyStatus'],
  inconsistencies: ['legacyStatus'],
};

export class SanitizationError extends Error {}

export interface PublicProjection {
  sourceEntityId: string;
  sourceVersion: number;
  releaseId: string;
  /** Campos aprovados, já filtrados. */
  data: Record<string, unknown>;
  /** Campos descartados — vão para o relatório do release, não para o público. */
  dropped: string[];
}

export function sanitizeForPublication(
  collection: PublicCollection,
  internal: Record<string, unknown>,
  context: { sourceEntityId: string; sourceVersion: number; releaseId: string },
): PublicProjection {
  const allowlist = PUBLIC_ALLOWLIST[collection];
  if (!allowlist) {
    throw new SanitizationError(
      `Sem allowlist definida para "${collection}". Nenhuma coleção é publicada por padrão.`,
    );
  }

  const excecoes = EXCECOES_AO_NEVER_PUBLIC[collection] ?? [];
  const vazamento = allowlist.filter(
    (field) => NEVER_PUBLIC.includes(field) && !excecoes.includes(field),
  );
  if (vazamento.length > 0) {
    throw new SanitizationError(
      `A allowlist de "${collection}" inclui campo interno: ${vazamento.join(', ')}.`,
    );
  }

  const data: Record<string, unknown> = {};
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(internal)) {
    if (allowlist.includes(key)) {
      data[key] = value;
    } else {
      dropped.push(key);
    }
  }

  return {
    sourceEntityId: context.sourceEntityId,
    sourceVersion: context.sourceVersion,
    releaseId: context.releaseId,
    data,
    dropped: dropped.sort(),
  };
}

// ------------------------------------------------------ fluxo de publicação

export const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  changes_requested: 'Ajustes solicitados',
  approved: 'Aprovado',
  published: 'Publicado',
  archived: 'Arquivado',
};

/** Quem pode fazer cada transição. A regra real está nas Security Rules. */
export const TRANSITIONS: Record<PublicationStatus, Array<{ to: PublicationStatus; roles: string[] }>> = {
  draft: [{ to: 'in_review', roles: ['owner', 'admin', 'editor'] }],
  in_review: [
    { to: 'approved', roles: ['owner', 'admin', 'reviewer'] },
    { to: 'changes_requested', roles: ['owner', 'admin', 'reviewer'] },
  ],
  changes_requested: [{ to: 'in_review', roles: ['owner', 'admin', 'editor'] }],
  // Publicar é exclusivo do proprietário — e isso é imposto pelas Rules,
  // não por esta tabela.
  approved: [{ to: 'published', roles: ['owner'] }, { to: 'draft', roles: ['owner', 'admin', 'editor'] }],
  published: [{ to: 'draft', roles: ['owner', 'admin', 'editor'] }, { to: 'archived', roles: ['owner'] }],
  archived: [],
};

export class PublicationTransitionError extends Error {}

export function assertPublicationTransition(
  from: PublicationStatus,
  to: PublicationStatus,
  role: string,
): void {
  const permitidas = TRANSITIONS[from] ?? [];
  const alvo = permitidas.find((t) => t.to === to);

  if (!alvo) {
    const opcoes = permitidas.map((t) => PUBLICATION_LABEL[t.to]);
    throw new PublicationTransitionError(
      opcoes.length === 0
        ? `De "${PUBLICATION_LABEL[from]}" não há transição possível.`
        : `Não se vai de "${PUBLICATION_LABEL[from]}" para "${PUBLICATION_LABEL[to]}". ` +
          `A partir daqui: ${opcoes.join(', ')}.`,
    );
  }

  if (!alvo.roles.includes(role)) {
    throw new PublicationTransitionError(
      to === 'published'
        ? 'Somente o proprietário publica. Revisar e aprovar não é publicar.'
        : `Seu perfil não pode levar de "${PUBLICATION_LABEL[from]}" para "${PUBLICATION_LABEL[to]}".`,
    );
  }
}

/** Um rascunho jamais é visível ao cidadão. */
export function isPubliclyVisible(status: PublicationStatus): boolean {
  return status === 'published';
}
