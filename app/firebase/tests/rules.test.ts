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
        publishedBy: OWNER.uid,
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
      createdBy: EDITOR.uid,
      updatedAt: serverTimestamp(),
      updatedBy: EDITOR.uid,
      ...overrides,
    };
  }

  function eventoValido(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ev-1',
      workspaceId: WID,
      entityCollection: 'projects',
      entityId: 'proj-novo',
      actorUid: EDITOR.uid,
      occurredAt: serverTimestamp(),
      toVersion: 1,
      reason: 'Criação do projeto',
      ...overrides,
    };
  }

  it('editor cria projeto quando o auditEvent vem no mesmo lote', async () => {
    const db = ctx(EDITOR).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, `workspaces/${WID}/auditEvents/ev-1`), eventoValido());
    batch.set(doc(db, `workspaces/${WID}/projects/proj-novo`), projetoValido());
    await assertSucceeds(batch.commit());
  });

  it('editor NÃO cria projeto sem auditEvent', async () => {
    const db = ctx(EDITOR).firestore();
    await assertFails(setDoc(doc(db, `workspaces/${WID}/projects/proj-novo`), projetoValido()));
  });

  it('editor NÃO cria projeto com auditEvent de outra entidade', async () => {
    const db = ctx(EDITOR).firestore();
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

  it('editor NÃO incrementa a versão fora de sequência', async () => {
    const db = ctx(EDITOR).firestore();
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
      updatedBy: EDITOR.uid,
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

  it('editor cria projeto pelo caminho real da aplicação', async () => {
    const db = ctx(EDITOR).firestore();
    await assertSucceeds(commit(db, criar(EDITOR.uid, 'editor'), 'ev-app-1'));
  });

  it('editor atualiza projeto pelo caminho real, com versão +1', async () => {
    const db = ctx(EDITOR).firestore();
    await assertSucceeds(commit(db, criar(EDITOR.uid, 'editor'), 'ev-app-2'));

    // Recarrega o documento inteiro antes de editar, como a interface faz.
    // createdAt e createdBy precisam voltar idênticos: as Rules conferem.
    const atual = (await getDoc(doc(db, `workspaces/${WID}/projects/proj-app`))).data()!;

    await assertSucceeds(
      commit(
        db,
        {
          ...criar(EDITOR.uid, 'editor'),
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
    const db = ctx(EDITOR).firestore();
    await assertSucceeds(commit(db, criar(EDITOR.uid, 'editor'), 'ev-app-6'));

    const evento = await getDoc(doc(db, `workspaces/${WID}/auditEvents/ev-app-6`));
    expect(evento.exists()).toBe(true);
    expect(evento.data()?.entityId).toBe('proj-app');
    expect(evento.data()?.entityCollection).toBe('projects');
    expect(evento.data()?.actorUid).toBe(EDITOR.uid);
    expect(evento.data()?.toVersion).toBe(1);
    expect(evento.data()?.reason).toBe('Cadastro pela interface de gestão');
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
  const projecao = (uid: string) => ({
    sourceEntityId: 'proj-1',
    sourceVersion: 1,
    name: 'Projeto publicado',
    publishedAt: serverTimestamp(),
    publishedBy: uid,
  });

  it('somente o owner publica', async () => {
    const db = ctx(OWNER).firestore();
    await assertSucceeds(
      setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), projecao(OWNER.uid)),
    );
  });

  it('admin NÃO publica', async () => {
    const db = ctx(ADMIN).firestore();
    await assertFails(setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), projecao(ADMIN.uid)));
  });

  it('editor NÃO publica', async () => {
    const db = ctx(EDITOR).firestore();
    await assertFails(setDoc(doc(db, `publicWorkspaces/${WID}/projects/proj-1`), projecao(EDITOR.uid)));
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
