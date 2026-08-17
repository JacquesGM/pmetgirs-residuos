// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildMutation, SERVER_TIME } from '../../src/domain/mutation';
import { sanitizeForPublication } from '../../src/domain/publication/sanitize';

/**
 * Testes das Security Rules contra o Emulator.
 *
 * Rodam com `npm run test:rules`, que sobe o emulador do Firestore e executa
 * este arquivo. Nenhum projeto real do Firebase é tocado: o ID começa com
 * "demo-", que o Firebase trata como exclusivo de emulador.
 */

const WID = 'pmetgirs-rmrj';
const PROJECT_ID = 'demo-pmetgirs';

let testEnv: RulesTestEnvironment;

const OWNER = { uid: 'uid-owner', email: 'owner@exemplo.gov.br' };
const ADMIN = { uid: 'uid-admin', email: 'admin@exemplo.gov.br' };
const EDITOR = { uid: 'uid-editor', email: 'editor@exemplo.gov.br' };
const REVIEWER = { uid: 'uid-reviewer', email: 'reviewer@exemplo.gov.br' };
const VIEWER = { uid: 'uid-viewer', email: 'viewer@exemplo.gov.br' };
const SUSPENSO = { uid: 'uid-suspenso', email: 'suspenso@exemplo.gov.br' };
const ESTRANHO = { uid: 'uid-estranho', email: 'estranho@exemplo.com' };
const CONVIDADO = { uid: 'uid-convidado', email: 'convidado@exemplo.gov.br' };

function ctx(user: { uid: string; email: string }) {
  return testEnv.authenticatedContext(user.uid, { email: user.email, email_verified: true });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const membro = (user: { uid: string; email: string }, role: string, status = 'active') =>
      setDoc(doc(db, `workspaces/${WID}/members/${user.uid}`), {
        uid: user.uid,
        email: user.email,
        role,
        status,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        updatedBy: user.uid,
      });

    await Promise.all([
      setDoc(doc(db, `workspaces/${WID}`), { id: WID, name: 'PMetGIRS — RMRJ' }),
      membro(OWNER, 'owner'),
      membro(ADMIN, 'admin'),
      membro(EDITOR, 'editor'),
      membro(REVIEWER, 'reviewer'),
      membro(VIEWER, 'viewer'),
      membro(SUSPENSO, 'editor', 'suspended'),
      setDoc(doc(db, `workspaces/${WID}/projects/proj-1`), {
        id: 'proj-1',
        workspaceId: WID,
        name: 'Projeto existente',
        schemaVersion: 1,
        version: 1,
        isArchived: false,
        lastEventId: 'ev-seed',
        createdAt: Timestamp.now(),
        createdBy: OWNER.uid,
        updatedAt: Timestamp.now(),
        updatedBy: OWNER.uid,
      }),
      setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), {
        sourceEntityId: 'proj-1',
        name: 'Projeto publicado',
        publishedAt: Timestamp.now(),
      }),
      setDoc(doc(db, `workspaces/${WID}/invitations/inv-1`), {
        email: CONVIDADO.email,
        role: 'editor',
        status: 'pending',
        expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 3600 * 1000),
      }),
    ]);
  });
});

// --------------------------------------------------------------- fronteiras

