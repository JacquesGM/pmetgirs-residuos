import { describe, expect, it } from 'vitest';
import {
  assertPublicationTransition,
  isPubliclyVisible,
  EXCECOES_AO_NEVER_PUBLIC,
  NEVER_PUBLIC,
  PUBLIC_ALLOWLIST,
  PUBLIC_METADATA_FIELDS,
  PublicationTransitionError,
  sanitizeForPublication,
  SanitizationError,
  type PublicCollection,
} from './sanitize';

const contexto = {
  sourceEntityId: 'plano-negocios-pmetgirs',
  sourceVersion: 3,
  releaseId: 'rel-1',
};

/** Documento interno completo, como sai do Firestore. */
const interno = {
  id: 'plano-negocios-pmetgirs',
  workspaceId: 'pmetgirs-rmrj',
  name: 'Elaboração do Plano de Negócios',
  description: 'Detalha os aspectos técnicos e contratuais.',
  axisId: 'governanca-marco-legal',
  accountable: 'IRM',
  executionStatus: 'structuring',
  validationStatus: 'not_assessed',
  actualityStatus: 'no_date',
  sourceLabel: 'Plano de Ações do PMetGIRS',
  dataDate: null,
  // Tudo abaixo é interno e não pode atravessar.
  createdBy: 'migration',
  updatedBy: 'uid-editor',
  changeReason: 'Ata da reunião do comitê',
  lastEventId: 'ev-123',
  legacyStatus: 'em_estruturacao',
  version: 3,
  schemaVersion: 1,
  isArchived: false,
  internalNotes: 'Discutir com a procuradoria antes de divulgar',
  contactEmail: 'servidor@irm.rj.gov.br',
};

describe('sanitização por allowlist', () => {
  const resultado = sanitizeForPublication('projects', interno, contexto);

  it('deixa passar os campos aprovados', () => {
    expect(resultado.data.name).toBe('Elaboração do Plano de Negócios');
    expect(resultado.data.executionStatus).toBe('structuring');
    expect(resultado.data.sourceLabel).toBe('Plano de Ações do PMetGIRS');
  });

  it('não deixa passar quem editou nem por quê', () => {
    expect(resultado.data.updatedBy).toBeUndefined();
    expect(resultado.data.createdBy).toBeUndefined();
    expect(resultado.data.changeReason).toBeUndefined();
  });

  it('não deixa passar nota interna nem e-mail de servidor', () => {
    expect(resultado.data.internalNotes).toBeUndefined();
    expect(resultado.data.contactEmail).toBeUndefined();
  });

  it('não deixa passar campos de controle', () => {
    for (const campo of ['lastEventId', 'version', 'schemaVersion', 'workspaceId', 'legacyStatus']) {
      expect(resultado.data[campo]).toBeUndefined();
    }
  });

  it('registra o que foi descartado, para o relatório do release', () => {
    expect(resultado.dropped).toContain('internalNotes');
    expect(resultado.dropped).toContain('changeReason');
    expect(resultado.dropped).toContain('contactEmail');
  });

  it('nenhum campo proibido sobrevive, salvo exceção declarada', () => {
    // Varre todas as coleções com um documento que contém todos os campos
    // proibidos: só pode atravessar o que estiver em EXCECOES_AO_NEVER_PUBLIC.
    const suspeito = Object.fromEntries(NEVER_PUBLIC.map((f) => [f, 'VAZOU']));
    for (const collection of Object.keys(PUBLIC_ALLOWLIST) as PublicCollection[]) {
      const r = sanitizeForPublication(collection, suspeito, contexto);
      const permitidos = EXCECOES_AO_NEVER_PUBLIC[collection] ?? [];
      const vazados = Object.keys(r.data).filter((k) => r.data[k] === 'VAZOU');
      expect(vazados.sort(), `coleção ${collection}`).toEqual([...permitidos].sort());
    }
  });

  it('nenhuma allowlist inclui campo interno sem exceção', () => {
    for (const [collection, campos] of Object.entries(PUBLIC_ALLOWLIST)) {
      const permitidos = EXCECOES_AO_NEVER_PUBLIC[collection as PublicCollection] ?? [];
      const intersecao = campos.filter((c) => NEVER_PUBLIC.includes(c) && !permitidos.includes(c));
      expect(intersecao, `allowlist de ${collection}`).toEqual([]);
    }
  });

  describe('as exceções são poucas e reais', () => {
    /**
     * Uma exceção que ninguém revisita vira regra por esquecimento. Estes
     * testes mantêm a lista pequena, verdadeira e visível.
     */
    it('toda exceção nomeia um campo que de fato é proibido', () => {
      for (const [collection, campos] of Object.entries(EXCECOES_AO_NEVER_PUBLIC)) {
        for (const campo of campos ?? []) {
          expect(NEVER_PUBLIC, `${collection}.${campo}`).toContain(campo);
        }
      }
    });

    it('toda exceção aparece na allowlist da coleção', () => {
      // Exceção sem uso é resíduo: autoriza um vazamento que ninguém pediu.
      for (const [collection, campos] of Object.entries(EXCECOES_AO_NEVER_PUBLIC)) {
        for (const campo of campos ?? []) {
          expect(
            PUBLIC_ALLOWLIST[collection as PublicCollection],
            `${collection}.${campo}`,
          ).toContain(campo);
        }
      }
    });

    it('nenhuma exceção libera identificador de usuário', () => {
      const identificadores = ['updatedBy', 'createdBy', 'ownerUid', 'teamUids', 'contactEmail'];
      for (const [collection, campos] of Object.entries(EXCECOES_AO_NEVER_PUBLIC)) {
        for (const campo of campos ?? []) {
          expect(identificadores, `${collection}.${campo}`).not.toContain(campo);
        }
      }
    });
  });

  it('coleção sem allowlist não é publicada', () => {
    expect(() =>
      sanitizeForPublication('auditEvents' as PublicCollection, interno, contexto),
    ).toThrow(SanitizationError);
  });

  it('carrega a rastreabilidade até a origem', () => {
    expect(resultado.sourceEntityId).toBe('plano-negocios-pmetgirs');
    expect(resultado.sourceVersion).toBe(3);
    expect(resultado.releaseId).toBe('rel-1');
  });

  it('campo novo no documento interno não vaza por padrão', () => {
    // É a razão de ser da allowlist: acrescentar um campo interno não pode
    // torná-lo público sem alguém decidir isso.
    const comCampoNovo = { ...interno, orcamentoSigiloso: 999 };
    const r = sanitizeForPublication('projects', comCampoNovo, contexto);
    expect(r.data.orcamentoSigiloso).toBeUndefined();
    expect(r.dropped).toContain('orcamentoSigiloso');
  });
});

