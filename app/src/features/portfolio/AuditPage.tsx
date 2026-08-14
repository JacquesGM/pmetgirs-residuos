import { listAuditEvents } from '../../data/firestore/portfolio';
import { useAsync } from './useAsync';
import { actionLabel, roleLabel } from './StateLabels';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

/**
 * Auditoria do workspace.
 *
 * Os eventos são append-only: as Security Rules negam update e delete para
 * todos os perfis, inclusive o proprietário. O que está aqui não é editável
 * por ninguém pela aplicação.
 */
export function AuditPage() {
  const state = useAsync(() => listAuditEvents(undefined, 100), []);

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-neutral-900">Auditoria</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Quem alterou o quê, quando e por quê. Os eventos não podem ser alterados nem apagados por
        nenhum perfil.
      </p>

      <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
        Sem processamento no servidor, o evento é gravado pelo próprio navegador. As Rules garantem
        que ele exista, aponte para a entidade certa, tenha a hora do servidor e case com a versão —
        mas o motivo é declarado por quem edita. É rastreabilidade forte, não auditoria inviolável.
      </div>

      {state.status === 'loading' && (
        <div className="mt-6 space-y-2" aria-live="polite">
          <span className="sr-only">Carregando eventos...</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-neutral-200" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">{state.message}</p>
      )}

      {state.status === 'ready' && state.data.length === 0 && (
        <p className="mt-6 text-sm text-neutral-600">Nenhum evento registrado ainda.</p>
      )}

      {state.status === 'ready' && state.data.length > 0 && (
        <>
          <p className="mt-6 text-sm text-neutral-600">
            {state.data.length} eventos mais recentes
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[860px] text-sm">
              <caption className="sr-only">Eventos de auditoria do workspace</caption>
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Quando</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Ação</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Entidade</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Quem</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((e) => (
                  <tr key={e.id} className="border-b border-neutral-100 last:border-0 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-600">
                      {e.occurredAt ? dateFormat.format(e.occurredAt) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {actionLabel(e.action)}
                      <span className="ml-1 text-xs text-neutral-500">
                        {e.fromVersion !== null ? `v${e.fromVersion}→v${e.toVersion}` : `v${e.toVersion}`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-neutral-800">{e.entityId}</span>
                      <span className="block text-xs text-neutral-500">{e.entityCollection}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-neutral-600">
                      {roleLabel(e.actorRole)}
                      <span className="block text-xs text-neutral-500">origem: {e.source}</span>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-700">{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
