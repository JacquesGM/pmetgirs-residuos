/**
 * Exportação lógica do Firestore — e o ensaio de restauração que a torna real.
 *
 * Backup gerenciado, PITR e clone exigem plano Blaze. No Spark resta a
 * exportação lógica, e o documento de arquitetura é explícito quanto ao que a
 * torna confiável: "ensaio de restore em ambiente não produtivo". Backup que
 * nunca foi restaurado não é backup, é esperança versionada.
 *
 * Modos:
 *   (padrão)     lê produção e escreve backups/<carimbo>/
 *   --restaurar  escreve um backup no Emulator e compara documento a documento
 *   --ultimo     usado com --restaurar: pega o backup mais recente
 *
 * A restauração **nunca** aponta para produção. Não há bandeira que permita
 * isso: sobrescrever produção a partir de arquivo é operação de incidente, com
 * decisão humana, não algo que um script ofereça por conveniência.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_BACKUPS = join(AQUI, '..', 'backups');

/**
 * Subcoleções do workspace que compõem o estado recuperável. `auditEvents`
 * entra: sem ela o backup restaura os dados e perde a trilha de quem os mudou.
 */
const COLECOES_INTERNAS = [
  'members',
  'invitations',
  'accessRequests',
  'plans',
  'axes',
  'projects',
  'goals',
  'indicators',
  'municipalities',
  'infrastructures',
  'documents',
  'inconsistencies',
  'glossary',
  'evidence',
  'milestones',
  'municipalIndicators',
  'costEstimates',
  'gutPriorities',
  'dependencies',
  'treatmentCentrals',
  'economicViability',
  'imports',
  'settings',
  'approvalRequests',
  'publicationReleases',
  'auditEvents',
];

const COLECOES_PUBLICAS = [
  'projects',
  'treatmentCentrals',
  'economicViability',
  'axes',
  'indicators',
  'municipalIndicators',
  'municipalities',
  'goals',
  'infrastructures',
  'documents',
  'inconsistencies',
  'glossary',
  'evidence',
];

interface Documento {
  id: string;
  data: Record<string, unknown>;
}

interface Backup {
  geradoEm: string;
  projeto: string;
  workspace: string;
  /** Contagem por caminho, para conferência rápida sem reler tudo. */
  contagens: Record<string, number>;
  totalDocumentos: number;
  /** SHA-256 do conteúdo serializado, sem o próprio cabeçalho. */
  sha256: string;
  colecoes: Record<string, Documento[]>;
}

class Abortado extends Error {}

/** Serialização determinística: chaves ordenadas, ordem de array preservada. */
function serializar(valor: unknown): string {
  return JSON.stringify(valor, (_chave, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(
        ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
      ));
    }
    return v;
  });
}

async function conectar(alvo: 'producao' | 'emulador') {
  const { initializeApp, applicationDefault, getApps, deleteApp, getApp } = await import(
    'firebase-admin/app'
  );
  const { getFirestore } = await import('firebase-admin/firestore');

  if (alvo === 'emulador') {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  } else {
    // Uma variável de emulador esquecida no ambiente faria a "exportação de
    // produção" ler um banco vazio e gravar um backup vazio, sem erro algum.
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Abortado(
        'FIRESTORE_EMULATOR_HOST está definido. Um backup de produção não pode ' +
          'sair de um emulador — limpe a variável e rode de novo.',
      );
    }
  }

  const projectId =
    alvo === 'emulador'
      ? 'demo-pmetgirs'
      : (process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT);

  if (!projectId) {
    throw new Abortado('Defina FIREBASE_PROJECT_ID no ambiente (não no repositório).');
  }

  if (getApps().length > 0) await deleteApp(getApp());
  initializeApp(
    alvo === 'emulador' ? { projectId } : { credential: applicationDefault(), projectId },
  );
  return { db: getFirestore(), projectId };
}

// ------------------------------------------------------------------ exportar

async function exportar(workspace: string): Promise<string> {
  const { db, projectId } = await conectar('producao');

  const colecoes: Record<string, Documento[]> = {};
  const contagens: Record<string, number> = {};

  const ler = async (caminho: string) => {
    const snap = await db.collection(caminho).get();
    const docs = snap.docs
      .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (docs.length > 0) {
      colecoes[caminho] = docs;
      contagens[caminho] = docs.length;
    }
  };

  for (const c of COLECOES_INTERNAS) await ler(`workspaces/${workspace}/${c}`);
  for (const c of COLECOES_PUBLICAS) await ler(`publicWorkspaces/${workspace}/${c}`);

  // A lista acima é escrita à mão de propósito: enumerar coleções é decisão de
  // segurança, não conveniência. Mas lista escrita à mão envelhece — em
  // 16/08/2026 uma coleção inteira, com 242 registros, ficou de fora do backup
  // por três horas sem que nada acusasse. Agora o Firestore é perguntado quais
  // subcoleções existem de verdade, e o que a lista não cobre aborta a execução.
  const declaradas = new Set([
    ...COLECOES_INTERNAS.map((c) => `workspaces/${workspace}/${c}`),
    ...COLECOES_PUBLICAS.map((c) => `publicWorkspaces/${workspace}/${c}`),
  ]);
  const existentes: string[] = [];
  for (const raiz of ['workspaces', 'publicWorkspaces']) {
    for (const sub of await db.doc(`${raiz}/${workspace}`).listCollections()) {
      existentes.push(`${raiz}/${workspace}/${sub.id}`);
    }
  }
  const esquecidas = existentes.filter((c) => !declaradas.has(c));
  if (esquecidas.length > 0) {
    throw new Abortado(
      'Existem coleções fora da lista do backup. Um backup que ignora coleção em silêncio é ' +
        'pior que nenhum, porque parece completo:\n    ' + esquecidas.join('\n    '),
    );
  }

  const total = Object.values(contagens).reduce((s, n) => s + n, 0);
  if (total === 0) {
    throw new Abortado(
      'Nenhum documento lido. Um backup vazio é pior que nenhum backup: ele ' +
        'passa a impressão de que existe cópia. Verifique credencial e workspace.',
    );
  }

  const backup: Backup = {
    geradoEm: new Date().toISOString(),
    projeto: projectId,
    workspace,
    contagens,
    totalDocumentos: total,
    sha256: createHash('sha256').update(serializar(colecoes)).digest('hex'),
    colecoes,
  };

  const carimbo = backup.geradoEm.replace(/[:.]/g, '-');
  const destino = join(RAIZ_BACKUPS, carimbo);
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, 'backup.json'), JSON.stringify(backup, null, 2), 'utf8');

  console.log(`\n  Projeto: ${projectId}   Workspace: ${workspace}`);
  console.log('  ' + '─'.repeat(58) + '\n');
  for (const [caminho, n] of Object.entries(contagens).sort()) {
    console.log(`  ${String(n).padStart(5)}  ${caminho}`);
  }
  console.log(`\n  Total: ${total} documentos`);
  console.log(`  SHA-256: ${backup.sha256.slice(0, 16)}…`);
  console.log(`  Escrito em backups/${carimbo}/backup.json`);
  return destino;
}

