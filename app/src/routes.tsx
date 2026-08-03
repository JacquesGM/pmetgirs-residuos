import { lazy, Suspense, type ReactNode } from 'react';
import { Home } from './pages/Home';
import { Indicators } from './components/sections/Indicators';
import { Axes } from './components/sections/Axes';
import { Projects } from './components/sections/Projects';
import { Goals } from './components/sections/Goals';
import { Infrastructure } from './components/sections/Infrastructure';
import { Transparency } from './components/sections/Transparency';
import { Documents } from './components/sections/Documents';
import { FAQ } from './components/sections/FAQ';
import { PageLoading } from './components/layout/PageLoading';

const MetropolitanMap = lazy(() =>
  import('./components/sections/MetropolitanMap').then((m) => ({ default: m.MetropolitanMap })),
);

export interface AppRoute {
  path: string;
  /** Shown as a link in the header nav. Omit to keep the route reachable only via direct link/footer. */
  label?: string;
  title: string;
  element: ReactNode;
}

export const routes: AppRoute[] = [
  { path: '/', label: 'Início', title: 'Início', element: <Home /> },
  { path: '/indicadores', label: 'Indicadores', title: 'Indicadores de destaque', element: <Indicators /> },
  { path: '/eixos', label: 'Eixos', title: 'Eixos estratégicos', element: <Axes /> },
  { path: '/projetos', label: 'Projetos', title: 'Portfólio de projetos', element: <Projects /> },
  {
    path: '/municipios',
    label: 'Municípios',
    title: 'Mapa da Região Metropolitana',
    element: (
      <Suspense fallback={<PageLoading label="Carregando mapa..." />}>
        <MetropolitanMap />
      </Suspense>
    ),
  },
  { path: '/metas', label: 'Metas', title: 'Metas de coleta e atendimento', element: <Goals /> },
  { path: '/infraestrutura', title: 'Infraestrutura planejada', element: <Infrastructure /> },
  { path: '/transparencia', label: 'Transparência', title: 'Transparência dos dados', element: <Transparency /> },
  { path: '/documentos', label: 'Documentos', title: 'Documentos oficiais', element: <Documents /> },
  { path: '/duvidas', label: 'Dúvidas', title: 'Perguntas frequentes', element: <FAQ /> },
];
