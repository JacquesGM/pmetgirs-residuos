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
  {
    path: 'investimentos',
    title: 'Investimentos',
    element: (
      <PlaceholderPage
        title="Investimentos"
        phase="Fase 6"
        description="Funil de estruturação e índice de prontidão para captação, com as lacunas que faltam fechar em cada oportunidade."
      />
    ),
  },
  {
    path: 'oportunidades',
    title: 'Oportunidades',
    element: (
      <PlaceholderPage
        title="Oportunidades"
        phase="Fase 6"
        description="Fichas executivas para apresentação ao mercado, sempre distinguindo receita contratual, receita de mercado, economia pública e benefício socioambiental."
      />
    ),
  },
  {
    path: 'desafios',
    title: 'Desafios',
    element: (
      <PlaceholderPage
        title="Desafios e participação do mercado"
        phase="Fase 6"
        description="Problemas estruturados com evidência, território e formas possíveis de participação. O sistema divulga; não seleciona empresa nem substitui procedimento oficial."
      />
    ),
  },
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
  {
    path: 'publicacao',
    title: 'Publicação',
    element: (
      <PlaceholderPage
        title="Publicação"
        phase="Fase 7"
        description="Fluxo rascunho → revisão → aprovação → publicação, gerando a cópia pública sanitizada em lote único com registro e evento de auditoria."
      />
    ),
  },
  { path: 'auditoria', title: 'Auditoria', element: <AuditPage /> },
  {
    path: 'usuarios',
    title: 'Usuários',
    element: (
      <PlaceholderPage
        title="Usuários e convites"
        phase="Fase 1"
        description="Convite por e-mail, aceite, suspensão e revogação. Somente o proprietário gerencia acessos — e isso é imposto pelas Security Rules, não pelo menu."
      />
    ),
  },
  { path: 'configuracoes', title: 'Configurações', element: <SettingsPage /> },
];
