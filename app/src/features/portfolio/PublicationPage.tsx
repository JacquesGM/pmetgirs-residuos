import { useState } from 'react';
import { AlertTriangle, Eye, Globe, Lock, Send } from 'lucide-react';
import { listForPublication, readDocsForPublication } from '../../data/firestore/portfolio';
import { COLECOES_PUBLICAVEIS } from '../../data/published/publishedCollections';
import { countPublic, listReleases, publishBatch } from '../../data/firestore/publication';
import { PUBLIC_ALLOWLIST } from '../../domain/publication/sanitize';
import { useAuth } from '../../app/AuthProvider';
import { criarPedido, listarPedidos } from '../../data/firestore/approvals';
import { useAsync } from './useAsync';
import { Pill } from './StateLabels';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Publicação.
 *
 * A única passagem entre a árvore interna e a pública. Rascunho jamais aparece
 * ao cidadão: o portal lê apenas publicWorkspaces, e só o proprietário escreve
 * lá — imposto pelas Security Rules, não por esta tela.
 */
export function PublicationPage() {
  const { state: auth, hasRole } = useAuth();
  const ehProprietario = hasRole(['owner']);
  // Editor e administrador propõem; só o proprietário publica. A separação é
  // das Security Rules — `publicWorkspaces` só aceita escrita do proprietário —,
  // e esta tela apenas não tenta contorná-la.
  const podeSolicitar = !ehProprietario && hasRole(['admin', 'editor']);

  // Carrega todas as coleções publicáveis de uma vez. O registro é o mesmo que
  // o gerador de snapshot usa, para que a tela e o arquivo nunca discordem
  // sobre o que pode ir ao ar.
  const grupos = useAsync(
    () =>
      Promise.all(
        COLECOES_PUBLICAVEIS.map(async (c) => ({
          ...c,
          itens: await listForPublication(c.colecao),
        })),
      ),
    [],
  );
  const releases = useAsync(() => listReleases(), []);
  const publicados = useAsync(
    async () =>
      (await Promise.all(COLECOES_PUBLICAVEIS.map((c) => countPublic(c.colecao)))).reduce(
        (a, b) => a + b,
        0,
      ),
    [],
  );

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  /** A chave é `colecao/id`: dois registros de coleções diferentes podem ter o mesmo id. */
  function alternar(chave: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }

  /**
   * Pedido de publicação, o caminho de quem não publica.
   *
   * Grava só as chaves `colecao/id` — não os documentos. O conteúdo é lido de
   * novo na hora de publicar, do que estiver gravado então: um pedido que
   * carregasse cópia dos dados publicaria a versão do dia do pedido, e não a
   * vigente no dia da publicação.
   */
  async function solicitar(event: React.FormEvent) {
    event.preventDefault();
    if (auth.status !== 'active') return;

    setErro(null);
    setResultado(null);
    setPublicando(true);
    try {
      const { id } = await criarPedido({
        itens: [...selecionados],
        motivo,
        actorUid: auth.membership.uid,
        actorRole: auth.membership.role,
      });
      setResultado(
        `Pedido ${id} registrado com ${selecionados.size} item(ns). ` +
          'Ele aparece em Pedidos, para revisão. Nada foi ao ar ainda.',
      );
      setSelecionados(new Set());
      setMotivo('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar o pedido.');
    } finally {
      setPublicando(false);
    }
  }

  async function publicar(event: React.FormEvent) {
    event.preventDefault();
    if (auth.status !== 'active' || grupos.status !== 'ready') return;

    setErro(null);
    setResultado(null);
    setPublicando(true);

    try {
      // Lê o documento armazenado, e não o view model da listagem. A allowlist
      // só preserva o que recebe: publicar a partir do que a tela mostra
      // descartaria em silêncio campos que deveriam atravessar a fronteira.
      const porColecao = await Promise.all(
        grupos.data.map(async (g) => {
          const ids = g.itens
            .filter((i) => selecionados.has(`${g.colecao}/${i.id}`))
            .map((i) => i.id);
          if (ids.length === 0) return [];
          const brutos = await readDocsForPublication(g.colecao, ids);
          return brutos.map((b) => ({
            collection: g.colecao,
            id: b.id,
            version: b.version,
            data: b.data as Record<string, unknown>,
          }));
        }),
      );

      const itens = porColecao.flat();

      const r = await publishBatch(itens, { uid: auth.membership.uid, role: auth.membership.role }, motivo);

      const descartados = new Set(Object.values(r.droppedFieldsByItem).flat());
      setResultado(
        `${r.publishedCount} item(ns) publicado(s) no release ${r.releaseId}. ` +
          `${descartados.size} campo(s) interno(s) foram removidos antes de atravessar a fronteira.`,
      );
      setSelecionados(new Set());
      setMotivo('');
      releases.reload();
      publicados.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível publicar.');
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-neutral-900">Publicação</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        A única passagem entre a área interna e o portal público. O que não for publicado aqui não
        existe para o cidadão.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <Lock aria-hidden="true" className="h-3.5 w-3.5" />
            Na área interna
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">
            {grupos.status === 'ready'
              ? grupos.data.reduce((total, g) => total + g.itens.length, 0)
              : '—'}
          </p>
          <p className="text-xs text-neutral-500">registros, visíveis só para membros</p>
        </div>
        <div className="rounded-lg border border-brand-green-300 bg-brand-green-50 p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-green-800">
            <Globe aria-hidden="true" className="h-3.5 w-3.5" />
            Visível ao cidadão
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-brand-green-800">
            {publicados.status === 'ready' ? publicados.data : '—'}
          </p>
          <p className="text-xs text-neutral-600">registros publicados</p>
        </div>
      </div>

      {!ehProprietario && (
        <p className="mt-5 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-700">
          Somente o proprietário publica. Revisar e aprovar não é publicar — e a recusa vem do
          servidor, não deste menu.
        </p>
      )}

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <Eye aria-hidden="true" className="h-4 w-4" />
          O que atravessa a fronteira
        </h2>
        <p className="mt-1 max-w-prose text-sm text-neutral-600">
          A publicação usa lista de permissão: só sai o campo que está explicitamente autorizado
          para o seu tipo. Um campo interno novo não vaza por padrão — ele simplesmente não passa
          até alguém decidir que deve passar.
        </p>
        <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm font-medium text-neutral-800">
            Projetos — {PUBLIC_ALLOWLIST.projects.length} campos autorizados
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PUBLIC_ALLOWLIST.projects.map((campo) => (
              <span
                key={campo}
                className="rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-xs text-neutral-600"
              >
                {campo}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Nunca atravessam: quem editou, motivo da alteração, notas internas, e-mails,
            identificadores de usuário e campos de controle.
          </p>
        </div>
      </section>

      {ehProprietario && <PedidosAprovados aoPublicar={() => { releases.reload(); publicados.reload(); }} />}

      {(ehProprietario || podeSolicitar) && grupos.status === 'ready' && (
        <form
          onSubmit={ehProprietario ? publicar : solicitar}
          className="mt-8 rounded-lg border border-neutral-200 bg-white p-5"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <Send aria-hidden="true" className="h-4 w-4" />
            {ehProprietario ? 'Publicar' : 'Solicitar publicação'}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {ehProprietario
              ? 'Documento público, registro do release e evento de auditoria são gravados no mesmo lote. Se algo falhar, nada muda.'
              : 'Seu perfil propõe a publicação; quem publica é o proprietário, depois da revisão. O pedido fica registrado com o seu nome e o seu motivo.'}
          </p>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-neutral-700">
              Selecione o que vai ao ar ({selecionados.size} selecionado
              {selecionados.size === 1 ? '' : 's'})
            </legend>
            <div className="mt-2 max-h-80 space-y-3 overflow-y-auto rounded-md border border-neutral-200 p-2">
              {grupos.data.map((g) => (
                <div key={g.colecao}>
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {g.rotulo} <span className="font-normal tabular-nums">({g.itens.length})</span>
                  </p>
                  <ul className="space-y-1">
                    {g.itens.map((i) => {
                      const chave = `${g.colecao}/${i.id}`;
                      return (
                        <li key={chave}>
                          <label className="flex min-h-11 items-center gap-2.5 rounded px-2 text-sm hover:bg-neutral-50">
                            <input
                              type="checkbox"
                              checked={selecionados.has(chave)}
                              onChange={() => alternar(chave)}
                              className="h-4 w-4"
                            />
                            <span className="text-neutral-800">{i.rotulo}</span>
                            <span className="ml-auto shrink-0 text-xs text-neutral-500">
                              v{i.version}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">
              {ehProprietario ? 'Motivo da publicação' : 'Motivo do pedido'}{' '}
              <span className="text-status-red">*</span>
            </span>
            <input
              required
              minLength={5}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                ehProprietario
                  ? 'Ex.: atualização trimestral aprovada pelo comitê'
                  : 'Ex.: metas revisadas contra a Tabela 12 do Plano de Ações'
              }
              className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={publicando || selecionados.size === 0}
            className="mt-4 min-h-11 rounded-md bg-brand-blue-700 px-4 text-sm font-medium text-white hover:bg-brand-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publicando
              ? ehProprietario
                ? 'Publicando...'
                : 'Enviando...'
              : ehProprietario
                ? `Publicar ${selecionados.size} item(ns)`
                : `Solicitar publicação de ${selecionados.size} item(ns)`}
          </button>

          {erro && (
            <p className="mt-3 flex items-start gap-2 text-sm text-status-red" role="alert">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {erro}
            </p>
          )}
          {resultado && (
            <p className="mt-3 rounded-md border border-brand-green-300 bg-brand-green-50 p-3 text-sm text-neutral-800" role="status">
              {resultado}
            </p>
          )}
        </form>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold text-neutral-900">Histórico de publicações</h2>
        {releases.status === 'ready' && releases.data.length === 0 && (
          <p className="mt-2 text-sm text-neutral-600">Nada publicado ainda.</p>
        )}
        {releases.status === 'ready' && releases.data.length > 0 && (
          <ul className="mt-3 space-y-2">
            {releases.data.map((r) => (
              <li key={r.id} className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-neutral-900">{r.reason}</span>
                  <Pill tone="ok">{r.itemCount} item(ns)</Pill>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {r.publishedAt ? dateFormat.format(r.publishedAt) : 'sem data'} · release {r.id}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Decisão pendente do proprietário</h2>
        <p className="mt-1 text-sm text-neutral-700">
          O Relatório de Inconsistências documenta 24 achados; o portal publica 9. As decisões de
          divulgação de cada um existem em texto solto no relatório e ainda não foram registradas
          como política no sistema. Enquanto isso, o campo de política de publicação das
          inconsistências permanece vazio — a migração não inventou a decisão.
        </p>
      </section>
    </div>
  );
}

/**
 * Pedidos aprovados, prontos para o proprietário concluir.
 *
 * Publicar daqui relê os documentos do banco na hora, e não o que estava
 * gravado quando o pedido foi feito: entre a proposta e a publicação o
 * conteúdo pode ter mudado, e o que vai ao ar tem de ser o vigente.
 *
 * O motivo do release é o do pedido, e o release guarda `approvalRequestId`.
 * É assim que "quem propôs, quem revisou e quem publicou" fica reconstituível
 * sem alterar o registro da decisão depois de tomada.
 */
function PedidosAprovados({ aoPublicar }: { aoPublicar: () => void }) {
  const { state: auth } = useAuth();
  const pedidos = useAsync(() => listarPedidos(), []);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  const jaPublicados = useAsync(async () => {
    const releases = await listReleases(100);
    return new Set(releases.map((r) => r.approvalRequestId).filter(Boolean) as string[]);
  }, []);

  const aprovados =
    pedidos.status === 'ready' && jaPublicados.status === 'ready'
      ? pedidos.data.filter((p) => p.status === 'approved' && !jaPublicados.data.has(p.id))
      : [];

  if (aprovados.length === 0) return null;

  async function publicarPedido(pedidoId: string, itens: string[], motivo: string) {
    if (auth.status !== 'active') return;
    setErro(null);
    setFeito(null);
    setPublicandoId(pedidoId);
    try {
      // As chaves vêm como `colecao/id`; o documento é lido agora, do banco.
      const porColecao = new Map<string, string[]>();
      for (const chave of itens) {
        const [colecao, ...resto] = chave.split('/');
        porColecao.set(colecao, [...(porColecao.get(colecao) ?? []), resto.join('/')]);
      }

      const lidos = await Promise.all(
        [...porColecao].map(async ([colecao, ids]) => {
          const brutos = await readDocsForPublication(colecao as never, ids);
          return brutos.map((b) => ({
            collection: colecao as never,
            id: b.id,
            version: b.version,
            data: b.data as Record<string, unknown>,
          }));
        }),
      );

      const r = await publishBatch(
        lidos.flat(),
        { uid: auth.membership.uid, role: auth.membership.role },
        motivo,
        pedidoId,
      );
      setFeito(`${r.publishedCount} item(ns) publicado(s) no release ${r.releaseId}.`);
      jaPublicados.reload();
      aoPublicar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível publicar o pedido.');
    } finally {
      setPublicandoId(null);
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-brand-green-300 bg-brand-green-50 p-5">
      <h2 className="text-base font-semibold text-neutral-900">
        Aprovados, aguardando publicação
      </h2>
      <p className="mt-1 text-sm text-neutral-700">
        Alguém propôs, alguém revisou. Publicar relê os documentos do banco agora — o que vai ao ar
        é o conteúdo vigente, não o do dia do pedido.
      </p>
      <ul className="mt-4 space-y-3">
        {aprovados.map((p) => (
          <li key={p.id} className="rounded-md border border-neutral-200 bg-white p-4">
            <p className="font-medium text-neutral-900">{p.motivo}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {p.itens.length} item(ns) · pedido {p.id}
            </p>
            {p.parecer && <p className="mt-2 text-sm text-neutral-700">Parecer: {p.parecer}</p>}
            <button
              type="button"
              disabled={publicandoId !== null}
              onClick={() => publicarPedido(p.id, p.itens, p.motivo)}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-blue-700 px-4 text-sm font-medium text-white hover:bg-brand-blue-800 disabled:opacity-60"
            >
              <Send aria-hidden="true" className="h-4 w-4" />
              {publicandoId === p.id ? 'Publicando…' : `Publicar ${p.itens.length} item(ns)`}
            </button>
          </li>
        ))}
      </ul>
      {erro && (
        <p className="mt-3 flex items-start gap-2 text-sm text-status-red" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {erro}
        </p>
      )}
      {feito && (
        <p className="mt-3 text-sm text-brand-green-800" role="status">
          {feito}
        </p>
      )}
    </section>
  );
}
