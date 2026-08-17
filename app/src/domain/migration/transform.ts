import type {
  Atualizacao,
  Documento,
  Eixo,
  EvolucaoEtapa,
  Inconsistencia,
  Indicador,
  IndicadorMunicipal,
  EstimativaDeCustoRegistro,
  TemaGut,
  CentralDeTratamento,
  ViabilidadeEconomica,
  Vazadouro,
  ComponenteRsu,
  Infraestrutura,
  Meta,
  Municipio,
  Projeto,
  TermoGlossario,
} from '../../types';
import { mapLegacyProjectStatus, mapLegacyValidationStatus, resolveLegacyStatus } from '../legacy';
import type { EvidenceDraft, MigrationRecord } from './types';
import { categoriaDe, validarEstimativa } from '../costEstimate';
// A regra da abrangência mora fora da migração de propósito: o portal a aplica
// sobre o dado embutido, que não passa por aqui. Uma cópia em cada lado
// divergiria em silêncio.
import { municipiosDoProjeto } from '../abrangencia';

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

export function transformProject(p: Projeto, municipiosDaRmrj: string[]): MigrationRecord {
  const mapped = mapLegacyProjectStatus(p.status);
  const municipalityIds = municipiosDoProjeto(p.abrangencia, municipiosDaRmrj);
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
      // A abrangência em texto continua gravada como a fonte a escreveu; esta
      // é a leitura estruturada dela, e as duas convivem para que a conferência
      // contra o documento continue possível.
      municipalityIds,
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
      municipalityIds,
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
      // Coluna "Objetivos Gerais" das tabelas OKR/SMART: várias metas
      // compartilham o mesmo objetivo, e é por ele que elas se agrupam.
      generalObjective: m.objetivoGeral,
      // Coluna "Responsáveis". Sem ela a meta diz o que fazer e omite de quem
      // é a entrega — que é exatamente o achado INC-13 do Relatório.
      responsibleParties: m.responsaveis,
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

  // O catálogo do SNIS não gera alegação de valor: não há valor algum a
  // alegar. Criar 48 claims nulas encheria a auditoria de ruído e faria
  // parecer que alguém mediu e não encontrou.
  const evidence: EvidenceDraft[] = ind.natureza === 'catalogo_snis' ? [] : [
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
        // Separa número apurado de definição a observar. Ver NaturezaIndicador.
        nature: ind.natureza,
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
        reportCode: inc.codigoRelatorio,
        findingOrigin: inc.origemDoAchado,
        // Decisão editorial sobre divulgar ou não cada achado. Vem da matriz
        // consolidada do Relatório de Inconsistências, onde cada linha carrega
        // a sua anotação. Continua sendo lacuna enquanto estiver nula.
        publicationPolicy: inc.tratamentoEditorial,
      },
      gaps: gapsFor({
        nextStep: inc.encaminhamento,
        dataDate: inc.ultimaAtualizacao,
      }).concat(
        // A lacuna só faz sentido para achado que consta do Relatório: é lá
        // que a decisão de divulgação deveria estar anotada. Achado nosso não
        // tem anotação a preencher, e cobrar uma seria alarme falso.
        inc.codigoRelatorio !== null && inc.tratamentoEditorial === null
          ? ['publicationPolicy']
          : [],
      ),
    },
    evidence,
    anomaly,
  };
}

// ------------------------------------------------- indicadores municipais

/**
 * Cada linha das tabelas municipais do Diagnóstico vira um registro próprio.
 *
 * Não gera alegação de valor: aqui existe uma fonte por valor, e alegação com
 * fonte única não é divergência — é só o dado. A exceção declarada no arquivo
 * de origem (a despesa de Niterói) chega com `informacao_divergente` e a
 * ressalva no campo de observação.
 */
