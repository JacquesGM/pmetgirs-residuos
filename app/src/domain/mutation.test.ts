import { describe, expect, it } from 'vitest';
import { buildMutation, diffFields, MutationError, SERVER_TIME } from './mutation';
import type { MutationInput } from './mutation';

const base: MutationInput = {
  workspaceId: 'pmetgirs-rmrj',
  collection: 'projects',
  id: 'plano-negocios-pmetgirs',
  data: { name: 'Elaboração do Plano de Negócios', executionStatus: 'structuring' },
  actorUid: 'uid-editor',
  actorRole: 'editor',
  action: 'create',
  reason: 'Cadastro inicial',
};

describe('criação', () => {
  const plan = buildMutation(base, 'ev-1');

  it('começa na versão 1', () => {
    expect(plan.nextVersion).toBe(1);
    expect(plan.doc.version).toBe(1);
  });

  it('aponta o documento para o evento gravado no mesmo lote', () => {
    expect(plan.doc.lastEventId).toBe('ev-1');
    expect(plan.event.id).toBe('ev-1');
    expect(plan.event.entityId).toBe(base.id);
    expect(plan.event.entityCollection).toBe('projects');
  });

  it('usa carimbo de servidor, nunca hora do cliente', () => {
    expect(plan.doc.createdAt).toBe(SERVER_TIME);
    expect(plan.doc.updatedAt).toBe(SERVER_TIME);
    expect(plan.event.occurredAt).toBe(SERVER_TIME);
  });

  it('registra o ator e o papel no evento', () => {
    expect(plan.event.actorUid).toBe('uid-editor');
    expect(plan.event.actorRole).toBe('editor');
    expect(plan.event.source).toBe('web');
  });

  it('escreve nos dois caminhos esperados', () => {
    expect(plan.docPath).toBe('workspaces/pmetgirs-rmrj/projects/plano-negocios-pmetgirs');
    expect(plan.eventPath).toBe('workspaces/pmetgirs-rmrj/auditEvents/ev-1');
  });
});

describe('atualização', () => {
  const input: MutationInput = {
    ...base,
    action: 'update',
    reason: 'Atualiza a situação após reunião do comitê',
    currentVersion: 3,
    currentData: {
      name: 'Elaboração do Plano de Negócios',
      executionStatus: 'not_started',
      createdAt: 'antes',
      createdBy: 'uid-owner',
    },
    data: { name: 'Elaboração do Plano de Negócios', executionStatus: 'structuring' },
  };

  const plan = buildMutation(input, 'ev-2');

  it('incrementa a versão de um em um', () => {
    expect(plan.nextVersion).toBe(4);
    expect(plan.event.fromVersion).toBe(3);
    expect(plan.event.toVersion).toBe(4);
  });

  it('lista exatamente os campos que mudaram', () => {
    expect(plan.changedFields).toEqual(['createdAt', 'createdBy', 'executionStatus']);
    expect(plan.event.changedFields).toEqual(plan.changedFields);
  });

  it('preserva createdAt e createdBy do registro original', () => {
    expect(plan.doc.createdAt).toBe('antes');
    expect(plan.doc.createdBy).toBe('uid-owner');
  });

  it('recusa alteração de campo imutável', () => {
    expect(() =>
      buildMutation({ ...input, data: { ...input.data, workspaceId: 'outro' } }, 'ev-3'),
    ).toThrow(MutationError);
  });

  it('recusa gravação que não muda nada', () => {
    expect(() =>
      buildMutation({ ...input, data: { ...input.currentData } }, 'ev-4'),
    ).toThrow(/Nada mudou/);
  });

  it('recusa atualização sem createdAt no estado atual', () => {
    // As Rules exigem createdAt idêntico ao gravado. Sem ele, o servidor
    // recusaria com permission-denied, que não diz o que fazer. Falhar aqui,
    // com a causa nomeada, poupa a caçada.
    expect(() =>
      buildMutation(
        { ...input, currentData: { name: 'x' }, data: { name: 'y' } },
        'ev-8',
      ),
    ).toThrow(/Carregue o documento inteiro/);
  });
});

describe('motivo obrigatório', () => {
  it('recusa motivo vazio', () => {
    expect(() => buildMutation({ ...base, reason: '' }, 'ev-5')).toThrow(MutationError);
  });

  it('recusa motivo só com espaços', () => {
    expect(() => buildMutation({ ...base, reason: '   ' }, 'ev-6')).toThrow(
      /prestação de contas/,
    );
  });
});

describe('arquivamento', () => {
  const plan = buildMutation(
    {
      ...base,
      action: 'archive',
      reason: 'Ação absorvida pelo Plano de Negócios',
      currentVersion: 1,
      currentData: { name: 'x', isArchived: false, createdAt: 'antes', createdBy: 'uid-owner' },
      data: { name: 'y' },
    },
    'ev-7',
  );

  it('marca como arquivado em vez de apagar', () => {
    expect(plan.doc.isArchived).toBe(true);
    expect(plan.doc.archivedAt).toBe(SERVER_TIME);
    expect(plan.doc.archivedBy).toBe('uid-editor');
  });

  it('registra a ação como archive na auditoria', () => {
    expect(plan.event.action).toBe('archive');
  });
});

describe('diffFields', () => {
  it('em criação, considera todos os campos alterados', () => {
    expect(diffFields(undefined, { a: 1, b: 2 })).toEqual(['a', 'b']);
  });

  it('detecta alteração em estrutura aninhada', () => {
    expect(diffFields({ a: { x: 1 } }, { a: { x: 2 } })).toEqual(['a']);
  });

  it('ignora campos iguais', () => {
    expect(diffFields({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual(['b']);
  });

  it('detecta campo removido', () => {
    expect(diffFields({ a: 1, b: 2 }, { a: 1 })).toEqual(['b']);
  });
});
