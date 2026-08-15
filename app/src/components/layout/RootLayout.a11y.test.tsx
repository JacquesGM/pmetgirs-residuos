import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RootLayout } from './RootLayout';
import { routes } from '../../routes';

/**
 * Acessibilidade estrutural do layout. São comportamentos que ninguém percebe
 * quebrar olhando a tela — só quem navega por teclado ou leitor de tela — e por
 * isso precisam de teste.
 */

function renderLayout(entrada = '/') {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route element={<RootLayout />}>
          {routes.map((route) => (
            // Conteúdo dublê: o que está sob teste é o layout, não as seções.
            <Route key={route.path} path={route.path} element={<h1>{route.title}</h1>} />
          ))}
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('pular para o conteúdo', () => {
  it('aponta para um alvo que existe e é focável', () => {
    const { container } = renderLayout();

    const atalho = screen.getByRole('link', { name: /ir para o conteúdo/i });
    const destino = atalho.getAttribute('href')?.replace('#', '');
    expect(destino).toBeTruthy();

    const main = container.querySelector(`#${destino}`);
    expect(main).not.toBeNull();
    expect(main?.tagName).toBe('MAIN');
    // Sem tabIndex o navegador rola até o conteúdo mas deixa o foco no
    // cabeçalho, e o Tab seguinte devolve o usuário à navegação que ele pulou.
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});

describe('anúncio de troca de rota', () => {
  it('não anuncia nada na primeira carga', () => {
    const { container } = renderLayout();

    const regiao = container.querySelector('[aria-live="polite"]');
    expect(regiao).not.toBeNull();
    // O leitor de tela já lê o título no carregamento; repetir seria eco.
    expect(regiao?.textContent).toBe('');
  });

  it('anuncia o nome da nova página ao navegar', async () => {
    const destino = routes.find((route) => route.path === '/indicadores');
    expect(destino).toBeDefined();

    const { container } = renderLayout();

    const [link] = screen.getAllByRole('link', { name: destino!.label! });
    fireEvent.click(link);

    await waitFor(() => {
      const regiao = container.querySelector('[aria-live="polite"]');
      expect(regiao?.textContent).toBe(destino!.title);
    });
  });
});
