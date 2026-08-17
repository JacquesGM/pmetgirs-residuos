import { describe, expect, it } from 'vitest';
import atualizacoes from '../../data/atualizacoes.json';
import documentos from '../../data/documentos.json';
import eixos from '../../data/eixos.json';
import evolucao from '../../data/evolucao.json';
import glossario from '../../data/glossario.json';
import inconsistencias from '../../data/inconsistencias.json';
import indicadores from '../../data/indicadores.json';
import indicadoresMunicipais from '../../data/indicadoresMunicipais.json';
import estimativasDeCusto from '../../data/estimativasDeCusto.json';
import priorizacaoGut from '../../data/priorizacaoGut.json';
import infraestruturas from '../../data/infraestruturas.json';
import metas from '../../data/metas.json';
import municipios from '../../data/municipios.json';
import projetos from '../../data/projetos.json';
import { buildMigrationPlan, fingerprint } from './plan';
import { municipiosDoProjeto } from '../abrangencia';
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
  indicadoresMunicipais,
  estimativasDeCusto,
  priorizacaoGut,
  evolucao,
  glossario,
  atualizacoes,
};

const plan = buildMigrationPlan(sources, 'pmetgirs-rmrj');
const errors = plan.issues.filter((i) => i.severity === 'error');

describe('reconciliação dos registros', () => {
  it('a origem tem 457 registros', () => {
    expect(plan.totalSourceRecords).toBe(457);
  });

  it('o plano produz exatamente um registro por registro de origem', () => {
    expect(plan.records).toHaveLength(457);
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
      goals: 44,
      infrastructures: 7,
      documents: 3,
      inconsistencies: 13,
      municipalIndicators: 242,
      costEstimates: 10,
      gutPriorities: 16,
      // Derivadas do campo `dependencias` dos projetos, uma aresta por id.
      dependencies: 2,
      indicators: 56,
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
  it('as unidades térmicas guardam as três fontes, sem escolher uma', () => {
    // Eram duas até 16/08/2026. A leitura do Prognóstico mostrou um terceiro
    // valor — 10 usinas — e que a inversão 13/15 é interna ao Plano de Ações,
    // entre a sua tabela e o seu texto corrido.
    const combustao = plan.evidence.filter(
      (c) => c.entityId === 'unidades-combustao' && c.fieldPath === 'quantity',
    );
    expect(combustao).toHaveLength(3);
    expect(combustao.every((c) => c.validationStatus === 'divergent')).toBe(true);

    const valores = combustao.map((c) => String(c.value));
    for (const esperado of ['10 usinas', '13 usinas', '15 usinas']) {
      expect(valores.some((v) => v.startsWith(esperado)), `falta "${esperado}"`).toBe(true);
    }

    const fontes = combustao.map((c) => c.sourceDocumentId);
    expect(fontes.some((f) => f.startsWith('Plano de Ações'))).toBe(true);
    expect(fontes.some((f) => f.startsWith('Prognóstico'))).toBe(true);
  });

  it('o total de unidades térmicas deixou de ser publicado como número assentado', () => {
    // O portal publicava "28" afirmando que o total era consistente entre os
    // documentos. O Prognóstico propõe 20. Nenhum dos dois pode ser exibido
    // como se fosse o número.
    const total = plan.records.find(
      (r) => r.collection === 'infrastructures' && r.id === 'total-unidades-termicas',
    );
    expect(total?.data.hasDivergentSources).toBe(true);
    expect(String(total?.data.quantityLabel)).not.toMatch(/^[0-9]+$/);

    const claims = plan.evidence.filter((c) => c.entityId === 'total-unidades-termicas');
    const valores = claims.map((c) => String(c.value));
    expect(valores.some((v) => v.includes('20'))).toBe(true);
    expect(valores.some((v) => v.includes('28'))).toBe(true);
  });

  it('a divergência de geração diária preserva os três números', () => {
    const geracao = plan.evidence.filter((c) => c.entityId === 'divergencia-geracao-diaria');
    expect(geracao).toHaveLength(3);
    const valores = geracao.map((c) => String(c.value));
    for (const esperado of ['16.926', '16.929', '15.499']) {
      expect(valores.some((v) => v.includes(esperado)), `falta ${esperado}`).toBe(true);
    }
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
  it('a biblioteca entrega os três volumes, e não apenas os lista', () => {
    // Era a maior contradição aberta do portal: listar os volumes técnicos sem
    // entregá-los. Em 16/08/2026 as URLs foram encontradas no portal oficial do
    // IRM — não houve nada a hospedar, o Estado já publicava os arquivos.
    const aviso = plan.issues.find((i) => i.code === 'documento_sem_url');
    expect(aviso).toBeUndefined();

    const documentos = plan.records.filter((r) => r.collection === 'documents');
    expect(documentos).toHaveLength(3);
    for (const doc of documentos) {
      const url = String(doc.data.url);
      // Origem institucional, não um espelho nosso: o binário fica com quem
      // responde por ele, e o portal guarda apenas metadados e o endereço.
      expect(url, `${doc.id} fora do domínio oficial`).toMatch(/^https:\/\/www\.rj\.gov\.br\/irm\//);
      expect(doc.gaps, `${doc.id} ainda cobra URL`).not.toContain('url');
    }
  });

  it('aponta as 34 metas que seguem sem linha de base', () => {
    // Eram 44. Em 16/08/2026 dez receberam ponto de partida do Diagnóstico
    // Geral; as demais continuam nulas porque o documento não o declara.
    const aviso = plan.issues.find((i) => i.code === 'meta_sem_linha_de_base');
    expect(aviso?.message).toContain('34 metas');
  });

  it('a linha de base preenchida cita a tabela de origem e traz data de referência', () => {
    // Uma linha de base sem procedência é um número solto. Se um dia alguém
    // preencher "50%" sem dizer de onde veio, este teste reprova.
    const comBase = plan.records.filter(
      (r) => r.collection === 'goals' && r.data.baseline !== null,
    );
    expect(comBase).toHaveLength(10);
    for (const r of comBase) {
      expect(String(r.data.baseline), `${r.id} não cita a fonte`).toMatch(/Fonte: Diagnóstico Geral/);
      expect(r.data.dataDate, `${r.id} sem data de referência`).not.toBeNull();
      // O ponto de partida não é progresso: nenhuma meta ganha resultado atual.
      expect(r.data.currentResult, `${r.id} recebeu resultado atual`).toBeNull();
    }
  });

  it('a lacuna de política de publicação só vale para achado do Relatório', () => {
    // Os nove achados do Relatório têm a anotação da matriz; os quatro da
    // leitura das fontes não têm o que anotar, e cobrar deles seria alarme
    // falso. A lacuna some, mas por precisão, não por complacência.
    const aviso = plan.issues.find((i) => i.code === 'inconsistencia_sem_politica_de_publicacao');
    expect(aviso).toBeUndefined();

    const doRelatorio = plan.records.filter(
      (r) => r.collection === 'inconsistencies' && r.data.reportCode !== null,
    );
    expect(doRelatorio).toHaveLength(9);
    for (const r of doRelatorio) {
      expect(r.data.publicationPolicy, `${r.id} sem política`).not.toBeNull();
    }

    const daLeitura = plan.records.filter(
      (r) => r.collection === 'inconsistencies' && r.data.findingOrigin === 'leitura_das_fontes',
    );
    expect(daLeitura).toHaveLength(4);
    for (const r of daLeitura) {
      expect(r.data.reportCode, `${r.id} não deveria ter código`).toBeNull();
      expect(r.gaps, `${r.id} não deveria cobrar política`).not.toContain('publicationPolicy');
    }
  });

  it('registra a anotação da matriz sem deixá-la governar a publicação', () => {
    // A seção 6.13 do Prompt de Criação da SPA nomeia os nove achados e exige
    // que a divergência continue visível. A anotação do Relatório fica como
    // procedência: seis achados dizem "não disponibilizar" e são publicados
    // assim mesmo, por decisão de 16/08/2026.
    const marcados = plan.records.filter(
      (r) =>
        r.collection === 'inconsistencies' &&
        // Só o que veio do Relatório tem anotação a considerar.
        r.data.reportCode !== null &&
        !['definir_na_modelagem', 'divulgar_como_dado_de_epoca'].includes(
          r.data.publicationPolicy as string,
        ),
    );
    expect(marcados.map((r) => r.data.reportCode).sort()).toEqual([
      'INC-01', 'INC-03', 'INC-04', 'INC-06', 'INC-09', 'INC-16',
    ]);
    const total = plan.records.filter((r) => r.collection === 'inconsistencies');
    expect(total).toHaveLength(13);
  });

  it('não inventa valor para o catálogo de indicadores do SNIS', () => {
    // A Tabela 25 nomeia o que medir e não mede nada. Se um dia algum destes
    // aparecer com valor, veio de fora do documento.
    const catalogo = plan.records.filter(
      (r) => r.collection === 'indicators' && r.data.nature === 'catalogo_snis',
    );
    expect(catalogo).toHaveLength(48);
    for (const r of catalogo) {
      expect(r.data.value, `${r.id} não pode ter valor`).toBeNull();
      expect(r.data.unit, `${r.id} não pode ter unidade`).toBeNull();
    }
    // Nem alegação de valor: uma claim nula faria parecer medição frustrada.
    const claims = plan.evidence.filter((e) => catalogo.some((r) => r.id === e.entityId));
    expect(claims).toHaveLength(0);
  });

  it('a matriz GUT é transcrita e a aritmética da fonte é conferida', () => {
    // A priorização já existia no Plano de Ações. Construir formulário para
    // alguém digitá-la teria descartado o trabalho que a fonte já fez.
    const temas = plan.records.filter((r) => r.collection === 'gutPriorities');
    expect(temas).toHaveLength(16);

    // Gravidade x Urgência x Tendência = pontuação, em toda linha.
    for (const t of temas) {
      const produto = (t.data.severity as number) * (t.data.urgency as number) * (t.data.trend as number);
      expect(t.data.score, `${t.id}`).toBe(produto);
    }

    // Uma única linha da Tabela 5 imprime valor diferente do produto, e o
    // registro guarda os dois em vez de escolher em silêncio.
    const divergentes = temas.filter((t) => t.data.arithmeticMatches === false);
    expect(divergentes).toHaveLength(1);
    expect(divergentes[0].data.printedScore).toBe(88);
    expect(divergentes[0].data.score).toBe(80);
    expect(divergentes[0].data.note).toMatch(/Tabela 6 usa/);

    // O ranking reproduz o da Tabela 6 do documento.
    const primeiro = temas.find((t) => t.data.ranking === 1);
    expect(primeiro?.data.score).toBe(125);
  });

  it('a estimativa de custo vem das fontes, e o que não existe é declarado', () => {
    // A pergunta que motivou isto: o dado existe antes de pedir que alguém
    // digite? O Anexo I do Plano de Ações responde — quatro projetos têm
    // número ou declaração, seis têm a orçamentação remetida a um Plano de
    // Negócios ainda não contratado.
    const estimativas = plan.records.filter((r) => r.collection === 'costEstimates');
    expect(estimativas).toHaveLength(10);

    const comValor = estimativas.filter((r) => r.data.capexMinCents !== null);
    const semDesembolso = estimativas.filter((r) => r.data.requiresNewDisbursement === false);
    const emEstruturacao = estimativas.filter((r) => r.data.underEstimation === true);
    expect(comValor).toHaveLength(3);
    expect(semDesembolso).toHaveLength(1);
    expect(emEstruturacao).toHaveLength(6);

    // Nenhuma linha sem procedência, inclusive as que não têm número.
    for (const r of estimativas) {
      expect(r.data.sourceLabel, `${r.id} sem fonte`).toBeTruthy();
    }
    // Valor exige ano-base, como o domínio impõe.
    for (const r of comValor) {
      expect(r.data.baseYear, `${r.id} sem ano-base`).not.toBeNull();
    }
    // "Em estruturação" não é "não informado": alguém está trabalhando nele.
    for (const r of emEstruturacao) {
      expect(r.data.costCategory).toBe('estimating');
    }
    expect(semDesembolso[0].data.costCategory).toBe('no_new_disbursement');
  });

  it('mantém nulos os campos ausentes de metas', () => {
    const meta = plan.records.find((r) => r.collection === 'goals');
    expect(meta?.data.baseline).toBeNull();
    expect(meta?.data.currentResult).toBeNull();
    expect(meta?.data.baseline).not.toBe(0);
    expect(meta?.data.currentResult).not.toBe('');
  });
});

describe('dependências, que sempre estiveram na origem', () => {
  // O campo `dependencias` existia em projetos.json desde o começo, mas só era
  // gravado como lista de ids dentro do projeto. A coleção que a tela lê nunca
  // recebia nada, e a página exibia "nenhuma dependência registrada" com dois
  // pares declarados no documento.
  const arestas = plan.records.filter((r) => r.collection === 'dependencies');

  it('transcreve uma aresta por id declarado, sem inventar nem perder', () => {
    const declaradas = (projetos as { id: string; dependencias: string[] }[]).flatMap((p) =>
      p.dependencias.map((d) => `${d}--${p.id}`),
    );
    expect(arestas.map((a) => a.id).sort()).toEqual(declaradas.sort());
  });

  it('as duas precedências são as do Plano de Ações', () => {
    const pares = arestas.map((a) => [a.data.predecessorId, a.data.successorId]);
    expect(pares).toContainEqual([
      'licitacao-usinas-triagem',
      'licitacao-usinas-recuperacao-energetica',
    ]);
    expect(pares).toContainEqual([
      'licitacao-usinas-recuperacao-energetica',
      'licitacao-usinas-asfalto',
    ]);
  });

  it('declara que o tipo é leitura do sistema, não afirmação do documento', () => {
    // O documento diz QUE a dependência existe. Não diz de que tipo nem por
    // quê. Registrar "Término → Início" sem essa ressalva seria atribuir à
    // fonte uma classificação que ela não fez.
    for (const a of arestas) {
      expect(a.data.justification).toMatch(/não o seu tipo nem a sua razão/);
      expect(a.gaps).toContain('type');
    }
  });

  it('nenhuma aresta aponta para projeto inexistente', () => {
    const ids = new Set((projetos as { id: string }[]).map((p) => p.id));
    for (const a of arestas) {
      expect(ids.has(String(a.data.predecessorId)), `${a.id}: predecessor`).toBe(true);
      expect(ids.has(String(a.data.successorId)), `${a.id}: sucessor`).toBe(true);
    }
  });
});

describe('abrangência lida como lista de municípios', () => {
  const projetosMigrados = plan.records.filter((r) => r.collection === 'projects');
  const ids = (municipios as { id: string }[]).map((m) => m.id);

  it('projeto metropolitano recebe os 22 municípios do próprio banco', () => {
    const metropolitanos = projetosMigrados.filter((r) => r.data.municipalityIds !== null);
    expect(metropolitanos).toHaveLength(8);
    for (const r of metropolitanos) {
      expect(r.data.municipalityIds, r.id).toEqual(ids);
    }
  });

  it('abrangência indeterminada fica nula, nunca lista vazia', () => {
    // `[]` afirmaria "nenhum município". Os dois casos abaixo são a fonte
    // declarando que não sabe: "municípios participantes a definir" e uma
    // contagem de ÁREAS ("até 23"), que nem sequer é a mesma unidade.
    const semLista = projetosMigrados.filter((r) => r.data.municipalityIds === null);
    expect(semLista.map((r) => r.id).sort()).toEqual([
      'projeto-os-invisiveis',
      'remediacao-lixoes-aterros',
    ]);
    for (const r of semLista) {
      expect(r.data.municipalityIds).not.toEqual([]);
      expect(r.gaps).toContain('municipalityIds');
    }
  });

  it('a abrangência em texto continua gravada como a fonte escreveu', () => {
    // A leitura estruturada não substitui o original: sem ele, a conferência
    // contra o documento deixaria de ser possível.
    const porId = new Map(projetosMigrados.map((r) => [r.id, r.data.territorialScale]));
    for (const p of projetos as { id: string; abrangencia: string }[]) {
      expect(porId.get(p.id)).toBe(p.abrangencia);
    }
  });

  it('a lista vem do banco, não de constante escrita à mão', () => {
    // Se um município entrasse ou saísse da RMRJ, uma constante envelheceria
    // em silêncio. Este teste falha se alguém trocar a origem por literal.
    expect(municipiosDoProjeto('Região Metropolitana do Rio de Janeiro', ['a', 'b'])).toEqual([
      'a',
      'b',
    ]);
    expect(municipiosDoProjeto('Municípios participantes a definir', ['a', 'b'])).toBeNull();
  });
});

describe('verificações que saíram dos formulários', () => {
  // Quando os formulários foram removidos, em 16/08/2026, duas regras que só
  // existiam no caminho de escrita da interface teriam sumido junto. Elas
  // foram para a migração, que passou a ser o único caminho de entrada.

  it('recusa ciclo de dependências, como o formulário recusava', () => {
    const comCiclo = buildMigrationPlan(
      {
        ...sources,
        projetos: [
          { ...(projetos as Record<string, unknown>[])[0], id: 'a', dependencias: ['b'] },
          { ...(projetos as Record<string, unknown>[])[0], id: 'b', dependencias: ['a'] },
        ],
      },
      'pmetgirs-rmrj',
    );
    const ciclo = comCiclo.issues.find((i) => i.code === 'ciclo_de_dependencias');
    expect(ciclo?.severity).toBe('error');
    expect(ciclo?.message).toMatch(/a → b → a|b → a → b/);
  });

  it('recusa valor de custo sem ano-base, como o formulário recusava', () => {
    // A regra nasceu na tela; se não valesse aqui, não valeria em lugar nenhum.
    expect(() =>
      buildMigrationPlan(
        {
          ...sources,
          estimativasDeCusto: [
            {
              ...(estimativasDeCusto as Record<string, unknown>[])[0],
              capexMinCents: 100_000_00,
              capexMaxCents: 100_000_00,
              baseYear: null,
            },
          ],
        },
        'pmetgirs-rmrj',
      ),
    ).toThrow(/ano-base/);
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
