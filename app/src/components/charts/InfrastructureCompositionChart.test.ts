import { describe, expect, it } from 'vitest';
import { parseQuantidade } from './InfrastructureCompositionChart';

describe('parseQuantidade', () => {
  it('extrai um número inteiro simples', () => {
    expect(parseQuantidade('25')).toEqual({ numero: 25, aproximado: false });
  });

  it('marca como aproximado quando o valor começa com "Até"', () => {
    expect(parseQuantidade('Até 23')).toEqual({ numero: 23, aproximado: true });
  });

  it('é insensível a maiúsculas/minúsculas para o prefixo "até"', () => {
    expect(parseQuantidade('até 23')).toEqual({ numero: 23, aproximado: true });
  });

  it('retorna 0 quando não há dígitos no valor', () => {
    expect(parseQuantidade('Quantidade em validação')).toEqual({ numero: 0, aproximado: false });
  });
});
