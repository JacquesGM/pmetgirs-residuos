import type {
  Atualizacao,
  Documento,
  Eixo,
  EvolucaoEtapa,
  Inconsistencia,
  Indicador,
  Infraestrutura,
  Meta,
  Municipio,
  Projeto,
  TermoGlossario,
} from '../../types';
import { mapLegacyProjectStatus, mapLegacyValidationStatus, resolveLegacyStatus } from '../legacy';
import type { EvidenceDraft, MigrationRecord } from './types';

/**
 * Transformação dos JSON legados em registros de domínio.
 *
 * Três regras que valem para tudo aqui:
 *
 *  1. O ID legado é preservado como ID novo e repetido em `legacyId`. Links
 *     externos e URLs existentes continuam funcionando.
 *  2. Ausência permanece nula e é registrada em `gaps`. Nada vira 0, false ou
 *     string vazia para "ficar bonito" num gráfico.
 *  3. Onde a origem traz dois valores para o mesmo campo, saem duas
 *     EvidenceClaim e o agregado fica `divergent`. A migração não escolhe
 *     número.
 */

/** Normaliza para busca: minúsculas, sem acento. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function slugify(value: string): string {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function gapsFor(entries: Record<string, unknown>): string[] {
  return Object.entries(entries)
    .filter(([, value]) => value === null || value === undefined || value === '')
    .map(([key]) => key);
}

// --------------------------------------------------------------- municípios

export function transformMunicipality(m: Municipio): MigrationRecord {
  const mapped = mapLegacyValidationStatus(m.statusDados);
  return {
    collection: 'municipalities',
    id: m.id,
    legacyId: m.id,
    data: {
      name: m.nome,
      nameNormalized: normalizeName(m.nome),
      territorialAreaKm2: m.areaTerritorialKm2,
      urbanizedAreaKm2: m.areaUrbanizadaKm2,
      population: m.populacao,
      populationYear: m.populacaoAno,
      populationDensity: m.densidadeDemografica,
      // Anos diferentes convivem porque a fonte é assim. Guardar os dois
      // impede a leitura errada de comparar 2010 com 2021 sem perceber.
      densityYear: m.densidadeAno,
      lat: m.lat,
      lng: m.lng,
      sourceLabel: m.fonte,
      sourceType: mapped.sourceType ?? 'official',
      validationStatus: mapped.validation ?? 'validated',
      actualityStatus: mapped.actuality ?? 'historical',
      legacyStatus: mapped.legacyStatus,
      note: m.observacao,
    },
    gaps: gapsFor({ note: m.observacao }),
  };
}

// -------------------------------------------------------------------- eixos

export function transformAxis(e: Eixo): MigrationRecord {
  const mapped = mapLegacyProjectStatus(e.situacao);
  return {
    collection: 'axes',
    id: e.id,
    legacyId: e.id,
    data: {
      name: e.nome,
      nameNormalized: normalizeName(e.nome),
      description: e.descricao,
      objective: e.objetivo,
      accountable: e.responsavel,
      executionStatus: mapped.execution ?? null,
      validationStatus: mapped.validation ?? 'not_assessed',
      actualityStatus: 'no_date',
      legacyStatus: mapped.legacyStatus,
      relatedIndicatorIds: e.indicadoresRelacionados,
      relatedDocumentIds: e.documentosRelacionados,
    },
    gaps: mapped.execution ? [] : ['executionStatus'],
  };
}

// ----------------------------------------------------------------- projetos

export function transformProject(p: Projeto): MigrationRecord {
  const mapped = mapLegacyProjectStatus(p.status);
  return {
    collection: 'projects',
    id: p.id,
    legacyId: p.id,
    data: {
      name: p.nome,
      nameNormalized: normalizeName(p.nome),
      slug: slugify(p.nome),
      axisId: p.eixo,
      description: p.descricao,
      territorialScale: p.abrangencia,
      accountable: p.responsavel,
      participants: p.participantes,
      executionStatus: mapped.execution ?? null,
      validationStatus: mapped.validation ?? 'not_assessed',
      actualityStatus: p.ultimaAtualizacao ? 'current' : 'no_date',
      publicationStatus: 'published',
      legacyStatus: mapped.legacyStatus,
      // Nunca calculado: o Plano de Ações não define metodologia de avanço.
      progressPercent: p.percentualAvanco,
      plannedStart: p.inicioPrevisto,
      plannedEnd: p.terminoPrevisto,
      dataDate: p.ultimaAtualizacao,
      nextSteps: p.proximosPassos,
      dependencies: p.dependencias,
      risks: p.riscos,
      relatedDocumentIds: p.documentosRelacionados,
      sourceLabel: p.fonte,
      currency: 'BRL',
      costCategory: 'not_informed',
      capexMinCents: null,
      capexMaxCents: null,
      annualOpexCents: null,
      timeHorizon: 'not_informed',
      priorityScore: null,
      socialImpactScore: null,
    },
    gaps: gapsFor({
      progressPercent: p.percentualAvanco,
      plannedStart: p.inicioPrevisto,
      plannedEnd: p.terminoPrevisto,
      dataDate: p.ultimaAtualizacao,
    }).concat(mapped.execution ? [] : ['executionStatus']),
  };
}

// -------------------------------------------------------------------- metas

export function transformGoal(m: Meta): MigrationRecord {
  const mapped = mapLegacyProjectStatus(m.situacao);
  return {
    collection: 'goals',
    id: m.id,
    legacyId: m.id,
    data: {
      name: m.nome,
      nameNormalized: normalizeName(m.nome),
      // Linha de base e resultado atual seguem nulos: existem nos documentos
      // técnicos, mas não foram transpostos. Sem eles não há progresso a
      // exibir, só alvo — e é isso que o relatório aponta.
      baseline: m.linhaBase,
      currentResult: m.resultadoAtual,
      expectedResult: m.resultadoEsperado,
      deadline: m.prazo,
      scope: m.municipios,
      executionStatus: mapped.execution ?? null,
      validationStatus: mapped.validation ?? 'not_assessed',
      actualityStatus: m.ultimaAtualizacao ? 'current' : 'no_date',
      legacyStatus: mapped.legacyStatus,
      methodology: m.metodologia,
      sourceLabel: m.fonte,
      dataDate: m.ultimaAtualizacao,
    },
    gaps: gapsFor({
      baseline: m.linhaBase,
      currentResult: m.resultadoAtual,
      methodology: m.metodologia,
      dataDate: m.ultimaAtualizacao,
    }),
  };
}

// ----------------------------------------------------------- infraestrutura

export function transformInfrastructure(i: Infraestrutura): {
  record: MigrationRecord;
  evidence: EvidenceDraft[];
} {
  const mapped = mapLegacyValidationStatus(i.statusValidacao);
  const divergentes = i.valoresDivergentes ?? [];

  // Cada fonte vira uma alegação própria. O agregado só é marcado como
  // divergente quando há mais de uma — não se declara divergência sozinha.
  const evidence: EvidenceDraft[] = divergentes.map((v, index) => ({
    id: `${i.id}--claim-${index + 1}`,
    entityType: 'infrastructures',
    entityId: i.id,
    fieldPath: 'quantity',
    value: v.valor,
    unit: i.unidade,
    sourceType: 'official',
    sourceDocumentId: v.fonte,
    referenceDate: null,
    confidenceScore: null,
    validationStatus: divergentes.length > 1 ? 'divergent' : 'in_validation',
    notes: null,
  }));

  return {
    record: {
      collection: 'infrastructures',
      id: i.id,
      legacyId: i.id,
      data: {
        name: i.nome,
        nameNormalized: normalizeName(i.nome),
        quantityLabel: i.quantidade,
        unit: i.unidade,
        sourceLabel: i.fonte,
        sourceType: mapped.sourceType ?? 'technical_estimate',
        validationStatus: divergentes.length > 1 ? 'divergent' : (mapped.validation ?? 'not_assessed'),
        actualityStatus: mapped.actuality ?? 'no_date',
        legacyStatus: mapped.legacyStatus,
        hasDivergentSources: divergentes.length > 1,
        note: i.observacao,
      },
      gaps: gapsFor({ note: i.observacao }),
    },
    evidence,
  };
}

// -------------------------------------------------------------- indicadores

export function transformIndicator(ind: Indicador): {
  record: MigrationRecord;
  evidence: EvidenceDraft[];
} {
  const tipo = mapLegacyValidationStatus(ind.tipoDado);
  const validacao = mapLegacyValidationStatus(ind.statusValidacao);

  const evidence: EvidenceDraft[] = [
    {
      id: `${ind.id}--claim-1`,
      entityType: 'indicators',
      entityId: ind.id,
      fieldPath: 'value',
      value: ind.valor,
      unit: ind.unidade,
      sourceType: tipo.sourceType ?? 'technical_estimate',
      sourceDocumentId: ind.fonte,
      referenceDate: ind.ultimaAtualizacao,
      confidenceScore: null,
      validationStatus: validacao.validation ?? 'not_assessed',
      notes: ind.observacao,
    },
  ];

  return {
    record: {
      collection: 'indicators',
      id: ind.id,
      legacyId: ind.id,
      data: {
        name: ind.nome,
        nameNormalized: normalizeName(ind.nome),
        value: ind.valor,
        displayValue: ind.valorExibicao,
        unit: ind.unidade,
        referencePeriod: ind.periodoReferencia,
        sourceLabel: ind.fonte,
        sourceType: tipo.sourceType ?? 'technical_estimate',
        validationStatus: validacao.validation ?? 'not_assessed',
        actualityStatus: validacao.actuality ?? (ind.ultimaAtualizacao ? 'current' : 'no_date'),
        legacyTypeStatus: tipo.legacyStatus,
        legacyValidationStatus: validacao.legacyStatus,
        dataDate: ind.ultimaAtualizacao,
        note: ind.observacao,
      },
      gaps: gapsFor({ dataDate: ind.ultimaAtualizacao }),
    },
    evidence,
  };
}

// ------------------------------------------------------------ inconsistências

export function transformInconsistency(inc: Inconsistencia): {
  record: MigrationRecord;
  evidence: EvidenceDraft[];
  /** Preenchido quando o status de origem não pertence à família declarada. */
  anomaly: string | null;
} {
  // O tipo declara StatusValidacao, mas há registro com 'em_estruturacao',
  // que é situação de execução. Resolver pelas duas famílias e relatar.
  const mapped = resolveLegacyStatus(inc.situacao, 'validation');
  const anomaly =
    mapped === null
      ? `Status desconhecido em inconsistencias.json: "${inc.situacao}"`
      : mapped.outOfDeclaredFamily
        ? `Status "${inc.situacao}" é de execução, mas o campo declara situação de validação`
        : null;

  const fontes = inc.fontes ?? [];

  const evidence: EvidenceDraft[] = fontes.map((f, index) => ({
    id: `${inc.id}--claim-${index + 1}`,
    entityType: 'inconsistencies',
    entityId: inc.id,
    fieldPath: 'claimedValue',
    value: f.valor,
    unit: null,
    sourceType: 'official',
    sourceDocumentId: f.fonte,
    referenceDate: null,
    confidenceScore: null,
    validationStatus: fontes.length > 1 ? 'divergent' : 'in_validation',
    notes: null,
  }));

  return {
    record: {
      collection: 'inconsistencies',
      id: inc.id,
      legacyId: inc.id,
      data: {
        title: inc.titulo,
        nameNormalized: normalizeName(inc.titulo),
        category: inc.categoria,
        description: inc.descricao,
        impact: inc.impacto,
        validationStatus: mapped?.validation ?? 'in_validation',
        actualityStatus: mapped?.actuality ?? 'no_date',
        executionStatus: mapped?.execution ?? null,
        legacyStatus: inc.situacao,
        accountableArea: inc.areaResponsavel,
        nextStep: inc.encaminhamento,
        dataDate: inc.ultimaAtualizacao,
        hasDivergentSources: fontes.length > 1,
        // Decisão editorial sobre divulgar ou não cada achado. Está registrada
        // apenas no Relatório de Inconsistências, em texto solto, e depende de
        // decisão do proprietário — por isso fica nula e é apontada como lacuna.
        publicationPolicy: null,
      },
      gaps: gapsFor({
        nextStep: inc.encaminhamento,
        dataDate: inc.ultimaAtualizacao,
      }).concat('publicationPolicy'),
    },
    evidence,
    anomaly,
  };
}

