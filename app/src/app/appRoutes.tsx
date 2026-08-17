import type { ReactNode } from 'react';
import { PlaceholderPage } from './PlaceholderPage';
import { AuditPage } from '../features/portfolio/AuditPage';
import { DashboardPage } from '../features/portfolio/DashboardPage';
import { ProjectDetailPage } from '../features/portfolio/ProjectDetailPage';
import { ProjectsPage } from '../features/portfolio/ProjectsPage';
import { PrioritizationPage } from '../features/portfolio/PrioritizationPage';
import { SettingsPage } from '../features/portfolio/SettingsPage';
import { DependenciesPage } from '../features/portfolio/DependenciesPage';
import { SchedulePage } from '../features/portfolio/SchedulePage';
import { InvestmentsPage } from '../features/portfolio/InvestmentsPage';
import { OpportunitiesPage } from '../features/portfolio/OpportunitiesPage';
import { ChallengesPage } from '../features/portfolio/ChallengesPage';
import { PublicationPage } from '../features/portfolio/PublicationPage';
import { ApprovalsPage } from '../features/portfolio/ApprovalsPage';
import { UsersPage } from '../features/portfolio/UsersPage';

export interface PrivateRoute {
  path: string;
  title: string;
  element: ReactNode;
}

/**
 * Rotas da área de gestão.
 *
 * Todas existem desde a Fase 1, protegidas pelo AppShell e pelas Security
 * Rules. O conteúdo de cada uma entra na fase indicada — a ordem segue o
 * roadmap aprovado na Fase 0.
 */
export const privateRoutes: PrivateRoute[] = [
  { path: '', title: 'Painel', element: <DashboardPage /> },
  {
    path: 'portfolio',
    title: 'Portfólio',
    element: (
      <PlaceholderPage
        title="Portfólio"
        phase="Fase 3"
        description="Visões em lista, cards, Kanban e cronograma sobre a hierarquia Plano → Eixo → Programa → Projeto → Ação → Marco."
      />
    ),
  },
  {
    path: 'planos',
    title: 'Planos e eixos',
    element: (
      <PlaceholderPage
        title="Planos e eixos"
        phase="Fase 3"
        description="Cadastro do PMetGIRS como primeiro plano do workspace, com seus 12 eixos estratégicos e os programas de cada um."
      />
    ),
  },
  { path: 'projetos', title: 'Projetos', element: <ProjectsPage /> },
  { path: 'projetos/:projetoId', title: 'Projeto', element: <ProjectDetailPage /> },
  { path: 'cronograma', title: 'Cronograma', element: <SchedulePage /> },
  { path: 'dependencias', title: 'Dependências', element: <DependenciesPage /> },
  { path: 'priorizacao', title: 'Priorização', element: <PrioritizationPage /> },
  { path: 'investimentos', title: 'Investimentos', element: <InvestmentsPage /> },
  { path: 'oportunidades', title: 'Oportunidades', element: <OpportunitiesPage /> },
  { path: 'desafios', title: 'Desafios', element: <ChallengesPage /> },
  {
    path: 'documentos',
    title: 'Documentos',
    element: (
      <PlaceholderPage
        title="Documentos"
        phase="Fase 3"
        description="Metadados e links institucionais dos documentos oficiais. Arquivos binários privados dependem do Cloud Storage, que exige o plano Blaze."
      />
    ),
  },
  { path: 'aprovacoes', title: 'Pedidos de publicação', element: <ApprovalsPage /> },
  { path: 'publicacao', title: 'Publicação', element: <PublicationPage /> },
  { path: 'auditoria', title: 'Auditoria', element: <AuditPage /> },
  { path: 'usuarios', title: 'Usuários', element: <UsersPage /> },
  { path: 'configuracoes', title: 'Configurações', element: <SettingsPage /> },
];
