import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { routes } from '../../routes';

const SITE_NAME = 'PMetGIRS — Instituto Rio Metrópole';

export function RouteTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = routes.find((route) => route.path === pathname);
    document.title = match ? `${match.title} | ${SITE_NAME}` : `Página não encontrada | ${SITE_NAME}`;
  }, [pathname]);

  return null;
}
