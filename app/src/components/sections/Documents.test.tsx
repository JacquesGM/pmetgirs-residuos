import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Documents } from './Documents';
import documentos from '../../data/documentos.json';
import type { Documento } from '../../types';

/**
 * A biblioteca de documentos.
 *
 * Por meses ela listou os três volumes técnicos e não os entregou — a maior
 * contradição aberta de um portal de transparência. O dado sequer era o
 * obstáculo: o componente imprimia "Link do PDF em breve" fixo e nunca lia o
 * campo de link, que passou a existir em 16/08/2026.
 */
describe('biblioteca de documentos', () => {
  const dados = documentos as Documento[];

  it('todo documento com link vira um link de verdade', () => {
    render(<Documents />);
    const comLink = dados.filter((d) => d.link);
    expect(comLink.length).toBeGreaterThan(0);

    for (const doc of comLink) {
      const link = screen.getByRole('link', { name: new RegExp(`Abrir ${doc.titulo}`) });
      expect(link).toHaveAttribute('href', doc.link!);
    }
  });

  it('nenhum documento com link ainda promete o link para depois', () => {
    render(<Documents />);
    if (dados.every((d) => d.link)) {
      expect(screen.queryByText(/Link do PDF em breve/i)).not.toBeInTheDocument();
    }
  });

  it('o link avisa formato, peso e que sai do portal', () => {
    render(<Documents />);
    const doc = dados.find((d) => d.link && d.tamanho)!;
    const link = screen.getByRole('link', { name: new RegExp(`Abrir ${doc.titulo}`) });

    // Quem está no celular decide antes de baixar 20 MB; quem usa leitor de
    // tela não é levado para outra aba sem aviso.
    expect(link).toHaveAccessibleName(new RegExp(doc.formato));
    expect(link).toHaveAccessibleName(new RegExp(doc.tamanho!.replace(',', ',')));
    expect(link).toHaveAccessibleName(/em nova aba/);
  });

  it('link externo não entrega a aba de origem ao destino', () => {
    render(<Documents />);
    for (const link of screen.getAllByRole('link', { name: /^Abrir / })) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel') ?? '').toContain('noopener');
    }
  });
});
