/**
 * Bootstrap do proprietário do workspace.
 *
 * ---------------------------------------------------------------------------
 * CREDENCIAIS — leia antes de executar
 * ---------------------------------------------------------------------------
 * Este script NÃO contém, NÃO lê e NÃO grava nenhuma chave. Ele usa a
 * credencial padrão da aplicação (ADC), obtida com:
 *
 *     gcloud auth application-default login
 *
 * Nunca baixe um arquivo de service account para o repositório. Se a sua
 * organização exigir service account, exporte GOOGLE_APPLICATION_CREDENTIALS
 * apontando para um caminho FORA do projeto, use e revogue depois.
 *
 * Chave privada, senha ou token não entram em código, .env, commit ou mensagem.
 * ---------------------------------------------------------------------------
 *
 * O que faz: cria o workspace e o documento de membro do proprietário com
 * role=owner e status=active, mais o evento de auditoria correspondente.
 *
 * Por que existe: as Security Rules impedem que qualquer cliente crie um
 * membro com papel 'owner'. Sem essa porta administrativa, ninguém entraria no
 * sistema pela primeira vez. Por isso ela vive fora da aplicação, é executada à
 * mão e fica registrada na auditoria com origem 'bootstrap_admin'.
 *
 * Uso:
 *   npm run bootstrap:owner -- --uid=<UID> --email=<email> [--workspace=<id>]
 *
 * O UID sai do console do Firebase, em Authentication, DEPOIS de o
 * proprietário entrar uma vez com a conta Google.
 */

import { cert, initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

interface Args {
  uid: string;
  email: string;
  workspace: string;
}

function parseArgs(): Args {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args.set(match[1], match[2]);
  }

  const uid = args.get('uid');
  const email = args.get('email');
  const workspace = args.get('workspace') ?? 'pmetgirs-rmrj';

  if (!uid || !email) {
    console.error(
      'Uso: npm run bootstrap:owner -- --uid=<UID> --email=<email> [--workspace=<id>]\n\n' +
        'O UID está no console do Firebase, em Authentication, depois do primeiro login.',
    );
    process.exit(1);
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`E-mail inválido: ${email}`);
    process.exit(1);
  }

  return { uid, email, workspace };
}

async function main() {
  const { uid, email, workspace } = parseArgs();

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
  if (!projectId) {
    console.error(
      'Defina FIREBASE_PROJECT_ID no ambiente (não no repositório) antes de executar.\n' +
        'Exemplo: FIREBASE_PROJECT_ID=meu-projeto npm run bootstrap:owner -- --uid=... --email=...',
    );
    process.exit(1);
  }

  if (getApps().length === 0) {
    // `cert` é importado apenas para deixar explícito que NÃO é usado aqui:
    // a credencial vem do ambiente, nunca de um arquivo no projeto.
    void cert;
    initializeApp({ credential: applicationDefault(), projectId });
  }

  const db = getFirestore();
  const memberRef = db.doc(`workspaces/${workspace}/members/${uid}`);

  const existing = await memberRef.get();
  if (existing.exists) {
    console.error(
      `Já existe um membro em workspaces/${workspace}/members/${uid}.\n` +
        'Transferência de propriedade é procedimento administrativo separado; este script não sobrescreve.',
    );
    process.exit(1);
  }

  const eventRef = db.collection(`workspaces/${workspace}/auditEvents`).doc();
  const batch = db.batch();

  batch.set(
    db.doc(`workspaces/${workspace}`),
    {
      id: workspace,
      name: 'PMetGIRS — Região Metropolitana do Rio de Janeiro',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      schemaVersion: 1,
    },
    { merge: true },
  );

  batch.set(memberRef, {
    uid,
    email,
    role: 'owner',
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: uid,
  });

  batch.set(eventRef, {
    id: eventRef.id,
    workspaceId: workspace,
    entityCollection: 'members',
    entityId: uid,
    action: 'access_change',
    actorUid: uid,
    actorRole: 'owner',
    occurredAt: FieldValue.serverTimestamp(),
    reason: 'Bootstrap do proprietário via Admin SDK',
    changedFields: ['role', 'status'],
    toVersion: 1,
    correlationId: eventRef.id,
    source: 'bootstrap_admin',
  });

  await batch.commit();

  console.log(
    [
      '',
      'Proprietário criado.',
      `  projeto:    ${projectId}`,
      `  workspace:  ${workspace}`,
      `  uid:        ${uid}`,
      `  e-mail:     ${email}`,
      `  auditoria:  ${eventRef.id}`,
      '',
      'Próximos passos:',
      '  1. Entre em /app e confirme que o painel abre.',
      '  2. Registre esta execução no runbook, fora do repositório.',
      '  3. Revogue a credencial usada: gcloud auth application-default revoke',
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error('Falha no bootstrap:', error instanceof Error ? error.message : error);
  process.exit(1);
});
