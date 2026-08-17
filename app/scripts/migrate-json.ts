/**
 * Migração dos 11 JSON legados para o Firestore.
 *
 * ---------------------------------------------------------------------------
 * CREDENCIAIS — leia antes de executar
 * ---------------------------------------------------------------------------
 * Contra o Emulator: nenhuma credencial é necessária.
 * Contra produção: credencial padrão da aplicação (ADC), obtida com
 *
 *     gcloud auth application-default login
 *
 * Nunca baixe arquivo de service account para dentro do projeto.
 * ---------------------------------------------------------------------------
 *
 * Modos:
 *   (padrão)      dry-run — não escreve nada, só produz o relatório
 *   --emulator    escreve no Emulator local (projeto demo-*)
 *   --production  escreve em produção; exige --confirmar e FIREBASE_PROJECT_ID
 *
 * O plano é montado pelo mesmo código nos três modos. Um relatório que viesse
 * de um caminho diferente do da escrita não provaria nada.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMigrationPlan } from '../src/domain/migration/plan';
import type { MigrationPlan, MigrationSources } from '../src/domain/migration/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(HERE, '../src/data');
const OUT = resolve(HERE, 'output');

type Mode = 'dry-run' | 'emulator' | 'production';

function parseMode(): { mode: Mode; confirmed: boolean; workspaceId: string } {
  const args = process.argv.slice(2);
  const mode: Mode = args.includes('--production')
    ? 'production'
    : args.includes('--emulator')
      ? 'emulator'
      : 'dry-run';
  const workspaceArg = args.find((a) => a.startsWith('--workspace='));
  return {
    mode,
    confirmed: args.includes('--confirmar'),
    workspaceId: workspaceArg?.split('=')[1] ?? 'pmetgirs-rmrj',
  };
}

function readJson(name: string): unknown[] {
  return JSON.parse(readFileSync(resolve(DATA, `${name}.json`), 'utf8'));
}

function loadSources(): MigrationSources {
  return {
    municipios: readJson('municipios'),
    eixos: readJson('eixos'),
    projetos: readJson('projetos'),
    metas: readJson('metas'),
    infraestruturas: readJson('infraestruturas'),
    documentos: readJson('documentos'),
    inconsistencias: readJson('inconsistencias'),
    indicadores: readJson('indicadores'),
    indicadoresMunicipais: readJson('indicadoresMunicipais'),
    estimativasDeCusto: readJson('estimativasDeCusto'),
    priorizacaoGut: readJson('priorizacaoGut'),
    evolucao: readJson('evolucao'),
    glossario: readJson('glossario'),
    atualizacoes: readJson('atualizacoes'),
  };
}

// ------------------------------------------------------------------ relatório

function printReport(plan: MigrationPlan, mode: Mode): void {
  const errors = plan.issues.filter((i) => i.severity === 'error');
  const warnings = plan.issues.filter((i) => i.severity === 'warning');
  const infos = plan.issues.filter((i) => i.severity === 'info');

  const line = '─'.repeat(74);
  console.log(`\n${line}`);
  console.log(`  MIGRAÇÃO PMetGIRS — modo: ${mode}`);
  console.log(`  workspace: ${plan.workspaceId}    origem: ${plan.sourceFingerprint}`);
  console.log(line);

  console.log('\n  RECONCILIAÇÃO');
  const porColecao = plan.records.reduce<Record<string, number>>((acc, r) => {
    acc[r.collection] = (acc[r.collection] ?? 0) + 1;
    return acc;
  }, {});
  for (const [arquivo, total] of Object.entries(plan.sourceCounts)) {
    console.log(`    ${arquivo.padEnd(20)} ${String(total).padStart(3)} registros`);
  }
  console.log(`    ${'─'.repeat(20)} ${'─'.repeat(3)}`);
  console.log(`    ${'origem'.padEnd(20)} ${String(plan.totalSourceRecords).padStart(3)}`);
  console.log(`    ${'plano'.padEnd(20)} ${String(plan.records.length).padStart(3)}`);
  const bate = plan.records.length === plan.totalSourceRecords;
  console.log(`    ${bate ? 'CONFERE — zero perda' : '*** DIVERGE ***'}`);

  console.log('\n  DESTINO');
  for (const [colecao, total] of Object.entries(porColecao).sort()) {
    console.log(`    ${colecao.padEnd(20)} ${String(total).padStart(3)}`);
  }
  console.log(`    ${'evidence'.padEnd(20)} ${String(plan.evidence.length).padStart(3)} alegações de valor`);

  if (errors.length > 0) {
    console.log(`\n  ERROS (${errors.length}) — bloqueiam a importação`);
    for (const e of errors) {
      console.log(`    ✗ [${e.code}] ${e.message}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  AVISOS (${warnings.length}) — lacunas a decidir, não bloqueiam`);
    for (const w of warnings) {
      const alvo = w.recordId ? ` (${w.collection}/${w.recordId})` : '';
      console.log(`    ! [${w.code}]${alvo}`);
      console.log(`        ${w.message}`);
    }
  }

  if (infos.length > 0) {
    console.log(`\n  NOTAS (${infos.length})`);
    for (const i of infos) {
      console.log(`    · [${i.code}] ${i.message}`);
    }
  }

  const totalGaps = plan.records.reduce((sum, r) => sum + r.gaps.length, 0);
  console.log(`\n  LACUNAS: ${totalGaps} campos nulos preservados (nenhum convertido em zero)`);
  console.log(`\n${line}`);
  console.log(
    errors.length === 0
      ? `  RESULTADO: plano válido — ${plan.records.length} registros prontos`
      : `  RESULTADO: BLOQUEADO — ${errors.length} erro(s) a corrigir`,
  );
  console.log(`${line}\n`);
}

function writeReportFile(plan: MigrationPlan, mode: Mode): string {
  mkdirSync(OUT, { recursive: true });
  const path = resolve(OUT, `migracao-${mode}-${plan.sourceFingerprint}.json`);
  writeFileSync(
    path,
    JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        modo: mode,
        workspaceId: plan.workspaceId,
        sourceFingerprint: plan.sourceFingerprint,
        sourceCounts: plan.sourceCounts,
        totalSourceRecords: plan.totalSourceRecords,
        totalRecords: plan.records.length,
        totalEvidence: plan.evidence.length,
        issues: plan.issues,
        gapsPorRegistro: plan.records
          .filter((r) => r.gaps.length > 0)
          .map((r) => ({ collection: r.collection, id: r.id, gaps: r.gaps })),
      },
      null,
      2,
    ),
    'utf8',
  );
  return path;
}

// ------------------------------------------------------------------ escrita

async function write(plan: MigrationPlan, mode: Mode): Promise<void> {
  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  const { FieldValue, getFirestore } = await import('firebase-admin/firestore');

  const projectId =
    mode === 'emulator'
      ? 'demo-pmetgirs'
      : (process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT);

  if (!projectId) {
    throw new Error('Defina FIREBASE_PROJECT_ID no ambiente (não no repositório).');
  }

  if (mode === 'emulator') {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  }

  if (getApps().length === 0) {
    initializeApp(
      mode === 'emulator' ? { projectId } : { credential: applicationDefault(), projectId },
    );
  }

  const db = getFirestore();
  const base = `workspaces/${plan.workspaceId}`;
  const now = FieldValue.serverTimestamp();
  const correlationId = `migration-${plan.sourceFingerprint}`;

  // Lotes de 400: cada registro custa 2 escritas (documento + auditEvent) e o
  // limite do Firestore é 500 por lote.
  const CHUNK = 200;
  let gravados = 0;

  for (let i = 0; i < plan.records.length; i += CHUNK) {
    const fatia = plan.records.slice(i, i + CHUNK);
    const batch = db.batch();

    for (const record of fatia) {
      const eventRef = db.collection(`${base}/auditEvents`).doc();
      batch.set(eventRef, {
        id: eventRef.id,
        workspaceId: plan.workspaceId,
        entityCollection: record.collection,
        entityId: record.id,
        action: 'create',
        actorUid: 'migration',
        actorRole: 'owner',
        occurredAt: now,
        reason: `Migração da carga inicial (origem ${plan.sourceFingerprint})`,
        changedFields: Object.keys(record.data),
        toVersion: 1,
        correlationId,
        source: 'migration',
      });

      batch.set(db.doc(`${base}/${record.collection}/${record.id}`), {
        ...record.data,
        id: record.id,
        workspaceId: plan.workspaceId,
        legacyId: record.legacyId,
        schemaVersion: 1,
        version: 1,
        isArchived: false,
        lastEventId: eventRef.id,
        createdAt: now,
        createdBy: 'migration',
        updatedAt: now,
        updatedBy: 'migration',
        changeReason: 'Carga inicial migrada dos arquivos JSON versionados',
      });
    }

    await batch.commit();
    gravados += fatia.length;
    console.log(`    gravados ${gravados}/${plan.records.length}`);
  }

  if (plan.evidence.length > 0) {
    const batch = db.batch();
    for (const claim of plan.evidence) {
      batch.set(db.doc(`${base}/evidence/${claim.id}`), {
        ...claim,
        workspaceId: plan.workspaceId,
        schemaVersion: 1,
        version: 1,
        isArchived: false,
        createdAt: now,
        createdBy: 'migration',
        updatedAt: now,
        updatedBy: 'migration',
      });
    }
    await batch.commit();
    console.log(`    gravadas ${plan.evidence.length} alegações de valor`);
  }
}

// --------------------------------------------------------------------- main

async function main() {
  const { mode, confirmed, workspaceId } = parseMode();
  const plan = buildMigrationPlan(loadSources(), workspaceId);

  printReport(plan, mode);
  const reportPath = writeReportFile(plan, mode);
  console.log(`  Relatório: ${reportPath}\n`);

  const errors = plan.issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    console.error('  Importação bloqueada: corrija os erros acima.\n');
    process.exit(1);
  }

  if (mode === 'dry-run') {
    console.log('  Dry-run: nada foi escrito.');
    console.log('  Para escrever no Emulator:  npm run migrate:emulator');
    console.log('  Para escrever em produção:  npm run migrate:prod -- --confirmar\n');
    return;
  }

  if (mode === 'production' && !confirmed) {
    console.error('  Produção exige --confirmar. Nada foi escrito.\n');
    process.exit(1);
  }

  console.log(`  Escrevendo (${mode})...`);
  await write(plan, mode);
  console.log('\n  Concluído.\n');
}

main().catch((error) => {
  console.error('Falha na migração:', error instanceof Error ? error.message : error);
  process.exit(1);
});
