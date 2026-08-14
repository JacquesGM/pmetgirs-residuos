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
  | 'inconsistencies';

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
  ],
  axes: ['name', 'description', 'objective', 'accountable', 'executionStatus', 'relatedDocumentIds'],
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
  ],
  infrastructures: [
    'name',
    'quantityLabel',
    'unit',
    'sourceLabel',
    'validationStatus',
    'hasDivergentSources',
    'note',
  ],
  documents: ['title', 'description', 'category', 'year', 'organization', 'format', 'size', 'url', 'linkStatus', 'version'],
  inconsistencies: [
    'title',
    'category',
    'description',
    'impact',
    'validationStatus',
    'accountableArea',
    'nextStep',
    'hasDivergentSources',
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

export class SanitizationError extends Error {}

export interface PublicProjection {
  sourceEntityId: string;
  sourceVersion: number;
  releaseId: string;
  publishedBy: string;
  /** Campos aprovados, já filtrados. */
  data: Record<string, unknown>;
  /** Campos descartados — vão para o relatório do release, não para o público. */
  dropped: string[];
}

export function sanitizeForPublication(
  collection: PublicCollection,
  internal: Record<string, unknown>,
  context: { sourceEntityId: string; sourceVersion: number; releaseId: string; publishedBy: string },
): PublicProjection {
  const allowlist = PUBLIC_ALLOWLIST[collection];
  if (!allowlist) {
    throw new SanitizationError(
      `Sem allowlist definida para "${collection}". Nenhuma coleção é publicada por padrão.`,
    );
  }

  const vazamento = allowlist.filter((field) => NEVER_PUBLIC.includes(field));
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
    publishedBy: context.publishedBy,
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
