import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { routes } from '../../routes';

const SITE_NAME = 'PMetGIRS — Instituto Rio Metrópole';
const DEFAULT_DESCRIPTION =
  'Acompanhe as metas, projetos e resultados do Plano Metropolitano de Gestão Integrada de Resíduos Sólidos (PMetGIRS) dos 22 municípios da Região Metropolitana do Rio de Janeiro.';

function setMetaByAttr(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

export function RouteTitle() {
  const { pathname } = useLocation();
  /**
   * Numa SPA a troca de rota não recarrega a página, então nenhum leitor de
   * tela percebe que `document.title` mudou: o usuário aciona um item do menu,
   * o conteúdo inteiro é substituído e nada é falado. Esta região anuncia o
   * nome da nova página.
   */
  const [anuncio, setAnuncio] = useState('');
  const primeiraRota = useRef(true);

  useEffect(() => {
    const match = routes.find((route) => route.path === pathname);
    const nomeDaPagina = match ? match.title : 'Página não encontrada';
    const title = `${nomeDaPagina} | ${SITE_NAME}`;
    const description = match?.description ?? DEFAULT_DESCRIPTION;

    document.title = title;
    setMetaByAttr('name', 'description', description);
    setMetaByAttr('property', 'og:title', title);
    setMetaByAttr('property', 'og:description', description);
    setCanonical(`${window.location.origin}${pathname}`);

    // Na primeira carga o leitor de tela já lê o título sozinho; anunciar de
    // novo seria eco.
    if (primeiraRota.current) {
      primeiraRota.current = false;
      return;
    }
    setAnuncio(nomeDaPagina);
  }, [pathname]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {anuncio}
    </div>
  );
}
