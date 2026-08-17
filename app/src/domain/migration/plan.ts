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
  Infraestrutura,
  Meta,
  Municipio,
  Projeto,
  TermoGlossario,
} from '../../types';
import { runIntegrityChecks } from './integrity';
import {
  transformAxis,
  transformDocument,
  transformGlossaryTerm,
  transformGoal,
  transformImport,
  transformInconsistency,
  transformIndicator,
  transformMunicipalIndicator,
  transformCostEstimate,
  transformDependency,
  transformGutTheme,
  transformInfrastructure,
  transformMilestone,
  transformMunicipality,
  transformProject,
} from './transform';
import type { EvidenceDraft, MigrationIssue, MigrationPlan, MigrationRecord, MigrationSources } from './types';

/**
 * Monta o plano de migração a partir dos 11 JSON.
 *
 * É a mesma função no dry-run e na importação real. Se o relatório viesse de
 * um caminho diferente do da escrita, ele não provaria nada.
 */

/**
 * Impressão digital da origem (FNV-1a de 32 bits).
 *
 * Serve para detectar que os JSON mudaram entre o dry-run e a importação.
 * NÃO é hash criptográfico e não protege contra adulteração deliberada —
 * protege contra a origem ter mudado sem ninguém notar.
 */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function buildMigrationPlan(sources: MigrationSources, workspaceId: string): MigrationPlan {
  const records: MigrationRecord[] = [];
  const evidence: EvidenceDraft[] = [];

  for (const item of sources.municipios as Municipio[]) records.push(transformMunicipality(item));
  for (const item of sources.eixos as Eixo[]) records.push(transformAxis(item));
  // A lista sai do próprio banco, não de uma constante: escrita à mão, ela
  // envelheceria em silêncio se a RMRJ mudasse de composição.
  const municipiosDaRmrj = (sources.municipios as Municipio[]).map((m) => m.id);

  for (const item of sources.projetos as Projeto[]) {
    records.push(transformProject(item, municipiosDaRmrj));
    // As dependências viram arestas próprias, e não só uma lista de ids dentro
    // do projeto: é a coleção `dependencies` que alimenta o grafo, a detecção
    // de ciclo e o cálculo do que pode começar agora.
    for (const predecessorId of item.dependencias) {
      records.push(transformDependency(item.id, predecessorId, item.fonte));
    }
  }
  for (const item of sources.metas as Meta[]) records.push(transformGoal(item));
  for (const item of sources.documentos as Documento[]) records.push(transformDocument(item));
  for (const item of sources.evolucao as EvolucaoEtapa[]) records.push(transformMilestone(item));
  for (const item of sources.glossario as TermoGlossario[]) records.push(transformGlossaryTerm(item));
  for (const item of sources.indicadoresMunicipais as IndicadorMunicipal[]) {
    records.push(transformMunicipalIndicator(item));
  }
  for (const item of sources.estimativasDeCusto as EstimativaDeCustoRegistro[]) {
    records.push(transformCostEstimate(item));
  }
  for (const item of sources.priorizacaoGut as TemaGut[]) {
    records.push(transformGutTheme(item));
  }
  for (const item of sources.atualizacoes as Atualizacao[]) records.push(transformImport(item));

  for (const item of sources.infraestruturas as Infraestrutura[]) {
    const result = transformInfrastructure(item);
    records.push(result.record);
    evidence.push(...result.evidence);
  }

  for (const item of sources.indicadores as Indicador[]) {
    const result = transformIndicator(item);
    records.push(result.record);
    evidence.push(...result.evidence);
  }

  const sourceAnomalies: MigrationIssue[] = [];
  for (const item of sources.inconsistencias as Inconsistencia[]) {
    const result = transformInconsistency(item);
    records.push(result.record);
    evidence.push(...result.evidence);
    if (result.anomaly) {
      sourceAnomalies.push({
        severity: 'warning',
        code: 'status_fora_da_familia_declarada',
        collection: 'inconsistencies',
        recordId: result.record.id,
        message: result.anomaly,
      });
    }
  }

  const sourceCounts: Record<string, number> = {
    municipios: sources.municipios.length,
    eixos: sources.eixos.length,
    projetos: sources.projetos.length,
    metas: sources.metas.length,
    infraestruturas: sources.infraestruturas.length,
    documentos: sources.documentos.length,
    inconsistencias: sources.inconsistencias.length,
    indicadores: sources.indicadores.length,
    evolucao: sources.evolucao.length,
    glossario: sources.glossario.length,
    indicadoresMunicipais: sources.indicadoresMunicipais.length,
    estimativasDeCusto: sources.estimativasDeCusto.length,
    priorizacaoGut: sources.priorizacaoGut.length,
    atualizacoes: sources.atualizacoes.length,
    // Cada id em `dependencias` vira exatamente uma aresta. Contá-los aqui
    // mantém a invariante de `checkRecordCount` — nem um a mais, nem a menos —
    // valendo também para os registros derivados.
    dependencias: (sources.projetos as Projeto[]).reduce(
      (soma, p) => soma + p.dependencias.length,
      0,
    ),
  };

  const totalSourceRecords = Object.values(sourceCounts).reduce((sum, n) => sum + n, 0);

  const plan: MigrationPlan = {
    workspaceId,
    sourceFingerprint: fingerprint(sources),
    sourceCounts,
    totalSourceRecords,
    records,
    evidence,
    issues: [],
  };

  plan.issues = [...runIntegrityChecks(plan), ...sourceAnomalies, ...collectGapNotices(plan)];
  return plan;
}