export function transformMunicipalIndicator(i: IndicadorMunicipal): MigrationRecord {
  const mapped = mapLegacyValidationStatus(i.statusValidacao);
  return {
    collection: 'municipalIndicators',
    id: i.id,
    legacyId: i.id,
    data: {
      municipalityId: i.municipioId,
      indicator: i.indicador,
      name: i.nome,
      nameNormalized: normalizeName(i.nome),
      value: i.valor,
      displayValue: i.valorExibicao,
      unit: i.unidade,
      referencePeriod: i.periodoReferencia,
      sourceLabel: i.fonte,
      sourceType: mapped.sourceType ?? 'municipal_declared',
      validationStatus: mapped.validation ?? 'in_validation',
      actualityStatus: mapped.actuality ?? 'historical',
      legacyStatus: mapped.legacyStatus,
      note: i.observacao,
    },
    gaps: gapsFor({ value: i.valor, note: i.observacao }),
  };
}

// ------------------------------------------- composição gravimétrica do RSU

export function transformWasteComponent(c: ComponenteRsu): MigrationRecord {
  return {
    collection: 'wasteComposition',
    id: c.id,
    legacyId: c.id,
    data: {
      name: c.nome,
      nameNormalized: normalizeName(c.nome),
      group: c.grupo,
      groupLabel: c.grupoRotulo,
      percentage: c.percentual,
      percentageBase: c.baseDoPercentual,
      dailyTonnes: c.toneladasDia,
      displayOrder: c.ordem,
      sourceLabel: c.fonte,
      validationStatus: mapLegacyValidationStatus(c.statusValidacao).validation ?? 'estimated',
      note: c.observacao,
    },
    gaps: [],
  };
}

// ------------------------------------------------------------ vazadouros

/**
 * Vazadouro encerrado, com o estágio de remediação de cada etapa.
 *
 * `municipalityIds` guarda um único município em lista, e não um campo
 * escalar, para que a tela do mapa use o mesmo caminho de projetos e centrais
 * — três entidades diferentes ligadas ao município pelo mesmo campo.
 */
export function transformDumpsite(v: Vazadouro): MigrationRecord {
  return {
    collection: 'dumpsites',
    id: v.id,
    legacyId: v.id,
    data: {
      name: v.nome,
      nameNormalized: normalizeName(v.nome),
      municipalityIds: [v.municipioId],
      stage: v.estagio,
      firstStage: v.primeiraEtapa,
      primaryTreatment: v.tratamentoPrimario,
      secondaryTreatment: v.tratamentoSecundario,
      tertiaryTreatment: v.tratamentoTerciario,
      closureYear: v.anoEncerramento,
      sourceLabel: v.fonte,
      validationStatus: mapLegacyValidationStatus(v.statusValidacao).validation ?? 'validated',
      note: v.observacao,
    },
    gaps: gapsFor({
      closureYear: v.anoEncerramento,
      primaryTreatment: v.tratamentoPrimario,
      secondaryTreatment: v.tratamentoSecundario,
      tertiaryTreatment: v.tratamentoTerciario,
    }),
  };
}

// ------------------------------------------------ viabilidade econômica

/**
 * Cenário de investimento ou tecnologia, do EVTE do Prognóstico.
 *
 * Os valores em reais vão como número inteiro de reais, e não em centavos:
 * são estimativas de bilhões arredondadas na fonte, e converter para centavos
 * fingiria uma precisão de dois dígitos que o documento não tem.
 */
export function transformEconomicViability(v: ViabilidadeEconomica): MigrationRecord {
  return {
    collection: 'economicViability',
    id: v.id,
    legacyId: v.id,
    data: {
      name: v.nome,
      nameNormalized: normalizeName(v.nome),
      kind: v.tipo,
      dailyMswTonnes: v.rsuTdia,
      dailyCdwTonnes: v.crdTdia,
      dailyRecyclablesTonnes: v.reciclaveisTdia,
      combustionPlants: v.usinasCombustao,
      thermalDegradationPlants: v.usinasTermodegradacao,
      sortingPlants: v.usinasTriagem,
      totalCapexReais: v.capexTotalReais,
      annualRevenueReais: v.receitaAnualReais,
      capexPerPlantReais: v.capexPorUsinaReais,
      annualRevenuePerPlantReais: v.receitaAnualPorUsinaReais,
      annualOpexReais: v.opexAnualReais,
      sourceLabel: v.fonte,
      validationStatus: mapLegacyValidationStatus(v.statusValidacao).validation ?? 'estimated',
      note: v.observacao,
    },
    gaps: gapsFor({
      totalCapexReais: v.capexTotalReais,
      annualRevenueReais: v.receitaAnualReais,
      capexPerPlantReais: v.capexPorUsinaReais,
      annualOpexReais: v.opexAnualReais,
    }),
  };
}

