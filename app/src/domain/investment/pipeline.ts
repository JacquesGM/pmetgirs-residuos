import type { InvestmentStage } from '../enums';

/**
 * Funil de estruturação de investimento.
 *
 * Avançar de estágio é afirmação institucional, não consequência automática de
 * uma pontuação alta. Por isso cada transição declara o que precisa estar
 * pronto, e o sistema recusa saltos — passar de "identificado" direto para
 * "pronto para captação" esconderia exatamente os estudos que dão segurança à
 * decisão.
 */

export const STAGE_ORDER: InvestmentStage[] = [
  'identified',
  'prioritized',
  'structuring',
  'study',
  'study_complete',
  'ready_for_fundraising',
  'market_consultation',
  'procurement',
  'contracted',
];

export const STAGE_LABEL: Record<InvestmentStage, string> = {
  identified: 'Identificado',
  prioritized: 'Priorizado',
  structuring: 'Em estruturação',
  study: 'Em estudo',
  study_complete: 'Estudo concluído',
  ready_for_fundraising: 'Pronto para captação',
  market_consultation: 'Em consulta ao mercado',
  procurement: 'Em contratação',
  contracted: 'Contratado',
  archived: 'Arquivado',
};

/** O que precisa estar demonstrado para entrar em cada estágio. */
export const STAGE_REQUIREMENTS: Partial<Record<InvestmentStage, string[]>> = {
  study_complete: ['Estudo de viabilidade concluído', 'CAPEX e OPEX com memória de cálculo'],
  ready_for_fundraising: [
    'Escopo definido',
    'Viabilidade técnica demonstrada',
    'CAPEX e OPEX estimados',
    'Situação fundiária identificada',
    'Licenciamento mapeado',
    'Modelo de contratação em avaliação',
    'Matriz de riscos',
  ],
  market_consultation: ['Ficha executiva aprovada', 'Contato institucional definido'],
  procurement: ['Consulta ao mercado concluída', 'Modelo de contratação definido'],
};

export class StageTransitionError extends Error {}

export function canAdvance(from: InvestmentStage, to: InvestmentStage): boolean {
  if (to === 'archived') return true;
  if (from === 'archived') return false;

  const origem = STAGE_ORDER.indexOf(from);
  const destino = STAGE_ORDER.indexOf(to);
  if (origem < 0 || destino < 0) return false;

  // Um passo à frente, ou qualquer recuo. Recuar é legítimo: um estudo pode
  // revelar que a oportunidade não estava madura.
  return destino === origem + 1 || destino < origem;
}

export function assertTransition(from: InvestmentStage, to: InvestmentStage): void {
  if (canAdvance(from, to)) return;

  const origem = STAGE_ORDER.indexOf(from);
  const destino = STAGE_ORDER.indexOf(to);
  if (destino > origem + 1) {
    const pulados = STAGE_ORDER.slice(origem + 1, destino).map((s) => STAGE_LABEL[s]);
    throw new StageTransitionError(
      `Não é possível saltar de "${STAGE_LABEL[from]}" para "${STAGE_LABEL[to]}". ` +
        `Faltam os estágios: ${pulados.join(', ')}. ` +
        'Cada estágio existe para registrar o que foi demonstrado antes de avançar.',
    );
  }
  throw new StageTransitionError(
    `Transição inválida de "${STAGE_LABEL[from]}" para "${STAGE_LABEL[to]}".`,
  );
}

// ------------------------------------------------------- integridade financeira

/**
 * Tipo de fluxo financeiro.
 *
 * Esta separação responde ao achado INC-07 do Relatório de Inconsistências:
 * economias com aterro, transporte e logística apareciam agregadas às receitas
 * de energia, recicláveis e carbono, sem demonstrar como seriam capturadas
 * pelo projeto. Somar as quatro coisas infla a receita disponível ao operador
 * e distorce qualquer análise de retorno.
 */
export type FlowType =
  /** Receita prevista em contrato, devida ao operador. */
  | 'contractual_revenue'
  /** Receita sujeita a preço de mercado — energia, recicláveis, carbono. */
  | 'market_revenue'
  /** Economia do poder público: deixa de gastar, mas não vira caixa do operador. */
  | 'public_saving'
  /** Benefício socioambiental sem fluxo de caixa. */
  | 'socioenvironmental_benefit';

export type FlowCertainty = 'contracted' | 'projected' | 'estimated';

export const FLOW_LABEL: Record<FlowType, string> = {
  contractual_revenue: 'Receita contratual',
  market_revenue: 'Receita de mercado',
  public_saving: 'Economia pública',
  socioenvironmental_benefit: 'Benefício socioambiental',
};

export const CERTAINTY_LABEL: Record<FlowCertainty, string> = {
  contracted: 'Contratada',
  projected: 'Projetada',
  estimated: 'Estimada',
};

