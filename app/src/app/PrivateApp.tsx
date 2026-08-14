import { Component, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { AppShell } from './AppShell';
import { privateRoutes } from './appRoutes';
import { AuthErrorPage } from '../features/auth/AuthPages';
import { NotFound } from '../pages/NotFound';

/**
 * Sem configuração do Firebase, o cliente lança na inicialização. Isso é
 * intencional: é melhor falhar alto e explicar o que falta do que abrir uma
 * área de gestão que silenciosamente não fala com servidor nenhum.
 */
class FirebaseBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : 'Erro desconhecido.' };
  }

  render() {
    if (this.state.message) return <AuthErrorPage message={this.state.message} />;
    return this.props.children;
  }
}

export function PrivateApp() {
  return (
    <FirebaseBoundary>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            {privateRoutes.map((route) => (
              <Route
                key={route.path || 'index'}
                index={route.path === ''}
                path={route.path || undefined}
                element={route.element}
              />
            ))}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </FirebaseBoundary>
  );
}
