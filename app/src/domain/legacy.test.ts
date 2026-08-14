import { describe, expect, it } from 'vitest';
import { KNOWN_STATUSES } from '../components/ui/StatusBadge';
import { LEGACY_STATUS_KEYS, mapLegacyProjectStatus, mapLegacyValidationStatus } from './legacy';
import type { StatusProjeto, StatusValidacao } from '../types';

describe('conversão dos status legados', () => {
  it('cobre todos os 18 status que o sistema atual conhece', () => {
    expect([...LEGACY_STATUS_KEYS].sort()).toEqual([...KNOWN_STATUSES].sort());
  });

  it('tira dado_em_validacao da dimensão de execução', () => {
    const resultado = mapLegacyProjectStatus('dado_em_validacao');
    expect(resultado.validation).toBe('in_validation');
    // Não vira not_started: ninguém afirmou que o projeto não começou.
    expect(resultado.execution).toBeUndefined();
    expect(resultado.note).toBeTruthy();
  });

  it('converte suspenso em paused', () => {
    expect(mapLegacyProjectStatus('suspenso').execution).toBe('paused');
  });

  it('desdobra dado_oficial_validado em origem e validação', () => {
    const resultado = mapLegacyValidationStatus('dado_oficial_validado');
    expect(resultado.sourceType).toBe('official');
    expect(resultado.validation).toBe('validated');
  });

  it('trata dado_historico como atualidade, não como validação', () => {
    const resultado = mapLegacyValidationStatus('dado_historico');
    expect(resultado.actuality).toBe('historical');
    expect(resultado.validation).toBeUndefined();
  });

  it('trata estimativa_tecnica como origem, não como confiança', () => {
    const resultado = mapLegacyValidationStatus('estimativa_tecnica');
    expect(resultado.sourceType).toBe('technical_estimate');
    expect(resultado.validation).toBe('not_assessed');
  });

  it('preserva o valor original em toda conversão', () => {
    for (const status of KNOWN_STATUSES) {
      const resultado =
        mapLegacyProjectStatus(status as StatusProjeto) ??
        mapLegacyValidationStatus(status as StatusValidacao);
      expect(resultado.legacyStatus).toBe(status);
    }
  });
});
