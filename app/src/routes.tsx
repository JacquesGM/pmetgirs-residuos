import { lazy, Suspense, type ReactNode } from 'react';
import { Home } from './pages/Home';
import { Indicators } from './components/sections/Indicators';
import { Axes } from './components/sections/Axes';
import { Projects } from './components/sections/Projects';
import { Transparency } from './components/sections/Transparency';
import { Documents } from './components/sections/Documents';
import { FAQ } from './components/sections/FAQ';
import { PageLoading } from './components/layout/PageLoading';

const MetropolitanMap = lazy(() =>
  import('./components/sections/MetropolitanMap').then((m) => ({ default: m.MetropolitanMap })),
);
const Goals = lazy(() => import('./components/sections/Goals').then((m) => ({ default: m.Goals })));
const Infrastructure = lazy(() =>
  import('./components/sections/Infrastructure').then((m) => ({ default: m.Infrastructure })),
);

export interface AppRoute {
  path: string;
  /** Shown as a link in the header nav. Omit to keep the route reachable only via direct link/footer. */
  label?: string;
  title: string;
  description: string;
  element: ReactNode;
}

export const routes: AppRoute[] = [
  {
    path: '/',
    label: 'Início',
    title: 'Início',
    description:
      'Acompanhe as metas, projetos e resultados do PMetGIRS — o planejamento integrado de resíduos sólidos dos 22 municípios da Região Metropolitana do Rio de Janeiro.',
    element: <Home />,
  },
  {
    path: '/indicadores',
    label: 'Indicadores',
    title: 'Indicadores de destaque',
    description:
      'Números que resumem a escala do desafio metropolitano de resíduos sólidos, cada um com fonte, período e situação de validação.',
    element: <Indicators />,
  },
  {
    path: '/eixos',
    label: 'Eixos',
    title: 'Eixos estratégicos',
    description: 'Os 12 eixos estratégicos do PMetGIRS, com objetivo, responsável e situação de cada um.',
    element: <Axes />,
  },
  {
    path: '/projetos',
    label: 'Projetos',
    title: 'Portfólio de projetos',
    description: 'Ações do Plano de Ações do PMetGIRS, filtráveis por eixo, situação e responsável.',
    element: <Projects />,
  },
  {
    path: '/municipios',
    label: 'Municípios',
    title: 'Mapa da Região Metropolitana',
    description: 'Mapa interativo, gráfico populacional e comparador dos 22 municípios da Região Metropolitana do Rio de Janeiro.',
    element: (
      <Suspense fallback={<PageLoading label="Carregando mapa..." />}>
        <MetropolitanMap />
      </Suspense>
    ),
  },
  {
    path: '/metas',
    label: 'Metas',
    title: 'Metas de coleta e atendimento',
    description: 'Metas de universalização da coleta domiciliar e ampliação da coleta seletiva nos 22 municípios da RMRJ.',
    element: (
      <Suspense fallback={<PageLoading />}>
        <Goals />
      </Suspense>
    ),
  },
  {
    path: '/infraestrutura',
    title: 'Infraestrutura planejada',
    description: 'Usinas, unidades térmicas e demais infraestruturas planejadas pelo PMetGIRS, com as divergências entre fontes sinalizadas.',
    element: (
      <Suspense fallback={<PageLoading />}>
        <Infrastructure />
      </Suspense>
    ),
  },
  {
    path: '/transparencia',
    label: 'Transparência',
    title: 'Transparência dos dados',
    description: 'Selos de validação, divergências de dados e glossário de siglas do PMetGIRS.',
    element: <Transparency />,
  },
  {
    path: '/documentos',
    label: 'Documentos',
    title: 'Documentos oficiais',
    description: 'Biblioteca de documentos técnicos que fundamentam o PMetGIRS: Diagnóstico Geral, Prognóstico Geral e Plano de Ações.',
    element: <Documents />,
  },
  {
    path: '/duvidas',
    label: 'Dúvidas',
    title: 'Perguntas frequentes',
    description: 'Respostas rápidas para as dúvidas mais comuns sobre o PMetGIRS.',
    element: <FAQ />,
  },
];
