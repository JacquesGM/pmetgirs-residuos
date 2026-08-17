import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrototypeNotice } from './PrototypeNotice';

/**
 * O aviso é exigência literal do Prompt Mestre enquanto o sistema estiver em
 * domínio ou conta pessoal. O texto delimita a responsabilidade institucional
 * do IRM: alterá-lo por descuido muda o que o portal declara ser.
 */
describe('aviso de protótipo', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('aparece por padrão, com o texto exato do Prompt Mestre', () => {
    render(<PrototypeNotice />);
    const aviso = screen.getByRole('complementary');
    expect(aviso).toHaveTextContent(
      'Protótipo técnico em desenvolvimento. Esta página ainda não constitui canal ' +
        'oficial de divulgação do Instituto Rio Metrópole.',
    );
  });

  it('continua visível quando a variável não é exatamente "true"', () => {
    // Um valor mal preenchido não pode retirar um aviso institucional em
    // silêncio: só a string exata desliga.
    for (const valor of ['', 'false', 'TRUE', '1', 'sim']) {
      vi.stubEnv('VITE_CANAL_OFICIAL', valor);
      const { unmount } = render(<PrototypeNotice />);
      expect(screen.getByRole('complementary'), `valor "${valor}"`).toBeInTheDocument();
      unmount();
    }
  });

  it('sai quando o canal oficial é declarado', () => {
    vi.stubEnv('VITE_CANAL_OFICIAL', 'true');
    render(<PrototypeNotice />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});