// ------------------------------------------------ centrais de tratamento

/**
 * Central de Tratamento de Resíduos em operação.
 *
 * A infraestrutura que o portal mostrava era só a planejada — "25 usinas de
 * triagem", nenhuma construída. Estas quatro já operam, recebem resíduos de
 * dezenove dos vinte e dois municípios e não apareciam em lugar nenhum.
 *
 * `municipalityIds` reaproveita o mesmo campo dos projetos, o que faz a
 * central aparecer ligada ao município no mapa sem precisar de outra ligação.
 */
export function transformTreatmentCentral(c: CentralDeTratamento): MigrationRecord {
  return {
    collection: 'treatmentCentrals',
    id: c.id,
    legacyId: c.id,
    data: {
      name: c.nome,
      nameNormalized: normalizeName(c.nome),
      operator: c.operadora,
      hostMunicipalityId: c.municipioSede,
      address: c.endereco,
      operationStartDate: c.inicioOperacao,
      areaM2: c.areaM2,
      designCapacityTonnes: c.capacidadeProjetoToneladas,
      dailyCapacityTonnes: c.capacidadeDiariaTdia,
      annualCapacityTonnes: c.capacidadeAnualTano,
      averageDailyIntakeTonnes: c.recebimentoDiarioMedioTdia,
      usefulLifeYears: c.vidaUtilAnos,
      dailyLeachateM3: c.lixiviadoDiarioM3,
      leachateTechnology: c.tecnologiaChorume,
      biogasLabel: c.biogas,
      energyLabel: c.geracaoEnergia,
      carbonCreditsTco2e: c.creditoCarbonoTco2e,
      newCellCostPerM2: c.custoNovaCelulaPorM2,
      opexPerTonne: c.opexPorTonelada,
      leachateCostPerM3: c.custoTratamentoChorumePorM3,
      municipalityIds: c.municipiosAtendidos,
      servedOutsideRegion: c.municipiosAtendidosForaDaRmrj,
      sourceLabel: c.fonte,
      validationStatus: mapLegacyValidationStatus(c.statusValidacao).validation ?? 'validated',
      note: c.observacao,
    },
    gaps: gapsFor({
      operationStartDate: c.inicioOperacao,
      areaM2: c.areaM2,
      annualCapacityTonnes: c.capacidadeAnualTano,
      averageDailyIntakeTonnes: c.recebimentoDiarioMedioTdia,
      energyLabel: c.geracaoEnergia,
      opexPerTonne: c.opexPorTonelada,
      newCellCostPerM2: c.custoNovaCelulaPorM2,
      leachateCostPerM3: c.custoTratamentoChorumePorM3,
    }),
  };
}

// ---------------------------------------------------------------- dependências

/**
 * Arestas de precedência, a partir do campo `dependencias` dos projetos.
 *
 * O dado sempre esteve em `projetos.json`, mas só era gravado como uma lista
 * de ids dentro do documento do projeto — a coleção `dependencies`, que a tela
 * de Dependências lê, nunca recebia nada. A página mostrava "nenhuma
 * dependência registrada" com dois pares declarados na origem.
 *
 * `justification` cita a origem em vez de explicar a precedência: a origem
 * declara QUE a dependência existe, não POR QUE nem de que tipo. O tipo fica
 * `finish_to_start`, que é a leitura padrão do sistema, e o texto diz que essa
 * classificação é do sistema e não do documento.
 */
