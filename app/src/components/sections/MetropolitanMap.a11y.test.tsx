import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MetropolitanMap } from './MetropolitanMap';

/**
 * Acessibilidade do mapa de municípios.
 *
 * O Leaflet não roda de verdade no jsdom — não há canvas, não há SVG desenhado.
 * O que dá para provar aqui é justamente o que quebrava: a seleção por teclado
 * existir fora do mapa e a sua consequência ser anunciada.
 *
 * O defeito que motivou estes testes: os 22 marcadores já eram focáveis e
 * rotulados, e Enter já os acionava. Mas o painel que muda ao selecionar não
 * tinha região viva — quem navegava por teclado acionava um marcador e não
 * recebia nenhum retorno de que a escolha valeu.
 */
describe('acessibilidade do mapa de municípios', () => {
  it('a seleção por teclado não depende do mapa', () => {
    render(<MetropolitanMap />);
    const nav = screen.getByRole('navigation', { name: 'Selecionar município' });
    // Os 22 municípios como botões reais, fora do SVG do Leaflet.
    expect(within(nav).getAllByRole('button')).toHaveLength(22);
  });

  it('a instrução de teclado vem antes do mapa, não depois', () => {
    render(<MetropolitanMap />);
    const instrucao = screen.getByText(/use Tab para percorrê-los e Enter ou Espaço/i);
    const nav = screen.getByRole('navigation', { name: 'Selecionar município' });
    // compareDocumentPosition: 4 = o segundo vem depois do primeiro.
    expect(instrucao.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o painel do município é região viva: a troca de seleção é anunciada', () => {
    render(<MetropolitanMap />);

    const painel = screen.getByRole('status');
    expect(painel).toHaveAttribute('aria-live', 'polite');
    // Sem `atomic`, o leitor anuncia só o pedaço que mudou, e o ouvinte não
    // sabe de qual município se trata.
    expect(painel).toHaveAttribute('aria-atomic', 'true');

    const nav = screen.getByRole('navigation', { name: 'Selecionar município' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Niterói' }));

    expect(within(screen.getByRole('status')).getByText('Niterói')).toBeInTheDocument();
  });

  it('o painel diz o que fazer quando nada está selecionado', () => {
    render(<MetropolitanMap />);
    expect(screen.getByRole('status')).toHaveTextContent(/Selecione um dos 22 municípios/i);
  });
});
