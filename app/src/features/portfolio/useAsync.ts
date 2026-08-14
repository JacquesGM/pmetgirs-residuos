import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

/**
 * Carregamento pontual com estados explícitos.
 *
 * Sem listener em tempo real: a área de gestão lê sob demanda e invalida
 * depois de gravar. Listener aberto em toda tela é conta de leitura correndo
 * sozinha — e a cota do plano gratuito é finita.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    loader()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error && error.message.includes('permission-denied')
            ? 'Seu perfil não tem permissão para ver estas informações.'
            : error instanceof Error
              ? error.message
              : 'Não foi possível carregar os dados.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload };
}
