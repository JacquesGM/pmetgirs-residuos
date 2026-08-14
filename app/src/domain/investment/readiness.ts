import type { ScoringPolicy } from '../scoring/policy';
import { computeReadiness, type DimensionInput, type ScoreResult } from '../scoring/score';
import { STAGE_REQUIREMENTS, type FlowSummary } from './pipeline';
import type { InvestmentStage } from '../enums';

/**
 * Prontidão para captação: o que já está demonstrado e o que falta fechar.
 *
 * O valor prático desta tela não é a nota — é a lista de lacunas. Uma
 * oportunidade com 62 pontos não diz nada a quem precisa agir; "faltam
 * licenciamento e matriz de riscos" diz.
 */

export interface ReadinessGap {
  label: string;
  weight: number;
  /** O que fazer para fechar a lacuna. */
  nextAction: string;
}

export interface ReadinessReport extends ScoreResult {
  gapsDetailed: ReadinessGap[];
  /** Requisitos pendentes para o próximo estágio do funil. */
  stageBlockers: string[];
  /** Pode ser apresentada ao mercado? */
  readyToPresent: boolean;
  readyReason: string;
}

const NEXT_ACTIONS: Record<string, string> = {
  scope: 'Delimitar o que será feito e o que fica fora do escopo.',
  feasibility: 'Contratar ou concluir o estudo de viabilidade técnica.',
  costs: 'Produzir memória de cálculo de CAPEX e OPEX com ano-base.',
  licensing: 'Consultar o órgão ambiental sobre o rito de licenciamento.',
  land: 'Identificar o terreno e verificar titularidade e zoneamento.',
  demand: 'Confirmar volume e origem do resíduo com os municípios.',
  revenue: 'Modelar cenários de receita e economia, separando os beneficiários.',
  contracting: 'Avaliar concessão, PPP ou obra pública com apoio jurídico.',
  risks: 'Montar matriz de riscos com alocação entre as partes.',
  governance: 'Definir quem decide e quem responde por cada entrega.',
  documentation: 'Reunir estudos e peças técnicas num repositório único.',
  institutional: 'Obter manifestação formal dos órgãos envolvidos.',
  capacity: 'Dimensionar equipe e estrutura para executar e fiscalizar.',
};

export function buildReadinessReport(
  policy: ScoringPolicy,
  inputs: DimensionInput[],
  currentStage: InvestmentStage,
  targetStage: InvestmentStage,
  flows: FlowSummary | null,
): ReadinessReport {
  const base = computeReadiness(policy, inputs);
  const avaliados = new Map(inputs.map((i) => [i.key, i]));

  const gapsDetailed: ReadinessGap[] = policy.investmentReadiness
    .filter((c) => (avaliados.get(c.key)?.score ?? null) === null)
    .map((c) => ({
      label: c.label,
      weight: c.weight,
      nextAction: NEXT_ACTIONS[c.key] ?? `Avaliar "${c.label}" com evidência.`,
    }))
    // Maior peso primeiro: o que mais destrava a nota aparece no topo.
    .sort((a, b) => b.weight - a.weight);

  const stageBlockers = gapsDetailed.length > 0 ? (STAGE_REQUIREMENTS[targetStage] ?? []) : [];

  // Apresentar ao mercado exige demonstração, não pontuação. Uma nota alta com
  // receita de mercado não contratada continua sendo cenário.
  const temPromessaNaoContratada = (flows?.warnings.length ?? 0) > 0;
  const readyToPresent =
    base.score !== null && base.score >= 60 && gapsDetailed.length === 0 && currentStage !== 'identified';

  const readyReason = readyToPresent
    ? temPromessaNaoContratada
      ? 'Pronta para apresentação, desde que os cenários de receita sejam apresentados como cenários.'
      : 'Escopo, viabilidade, custos e riscos demonstrados.'
    : base.score === null
      ? 'Sem cobertura de evidência suficiente para avaliar a prontidão.'
      : gapsDetailed.length > 0
        ? `Faltam ${gapsDetailed.length} item(ns): ${gapsDetailed.slice(0, 3).map((g) => g.label).join(', ')}${gapsDetailed.length > 3 ? '...' : ''}`
        : 'Prontidão abaixo do mínimo para apresentação ao mercado.';

  return { ...base, gapsDetailed, stageBlockers, readyToPresent, readyReason };
}
