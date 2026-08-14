import { describe, expect, it } from 'vitest';
import atualizacoes from '../../data/atualizacoes.json';
import documentos from '../../data/documentos.json';
import eixos from '../../data/eixos.json';
import evolucao from '../../data/evolucao.json';
import glossario from '../../data/glossario.json';
import inconsistencias from '../../data/inconsistencias.json';
import indicadores from '../../data/indicadores.json';
import infraestruturas from '../../data/infraestruturas.json';
import metas from '../../data/metas.json';
import municipios from '../../data/municipios.json';
import projetos from '../../data/projetos.json';
import { buildMigrationPlan, fingerprint } from './plan';
import type { MigrationSources } from './types';

const sources: MigrationSources = {
  municipios,
  eixos,
  projetos,
  metas,
  infraestruturas,
  documentos,
  inconsistencias,
  indicadores,
  evolucao,
  glossario,
  atualizacoes,
};

const plan = buildMigrationPlan(sources, 'pmetgirs-rmrj');
const errors = plan.issues.filter((i) => i.severity === 'error');

describe('reconciliação dos registros', () => {
  it('a origem tem 96 registros', () => {
    expect(plan.totalSourceRecords).toBe(96);
  });

  it('o plano produz exatamente um registro por registro de origem', () => {
    expect(plan.records).toHaveLength(96);
  });

  it('não perde nem duplica nenhuma coleção', () => {
    const porColecao = plan.records.reduce<Record<string, number>>((acc, r) => {
      acc[r.collection] = (acc[r.collection] ?? 0) + 1;
      return acc;
    }, {});

    expect(porColecao).toEqual({
      municipalities: 22,
      axes: 12,
      projects: 10,
      goals: 5,
      infrastructures: 7,
      documents: 3,
      inconsistencies: 9,
      indicators: 8,
      milestones: 9,
      glossary: 10,
      imports: 1,
    });
  });

  it('preserva todos os IDs legados', () => {
    const semLegacy = plan.records.filter((r) => !r.legacyId);
    expect(semLegacy).toEqual([]);
  });

  it('usa o ID legado como ID novo, para não quebrar links existentes', () => {
    const projeto = plan.records.find((r) => r.collection === 'projects' && r.id === 'plano-negocios-pmetgirs');
    expect(projeto).toBeDefined();
    expect(projeto?.legacyId).toBe('plano-negocios-pmetgirs');
  });
});

describe('integridade', () => {
  it('não acusa nenhum erro bloqueante', () => {
    expect(errors.map((e) => `${e.code}: ${e.message}`)).toEqual([]);
  });

  it('todo projeto aponta para um eixo existente', () => {
    expect(errors.filter((e) => e.code === 'eixo_inexistente')).toEqual([]);
  });

  it('nenhuma ausência foi convertida em zero', () => {
    expect(errors.filter((e) => e.code === 'ausencia_virou_zero')).toEqual([]);
  });
});

describe('valores divergentes viram alegações separadas', () => {
  it('as unidades térmicas guardam as duas fontes, sem escolher uma', () => {
    const combustao = plan.evidence.filter(
      (c) => c.entityId === 'unidades-combustao' && c.fieldPath === 'quantity',
    );
    expect(combustao).toHaveLength(2);
    expect(combustao.every((c) => c.validationStatus === 'divergent')).toBe(true);

    const fontes = combustao.map((c) => c.sourceDocumentId);
    expect(fontes.some((f) => f.startsWith('Plano de Ações'))).toBe(true);
    expect(fontes.some((f) => f.startsWith('Prognóstico'))).toBe(true);
  });

  it('a divergência de geração diária preserva os dois números', () => {
    const geracao = plan.evidence.filter((c) => c.entityId === 'divergencia-geracao-diaria');
    expect(geracao).toHaveLength(2);
    const valores = geracao.map((c) => String(c.value));
    expect(valores.some((v) => v.includes('16.926'))).toBe(true);
    expect(valores.some((v) => v.includes('16.929'))).toBe(true);
  });

  it('não marca divergência onde só existe uma fonte', () => {
    const semDivergencia = plan.records.filter(
      (r) => r.collection === 'infrastructures' && r.data.hasDivergentSources === false,
    );
    expect(semDivergencia.length).toBeGreaterThan(0);
    for (const record of semDivergencia) {
      expect(record.data.validationStatus).not.toBe('divergent');
    }
  });
});

describe('separação das dimensões de estado', () => {
  it('tira dado_em_validacao da execução, sem inventar "não iniciado"', () => {
    const licitacao = plan.records.find(
      (r) => r.collection === 'projects' && r.id === 'licitacao-usinas-recuperacao-energetica',
    );
    expect(licitacao?.data.legacyStatus).toBe('dado_em_validacao');
    expect(licitacao?.data.executionStatus).toBeNull();
    expect(licitacao?.data.validationStatus).toBe('in_validation');
    expect(licitacao?.gaps).toContain('executionStatus');
  });

  it('desdobra o status oficial dos municípios em origem e validação', () => {
    const municipio = plan.records.find((r) => r.collection === 'municipalities');
    expect(municipio?.data.sourceType).toBe('official');
    expect(municipio?.data.validationStatus).toBe('validated');
  });
});

describe('lacunas relatadas, não preenchidas', () => {
  it('aponta os 3 documentos sem URL', () => {
    const aviso = plan.issues.find((i) => i.code === 'documento_sem_url');
    expect(aviso?.message).toContain('3 documentos');
  });

  it('aponta as 5 metas sem linha de base', () => {
    const aviso = plan.issues.find((i) => i.code === 'meta_sem_linha_de_base');
    expect(aviso?.message).toContain('5 metas');
  });

  it('aponta as inconsistências sem política de publicação definida', () => {
    const aviso = plan.issues.find((i) => i.code === 'inconsistencia_sem_politica_de_publicacao');
    expect(aviso?.message).toContain('9 inconsistências');
  });

  it('mantém nulos os campos ausentes de metas', () => {
    const meta = plan.records.find((r) => r.collection === 'goals');
    expect(meta?.data.baseline).toBeNull();
    expect(meta?.data.currentResult).toBeNull();
    expect(meta?.data.baseline).not.toBe(0);
    expect(meta?.data.currentResult).not.toBe('');
  });
});

describe('impressão digital da origem', () => {
  it('é estável para a mesma entrada', () => {
    expect(fingerprint(sources)).toBe(plan.sourceFingerprint);
  });

  it('muda quando qualquer dado muda', () => {
    const alterado = { ...sources, metas: [...(metas as unknown[]), { id: 'nova' }] };
    expect(fingerprint(alterado)).not.toBe(plan.sourceFingerprint);
  });
});
