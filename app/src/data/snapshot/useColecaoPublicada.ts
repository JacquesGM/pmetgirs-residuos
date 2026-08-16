import { useEffect, useState } from 'react';
import { carregarColecaoPublicada } from './loadSnapshot';

/**
 * Embutido primeiro, publicado depois.
 *
 * A seção renderiza no primeiro quadro com o conteúdo do bundle — sem spinner e
 * sem salto de layout — e troca pelo snapshot quando ele chega. Se a leitura
 * falhar, se nada tiver sido publicado, ou se a contagem divergir do manifesto,
 * o cidadão segue vendo o que já via.
 *
 * O padrão está aqui e não em cada seção porque a decisão é uma só: um portal
 * de transparência em branco por causa de rede é pior que um portal exibindo o
 * release anterior. Repetir a regra em sete lugares é convidar a que um deles
 * a implemente diferente.
 */
export function useColecaoPublicada<T>(colecao: string, embutido: T[]): T[] {
  const [dados, setDados] = useState<T[]>(embutido);

  useEffect(() => {
    const controle = new AbortController();
    carregarColecaoPublicada<T>(colecao, controle.signal)
      .then((publicados) => {
        if (publicados) setDados(publicados);
      })
      .catch(() => {
        /* mantém o conteúdo embutido */
      });
    return () => controle.abort();
  }, [colecao]);

  return dados;
}