/**
 * Lacunas conhecidas viram avisos nomeados, para que apareçam no relatório em
 * vez de sumirem como campos nulos silenciosos.
 */
function collectGapNotices(plan: MigrationPlan): MigrationIssue[] {
  const notices: MigrationIssue[] = [];

  const semData = plan.records.filter((r) => r.gaps.includes('dataDate'));
  if (semData.length > 0) {
    notices.push({
      severity: 'warning',
      code: 'sem_data_de_referencia',
      message:
        `${semData.length} registros sem data de referência. O campo existe e é exibido na ` +
        'interface; enquanto estiver vazio, o visitante não distingue dado revisado de dado de 2024.',
    });
  }

  const semLink = plan.records.filter((r) => r.collection === 'documents' && r.gaps.includes('url'));
  if (semLink.length > 0) {
    notices.push({
      severity: 'warning',
      code: 'documento_sem_url',
      message:
        `${semLink.length} documentos oficiais sem URL. A biblioteca lista os volumes técnicos ` +
        'mas não os entrega — é a maior contradição aberta do portal.',
    });
  }

  const semLinhaBase = plan.records.filter(
    (r) => r.collection === 'goals' && r.gaps.includes('baseline'),
  );
  if (semLinhaBase.length > 0) {
    notices.push({
      severity: 'warning',
      code: 'meta_sem_linha_de_base',
      message:
        `${semLinhaBase.length} metas sem linha de base nem resultado atual. Há alvo e prazo, ` +
        'mas não há progresso a mostrar. Os números existem nos documentos técnicos.',
    });
  }

  const semPolitica = plan.records.filter(
    (r) => r.collection === 'inconsistencies' && r.gaps.includes('publicationPolicy'),
  );
  if (semPolitica.length > 0) {
    notices.push({
      severity: 'warning',
      code: 'inconsistencia_sem_politica_de_publicacao',
      message:
        `${semPolitica.length} inconsistências sem política de publicação registrada. As decisões ` +
        'existem em texto solto no Relatório de Inconsistências e dependem de definição do ' +
        'proprietário — a migração não as inventa.',
    });
  }

  const semExecucao = plan.records.filter((r) => r.gaps.includes('executionStatus'));
  if (semExecucao.length > 0) {
    notices.push({
      severity: 'info',
      code: 'execucao_indefinida',
      message:
        `${semExecucao.length} registros ficam sem situação de execução porque o status legado era ` +
        'do dado, não da execução. Deixá-los indefinidos é mais honesto que assumir "não iniciado".',
    });
  }

  return notices;
}