// ---------------------------------------------------------------- restaurar

function backupMaisRecente(): string {
  if (!existsSync(RAIZ_BACKUPS)) throw new Abortado('Não há pasta backups/. Rode a exportação antes.');
  const pastas = readdirSync(RAIZ_BACKUPS).filter((p) =>
    existsSync(join(RAIZ_BACKUPS, p, 'backup.json')),
  );
  if (pastas.length === 0) throw new Abortado('Nenhum backup encontrado em backups/.');
  return join(RAIZ_BACKUPS, pastas.sort().at(-1)!);
}

async function restaurar(pasta: string): Promise<void> {
  const backup: Backup = JSON.parse(readFileSync(join(pasta, 'backup.json'), 'utf8'));

  const recalculado = createHash('sha256').update(serializar(backup.colecoes)).digest('hex');
  if (recalculado !== backup.sha256) {
    throw new Abortado(
      `O arquivo mudou depois de gerado.\n  gravado:     ${backup.sha256}\n  recalculado: ${recalculado}`,
    );
  }
  console.log(`\n  Backup de ${backup.geradoEm} — ${backup.totalDocumentos} documentos`);
  console.log('  Integridade do arquivo: confere.\n');

  const { db } = await conectar('emulador');

  let gravados = 0;
  for (const [caminho, docs] of Object.entries(backup.colecoes)) {
    for (let i = 0; i < docs.length; i += 400) {
      const lote = db.batch();
      for (const doc of docs.slice(i, i + 400)) {
        lote.set(db.collection(caminho).doc(doc.id), doc.data);
      }
      await lote.commit();
      gravados += Math.min(400, docs.length - i);
    }
  }
  console.log(`  Restaurados ${gravados} documentos no Emulator.`);

  // A prova: reler o que foi escrito e exigir que bata documento a documento.
  // Contagem igual não prova conteúdo igual — foi assim que dois defeitos
  // passaram despercebidos em 15/08/2026.
  const divergencias: string[] = [];
  for (const [caminho, docs] of Object.entries(backup.colecoes)) {
    const snap = await db.collection(caminho).get();
    if (snap.size !== docs.length) {
      divergencias.push(`${caminho}: ${snap.size} lidos, ${docs.length} esperados`);
      continue;
    }
    const lidos = new Map(snap.docs.map((d) => [d.id, serializar(d.data())]));
    for (const doc of docs) {
      const lido = lidos.get(doc.id);
      if (lido === undefined) divergencias.push(`${caminho}/${doc.id}: ausente`);
      else if (lido !== serializar(doc.data)) divergencias.push(`${caminho}/${doc.id}: conteúdo difere`);
    }
  }

  if (divergencias.length > 0) {
    console.error(`\n  ENSAIO FALHOU — ${divergencias.length} divergência(s):`);
    for (const d of divergencias.slice(0, 15)) console.error(`    · ${d}`);
    throw new Abortado('A restauração não reproduz o backup.');
  }

  console.log('  Conferência: cada documento restaurado bate com o backup, campo a campo.');
  console.log('\n  Ensaio concluído. Este backup é restaurável.');
}

// ------------------------------------------------------------------ entrada

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const workspace = process.env.VITE_WORKSPACE_ID ?? 'pmetgirs-rmrj';

  if (args.includes('--restaurar')) {
    const pasta = args.includes('--ultimo')
      ? backupMaisRecente()
      : (args.find((a) => !a.startsWith('--')) ?? backupMaisRecente());
    await restaurar(pasta);
    return;
  }

  await exportar(workspace);
  console.log('\n  Ensaie a restauração antes de confiar nele:');
  console.log('    npm run backup:ensaio');
}

main().catch((erro) => {
  console.error(`\n  ${erro instanceof Abortado ? erro.message : erro}`);
  // process.exit() derruba o processo antes do flush no Windows (assertion do
  // libuv). Marcar o código deixa o Node encerrar sozinho.
  process.exitCode = 1;
});