describe('fronteira público / privado', () => {
  it('qualquer pessoa lê as projeções públicas', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`)));
  });

  it('ninguém escreve nas projeções públicas sem estar autenticado', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-2`), { sourceEntityId: 'proj-2' }));
  });

  it('não autenticado não lê a árvore interna', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `workspaces/${WID}/projects/proj-1`)));
  });

  it('autenticado sem membership não lê a árvore interna', async () => {
    const db = ctx(ESTRANHO).firestore();
    await assertFails(getDoc(doc(db, `workspaces/${WID}/projects/proj-1`)));
  });

  it('usuário suspenso perde o acesso', async () => {
    const db = ctx(SUSPENSO).firestore();
    await assertFails(getDoc(doc(db, `workspaces/${WID}/projects/proj-1`)));
  });

  it('membro ativo lê o portfólio', async () => {
    const db = ctx(VIEWER).firestore();
    await assertSucceeds(getDoc(doc(db, `workspaces/${WID}/projects/proj-1`)));
  });

  /**
   * Toda coleção de conteúdo precisa constar de isContentCollection(), senão a
   * regra genérica nega a leitura e a tela de publicação inteira quebra —
   * `Promise.all` rejeita se uma única coleção falhar.
   *
   * Foi o que aconteceu com `municipalIndicators` em 16/08/2026: os 242
   * registros existiam no banco, gravados pelo Admin SDK, que não passa pelas
   * Rules. Nenhum teste cobria a coleção nova, e a falha só apareceu na tela.
   */
  it('toda coleção de conteúdo publicável é legível por membro ativo', async () => {
    const db = ctx(VIEWER).firestore();
    // A lista vem do registro de publicação e das coleções que a área interna
    // lê. Escrevê-la à mão aqui foi o que deixou `gutPriorities` passar: a
    // coleção entrou no sistema, não entrou na regra, e a tela de Priorização
    // caiu inteira porque um `Promise.all` rejeita se uma leitura falhar.
    for (const colecao of [
      'projects', 'goals', 'indicators', 'municipalIndicators', 'municipalities',
      'infrastructures', 'inconsistencies', 'documents', 'glossary',
      'costEstimates', 'gutPriorities', 'dependencies', 'treatmentCentrals', 'economicViability',
      'evidence', 'milestones',
    ]) {
      await assertSucceeds(getDoc(doc(db, `workspaces/${WID}/${colecao}/qualquer-id`)));
    }
  });

  it('assessments saiu da lista quando o formulário saiu', async () => {
    // A coleção nunca recebeu documento, e nenhuma tela escreve nela desde que
    // o formulário de avaliação foi removido, em 16/08/2026. Uma permissão que
    // nenhuma tela usa é superfície de escrita invisível — pior que uma
    // visível, porque não aparece em revisão de interface.
    //
    // O teste é aqui e não só um comentário: sem ele, recolocar 'assessments'
    // na lista passaria despercebido.
    const db = ctx(VIEWER).firestore();
    await assertFails(getDoc(doc(db, `workspaces/${WID}/assessments/qualquer-id`)));
  });

  it('coleção fora da lista de conteúdo permanece negada', async () => {
    // Prova que o teste acima não passa por vacuidade: uma coleção inventada
    // é recusada pela mesma regra.
    const db = ctx(VIEWER).firestore();
    await assertFails(getDoc(doc(db, `workspaces/${WID}/colecaoInexistente/qualquer-id`)));
  });
});

// ------------------------------------------------- ESCALADA DE PRIVILÉGIO
//
// Este bloco é a razão de a regra genérica de conteúdo ser fechada por lista
// explícita de coleções.
//
// IMPORTANTE — por que as cargas abaixo são tão completas: uma tentativa
// ingênua (só `{ role: 'owner' }`) é recusada por faltar o envelope de
// auditoria, e não pela fronteira de governança. O teste passaria mesmo com a
// regra vulnerável, sem provar nada. Por isso cada tentativa aqui satisfaz
// TODAS as condições da regra genérica — envelope completo e auditEvent no
// mesmo lote — de modo que o único motivo possível para a recusa seja a
// coleção estar fora de isContentCollection().

/** Envelope de auditoria completo, aceito pela regra genérica de conteúdo. */
function envelope(id: string, actorUid: string, eventId: string) {
  return {
    id,
    workspaceId: WID,
    schemaVersion: 1,
    version: 1,
    isArchived: false,
    lastEventId: eventId,
    createdAt: serverTimestamp(),
    createdBy: actorUid,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  };
}

function auditEvent(collection: string, entityId: string, actorUid: string, eventId: string) {
  return {
    id: eventId,
    workspaceId: WID,
    entityCollection: collection,
    entityId,
    actorUid,
    occurredAt: serverTimestamp(),
    toVersion: 1,
    reason: 'tentativa',
  };
}

