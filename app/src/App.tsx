import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RootLayout } from './components/layout/RootLayout';
import { PageLoading } from './components/layout/PageLoading';
import { NotFound } from './pages/NotFound';
import { routes } from './routes';

/**
 * Uma aplicação, duas superfícies.
 *
 * O portal público em `/` e a área de gestão em `/app` compartilham design e
 * domínio, mas nada mais: a gestão é carregada sob demanda, para que o cidadão
 * não baixe o SDK do Firebase para ler uma página estática, e lê uma árvore de
 * dados diferente, separada pelas Security Rules.
 */
const PrivateApp = lazy(() => import('./app/PrivateApp').then((m) => ({ default: m.PrivateApp })));

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        {routes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="/app/*"
        element={
          <Suspense fallback={<PageLoading label="Carregando a área de gestão..." />}>
            <PrivateApp />
          </Suspense>
        }
      />
    </Routes>
  );
}

export default App;
