import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { useAsync } from './useAsync';
import {
  decidirPedido,
  listarPedidos,
  type PedidoDePublicacao,
  type StatusDoPedido,
} from '../../data/firestore/approvals';
import { Pill } from './StateLabels';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const ROTULO: Record<StatusDoPedido, string> = {
  pending: 'Aguardando revisão',
  approved: 'Aprovado',
  changes_requested: 'Mudanças solicitadas',
  rejected: 'Recusado',
};

const TOM: Record<StatusDoPedido, 'ok' | 'info' | 'warn' | 'alert' | 'neutral'> = {
  pending: 'info',
  approved: 'ok',
  changes_requested: 'warn',
  rejected: 'alert',
};

/**
 * Revisão dos pedidos de publicação.
 *
 * O que se revisa aqui é o ato de publicar, não o conteúdo: os dados vêm dos
 * documentos técnicos por transcrição, e o que uma pessoa decide neste sistema
 * é o que atravessa a fronteira para o cidadão, e quando.
 *
 * Aprovar não publica. Publicar é do proprietário, na tela de Publicação —
 * separação imposta pelas Security Rules, não por esta tela.
 */
export function ApprovalsPage() {
  const { state: auth, hasRole } = useAuth();
  const podeRevisar = hasRole(['owner', 'admin', 'reviewer']);
  const pedidos = useAsync(() => listarPedidos(), []);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-neutral-900">Pedidos de publicação</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        O que se revisa aqui é o ato de publicar, não o conteúdo — os dados vêm dos documentos
        técnicos por transcrição. Aprovar não publica: quem publica é o proprietário.
      </p>

      {!podeRevisar && (
        <p className="mt-5 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-700">
          Seu perfil não decide pedidos. Você pode acompanhá-los.
        </p>
      )}

      {pedidos.status === 'loading' && (
        <div className="mt-6 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-200" />
          ))}
        </div>
      )}

      {pedidos.status === 'error' && (
        <p className="mt-6 text-sm text-status-red" role="alert">
          Não foi possível carregar os pedidos: {pedidos.message}
        </p>
      )}

      {pedidos.status === 'ready' && pedidos.data.length === 0 && (
        <div className="mt-6 rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm">
          <p className="font-medium text-neutral-800">Nenhum pedido registrado</p>
          <p className="mt-1 text-neutral-600">
            Pedidos aparecem aqui quando alguém com perfil de edição propõe uma publicação. O
            proprietário também pode publicar direto, sem pedido — é o que impede o sistema de
            travar enquanto houver um único membro.
          </p>
        </div>
      )}

      {pedidos.status === 'ready' && pedidos.data.length > 0 && (
        <ul className="mt-6 space-y-4">
          {pedidos.data.map((pedido) => (
            <Pedido
              key={pedido.id}
              pedido={pedido}
              podeRevisar={podeRevisar}
              /* Ninguém revisa o próprio pedido: revisão de si mesmo tem a
                 aparência de controle sem o ser. As Rules não impedem isso
                 — elas não sabem quem criou —, então a barreira é aqui, e
                 fica dita em voz alta na tela em vez de escondida. */
              ehAutor={auth.status === 'active' && auth.membership.uid === pedido.createdBy}
              actorUid={auth.status === 'active' ? auth.membership.uid : ''}
              aoDecidir={() => pedidos.reload()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Pedido({
  pedido,
  podeRevisar,
  ehAutor,
  actorUid,
  aoDecidir,
}: {
  pedido: PedidoDePublicacao;
  podeRevisar: boolean;
  ehAutor: boolean;
  actorUid: string;
  aoDecidir: () => void;
}) {
  const [parecer, setParecer] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aguardando = pedido.status === 'pending';

  async function decidir(decisao: Exclude<StatusDoPedido, 'pending'>) {
    setErro(null);
    setSalvando(true);
    try {
      await decidirPedido({ pedidoId: pedido.id, decisao, parecer, actorUid });
      aoDecidir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar a decisão.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-neutral-900">{pedido.motivo}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {pedido.itens.length} item(ns) ·{' '}
            {pedido.createdAt ? dateFormat.format(pedido.createdAt) : 'sem data'}
          </p>
        </div>
        <Pill tone={TOM[pedido.status]}>{ROTULO[pedido.status]}</Pill>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-brand-blue-700">
          Ver o que entra neste pedido
        </summary>
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-md bg-neutral-50 p-3 text-xs text-neutral-700">
          {pedido.itens.map((item) => (
            <li key={item} className="font-mono">
              {item}
            </li>
          ))}
        </ul>
      </details>

      {pedido.status !== 'pending' && (
        <div className="mt-3 border-t border-neutral-200 pt-3 text-sm">
          <p className="flex items-center gap-1.5 text-neutral-700">
            {pedido.status === 'approved' ? (
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand-green-700" />
            ) : (
              <XCircle aria-hidden="true" className="h-4 w-4 text-status-amber" />
            )}
            Decidido em {pedido.reviewedAt ? dateFormat.format(pedido.reviewedAt) : 'data não registrada'}
          </p>
          {pedido.parecer && <p className="mt-1 text-neutral-700">{pedido.parecer}</p>}
          {pedido.status === 'approved' && (
            <p className="mt-2 text-xs text-neutral-500">
              Aprovado não é publicado. O proprietário conclui na tela de Publicação.
            </p>
          )}
        </div>
      )}

      {aguardando && podeRevisar && !ehAutor && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <label className="block text-sm">
            <span className="text-neutral-700">
              Parecer <span className="text-neutral-500">(obrigatório para recusar ou pedir mudanças)</span>
            </span>
            <textarea
              rows={2}
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={() => decidir('approved')}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-green-700 px-4 text-sm font-medium text-white hover:bg-brand-green-800 disabled:opacity-60"
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Aprovar
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => decidir('changes_requested')}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              <Clock aria-hidden="true" className="h-4 w-4" />
              Pedir mudanças
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => decidir('rejected')}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-status-red px-4 text-sm font-medium text-status-red hover:bg-red-50 disabled:opacity-60"
            >
              <XCircle aria-hidden="true" className="h-4 w-4" />
              Recusar
            </button>
          </div>

          {erro && (
            <p className="mt-3 flex items-start gap-2 text-sm text-status-red" role="alert">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {erro}
            </p>
          )}
        </div>
      )}

      {aguardando && ehAutor && (
        <p className="mt-3 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
          Você propôs este pedido, então não o revisa. Revisão de si mesmo tem a aparência de
          controle sem o ser.
        </p>
      )}
    </li>
  );
}