describe('escalada de privilégio', () => {
  it('editor NÃO cria membro com papel owner, mesmo com auditoria válida', async () => {
    const db = ctx(EDITOR).firestore();
    const batch = writeBatch(db);
    batch.set(
      doc(db, `workspaces/${WID}/auditEvents/ev-esc`),
      auditEvent('members', 'uid-comparsa', EDITOR.uid, 'ev-esc'),
    );
    batch.set(doc(db, `workspaces/${WID}/members/uid-comparsa`), {
      ...envelope('uid-comparsa', EDITOR.uid, 'ev-esc'),
      uid: 'uid-comparsa',
      email: 'comparsa@exemplo.com',
      role: 'owner',
      status: 'active',
    });
    await assertFails(batch.commit());
  });

  it('editor NÃO escreve em settings, mesmo com auditoria válida', async () => {
    const db = ctx(EDITOR).firestore();
    const batch = writeBatch(db);
    batch.set(
      doc(db, `workspaces/${WID}/auditEvents/ev-cfg`),
      auditEvent('settings', 'scoringPolicy', EDITOR.uid, 'ev-cfg'),
    );
    batch.set(doc(db, `workspaces/${WID}/settings/scoringPolicy`), {
      ...envelope('scoringPolicy', EDITOR.uid, 'ev-cfg'),
      weights: { socialImpact: 100 },
    });
    await assertFails(batch.commit());
  });

  it('editor NÃO cria convite, mesmo com auditoria válida', async () => {
    const db = ctx(EDITOR).firestore();
    const batch = writeBatch(db);
    batch.set(
      doc(db, `workspaces/${WID}/auditEvents/ev-inv`),
      auditEvent('invitations', 'inv-2', EDITOR.uid, 'ev-inv'),
    );
    batch.set(doc(db, `workspaces/${WID}/invitations/inv-2`), {
      ...envelope('inv-2', EDITOR.uid, 'ev-inv'),
      email: EDITOR.email,
      role: 'owner',
      status: 'pending',
      expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
    });
    await assertFails(batch.commit());
  });

  it('editor NÃO cria release de publicação, mesmo com auditoria válida', async () => {
    const db = ctx(EDITOR).firestore();
    const batch = writeBatch(db);
    batch.set(
      doc(db, `workspaces/${WID}/auditEvents/ev-rel`),
      auditEvent('publicationReleases', 'rel-1', EDITOR.uid, 'ev-rel'),
    );
    batch.set(doc(db, `workspaces/${WID}/publicationReleases/rel-1`), {
      ...envelope('rel-1', EDITOR.uid, 'ev-rel'),
      publishedBy: EDITOR.uid,
      publishedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('editor NÃO forja pedido de acesso já aprovado, mesmo com auditoria válida', async () => {
    const db = ctx(EDITOR).firestore();
    const batch = writeBatch(db);
    batch.set(
      doc(db, `workspaces/${WID}/auditEvents/ev-acc`),
      auditEvent('accessRequests', 'uid-comparsa', EDITOR.uid, 'ev-acc'),
    );
    batch.set(doc(db, `workspaces/${WID}/accessRequests/uid-comparsa`), {
      ...envelope('uid-comparsa', EDITOR.uid, 'ev-acc'),
      uid: 'uid-comparsa',
      email: 'comparsa@exemplo.com',
      status: 'approved',
    });
    await assertFails(batch.commit());
  });

  it('editor NÃO altera o próprio papel', async () => {
    const db = ctx(EDITOR).firestore();
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/members/${EDITOR.uid}`), { role: 'owner' }, { merge: true }),
    );
  });

  it('admin NÃO promove ninguém — só o owner gerencia membros', async () => {
    const db = ctx(ADMIN).firestore();
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/members/${VIEWER.uid}`), { role: 'admin' }, { merge: true }),
    );
  });

  it('owner NÃO altera o próprio registro de membro', async () => {
    const db = ctx(OWNER).firestore();
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/members/${OWNER.uid}`), { role: 'viewer' }, { merge: true }),
    );
  });
});

// ------------------------------------------------------------------ escrita

describe('escrita de conteúdo', () => {
  function projetoValido(overrides: Record<string, unknown> = {}) {
    return {
      id: 'proj-novo',
      workspaceId: WID,
      name: 'Novo projeto',
      schemaVersion: 1,
      version: 1,
      isArchived: false,
      lastEventId: 'ev-1',
      createdAt: serverTimestamp(),
      createdBy: OWNER.uid,
      updatedAt: serverTimestamp(),
      updatedBy: OWNER.uid,
      ...overrides,
    };
  }

  function eventoValido(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ev-1',
      workspaceId: WID,
      entityCollection: 'projects',
      entityId: 'proj-novo',
      actorUid: OWNER.uid,
      occurredAt: serverTimestamp(),
      toVersion: 1,
      reason: 'Criação do projeto',
      ...overrides,
    };
  }

  it('proprietário cria projeto quando o auditEvent vem no mesmo lote', async () => {
    const db = ctx(OWNER).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, `workspaces/${WID}/auditEvents/ev-1`), eventoValido());
    batch.set(doc(db, `workspaces/${WID}/projects/proj-novo`), projetoValido());
    await assertSucceeds(batch.commit());
  });

  it('proprietário NÃO cria projeto sem auditEvent', async () => {
    const db = ctx(OWNER).firestore();
    await assertFails(setDoc(doc(db, `workspaces/${WID}/projects/proj-novo`), projetoValido()));
  });

  it('proprietário NÃO cria projeto com auditEvent de outra entidade', async () => {
    const db = ctx(OWNER).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, `workspaces/${WID}/auditEvents/ev-1`), eventoValido({ entityId: 'outra-coisa' }));
    batch.set(doc(db, `workspaces/${WID}/projects/proj-novo`), projetoValido());
    await assertFails(batch.commit());
  });

  it('viewer NÃO escreve projeto', async () => {
    const db = ctx(VIEWER).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, `workspaces/${WID}/auditEvents/ev-1`), eventoValido({ actorUid: VIEWER.uid }));
    batch.set(
      doc(db, `workspaces/${WID}/projects/proj-novo`),
      projetoValido({ createdBy: VIEWER.uid, updatedBy: VIEWER.uid }),
    );
    await assertFails(batch.commit());
  });

  it('proprietário NÃO incrementa a versão fora de sequência', async () => {
    const db = ctx(OWNER).firestore();
    const batch = writeBatch(db);
    batch.set(
      doc(db, `workspaces/${WID}/auditEvents/ev-2`),
      eventoValido({ id: 'ev-2', entityId: 'proj-1', toVersion: 5 }),
    );
    batch.set(doc(db, `workspaces/${WID}/projects/proj-1`), {
      id: 'proj-1',
      workspaceId: WID,
      name: 'Projeto existente',
      schemaVersion: 1,
      version: 5,
      isArchived: false,
      lastEventId: 'ev-2',
      createdAt: Timestamp.now(),
      createdBy: OWNER.uid,
      updatedAt: serverTimestamp(),
      updatedBy: OWNER.uid,
    });
    await assertFails(batch.commit());
  });

  it('ninguém apaga um projeto — exclusão física é sempre negada', async () => {
    const db = ctx(OWNER).firestore();
    const batch = writeBatch(db);
    batch.delete(doc(db, `workspaces/${WID}/projects/proj-1`));
    await assertFails(batch.commit());
  });
});

// ------------------------------------------ caminho de escrita real do app
//
// Os testes acima usam cargas escritas à mão. Estes usam buildMutation — o
// mesmo construtor que a interface chama — para provar que o caminho real da
// aplicação satisfaz as Rules, e não uma aproximação dele.

describe('buildMutation contra as Rules', () => {
  function materialize(payload: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) out[k] = v === SERVER_TIME ? serverTimestamp() : v;
    return out;
  }

  async function commit(
    db: ReturnType<ReturnType<typeof testEnv.authenticatedContext>['firestore']>,
    input: Parameters<typeof buildMutation>[0],
    eventId: string,
  ) {
    const plan = buildMutation(input, eventId);
    const batch = writeBatch(db);
    batch.set(doc(db, plan.eventPath), materialize(plan.event));
    batch.set(doc(db, plan.docPath), materialize(plan.doc));
    return batch.commit();
  }

  const criar = (uid: string, role: string) => ({
    workspaceId: WID,
    collection: 'projects',
    id: 'proj-app',
    data: { name: 'Projeto criado pela interface', executionStatus: 'structuring' },
    actorUid: uid,
    actorRole: role as never,
    action: 'create' as const,
    reason: 'Cadastro pela interface de gestão',
  });

  it('proprietário cria projeto pelo caminho real da aplicação', async () => {
    const db = ctx(OWNER).firestore();
    await assertSucceeds(commit(db, criar(OWNER.uid, 'owner'), 'ev-app-1'));
  });

  it('editor NÃO escreve conteúdo, mesmo pelo caminho real e com auditoria perfeita', async () => {
    // A postura mudou em 17/08/2026. Antes `canEdit` concedia esta escrita a
    // admin e editor; nenhuma tela usava a concessão desde que os formulários
    // de conteúdo saíram, e permissão que nenhuma tela usa não aparece em
    // revisão de interface.
    //
    // Este caso satisfaz TODAS as demais condições da regra — envelope de
    // auditoria completo, auditEvent no mesmo lote, versão 1, carimbos de
    // servidor. O único motivo possível para a recusa é o papel. Sem essa
    // completude o teste passaria mesmo com a regra antiga, e não provaria
    // nada.
    const db = ctx(EDITOR).firestore();
    await assertFails(commit(db, criar(EDITOR.uid, 'editor'), 'ev-app-editor'));
  });

  it('admin NÃO escreve conteúdo, mesmo pelo caminho real', async () => {
    const db = ctx(ADMIN).firestore();
    await assertFails(commit(db, criar(ADMIN.uid, 'admin'), 'ev-app-admin'));
  });

  it('editor continua propondo publicação — o que mudou foi o alcance, não o papel', async () => {
    // O papel não perdeu função: perdeu uma função que a interface não
    // oferecia. Propor publicação é o que ele faz, e continua fazendo.
    await assertSucceeds(
      setDoc(doc(ctx(EDITOR).firestore(), `workspaces/${WID}/approvalRequests/ped-editor`), {
        id: 'ped-editor',
        workspaceId: WID,
        items: ['projects/proj-1'],
        reason: 'Proposta de publicação depois do estreitamento de canEdit',
        itemCount: 1,
        status: 'pending',
        createdBy: EDITOR.uid,
        createdAt: serverTimestamp(),
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      }),
    );
  });

  const dependencia = (uid: string, role: string) => ({
    workspaceId: WID,
    collection: 'dependencies',
    id: 'proj-anterior--proj-app',
    data: {
      predecessorId: 'proj-anterior',
      successorId: 'proj-app',
      type: 'finish_to_start',
      lagDays: 0,
      mandatory: true,
      justification: 'Plano de Ações do PMetGIRS, Anexo III.',
      sharedResourceId: null,
    },
    actorUid: uid,
    actorRole: role as never,
    action: 'create' as const,
    reason: 'Precedência transcrita do Plano de Ações',
  });

  it('dependência transcrita passa pelo caminho real, com auditoria no mesmo lote', async () => {
    // A migração usa o Admin SDK, que não passa pelas Rules. Este teste existe
    // para que a coleção continue coberta por regra explícita mesmo assim —
    // foi a ausência disso que derrubou as telas de municipalIndicators e
    // gutPriorities.
    const db = ctx(OWNER).firestore();
    await assertSucceeds(commit(db, dependencia(OWNER.uid, 'owner'), 'ev-dep-1'));
  });

  const estimar = (uid: string, role: string) => ({
    workspaceId: WID,
    collection: 'costEstimates',
    id: 'proj-app',
    data: {
      entityCollection: 'projects',
      entityId: 'proj-app',
      requiresNewDisbursement: true,
      capexMinCents: 100_000_00,
      capexMaxCents: 200_000_00,
      annualOpexCents: null,
      currency: 'BRL',
      baseYear: 2024,
      sourceLabel: 'Prognóstico Geral, Tabela 73',
      assumptions: ['Inclui conexão elétrica'],
      confidenceScore: 40,
      asOfDate: null,
      underEstimation: false,
      costCategory: 'medium',
    },
    actorUid: uid,
    actorRole: role as never,
    action: 'create' as const,
    reason: 'Primeira estimativa a partir do EVTE',
  });

  it('proprietário registra estimativa de custo pelo caminho real', async () => {
    const db = ctx(OWNER).firestore();
    await assertSucceeds(commit(db, estimar(OWNER.uid, 'owner'), 'ev-custo-1'));
  });

  it('leitor não registra estimativa de custo', async () => {
    const db = ctx(VIEWER).firestore();
    await assertFails(commit(db, estimar(VIEWER.uid, 'viewer'), 'ev-custo-2'));
  });

  it('leitor não registra dependência', async () => {
    const db = ctx(VIEWER).firestore();
    await assertFails(commit(db, dependencia(VIEWER.uid, 'viewer'), 'ev-dep-2'));
  });

  it('proprietário atualiza projeto pelo caminho real, com versão +1', async () => {
    const db = ctx(OWNER).firestore();
    await assertSucceeds(commit(db, criar(OWNER.uid, 'owner'), 'ev-app-2'));

    // Recarrega o documento inteiro antes de editar, como a interface faz.
    // createdAt e createdBy precisam voltar idênticos: as Rules conferem.
    const atual = (await getDoc(doc(db, `workspaces/${WID}/projects/proj-app`))).data()!;

    await assertSucceeds(
      commit(
        db,
        {
          ...criar(OWNER.uid, 'owner'),
          action: 'update',
          reason: 'Atualiza situação após reunião',
          currentVersion: 1,
          currentData: atual,
          data: { ...atual, executionStatus: 'study' },
        },
        'ev-app-3',
      ),
    );

    const depois = (await getDoc(doc(db, `workspaces/${WID}/projects/proj-app`))).data()!;
    expect(depois.version).toBe(2);
    expect(depois.executionStatus).toBe('study');
    expect(depois.lastEventId).toBe('ev-app-3');
  });

  it('recusa atualização sem carregar o documento inteiro, com erro explicativo', () => {
    expect(() =>
      buildMutation(
        {
          ...criar(EDITOR.uid, 'editor'),
          action: 'update',
          reason: 'tentativa',
          currentVersion: 1,
          currentData: { name: 'sem createdAt' },
          data: { name: 'outro' },
        },
        'ev-app-x',
      ),
    ).toThrow(/Carregue o documento inteiro/);
  });

  it('viewer NÃO consegue usar o mesmo caminho', async () => {
    const db = ctx(VIEWER).firestore();
    await assertFails(commit(db, criar(VIEWER.uid, 'viewer'), 'ev-app-4'));
  });

  it('usuário suspenso NÃO consegue usar o mesmo caminho', async () => {
    const db = ctx(SUSPENSO).firestore();
    await assertFails(commit(db, criar(SUSPENSO.uid, 'editor'), 'ev-app-5'));
  });

  it('o evento gravado casa com a entidade, o ator e a versão', async () => {
    const db = ctx(OWNER).firestore();
    await assertSucceeds(commit(db, criar(OWNER.uid, 'owner'), 'ev-app-6'));

    const evento = await getDoc(doc(db, `workspaces/${WID}/auditEvents/ev-app-6`));
    expect(evento.exists()).toBe(true);
    expect(evento.data()?.entityId).toBe('proj-app');
    expect(evento.data()?.entityCollection).toBe('projects');
    expect(evento.data()?.actorUid).toBe(OWNER.uid);
    expect(evento.data()?.toVersion).toBe(1);
    expect(evento.data()?.reason).toBe('Cadastro pela interface de gestão');
  });
});

// ------------------------------------------------ fronteira da publicação
//
// Prova que o conteúdo interno não atravessa por acidente: mesmo o
// proprietário, escrevendo na árvore pública, só consegue gravar o que passou
// pela sanitização.

describe('fronteira da publicação', () => {
  const interno = {
    name: 'Projeto interno',
    updatedBy: 'uid-editor',
    changeReason: 'motivo interno',
    internalNotes: 'não divulgar',
    contactEmail: 'servidor@irm.rj.gov.br',
    legacyStatus: 'em_estruturacao',
  };

  it('a sanitização remove todo campo interno antes de publicar', () => {
    const projecao = sanitizeForPublication('projects', interno, {
      sourceEntityId: 'proj-1',
      sourceVersion: 1,
      releaseId: 'rel-1',
    });

    expect(projecao.data.name).toBe('Projeto interno');
    for (const campo of ['updatedBy', 'changeReason', 'internalNotes', 'contactEmail']) {
      expect(projecao.data[campo], campo).toBeUndefined();
    }
    // `legacyStatus` atravessa por exceção declarada em
    // EXCECOES_AO_NEVER_PUBLIC: é o único valor exato da coluna de situação
    // que o portal exibe, e reconstruí-lo produzia rótulos falsos.
    expect(projecao.data.legacyStatus).toBeDefined();
    expect(projecao.dropped).toContain('internalNotes');
  });

  it('o proprietário publica a projeção sanitizada', async () => {
    const db = ctx(OWNER).firestore();
    const projecao = sanitizeForPublication('projects', interno, {
      sourceEntityId: 'proj-1',
      sourceVersion: 1,
      releaseId: 'rel-1',
    });

    await assertSucceeds(
      setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), {
        ...projecao.data,
        sourceEntityId: 'proj-1',
        publishedAt: serverTimestamp(),
      }),
    );
  });

  it('o público lê a projeção, e nela não há campo interno', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const snapshot = await getDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`));
    expect(snapshot.exists()).toBe(true);
    for (const campo of ['updatedBy', 'changeReason', 'internalNotes', 'contactEmail']) {
      expect(snapshot.data()?.[campo], campo).toBeUndefined();
    }
  });

  it('o público NÃO alcança o documento interno correspondente', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `workspaces/${WID}/projects/proj-1`)));
  });

  it('editor não publica, mesmo com a projeção correta', async () => {
    const db = ctx(EDITOR).firestore();
    const projecao = sanitizeForPublication('projects', interno, {
      sourceEntityId: 'proj-1',
      sourceVersion: 1,
      releaseId: 'rel-1',
    });
    await assertFails(
      setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), {
        ...projecao.data,
        sourceEntityId: 'proj-1',
        publishedAt: serverTimestamp(),
      }),
    );
  });
});