describe('metadados do documento público', () => {
  /**
   * A allowlist cobre os campos que vêm do documento interno. Os metadados são
   * acrescentados depois de sanitizar, então passam por fora dela — e foi por
   * aí que o UID do proprietário chegou a ser publicado, em 15/08/2026.
   */
  it('não expõe identificador de usuário', () => {
    const identificadores = ['publishedBy', 'updatedBy', 'createdBy', 'actorUid', 'uid', 'ownerUid'];
    const vazando = PUBLIC_METADATA_FIELDS.filter((campo) =>
      identificadores.includes(campo as string),
    );
    expect(
      vazando,
      `metadado público expõe identificador de usuário: ${vazando.join(', ')}. ` +
        'Quem publicou fica em publicationReleases, na área interna.',
    ).toEqual([]);
  });

  it('não repete campo que a allowlist já proíbe', () => {
    const conflito = PUBLIC_METADATA_FIELDS.filter((campo) =>
      NEVER_PUBLIC.includes(campo as string),
    );
    expect(conflito).toEqual([]);
  });

  it('entrega ao cidadão a origem do dado, não a autoria', () => {
    // Rastreabilidade é saber de qual release o número veio.
    expect(PUBLIC_METADATA_FIELDS).toContain('releaseId');
    expect(PUBLIC_METADATA_FIELDS).toContain('sourceVersion');
    expect(PUBLIC_METADATA_FIELDS).not.toContain('publishedBy');
  });

  it('a projeção sanitizada não carrega quem publicou', () => {
    const projecao = sanitizeForPublication('projects', { name: 'Projeto' }, contexto);
    expect(Object.keys(projecao)).not.toContain('publishedBy');
  });
});

describe('fluxo de publicação', () => {
  it('editor envia rascunho para revisão', () => {
    expect(() => assertPublicationTransition('draft', 'in_review', 'editor')).not.toThrow();
  });

  it('revisor aprova ou devolve', () => {
    expect(() => assertPublicationTransition('in_review', 'approved', 'reviewer')).not.toThrow();
    expect(() => assertPublicationTransition('in_review', 'changes_requested', 'reviewer')).not.toThrow();
  });

  it('somente o proprietário publica', () => {
    expect(() => assertPublicationTransition('approved', 'published', 'owner')).not.toThrow();
    expect(() => assertPublicationTransition('approved', 'published', 'admin')).toThrow(
      /Somente o proprietário publica/,
    );
    expect(() => assertPublicationTransition('approved', 'published', 'reviewer')).toThrow(
      PublicationTransitionError,
    );
  });

  it('editor não aprova o próprio trabalho', () => {
    expect(() => assertPublicationTransition('in_review', 'approved', 'editor')).toThrow();
  });

  it('não se publica direto do rascunho', () => {
    expect(() => assertPublicationTransition('draft', 'published', 'owner')).toThrow(
      /Não se vai de "Rascunho" para "Publicado"/,
    );
  });

  it('a mensagem diz quais transições são possíveis dali', () => {
    try {
      assertPublicationTransition('draft', 'published', 'owner');
    } catch (e) {
      expect((e as Error).message).toContain('Em revisão');
    }
  });

  it('arquivado é terminal', () => {
    expect(() => assertPublicationTransition('archived', 'draft', 'owner')).toThrow(
      /não há transição possível/,
    );
  });
});

describe('visibilidade pública', () => {
  it('só o publicado é visível ao cidadão', () => {
    expect(isPubliclyVisible('published')).toBe(true);
    for (const status of ['draft', 'in_review', 'changes_requested', 'approved', 'archived'] as const) {
      expect(isPubliclyVisible(status), status).toBe(false);
    }
  });

  it('aprovado ainda não é público', () => {
    // Aprovar é decisão técnica; publicar é ato do proprietário.
    expect(isPubliclyVisible('approved')).toBe(false);
  });
});