export function transformDependency(
  successorId: string,
  predecessorId: string,
  fonte: string,
): MigrationRecord {
  const id = `${predecessorId}--${successorId}`;
  return {
    collection: 'dependencies',
    id,
    legacyId: id,
    data: {
      predecessorId,
      successorId,
      type: 'finish_to_start',
      lagDays: 0,
      mandatory: true,
      justification:
        `${fonte}: a ação "${successorId}" declara dependência de "${predecessorId}". ` +
        'A origem declara a existência da dependência, não o seu tipo nem a sua razão; ' +
        'Término → Início é a leitura padrão do sistema, não uma afirmação do documento.',
      sharedResourceId: null,
    },
    // O documento não classifica o tipo nem justifica a precedência.
    gaps: ['type', 'lagDays'],
  };
}

// ------------------------------------------------------ estimativas de custo

/**
 * A faixa é derivada aqui, na migração, pelo mesmo `categoriaDe` que a
 * interface usa — para que arquivo e tela nunca discordem sobre em que faixa
 * um projeto está.
 *
 * `validarEstimativa` roda antes: valor sem ano-base e sem fonte é recusado.
 * A regra nasceu na tela de edição, e quando essa tela saiu — em 16/08/2026,
 * porque os valores vêm dos documentos e não de digitação — ela veio para cá.
 * A transcrição é agora o único caminho de entrada; se a regra não valesse
 * aqui, não valeria em lugar nenhum.
 */
export function transformCostEstimate(e: EstimativaDeCustoRegistro): MigrationRecord {
  const estimativa = {
    requiresNewDisbursement: e.requiresNewDisbursement,
    capexMinCents: e.capexMinCents,
    capexMaxCents: e.capexMaxCents,
    annualOpexCents: e.annualOpexCents,
    currency: e.currency,
    baseYear: e.baseYear,
    sourceLabel: e.sourceLabel,
    assumptions: e.assumptions,
    confidenceScore: e.confidenceScore,
    asOfDate: e.asOfDate,
    underEstimation: e.underEstimation,
  };
  validarEstimativa(estimativa);
  const costCategory = categoriaDe(estimativa);
  return {
    collection: 'costEstimates',
    id: e.id,
    legacyId: e.id,
    data: {
      entityCollection: 'projects',
      entityId: e.entityId,
      requiresNewDisbursement: e.requiresNewDisbursement,
      capexMinCents: e.capexMinCents,
      capexMaxCents: e.capexMaxCents,
      annualOpexCents: e.annualOpexCents,
      currency: e.currency,
      baseYear: e.baseYear,
      sourceLabel: e.sourceLabel,
      assumptions: e.assumptions,
      confidenceScore: e.confidenceScore,
      asOfDate: e.asOfDate,
      underEstimation: e.underEstimation,
      costCategory,
    },
    gaps: gapsFor({
      capexMinCents: e.capexMinCents,
      baseYear: e.baseYear,
      confidenceScore: e.confidenceScore,
    }),
  };
}

// ---------------------------------------------------------- matriz GUT

export function transformGutTheme(t: TemaGut): MigrationRecord {
  return {
    collection: 'gutPriorities',
    id: t.id,
    legacyId: t.id,
    data: {
      themeNumber: t.numero,
      name: t.tema,
      nameNormalized: normalizeName(t.tema),
      severity: t.gravidade,
      urgency: t.urgencia,
      trend: t.tendencia,
      score: t.pontuacao,
      printedScore: t.pontuacaoImpressa,
      ranking: t.ranking,
      relatedProjectIds: t.projetosRelacionados,
      sourceLabel: t.fonte,
      note: t.observacao,
      // Marca a única linha em que a multiplicação do documento não fecha.
      arithmeticMatches: t.pontuacao === t.pontuacaoImpressa,
    },
    gaps: t.projetosRelacionados.length === 0 ? ['relatedProjectIds'] : [],
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
