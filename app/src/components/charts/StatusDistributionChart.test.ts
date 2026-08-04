import { describe, expect, it } from 'vitest';
import { groupStatuses } from './StatusDistributionChart';
import { KNOWN_STATUSES } from '../ui/StatusBadge';

describe('groupStatuses', () => {
  it('agrupa e conta ocorrências por status', () => {
    const data = groupStatuses(['em_estruturacao', 'nao_iniciado', 'em_estruturacao']);
    const emEstruturacao = data.find((d) => d.status === 'em_estruturacao');
    const naoIniciado = data.find((d) => d.status === 'nao_iniciado');
    expect(emEstruturacao?.count).toBe(2);
    expect(naoIniciado?.count).toBe(1);
  });

  it('ordena do status mais frequente para o menos frequente', () => {
    const data = groupStatuses(['em_estudo', 'nao_iniciado', 'nao_iniciado', 'nao_iniciado']);
    expect(data[0].status).toBe('nao_iniciado');
    expect(data[0].count).toBe(3);
  });

  it('atribui uma cor hexadecimal válida a cada status conhecido', () => {
    const data = groupStatuses(['em_estruturacao', 'em_estudo']);
    for (const item of data) {
      expect(item.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('cada status usado é reconhecido pelo StatusBadge (rótulo nunca cai no id bruto)', () => {
    const data = groupStatuses(['em_estruturacao', 'em_estudo', 'nao_iniciado', 'dado_em_validacao']);
    for (const item of data) {
      expect(KNOWN_STATUSES).toContain(item.status);
      expect(item.label).not.toBe(item.status);
    }
  });

  it('retorna array vazio para lista de status vazia', () => {
    expect(groupStatuses([])).toEqual([]);
  });
});
