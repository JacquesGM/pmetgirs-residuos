import { classifyCost, type CostCategoryResult } from './scoring/score';
import { DEFAULT_COST_THRESHOLDS, type CostThresholds } from './scoring/policy';

/**
 * Estimativa de custo de um projeto, com a procedência junto.
 *
 * Os dez projetos migrados têm todos os campos de custo nulos, e o portal não
 * consegue responder "quanto custa" — que é a pergunta que o Plano de Ações
 * deixou em aberto em R$ 12,5 bilhões contra R$ 9,15 bilhões.
 *
 * Duas regras do documento de arquitetura estão codificadas aqui e não são
 * negociáveis:
 *
 *  - **"Nunca deduzir valores sem fonte."** Valor sem fonte e sem ano-base é
 *    recusado. Um número monetário sem ano é incomparável: R$ 1 milhão de 2013
 *    não é R$ 1 milhão de 2026.
 *  - **A expressão "custo zero" não existe.** O que existe é "sem novo
 *    desembolso": executável com a equipe e os recursos que já estão pagos.
 */

/** Dinheiro em centavos inteiros. Float monetário acumula erro e some com centavos. */
export type Centavos = number;

export interface EstimativaDeCusto {
  /** `false` = executável sem novo desembolso. `null` = não se sabe. */
  requiresNewDisbursement: boolean | null;
  capexMinCents: Centavos | null;
  capexMaxCents: Centavos | null;
  annualOpexCents: Centavos | null;
  currency: 'BRL';
  /** Ano de referência dos valores. Sem ele o número não é comparável. */
  baseYear: number | null;
  /** De onde veio o número. Obrigatória quando há valor. */
  sourceLabel: string | null;
  /** Premissas curtas e explícitas. */
  assumptions: string[];
  /** 0–100, declarado por quem estima. Nunca inferido do tipo da fonte. */
  confidenceScore: number | null;
  /** Data do valor, no formato ISO. */
  asOfDate: string | null;
  /** `true` quando o valor está em estruturação, mesmo sem número. */
  underEstimation: boolean;
}

export class CostEstimateError extends Error {}

const ANO_MINIMO = 2000;

/**
 * Converte reais digitados em centavos inteiros, sem passar por float.
 *
 * `Math.round(valor * 100)` erra em casos como 19,99 e some com o centavo. Aqui
 * a string é partida em inteiro e decimal, e cada parte vira inteiro por conta
 * própria.
 */
export function paraCentavos(texto: string): Centavos | null {
  const bruto = texto.trim().replace(/\s/g, '');
  if (bruto === '') return null;

  // O agrupamento de milhar é conferido antes de qualquer limpeza. Remover os
  // pontos primeiro faria "1.2.3" virar 123 em silêncio — reinterpretar um
  // valor monetário digitado errado é pior que recusá-lo.
  const semSeparador = /^\d+(,\d{1,2})?$/;
  const comSeparador = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/;
  if (!semSeparador.test(bruto) && !comSeparador.test(bruto)) {
    throw new CostEstimateError(
      `Valor inválido: "${texto}". Use dígitos, ponto a cada três casas e vírgula decimal — ` +
        'por exemplo 6.300.000,00.',
    );
  }

  const [inteiro, decimal = ''] = bruto.replace(/\./g, '').split(',');
  const centavos = decimal.padEnd(2, '0');
  return Number(inteiro) * 100 + Number(centavos);
}

export function deCentavos(valor: Centavos | null): string {
  if (valor === null) return '';
  const negativo = valor < 0;
  const abs = Math.abs(valor);
  const inteiro = Math.floor(abs / 100).toLocaleString('pt-BR');
  const centavos = String(abs % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}${inteiro},${centavos}`;
}

function temAlgumValor(e: EstimativaDeCusto): boolean {
  return e.capexMinCents !== null || e.capexMaxCents !== null || e.annualOpexCents !== null;
}

export function validarEstimativa(e: EstimativaDeCusto): void {
  for (const [rotulo, valor] of [
    ['CAPEX mínimo', e.capexMinCents],
    ['CAPEX máximo', e.capexMaxCents],
    ['OPEX anual', e.annualOpexCents],
  ] as const) {
    if (valor !== null && valor < 0) {
      throw new CostEstimateError(`${rotulo} não pode ser negativo.`);
    }
  }

  if (e.capexMinCents !== null && e.capexMaxCents !== null && e.capexMinCents > e.capexMaxCents) {
    throw new CostEstimateError(
      'O CAPEX mínimo é maior que o máximo. Um intervalo invertido não é intervalo.',
    );
  }

  if (e.requiresNewDisbursement === false && temAlgumValor(e)) {
    throw new CostEstimateError(
      'Marcado como "sem novo desembolso", mas com valor informado. Se há desembolso, ' +
        'desmarque; se não há, deixe os valores em branco.',
    );
  }

  if (temAlgumValor(e)) {
    if (e.baseYear === null) {
      throw new CostEstimateError(
        'Valor sem ano-base. R$ 1 milhão de 2013 não é R$ 1 milhão de 2026 — sem o ano, o número ' +
          'não é comparável com nada.',
      );
    }
    const anoAtual = new Date().getFullYear();
    if (!Number.isInteger(e.baseYear) || e.baseYear < ANO_MINIMO || e.baseYear > anoAtual + 1) {
      throw new CostEstimateError(
        `Ano-base fora da faixa: ${e.baseYear}. Use um ano entre ${ANO_MINIMO} e ${anoAtual + 1}.`,
      );
    }
    if (!e.sourceLabel || e.sourceLabel.trim().length < 5) {
      throw new CostEstimateError(
        'Valor sem fonte. Nunca deduza valores sem dizer de onde vieram.',
      );
    }
  }

  if (e.confidenceScore !== null) {
    if (!Number.isInteger(e.confidenceScore) || e.confidenceScore < 0 || e.confidenceScore > 100) {
      throw new CostEstimateError('Confiança deve ser um inteiro de 0 a 100.');
    }
  }

  if (e.assumptions.some((a) => a.trim().length === 0)) {
    throw new CostEstimateError('Premissa em branco. Remova a linha em vez de deixá-la vazia.');
  }

  if (!temAlgumValor(e) && e.requiresNewDisbursement !== false && !e.underEstimation) {
    throw new CostEstimateError(
      'Nada a registrar: sem valores, sem "sem novo desembolso" e sem marcar que está em ' +
        'estruturação, a estimativa não diz nada.',
    );
  }
}

/** Faixa de custo derivada, sempre pelo teto do intervalo. */
export function categoriaDe(
  e: EstimativaDeCusto,
  limiares: CostThresholds = DEFAULT_COST_THRESHOLDS,
): CostCategoryResult {
  return classifyCost(
    {
      requiresNewDisbursement: e.requiresNewDisbursement,
      capexMinCents: e.capexMinCents,
      capexMaxCents: e.capexMaxCents,
      underEstimation: e.underEstimation,
    },
    limiares,
  );
}

export function estimativaEmBranco(): EstimativaDeCusto {
  return {
    requiresNewDisbursement: null,
    capexMinCents: null,
    capexMaxCents: null,
    annualOpexCents: null,
    currency: 'BRL',
    baseYear: null,
    sourceLabel: null,
    assumptions: [],
    confidenceScore: null,
    asOfDate: null,
    underEstimation: false,
  };
}
