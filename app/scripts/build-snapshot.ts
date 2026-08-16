/**
 * Gera o snapshot público a partir da projeção publicada.
 *
 * O portal do cidadão lê arquivo, nunca o banco. Este script é a ponte: lê
 * `publicWorkspaces` uma vez, monta os arquivos estáticos com manifesto e
 * SHA-256, valida, e escreve em `public/data/`. A leitura acontece por release,
 * não por visita — é o que mantém o tráfego público fora da cota do Firestore.
 *
 * Uso:
 *   npm run snapshot                 # gera e escreve
 *   npm run snapshot -- --dry-run    # valida sem escrever
 *   npm run snapshot -- --check      # falha se o que está em disco diverge
 *
 * Ambiente:
 *   FIREBASE_PROJECT_ID   obrigatório
 *   FIREBASE_API_KEY      obrigatório — pública por natureza, identifica o projeto
 *   WORKSPACE_ID          opcional, padrão pmetgirs-rmrj
 *
 * Nenhuma credencial privada é usada: a projeção pública é legível sem
 * autenticação, por decisão registrada nas Security Rules.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPublishedCollection, type AcessoPublico } from '../src/data/published/firestoreRest';
import { toProjeto } from '../src/data/published/publishedProjects';
import {
  montarManifesto,
  serializarDeterministico,
  validarSnapshot,
  varrerPii,
  type AchadoPii,
  type ArquivoDoSnapshot,
} from '../src/domain/publication/snapshot';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'public', 'data');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const check = args.includes('--check');

/**
 * Coleções publicadas e o nome do arquivo de cada uma.
 *
 * Só `projects` está publicada hoje. As demais entram aqui conforme forem
 * publicadas — o portal continua servindo o JSON embutido para as que faltam.
 */
const COLECOES: Array<{ colecao: string; arquivo: string; mapear: (doc: never) => unknown }> = [
  { colecao: 'projects', arquivo: 'projetos.json', mapear: toProjeto as never },
];

function sha256(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

/**
 * Encerra com falha sem `process.exit()`.
 *
 * Sair no meio de requisições pendentes derruba o libuv com um assertion no
 * Windows, e o barulho pode encobrir o código de saída — justamente o que o CI
 * lê para decidir se bloqueia a publicação. Marcar `exitCode` e deixar o
 * processo terminar sozinho é determinístico nas duas plataformas.
 */
class Abortado extends Error {}

function abortar(mensagem: string): never {
  console.error(`\n  ${mensagem}\n`);
  throw new Abortado(mensagem);
}

async function main() {
  const acesso: AcessoPublico = {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    apiKey: process.env.FIREBASE_API_KEY ?? '',
    workspaceId: process.env.WORKSPACE_ID ?? 'pmetgirs-rmrj',
  };

  if (!acesso.projectId || !acesso.apiKey) {
    abortar(
      'Defina FIREBASE_PROJECT_ID e FIREBASE_API_KEY no ambiente.\n' +
        '  A chave de API é pública; mesmo assim não deve ser commitada.',
    );
  }

  console.log(`\n  Projeto: ${acesso.projectId}   Workspace: ${acesso.workspaceId}`);
  console.log('  ──────────────────────────────────────────────────────────\n');

  const arquivos: ArquivoDoSnapshot[] = [];
  const conteudos = new Map<string, string>();
  const achadosPii: AchadoPii[] = [];
  const releaseIds: string[] = [];

  for (const { colecao, arquivo, mapear } of COLECOES) {
    const docs = await fetchPublishedCollection(colecao, acesso);

    if (!docs) {
      // null significa "não deu para ler" ou "nada publicado" — os dois casos
      // pedem a mesma resposta: não escrever arquivo nenhum. Um arquivo vazio
      // apagaria a seção no portal.
      console.log(`  ${colecao.padEnd(16)} nada publicado — arquivo não gerado`);
      continue;
    }

    for (const doc of docs) {
      const rid = doc.data.releaseId;
      if (typeof rid === 'string') releaseIds.push(rid);
    }

    const registros = docs
      .map((d) => mapear(d as never))
      .filter((r) => (r as { nome?: string }).nome !== '')
      .sort((a, b) =>
        String((a as { id: string }).id).localeCompare(String((b as { id: string }).id), 'pt-BR'),
      );

    const caminho = `current/${arquivo}`;
    const conteudo = serializarDeterministico(registros);
    const bytes = Buffer.byteLength(conteudo, 'utf8');
    const hash = sha256(conteudo);

    achadosPii.push(...varrerPii(conteudo, caminho));
    conteudos.set(caminho, conteudo);
    arquivos.push({ path: caminho, sha256: hash, bytes, registros: registros.length });

    console.log(
      `  ${colecao.padEnd(16)} ${String(registros.length).padStart(4)} registros   ` +
        `${String(bytes).padStart(7)} B   ${hash.slice(0, 12)}…`,
    );
  }

  // ---------------------------------------------------------------- validação

  const problemas = validarSnapshot(arquivos, achadosPii);
  const bloqueios = problemas.filter((p) => p.gravidade === 'bloqueia');

  console.log('');
  if (problemas.length === 0) {
    console.log('  Validação: sem problemas.');
  } else {
    for (const p of problemas) {
      console.log(`  ${p.gravidade === 'bloqueia' ? '✗' : '!'} ${p.mensagem}`);
    }
  }

  if (bloqueios.length > 0) {
    abortar(`${bloqueios.length} problema(s) impedem a publicação. Nada foi escrito.`);
  }

  const manifesto = montarManifesto({
    workspaceId: acesso.workspaceId,
    generatedAt: new Date().toISOString(),
    sourceReleaseIds: releaseIds,
    arquivos,
  });

  // ------------------------------------------------------------------- modos

  if (check) {
    // Confere se o disco corresponde ao que seria gerado agora. Detecta arquivo
    // editado à mão e geração não determinística — nos dois casos o hash
    // publicado deixaria de significar alguma coisa.
    let divergiu = false;
    for (const [caminho, conteudo] of conteudos) {
      const emDisco = join(destino, caminho);
      if (!existsSync(emDisco)) {
        console.log(`  ✗ ausente em disco: ${caminho}`);
        divergiu = true;
        continue;
      }
      if (readFileSync(emDisco, 'utf8') !== conteudo) {
        console.log(`  ✗ diverge do gerado: ${caminho}`);
        divergiu = true;
      }
    }
    if (divergiu) abortar('O snapshot em disco não corresponde à projeção publicada.');
    console.log('\n  Disco confere com a projeção publicada.\n');
    return;
  }

  if (dryRun) {
    console.log('\n  Dry-run: nada foi escrito.\n');
    return;
  }

  for (const [caminho, conteudo] of conteudos) {
    const alvo = join(destino, caminho);
    mkdirSync(dirname(alvo), { recursive: true });
    writeFileSync(alvo, conteudo, 'utf8');
  }
  writeFileSync(join(destino, 'manifest.json'), serializarDeterministico(manifesto), 'utf8');

  console.log(`\n  Escrito em public/data/`);
  console.log(`  Releases de origem: ${manifesto.sourceReleaseIds.join(', ') || '—'}\n`);
}

main().catch((erro) => {
  if (!(erro instanceof Abortado)) console.error(`\n  ${String(erro)}\n`);
  process.exitCode = 1;
});
