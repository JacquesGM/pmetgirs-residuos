import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, LogIn, ShieldOff } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';

function AuthLayout({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex justify-center text-brand-blue-600">{icon}</div>
        <h1 className="text-center text-xl font-bold text-neutral-900">{title}</h1>
        <div className="mt-4 space-y-4 text-sm text-neutral-600">{children}</div>
        <p className="mt-8 text-center text-xs text-neutral-500">
          <Link to="/" className="text-brand-blue-700 underline">
            Voltar ao portal público
          </Link>
        </p>
      </div>
    </main>
  );
}

export function SignInPage() {
  const { signIn, state } = useAuth();

  return (
    <AuthLayout icon={<LogIn aria-hidden="true" className="h-10 w-10" />} title="PMetGIRS Gestão">
      <p>
        Área restrita de planejamento e acompanhamento do Plano Metropolitano de Gestão Integrada de
        Resíduos Sólidos.
      </p>
      <p>
        O acesso é por convite. Entre com a conta Google cadastrada pelo responsável pelo sistema.
      </p>
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={state.status === 'loading'}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-brand-blue-700 px-4 font-medium text-white hover:bg-brand-blue-800 disabled:opacity-60"
      >
        Entrar com Google
      </button>
      <p className="text-xs text-neutral-500">
        Guardamos apenas o identificador da conta, nome, e-mail, perfil de acesso e data do último
        acesso — o mínimo para controlar quem pode entrar e registrar quem alterou o quê.
      </p>
    </AuthLayout>
  );
}

export function AccessPendingPage() {
  const { state, signOutUser } = useAuth();
  const email = state.status === 'no_membership' ? state.user.email : null;

  return (
    <AuthLayout
      icon={<Clock aria-hidden="true" className="h-10 w-10 text-status-amber" />}
      title="Acesso ainda não liberado"
    >
      <p>
        Sua conta {email && <strong className="text-neutral-800">{email}</strong>} entrou com sucesso,
        mas ainda não tem permissão neste espaço de trabalho.
      </p>
      <p>
        Peça ao responsável pelo sistema que envie um convite para este endereço. Enquanto isso, nenhuma
        informação interna fica visível.
      </p>
      <button
        type="button"
        onClick={() => void signOutUser()}
        className="mt-2 min-h-11 w-full rounded-md border border-neutral-300 px-4 font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Sair
      </button>
    </AuthLayout>
  );
}

export function AccessDeniedPage() {
  const { signOutUser } = useAuth();

  return (
    <AuthLayout
      icon={<ShieldOff aria-hidden="true" className="h-10 w-10 text-status-red" />}
      title="Acesso suspenso"
    >
      <p>Este acesso foi suspenso ou revogado pelo responsável pelo sistema.</p>
      <p>Se você acredita que houve engano, procure a equipe do Instituto Rio Metrópole.</p>
      <button
        type="button"
        onClick={() => void signOutUser()}
        className="mt-2 min-h-11 w-full rounded-md border border-neutral-300 px-4 font-medium text-neutral-700 hover:bg-neutral-50"
      >
        Sair
      </button>
    </AuthLayout>
  );
}

export function AuthErrorPage({ message }: { message: string }) {
  return (
    <AuthLayout
      icon={<AlertTriangle aria-hidden="true" className="h-10 w-10 text-status-amber" />}
      title="Não foi possível carregar a área de gestão"
    >
      <p>{message}</p>
      <p className="text-xs text-neutral-500">
        Se você está executando o projeto localmente, confira o arquivo <code>.env.local</code> e o
        guia interno de provisionamento do Firebase.
      </p>
    </AuthLayout>
  );
}