// ---------------------------------------------------------------- auditoria

describe('auditoria', () => {
  it('auditEvent não pode ser alterado', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `workspaces/${WID}/auditEvents/ev-seed`), {
        id: 'ev-seed',
        workspaceId: WID,
        entityCollection: 'projects',
        entityId: 'proj-1',
        actorUid: OWNER.uid,
        occurredAt: Timestamp.now(),
        toVersion: 1,
        reason: 'Carga inicial',
      });
    });
    const db = ctx(OWNER).firestore();
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/auditEvents/ev-seed`), { reason: 'reescrito' }, { merge: true }),
    );
  });

  it('auditEvent não pode ser apagado nem pelo owner', async () => {
    const db = ctx(OWNER).firestore();
    const batch = writeBatch(db);
    batch.delete(doc(db, `workspaces/${WID}/auditEvents/ev-seed`));
    await assertFails(batch.commit());
  });
});

// --------------------------------------------------------------- publicação

describe('publicação', () => {
  // A projeção pública não carrega quem publicou: o documento é lido por
  // qualquer visitante, e a autoria fica em publicationReleases, na área
  // interna.
  const projecao = () => ({
    sourceEntityId: 'proj-1',
    sourceVersion: 1,
    name: 'Projeto publicado',
    publishedAt: serverTimestamp(),
  });

  it('somente o owner publica', async () => {
    const db = ctx(OWNER).firestore();
    await assertSucceeds(setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), projecao()));
  });

  it('admin NÃO publica', async () => {
    const db = ctx(ADMIN).firestore();
    await assertFails(setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), projecao()));
  });

  it('editor NÃO publica', async () => {
    const db = ctx(EDITOR).firestore();
    await assertFails(setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), projecao()));
  });

  it('nem o owner publica documento que carrega publishedBy', async () => {
    // Sem esta regra, bastava o cliente voltar a incluir o campo para o UID do
    // proprietário reaparecer em dado aberto. Aconteceu em 15/08/2026.
    const db = ctx(OWNER).firestore();
    await assertFails(
      setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), {
        ...projecao(),
        publishedBy: OWNER.uid,
      }),
    );
  });

  it('nem o owner publica documento com qualquer identificador de ator', async () => {
    const db = ctx(OWNER).firestore();
    await assertFails(
      setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), {
        ...projecao(),
        publishedBy: 'outro-uid-qualquer',
      }),
    );
  });
});

// ------------------------------------------------------------------ convite

describe('convite', () => {
  it('convidado lê o próprio convite', async () => {
    const db = ctx(CONVIDADO).firestore();
    await assertSucceeds(getDoc(doc(db, `workspaces/${WID}/invitations/inv-1`)));
  });

  it('outra pessoa NÃO lê o convite alheio', async () => {
    const db = ctx(ESTRANHO).firestore();
    await assertFails(getDoc(doc(db, `workspaces/${WID}/invitations/inv-1`)));
  });

  it('convidado NÃO aceita convite de outro e-mail', async () => {
    const db = ctx(ESTRANHO).firestore();
    await assertFails(
      setDoc(
        doc(db, `workspaces/${WID}/invitations/inv-1`),
        { status: 'accepted', acceptedByUid: ESTRANHO.uid, acceptedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });

  it('convidado NÃO eleva o próprio papel ao aceitar', async () => {
    const db = ctx(CONVIDADO).firestore();
    await assertFails(
      setDoc(
        doc(db, `workspaces/${WID}/invitations/inv-1`),
        { status: 'accepted', acceptedByUid: CONVIDADO.uid, acceptedAt: serverTimestamp(), role: 'owner' },
        { merge: true },
      ),
    );
  });

  it('convidado NÃO cria membership com papel diferente do convite', async () => {
    const db = ctx(CONVIDADO).firestore();
    await assertFails(
      setDoc(doc(db, `workspaces/${WID}/members/${CONVIDADO.uid}`), {
        uid: CONVIDADO.uid,
        email: CONVIDADO.email,
        role: 'admin',
        status: 'active',
        invitationId: 'inv-1',
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('convidado cria a própria membership com o papel do convite', async () => {
    const db = ctx(CONVIDADO).firestore();
    await assertSucceeds(
      setDoc(doc(db, `workspaces/${WID}/members/${CONVIDADO.uid}`), {
        uid: CONVIDADO.uid,
        email: CONVIDADO.email,
        role: 'editor',
        status: 'active',
        invitationId: 'inv-1',
        createdAt: serverTimestamp(),
      }),
    );
  });
});

// ----------------------------------------------- FLUXO EDITORIAL DA PUBLICAÇÃO
//
// Depois que os formulários de conteúdo saíram, publicar virou a única escrita
// que a interface oferece — e é ela que o fluxo editorial governa.
//
// Três atos, três papéis, e o ponto destes testes é que nenhum papel consegue
// executar o ato do outro. A separação vive aqui, nas Rules: a interface pode
// esconder um botão, mas esconder não é impedir.
describe('pedidos de publicação', () => {
  const pedido = (uid: string) => ({
    id: 'ped-1',
    workspaceId: WID,
    items: ['projects/proj-app'],
    reason: 'Metas conferidas contra a Tabela 12 do Plano de Ações',
    itemCount: 1,
    status: 'pending',
    createdBy: uid,
    createdAt: serverTimestamp(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
  });

  const caminho = `workspaces/${WID}/approvalRequests/ped-1`;

  async function semRegras(dados: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), caminho), { ...dados, createdAt: Timestamp.now() });
    });
  }

  it('editor cria pedido', async () => {
    await assertSucceeds(setDoc(doc(ctx(EDITOR).firestore(), caminho), pedido(EDITOR.uid)));
  });

  it('leitor não cria pedido', async () => {
    await assertFails(setDoc(doc(ctx(VIEWER).firestore(), caminho), pedido(VIEWER.uid)));
  });

  it('editor não cria pedido em nome de outra pessoa', async () => {
    // createdBy é a assinatura do pedido. Sem esta regra, um pedido poderia
    // nascer atribuído a quem não o fez.
    await assertFails(setDoc(doc(ctx(EDITOR).firestore(), caminho), pedido(OWNER.uid)));
  });

  it('editor não cria pedido já aprovado', async () => {
    // Sem isto, quem propõe se autoaprovaria na criação e o revisor nunca
    // veria o pedido.
    await assertFails(
      setDoc(doc(ctx(EDITOR).firestore(), caminho), { ...pedido(EDITOR.uid), status: 'approved' }),
    );
  });

  it('revisor decide pedido pendente', async () => {
    await semRegras(pedido(EDITOR.uid));
    await assertSucceeds(
      setDoc(
        doc(ctx(REVIEWER).firestore(), caminho),
        {
          ...pedido(EDITOR.uid),
          status: 'approved',
          reviewedBy: REVIEWER.uid,
          reviewedAt: serverTimestamp(),
        },
      ),
    );
  });

  it('editor não decide o próprio pedido', async () => {
    // A regra é de papel, não de autoria: canReview não inclui editor. Que
    // ninguém revise o PRÓPRIO pedido é barreira da interface, e está dito lá
    // em voz alta — aqui se prova a parte que as Rules garantem.
    await semRegras(pedido(EDITOR.uid));
    await assertFails(
      setDoc(doc(ctx(EDITOR).firestore(), caminho), {
        ...pedido(EDITOR.uid),
        status: 'approved',
        reviewedBy: EDITOR.uid,
        reviewedAt: serverTimestamp(),
      }),
    );
  });

  it('revisor não assina a decisão como outra pessoa', async () => {
    await semRegras(pedido(EDITOR.uid));
    await assertFails(
      setDoc(doc(ctx(REVIEWER).firestore(), caminho), {
        ...pedido(EDITOR.uid),
        status: 'approved',
        reviewedBy: OWNER.uid,
        reviewedAt: serverTimestamp(),
      }),
    );
  });

  it('pedido não pode ser apagado', async () => {
    // Registro de decisão não se apaga: um pedido recusado que sumisse levaria
    // junto a prova de que a recusa aconteceu.
    await semRegras(pedido(EDITOR.uid));
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(ctx(OWNER).firestore(), caminho)));
  });

  it('aprovar não publica: revisor não escreve na árvore pública', async () => {
    // O ponto do fluxo inteiro. Um revisor com aprovação em mãos continua sem
    // conseguir tocar em publicWorkspaces.
    await assertFails(
      setDoc(doc(ctx(REVIEWER).firestore(), `publicWorkspaces/${WID}/projects/proj-app`), {
        name: 'Publicado por quem não publica',
        sourceEntityId: 'proj-app',
        sourceVersion: 1,
        releaseId: 'rel-x',
      }),
    );
  });
});
