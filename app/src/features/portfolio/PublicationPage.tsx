import { useState } from 'react';
import { AlertTriangle, Eye, Globe, Lock, Send } from 'lucide-react';
import { listProjects, readProjectsForPublication } from '../../data/firestore/portfolio';
import { countPublic, listReleases, publishBatch } from '../../data/firestore/publication';
import { PUBLIC_ALLOWLIST } from '../../domain/publication/sanitize';
import { useAuth } from '../../app/AuthProvider';
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

  const projetos = useAsync(() => listProjects({ limit: 200 }), []);
  const releases = useAsync(() => listReleases(), []);
  const publicados = useAsync(() => countPublic('projects'), []);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  function alternar(id: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  async function publicar(event: React.FormEvent) {
    event.preventDefault();
    if (auth.status !== 'active' || projetos.status !== 'ready') return;

    setErro(null);
    setResultado(null);
    setPublicando(true);

    try {
      // Lê o documento armazenado, e não o view model da listagem. A allowlist
      // só preserva o que recebe: publicar a partir do que a tela mostra
      // descartaria em silêncio campos que deveriam atravessar a fronteira.
      const brutos = await readProjectsForPublication(
        projetos.data.filter((p) => selecionados.has(p.id)).map((p) => p.id),
      );

      const itens = brutos.map((b) => ({
        collection: 'projects' as const,
        id: b.id,
        version: b.version,
        data: b.data as Record<string, unknown>,
      }));

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
            {projetos.status === 'ready' ? projetos.data.length : '—'}
          </p>
          <p className="text-xs text-neutral-500">projetos, visíveis só para membros</p>
        </div>
        <div className="rounded-lg border border-brand-green-300 bg-brand-green-50 p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-green-800">
            <Globe aria-hidden="true" className="h-3.5 w-3.5" />
            Visível ao cidadão
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-brand-green-800">
            {publicados.status === 'ready' ? publicados.data : '—'}
          </p>
          <p className="text-xs text-neutral-600">projetos publicados</p>
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

      {ehProprietario && projetos.status === 'ready' && (
        <form onSubmit={publicar} className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <Send aria-hidden="true" className="h-4 w-4" />
            Publicar
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Documento público, registro do release e evento de auditoria são gravados no mesmo lote.
            Se algo falhar, nada muda.
          </p>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-neutral-700">
              Selecione o que vai ao ar ({selecionados.size} selecionado
              {selecionados.size === 1 ? '' : 's'})
            </legend>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
              {projetos.data.map((p) => (
                <li key={p.id}>
                  <label className="flex min-h-11 items-center gap-2.5 rounded px-2 text-sm hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={selecionados.has(p.id)}
                      onChange={() => alternar(p.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-neutral-800">{p.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-neutral-500">v{p.version}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">
              Motivo da publicação <span className="text-status-red">*</span>
            </span>
            <input
              required
              minLength={5}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: atualização trimestral aprovada pelo comitê"
              className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={publicando || selecionados.size === 0}
            className="mt-4 min-h-11 rounded-md bg-brand-blue-700 px-4 text-sm font-medium text-white hover:bg-brand-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publicando ? 'Publicando...' : `Publicar ${selecionados.size} item(ns)`}
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