// ---------------------------------------------------------------- documentos

export function transformDocument(d: Documento): MigrationRecord {
  return {
    collection: 'documents',
    id: d.id,
    legacyId: d.id,
    data: {
      title: d.titulo,
      nameNormalized: normalizeName(d.titulo),
      description: d.descricao,
      category: d.categoria,
      year: d.ano,
      organization: d.orgao,
      format: d.formato,
      size: d.tamanho,
      // Sem URL o documento não é acessível ao cidadão. Fica explícito em vez
      // de nulo silencioso.
      url: d.link,
      linkStatus: d.link ? 'available' : 'pending',
      version: d.versao,
    },
    gaps: d.link ? [] : ['url'],
  };
}

// ------------------------------------------------------------------ evolução

export function transformMilestone(e: EvolucaoEtapa): MigrationRecord {
  const mapped = mapLegacyProjectStatus(e.situacao);
  return {
    collection: 'milestones',
    id: e.id,
    legacyId: e.id,
    data: {
      title: e.titulo,
      nameNormalized: normalizeName(e.titulo),
      period: e.periodo,
      description: e.descricao,
      executionStatus: mapped.execution ?? null,
      validationStatus: mapped.validation ?? 'not_assessed',
      legacyStatus: mapped.legacyStatus,
      sourceLabel: e.fonte,
    },
    gaps: mapped.execution ? [] : ['executionStatus'],
  };
}

// ------------------------------------------------------------------ glossário

export function transformGlossaryTerm(t: TermoGlossario): MigrationRecord {
  const id = slugify(t.sigla);
  return {
    collection: 'glossary',
    id,
    legacyId: t.sigla,
    data: {
      acronym: t.sigla,
      nameNormalized: normalizeName(t.sigla),
      meaning: t.significado,
    },
    gaps: [],
  };
}

// --------------------------------------------------------------- atualizações

export function transformImport(a: Atualizacao): MigrationRecord {
  return {
    collection: 'imports',
    id: a.id,
    legacyId: a.id,
    data: {
      date: a.data,
      description: a.descricao,
      sourceLabel: a.fonte,
      affectedFiles: a.arquivosAfetados,
    },
    gaps: [],
  };
}
