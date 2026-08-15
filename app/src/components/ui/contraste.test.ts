import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contraste dos selos e do texto corrido, conferido contra a WCAG 2.1 AA.
 *
 * Os selos de situação são a sinalização de transparência do portal — dizem ao
 * cidadão se um número está validado, preliminar ou em revisão. Se o texto
 * deles não tiver contraste, a ressalva desaparece justamente para quem mais
 * precisa dela, e nada na tela denuncia o problema.
 *
 * O arquivo de tema é lido como texto de propósito: importá-lo colocaria um
 * arquivo de fora de `src` dentro do programa do TypeScript, que usa project
 * references.
 */

const TEMA = readFileSync(resolve(__dirname, '../../../tailwind.config.ts'), 'utf-8');

/** Lê `nome: '#rrggbb'` do bloco de cores do tema. */
function tokenDoTema(nome: string): string {
  const achado = TEMA.match(new RegExp(`\\b${nome}:\\s*'(#[0-9a-fA-F]{6})'`));
  if (!achado) throw new Error(`token de cor '${nome}' não encontrado em tailwind.config.ts`);
  return achado[1].toLowerCase();
}

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(frente: string, fundo: string): number {
  const a = luminancia(frente);
  const b = luminancia(fundo);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const BRANCO = '#ffffff';
/** Cores padrão do Tailwind usadas como fundo de selo, fixadas aqui para o cálculo. */
const AMBER_50 = '#fffbeb';
const RED_50 = '#fef2f2';

/** Pares de cor em texto pequeno: exigem 4.5:1. */
const PARES_DE_TEXTO: Array<[nome: string, frente: string, fundo: string]> = [
  ['selo âmbar sobre amber-50', tokenDoTema('amber'), AMBER_50],
  ['selo âmbar sobre branco', tokenDoTema('amber'), BRANCO],
  ['selo vermelho sobre red-50', tokenDoTema('red'), RED_50],
  ['selo vermelho sobre branco', tokenDoTema('red'), BRANCO],
  ['selo azul sobre brand-blue-100', '#173f68', '#d7e6f5'],
  ['texto secundário sobre branco', '#69717d', BRANCO],
  ['texto secundário sobre neutral-50', '#69717d', '#f7f8f9'],
  ['rodapé: neutral-300 sobre neutral-900', '#b7bec7', '#181a1e'],
  ['rodapé: neutral-400 sobre neutral-900', '#8b93a0', '#181a1e'],
];

describe('contraste WCAG AA (4.5:1) do texto', () => {
  for (const [nome, frente, fundo] of PARES_DE_TEXTO) {
    it(nome, () => {
      const razao = contraste(frente, fundo);
      expect(
        razao,
        `${frente} sobre ${fundo} dá ${razao.toFixed(2)}:1, abaixo de 4.5:1`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('o âmbar de situação não pode regredir', () => {
  it('permanece legível como texto pequeno', () => {
    // Guarda explícita: #b5790a, o tom anterior, dava 3,68:1 e reprovava.
    expect(contraste(tokenDoTema('amber'), BRANCO)).toBeGreaterThanOrEqual(4.5);
    expect(contraste('#b5790a', BRANCO)).toBeLessThan(4.5);
  });
});