export interface FinancialFlow {
  id: string;
  type: FlowType;
  certainty: FlowCertainty;
  /** Quem recebe o fluxo: operador, poder público, sociedade. */
  beneficiary: string;
  amountCentsPerYear: number | null;
  assumptions: string[];
  evidenceIds: string[];
}

export interface FlowSummary {
  /** Só o que de fato vira caixa do operador. */
  operatorCashCents: number | null;
  /** Economia do poder público — não é caixa do operador. */
  publicSavingCents: number | null;
  /** Benefícios sem fluxo de caixa, listados sem soma monetária. */
  nonMonetary: FinancialFlow[];
  /** Avisos de integridade a exibir junto do número. */
  warnings: string[];
  /** Fluxos sem valor informado. */
  missingAmounts: number;
}

/**
 * Consolida os fluxos SEM somar coisas diferentes.
 *
 * Receita do operador e economia do poder público ficam separadas porque têm
 * beneficiários diferentes. Nenhuma receita não contratada é apresentada como
 * garantida.
 */
export function summarizeFlows(flows: FinancialFlow[]): FlowSummary {
  const warnings: string[] = [];
  let operatorCash: number | null = null;
  let publicSaving: number | null = null;
  let missingAmounts = 0;

  for (const flow of flows) {
    if (flow.amountCentsPerYear === null) {
      missingAmounts += 1;
      continue;
    }

    if (flow.type === 'contractual_revenue' || flow.type === 'market_revenue') {
      operatorCash = (operatorCash ?? 0) + flow.amountCentsPerYear;
    } else if (flow.type === 'public_saving') {
      publicSaving = (publicSaving ?? 0) + flow.amountCentsPerYear;
    }
  }

  const mercadoNaoContratado = flows.filter(
    (f) => f.type === 'market_revenue' && f.certainty !== 'contracted',
  );
  if (mercadoNaoContratado.length > 0) {
    warnings.push(
      `${mercadoNaoContratado.length} fluxo(s) de receita de mercado não estão contratados. ` +
        'Energia, recicláveis e créditos de carbono dependem de preço de mercado: são cenário, não garantia.',
    );
  }

  if (publicSaving !== null) {
    warnings.push(
      'A economia pública não entra no caixa do operador. Somá-la à receita superestimaria o ' +
        'retorno disponível para quem executa o projeto.',
    );
  }

  const semPremissa = flows.filter((f) => f.amountCentsPerYear !== null && f.assumptions.length === 0);
  if (semPremissa.length > 0) {
    warnings.push(`${semPremissa.length} fluxo(s) com valor mas sem premissa declarada.`);
  }

  if (missingAmounts > 0) {
    warnings.push(`${missingAmounts} fluxo(s) sem valor informado — não foram somados nem zerados.`);
  }

  return {
    operatorCashCents: operatorCash,
    publicSavingCents: publicSaving,
    nonMonetary: flows.filter((f) => f.type === 'socioenvironmental_benefit'),
    warnings,
    missingAmounts,
  };
}

// ------------------------------------------------------------------ desafios

export const PARTICIPATION_FORMS = [
  'estudos_consultoria',
  'tecnologia_engenharia_construcao',
  'operacao_manutencao',
  'concessao_ppp',
  'financiamento_fundo_impacto',
  'iniciativa_esg',
  'pesquisa_inovacao_piloto',
  'capacitacao_cooperativas',
] as const;

export type ParticipationForm = (typeof PARTICIPATION_FORMS)[number];

export const PARTICIPATION_LABEL: Record<ParticipationForm, string> = {
  estudos_consultoria: 'Estudos e consultoria',
  tecnologia_engenharia_construcao: 'Tecnologia, engenharia e construção',
  operacao_manutencao: 'Operação e manutenção',
  concessao_ppp: 'Concessão e PPP',
  financiamento_fundo_impacto: 'Financiamento e fundo de impacto',
  iniciativa_esg: 'Iniciativa ESG',
  pesquisa_inovacao_piloto: 'Pesquisa, inovação e projeto-piloto',
  capacitacao_cooperativas: 'Capacitação e apoio às cooperativas',
};

/**
 * Texto obrigatório em toda divulgação de desafio ou oportunidade.
 *
 * O sistema divulga formas de participação; ele NÃO seleciona empresa. Sem
 * este aviso, uma manifestação de interesse registrada aqui poderia ser lida
 * como etapa de habilitação — o que criaria um caminho informal de seleção.
 */
export const PARTICIPATION_NOTICE =
  'Manifestar interesse aqui não habilita, não classifica e não contrata ninguém. ' +
  'Contratação, concessão, PPP, consulta ao mercado e financiamento seguem os procedimentos ' +
  'oficiais e a legislação aplicável.';
