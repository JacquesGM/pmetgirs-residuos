import { useState } from 'react';
import { AlertTriangle, MailPlus, Trash2, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { useAsync } from './useAsync';
import {
  alterarStatusDoMembro,
  convidar,
  listarConvites,
  listarMembros,
  PAPEIS_CONVIDAVEIS,
  revogarConvite,
} from '../../data/firestore/members';
import type { Role } from '../../domain/enums';
import { Pill, roleLabel } from './StateLabels';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Usuários e convites.
 *
 * Somente o proprietário gerencia acessos, e isso é imposto pelas Security
 * Rules — a lista de membros nem sequer é legível por outro papel. O menu
 * esconde a página, mas esconder não é impedir; quem impede é a regra.
 */
export function UsersPage() {
  const { state: auth, hasRole } = useAuth();
  const ehProprietario = hasRole(['owner']);

  const membros = useAsync(() => (ehProprietario ? listarMembros() : Promise.resolve([])), [ehProprietario]);
  const convites = useAsync(() => (ehProprietario ? listarConvites() : Promise.resolve([])), [ehProprietario]);

  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Role>('editor');
  const [dias, setDias] = useState(7);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  if (!ehProprietario) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-neutral-900">Usuários e convites</h1>
        <p className="mt-4 rounded-md border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-700">
          Somente o proprietário gerencia acessos. Não é uma restrição desta tela: a lista de
          membros não é legível por outro papel, e a recusa vem do banco.
        </p>
      </div>
    );
  }

  async function enviarConvite(event: React.FormEvent) {
    event.preventDefault();
    if (auth.status !== 'active') return;
    setErro(null);
    setFeito(null);
    setSalvando(true);
    try {
      const { id } = await convidar({
        email,
        role: papel,
        dias,
        actorUid: auth.membership.uid,
        membros: membros.status === 'ready' ? membros.data : [],
        convites: convites.status === 'ready' ? convites.data : [],
      });
      setFeito(
        `Convite ${id} gravado para ${email.trim().toLowerCase()}. ` +
          'Nenhum e-mail foi enviado — avise a pessoa você mesmo.',
      );
      setEmail('');
      convites.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível convidar.');
    } finally {
      setSalvando(false);
    }
  }

  async function revogar(id: string, emailDoConvite: string) {
    if (auth.status !== 'active') return;
    setErro(null);
    setFeito(null);
    try {
      await revogarConvite(id, emailDoConvite, auth.membership.uid);
      setFeito(`Convite para ${emailDoConvite} revogado.`);
      convites.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível revogar.');
    }
  }

  async function alternarStatus(uid: string, statusAtual: string) {
    if (auth.status !== 'active') return;
    setErro(null);
    setFeito(null);
    try {
      const novo = statusAtual === 'active' ? 'suspended' : 'active';
      await alterarStatusDoMembro(uid, novo, auth.membership.uid);
      setFeito(novo === 'suspended' ? 'Membro suspenso.' : 'Membro reativado.');
      membros.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar o acesso.');
    }
  }

  const pendentes = convites.status === 'ready' ? convites.data.filter((c) => c.vigente) : [];
  const encerrados = convites.status === 'ready' ? convites.data.filter((c) => !c.vigente) : [];

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-neutral-900">Usuários e convites</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Quem entra, com que papel e até quando. Toda concessão e toda revogação entram na
        auditoria, que é append-only.
      </p>

      <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <MailPlus aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-status-amber" />
        <div className="text-sm text-neutral-800">
          <p className="font-medium">O sistema não envia e-mail.</p>
          <p className="mt-1">
            O plano gratuito do Firebase não tem como disparar mensagem. Convidar grava a
            autorização; avisar a pessoa é você. Ela entra em <code>/app</code> com a conta Google
            daquele endereço, e o acesso se cria no primeiro login.
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-neutral-900">Membros</h2>
        {membros.status === 'ready' && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Membros do workspace, com papel e situação</caption>
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">E-mail</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Papel</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Situação</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Ação</th>
                </tr>
              </thead>
              <tbody>
                {membros.data.map((m) => {
                  const euMesmo = auth.status === 'active' && m.uid === auth.membership.uid;
                  return (
                    <tr key={m.uid} className="border-b border-neutral-100 last:border-0">
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">{m.email}</th>
                      <td className="px-4 py-2.5">{roleLabel(m.role)}</td>
                      <td className="px-4 py-2.5">
                        <Pill tone={m.status === 'active' ? 'ok' : 'warn'}>
                          {m.status === 'active' ? 'Ativo' : 'Suspenso'}
                        </Pill>
                      </td>
                      <td className="px-4 py-2.5">
                        {euMesmo ? (
                          // Não é gentileza da tela: as Rules recusam que o
                          // proprietário altere o próprio membro, e é isso que
                          // impede o sistema de ficar sem dono.
                          <span className="text-xs italic text-neutral-500">
                            você não altera o próprio acesso
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => alternarStatus(m.uid, m.status)}
                            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-blue-700 hover:underline"
                          >
                            {m.status === 'active' ? (
                              <>
                                <UserX aria-hidden="true" className="h-4 w-4" />
                                Suspender
                              </>
                            ) : (
                              <>
                                <UserCheck aria-hidden="true" className="h-4 w-4" />
                                Reativar
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form onSubmit={enviarConvite} className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-neutral-900">Convidar</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-neutral-700">
              E-mail <span className="text-status-red">*</span>
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@exemplo.gov.br"
              className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Precisa ser a conta Google com que a pessoa vai entrar.
            </span>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-neutral-700">Papel</span>
            <select
              value={papel}
              onChange={(e) => setPapel(e.target.value as Role)}
              className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
            >
              {PAPEIS_CONVIDAVEIS.map((p) => (
                <option key={p} value={p}>{roleLabel(p)}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-neutral-500">
              Proprietário não se concede por convite.
            </span>
          </label>
        </div>

        <label className="mt-4 block text-sm sm:w-56">
          <span className="mb-1 block font-medium text-neutral-700">Validade (dias)</span>
          <input
            type="number"
            min={1}
            max={30}
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="min-h-11 w-full rounded-md border border-neutral-300 px-3 text-sm"
          />
          <span className="mt-1 block text-xs text-neutral-500">
            Convite sem prazo é acesso sem prazo.
          </span>
        </label>

        <button
          type="submit"
          disabled={salvando}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-blue-700 px-4 text-sm font-medium text-white hover:bg-brand-blue-800 disabled:opacity-60"
        >
          <MailPlus aria-hidden="true" className="h-4 w-4" />
          {salvando ? 'Gravando…' : 'Gravar convite'}
        </button>

        {erro && (
          <p className="mt-3 flex items-start gap-2 text-sm text-status-red" role="alert">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {erro}
          </p>
        )}
        {feito && (
          <p className="mt-3 rounded-md border border-brand-green-300 bg-brand-green-50 p-3 text-sm" role="status">
            {feito}
          </p>
        )}
      </form>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-neutral-900">
          Convites pendentes {pendentes.length > 0 && `(${pendentes.length})`}
        </h2>
        {pendentes.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">Nenhum convite aguardando aceite.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pendentes.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white p-4"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{c.email}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {roleLabel(c.role)} · válido até{' '}
                    {c.expiresAt ? dateFormat.format(c.expiresAt) : 'sem prazo registrado'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revogar(c.id, c.email)}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-status-red hover:underline"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Revogar
                </button>
              </li>
            ))}
          </ul>
        )}

        {encerrados.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-brand-blue-700">
              Convites aceitos ou vencidos ({encerrados.length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-neutral-600">
              {encerrados.map((c) => (
                <li key={c.id}>
                  {c.email} · {roleLabel(c.role)} ·{' '}
                  {c.status === 'accepted' ? 'aceito' : 'vencido sem aceite'}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
