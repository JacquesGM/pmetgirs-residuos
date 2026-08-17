import type { ComponentPropsWithoutRef, ReactNode } from 'react';

/**
 * Aceita os atributos de `div` para que quem usa o Card possa declarar papel e
 * região viva sem precisar embrulhá-lo numa `div` extra.
 *
 * O caso que motivou isto: o painel do município muda quando alguém seleciona
 * um marcador do mapa, e sem `role="status"` a mudança acontece em silêncio
 * para quem usa leitor de tela.
 */
type CardProps = ComponentPropsWithoutRef<'div'> & { children: ReactNode };

export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`min-w-0 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
