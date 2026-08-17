/**
 * Convite de acesso ao workspace.
 *
 * ---------------------------------------------------------------------------
 * CREDENCIAIS — leia antes de executar
 * ---------------------------------------------------------------------------
 * Este script NÃO contém, NÃO lê e NÃO grava nenhuma chave. Usa a credencial
 * padrão da aplicação (ADC), obtida com:
 *
 *     gcloud auth application-default login
 * ---------------------------------------------------------------------------
 *
 * ESTE SCRIPT NÃO ENVIA E-MAIL, e é importante que isso não seja mal-entendido.
 * O sistema roda no plano gratuito do Firebase, sem Cloud Functions, e não tem
 * como disparar mensagem alguma. O que ele faz é gravar o convite; quem avisa a
 * pessoa é você, pelo canal que preferir.
 *
 * Como o convite funciona, do lado de quem recebe:
 *
 *   1. a pessoa entra em /app com a conta Google DAQUELE endereço;
 *   2. a aplicação encontra o convite pendente para o e-mail autenticado;
 *   3. ela cria o próprio documento de membro, com o papel que o convite diz.
 *
 * O passo 3 é do cliente, não deste script — e as Security Rules conferem, uma
 * a uma, que o convite existe, que é do mesmo e-mail, que o papel bate, que
 * ainda está pendente e que não expirou. Um convite não é um atalho de
 * permissão: é uma autorização nominal e datada.
 *
 * Uso:
 *   npm run convidar -- --email=<email> --role=<papel> [--dias=7] [--workspace=<id>]
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';

/** Os mesmos que as Rules aceitam em members. 'owner' não entra: não se convida proprietário. */
const PAPEIS = ['admin', 'editor', 'reviewer', 'viewer', 'external_partner'] as const;
type Papel = (typeof PAPEIS)[number];

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args.set(m[1], m[2]);
  }

  const email = (args.get('email') ?? '').trim().toLowerCase();
  const role = (args.get('role') ?? '') as Papel;
  const dias = Number(args.get('dias') ?? '7');
  const workspace = args.get('workspace') ?? 'pmetgirs-rmrj';

  if (!email || !role) {
    console.error(
      'Uso: npm run convidar -- --email=<email> --role=<papel> [--dias=7]\n\n' +
        `Papéis: ${PAPEIS.join(', ')}`,
    );
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`E-mail inválido: ${email}`);
    process.exit(1);
  }
  if (!PAPEIS.includes(role)) {
    console.error(`Papel inválido: "${role}". Use um de: ${PAPEIS.join(', ')}`);
    process.exit(1);
  }
  if (!Number.isInteger(dias) || dias < 1 || dias > 30) {
    console.error(`--dias deve ser inteiro de 1 a 30. Recebido: ${args.get('dias')}`);
    process.exit(1);
  }

  return { email, role, dias, workspace };
}

async function main() {
  const { email, role, dias, workspace } = parseArgs();

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
  if (!projectId) {
    console.error('Defina FIREBASE_PROJECT_ID no ambiente (não no repositório).');
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId });
  }
  const db = getFirestore();

  // Convite pendente e ainda válido para o mesmo e-mail já resolve; criar outro
  // só multiplicaria registros para a mesma autorização.
  const existentes = await db
    .collection(`workspaces/${workspace}/invitations`)
    .where('email', '==', email)
    .get();

  const agora = Timestamp.now();
  const vigente = existentes.docs.find(
    (d) => d.data().status === 'pending' && (d.data().expiresAt?.toMillis?.() ?? 0) > agora.toMillis(),
  );
  if (vigente) {
    const validade = vigente.data().expiresAt.toDate();
    console.error(
      `Já existe convite pendente para ${email} (${vigente.id}), papel "${vigente.data().role}", ` +
        `válido até ${validade.toLocaleString('pt-BR')}.\n` +
        'Apague-o antes de emitir outro, para não haver duas autorizações vivas para a mesma pessoa.',
    );
    process.exit(1);
  }

  const jaMembro = await db
    .collection(`workspaces/${workspace}/members`)
    .where('email', '==', email)
    .get();
  if (!jaMembro.empty) {
    console.error(`${email} já é membro do workspace, com papel "${jaMembro.docs[0].data().role}".`);
    process.exit(1);
  }

  const ref = db.collection(`workspaces/${workspace}/invitations`).doc();
  const expiraEm = Timestamp.fromMillis(Date.now() + dias * 24 * 3600 * 1000);

  const eventRef = db.collection(`workspaces/${workspace}/auditEvents`).doc();
  const batch = db.batch();

  batch.set(ref, {
    id: ref.id,
    workspaceId: workspace,
    email,
    role,
    status: 'pending',
    expiresAt: expiraEm,
    createdAt: FieldValue.serverTimestamp(),
    acceptedAt: null,
    acceptedByUid: null,
  });

  // Convite é ato de governança: entra na auditoria como qualquer outro.
  batch.set(eventRef, {
    id: eventRef.id,
    workspaceId: workspace,
    entityCollection: 'invitations',
    entityId: ref.id,
    action: 'create',
    actorUid: 'admin_script',
    actorRole: 'owner',
    occurredAt: FieldValue.serverTimestamp(),
    reason: `Convite para ${email} com papel ${role}, válido por ${dias} dia(s)`,
    changedFields: ['email', 'role', 'status', 'expiresAt'],
    toVersion: 1,
    correlationId: ref.id,
    source: 'bootstrap_admin',
  });

  await batch.commit();

  console.log(`\n  Convite gravado.\n`);
  console.log(`    id        ${ref.id}`);
  console.log(`    e-mail    ${email}`);
  console.log(`    papel     ${role}`);
  console.log(`    validade  ${expiraEm.toDate().toLocaleString('pt-BR')} (${dias} dia(s))`);
  console.log(`\n  NENHUM E-MAIL FOI ENVIADO — o plano gratuito não tem como enviar.`);
  console.log(`  Avise a pessoa você mesmo e peça que entre em /app com a conta`);
  console.log(`  Google de ${email}. O acesso é criado no primeiro login.\n`);
}

main().catch((e) => {
  console.error('Falha ao convidar:', e instanceof Error ? e.message : e);
  process.exit(1);
});
