import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CalendarRange,
  CheckSquare,
  FileText,
  FolderKanban,
  GitBranch,
  Handshake,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ScrollText,
  Send,
  Settings,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { PageLoading } from '../components/layout/PageLoading';
import { AccessDeniedPage, AccessPendingPage, SignInPage } from '../features/auth/AuthPages';
import type { Role } from '../domain/enums';

interface NavItem {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  /** Perfis que veem o item. Omitido = todos os membros ativos. */
  roles?: Role[];
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/app', label: 'Painel', Icon: LayoutDashboard, end: true },
  { to: '/app/portfolio', label: 'Portfólio', Icon: FolderKanban },
  { to: '/app/planos', label: 'Planos e eixos', Icon: ListChecks },
  { to: '/app/projetos', label: 'Projetos', Icon: Building2 },
  { to: '/app/cronograma', label: 'Cronograma', Icon: CalendarRange },
  { to: '/app/dependencias', label: 'Dependências', Icon: GitBranch },
  { to: '/app/priorizacao', label: 'Priorização', Icon: BarChart3 },
  { to: '/app/investimentos', label: 'Investimentos', Icon: TrendingUp },
  { to: '/app/oportunidades', label: 'Oportunidades', Icon: Send },
  { to: '/app/desafios', label: 'Desafios', Icon: Handshake },
  { to: '/app/documentos', label: 'Documentos', Icon: FileText },
  // Sem `roles`: todo membro acompanha os pedidos, inclusive quem só lê. É o
  // registro de o que se propôs publicar e por quê — decidir é que exige
  // perfil, e a própria tela diz isso a quem não decide.
  { to: '/app/aprovacoes', label: 'Pedidos', Icon: CheckSquare },
  { to: '/app/publicacao', label: 'Publicação', Icon: Send, roles: ['owner'] },
  { to: '/app/auditoria', label: 'Auditoria', Icon: ScrollText },
  { to: '/app/usuarios', label: 'Usuários', Icon: Users, roles: ['owner'] },
  { to: '/app/configuracoes', label: 'Configurações', Icon: Settings, roles: ['owner', 'admin'] },
];

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  editor: 'Editor',
  reviewer: 'Revisor',
  viewer: 'Leitor',
  external_partner: 'Parceiro externo',
};

/**
 * Casca da área de gestão.
 *
 * O menu esconde o que o perfil não usa — isso é experiência, não segurança.
 * Quem tentar navegar direto para /app/usuarios sem ser proprietário verá a
 * tela, mas as Security Rules recusarão toda leitura e escrita.
 */
export function AppShell() {
  const { state, signOutUser, hasRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (state.status === 'loading') return <PageLoading label="Verificando seu acesso..." />;
  if (state.status === 'signed_out') return <SignInPage />;
  if (state.status === 'no_membership') return <AccessPendingPage />;
  if (state.status === 'suspended') return <AccessDeniedPage />;

  const { membership } = state;
  const itens = NAV.filter((item) => !item.roles || hasRole(item.roles));

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <a
        href="#gestao-conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-brand-blue-700 focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>

      <aside
        id="menu-gestao"
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-brand-blue-800 bg-brand-blue-900 lg:static lg:block ${
          menuOpen ? 'block' : 'hidden'
        }`}
      >
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue-200">
            Instituto Rio Metrópole
          </p>
          <p className="mt-1 text-sm font-bold text-white">PMetGIRS Gestão</p>
          <p className="mt-0.5 text-xs text-brand-blue-200">Região Metropolitana do Rio de Janeiro</p>
        </div>

        <nav aria-label="Navegação da gestão" className="px-2 py-3">
          <ul className="space-y-0.5">
            {itens.map(({ to, label, Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-brand-blue-100 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-white/10 px-4 py-3">
          <p className="truncate text-sm font-medium text-white">
            {membership.displayName ?? membership.email}
          </p>
          <p className="text-xs text-brand-blue-200">{ROLE_LABEL[membership.role]}</p>
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-md border border-white/25 px-3 text-sm text-white hover:bg-white/10"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2 lg:hidden">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="menu-gestao"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-300"
          >
            {menuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold text-neutral-900">PMetGIRS Gestão</span>
          <Link to="/" className="ml-auto text-xs text-brand-blue-700 underline">
            Portal público
          </Link>
        </header>

        <main id="gestao-conteudo" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
