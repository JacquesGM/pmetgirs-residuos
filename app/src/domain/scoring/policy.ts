/**
 * Políticas de pontuação — versionadas.
 *
 * Os pesos abaixo são PARÂMETROS DE GOVERNANÇA, não números do PMetGIRS.
 * Vieram do Prompt Mestre como ponto de partida e devem ser aprovados antes de
 * uso institucional. Quem muda é o proprietário, na tela de configurações.
 *
 * Toda mudança gera uma nova policyVersion. Avaliações antigas guardam a
 * versão que as gerou: sem isso, mexer nos pesos reescreveria silenciosamente
 * a história das decisões já tomadas.
 */

export interface WeightedCriterion {
  key: string;
  label: string;
  weight: number;
  /** Explica ao usuário o que a nota significa, na tela de avaliação. */
  help: string;
}

export interface ScoringPolicy {
  version: number;
  priority: WeightedCriterion[];
  socialImpact: WeightedCriterion[];
  investmentReadiness: WeightedCriterion[];
  /** Cobertura mínima de evidência para o sistema publicar uma nota. */
  minimumCoverage: number;
}

export const DEFAULT_PRIORITY_CRITERIA: WeightedCriterion[] = [
  { key: 'socialImpact', label: 'Impacto social', weight: 25, help: 'Quanto a ação melhora a vida das pessoas afetadas.' },
  { key: 'urgency', label: 'Urgência e obrigação', weight: 20, help: 'Prazo legal, risco à saúde ou compromisso já assumido.' },
  { key: 'readiness', label: 'Prontidão para execução', weight: 15, help: 'O quanto já está pronto para começar.' },
  { key: 'benefitCost', label: 'Relação benefício/custo', weight: 15, help: 'Retorno público esperado frente ao gasto.' },
  { key: 'environmentalImpact', label: 'Impacto ambiental', weight: 10, help: 'Ganho ambiental medido ou estimado.' },
  { key: 'investmentAppeal', label: 'Atratividade para investimento', weight: 10, help: 'Chance de atrair recurso público ou privado.' },
  { key: 'parallelization', label: 'Possibilidade de execução paralela', weight: 5, help: 'Se pode andar junto com outras ações.' },
];

export const DEFAULT_SOCIAL_IMPACT_CRITERIA: WeightedCriterion[] = [
  { key: 'population', label: 'População beneficiada e escala', weight: 20, help: 'Quantas pessoas são alcançadas.' },
  { key: 'vulnerable', label: 'Grupos vulneráveis e prioritários', weight: 20, help: 'Se alcança quem mais precisa.' },
  { key: 'health', label: 'Redução de riscos à saúde', weight: 15, help: 'Diminuição de exposição a risco sanitário.' },
  { key: 'income', label: 'Trabalho, renda e empregos', weight: 10, help: 'Postos de trabalho e renda gerados.' },
  { key: 'cooperatives', label: 'Catadores e cooperativas', weight: 10, help: 'Fortalecimento da cadeia de reciclagem.' },
  { key: 'equity', label: 'Equidade territorial', weight: 10, help: 'Se reduz desigualdade entre municípios.' },
  { key: 'environment', label: 'Qualidade ambiental percebida', weight: 10, help: 'Melhoria sentida por quem vive no território.' },
  { key: 'socialUrgency', label: 'Urgência social', weight: 5, help: 'Gravidade e pressa do problema.' },
];

export const DEFAULT_READINESS_CRITERIA: WeightedCriterion[] = [
  { key: 'scope', label: 'Escopo definido', weight: 10, help: 'O que será feito está delimitado.' },
  { key: 'feasibility', label: 'Viabilidade técnica', weight: 10, help: 'Estudo demonstrando que funciona.' },
  { key: 'costs', label: 'CAPEX e OPEX', weight: 10, help: 'Custos estimados com memória de cálculo.' },
  { key: 'licensing', label: 'Licenciamento', weight: 10, help: 'Situação junto ao órgão ambiental.' },
  { key: 'land', label: 'Localização e situação fundiária', weight: 8, help: 'Terreno identificado e disponível.' },
  { key: 'demand', label: 'Demanda', weight: 8, help: 'Volume e origem do resíduo confirmados.' },
  { key: 'revenue', label: 'Receita ou economia potencial', weight: 8, help: 'Cenário de retorno — nunca garantia.' },
  { key: 'contracting', label: 'Modelo de contratação', weight: 8, help: 'Concessão, PPP ou obra pública definida.' },
  { key: 'risks', label: 'Matriz de riscos', weight: 8, help: 'Riscos mapeados e alocados.' },
  { key: 'governance', label: 'Governança', weight: 8, help: 'Quem decide e quem responde.' },
  { key: 'documentation', label: 'Documentação', weight: 6, help: 'Estudos e peças disponíveis.' },
  { key: 'institutional', label: 'Apoio institucional', weight: 3, help: 'Respaldo formal dos envolvidos.' },
  { key: 'capacity', label: 'Capacidade de execução', weight: 3, help: 'Equipe e estrutura para tocar a obra.' },
];

export const DEFAULT_POLICY: ScoringPolicy = {
  version: 1,
  priority: DEFAULT_PRIORITY_CRITERIA,
  socialImpact: DEFAULT_SOCIAL_IMPACT_CRITERIA,
  investmentReadiness: DEFAULT_READINESS_CRITERIA,
  minimumCoverage: 40,
};

export class PolicyError extends Error {}

/** Os pesos precisam somar exatamente 100 — senão a nota não significa nada. */
export function validateWeights(criteria: WeightedCriterion[], label: string): void {
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(total - 100) > 1e-9) {
    throw new PolicyError(`Os pesos de ${label} somam ${total}, e precisam somar 100.`);
  }
  if (criteria.some((c) => c.weight < 0)) {
    throw new PolicyError(`Peso negativo em ${label}.`);
  }
  const chaves = new Set(criteria.map((c) => c.key));
  if (chaves.size !== criteria.length) {
    throw new PolicyError(`Critério repetido em ${label}.`);
  }
}

export function validatePolicy(policy: ScoringPolicy): void {
  validateWeights(policy.priority, 'priorização');
  validateWeights(policy.socialImpact, 'impacto social');
  validateWeights(policy.investmentReadiness, 'prontidão para investimento');
  if (policy.minimumCoverage < 0 || policy.minimumCoverage > 100) {
    throw new PolicyError('A cobertura mínima precisa estar entre 0 e 100.');
  }
}

/**
 * Limiares de custo — configuráveis.
 *
 * Valores iniciais para desenvolvimento. NÃO são números do PMetGIRS e
 * precisam de aprovação da governança antes de uso institucional.
 */
export interface CostThresholds {
  /** Até este valor, custo baixo. Em centavos. */
  lowMaxCents: number;
  /** Até este valor, custo médio. Acima, alto. Em centavos. */
  mediumMaxCents: number;
}

export const DEFAULT_COST_THRESHOLDS: CostThresholds = {
  lowMaxCents: 500_000_00,
  mediumMaxCents: 5_000_000_00,
};

/** Faixas de horizonte temporal — configuráveis. */
export interface HorizonConfig {
  shortMaxMonths: number;
  mediumMaxMonths: number;
}

export const DEFAULT_HORIZON: HorizonConfig = {
  shortMaxMonths: 12,
  mediumMaxMonths: 36,
};
