import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { routes } from '../../routes';

const SITE_NAME = 'PMetGIRS — Instituto Rio Metrópole';

/**
 * Endereço oficial do portal. Precisa ser fixo, e não `window.location.origin`:
 * enquanto o mesmo conteúdo é servido também pelo GitHub Pages, uma canônica
 * derivada do host faz cada cópia se declarar oficial, e quem decide qual
 * indexar passa a ser o buscador. Com o valor fixo, as duas cópias apontam para
 * a mesma URL — que é o que a tag canônica existe para fazer.
 */
const SITE_URL = (import.meta.env.VITE_SITE_URL ?? '').replace(/\/$/, '');
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

    const url = `${SITE_URL || window.location.origin}${pathname}`;
    setMetaByAttr('property', 'og:url', url);
    setCanonical(url);

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
