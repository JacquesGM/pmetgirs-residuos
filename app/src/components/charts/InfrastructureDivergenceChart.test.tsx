import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfrastructureDivergenceChart } from './InfrastructureDivergenceChart';
import infraestruturas from '../../data/infraestruturas.json';
import type { Infraestrutura } from '../../types';

/**
 * O defeito que este teste tranca: o gráfico tinha duas séries fixas, casadas
 * por prefixo com `find()`. Quando o Plano de Ações passou a ter duas fontes
 * — a sua tabela e o seu texto corrido, que discordam entre si —, a segunda
 * era descartada em silêncio, e a tabela acessível mostrava dois números onde
 * existem três.
 *
 * Um gráfico que promete "sem escolher nenhuma" e esconde uma fonte é pior que
 * um gráfico ausente: ele afirma completude que não tem.
 */
describe('gráfico de divergência da infraestrutura', () => {
  const dados = infraestruturas as Infraestrutura[];

  const fontesEsperadas = [
    ...new Set(
      ['unidades-combustao', 'gaseificacao-termodegradacao'].flatMap(
        (id) => (dados.find((i) => i.id === id)?.valoresDivergentes ?? []).map((v) => v.fonte),
      ),
    ),
  ];

  it('a origem tem mais de duas fontes — senão este teste não prova nada', () => {
    expect(fontesEsperadas.length).toBeGreaterThan(2);
  });

  it('a tabela acessível traz uma coluna por fonte, sem perder nenhuma', () => {
    render(<InfrastructureDivergenceChart />);
    for (const fonte of fontesEsperadas) {
      expect(
        screen.getAllByRole('columnheader', { name: fonte }).length,
        `coluna ausente para "${fonte}"`,
      ).toBeGreaterThan(0);
    }
  });

  it('o resumo lido por leitor de tela cita todas as fontes e o total delas', () => {
    render(<InfrastructureDivergenceChart />);
    // O `description` do ChartFigure vira `aria-label` do `role="img"` — é o
    // nome acessível, não a descrição. É essa frase que substitui o SVG.
    const figura = screen.getByRole('img');
    expect(figura).toHaveAccessibleName(
      new RegExp(`As ${fontesEsperadas.length} fontes são apresentadas`),
    );
    for (const fonte of fontesEsperadas) {
      expect(figura, `resumo não cita "${fonte}"`).toHaveAccessibleName(
        new RegExp(fonte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    }
  });
});
