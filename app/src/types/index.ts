export type StatusValidacao =
  | 'dado_oficial_validado'
  | 'dado_municipal_declarado'
  | 'estimativa_tecnica'
  | 'dado_historico'
  | 'dado_preliminar'
  | 'em_atualizacao'
  | 'em_validacao'
  | 'informacao_divergente';

export type StatusProjeto =
  | 'nao_iniciado'
  | 'em_estruturacao'
  | 'em_estudo'
  | 'em_contratacao'
  | 'em_licenciamento'
  | 'em_implantacao'
  | 'em_operacao'
  | 'concluido'
  | 'suspenso'
  | 'dado_em_validacao';

export interface Municipio {
  id: string;
  nome: string;
  areaTerritorialKm2: number;
  areaUrbanizadaKm2: number;
  populacao: number;
  populacaoAno: number;
  densidadeDemografica: number;
  densidadeAno: number;
  lat: number;
  lng: number;
  fonte: string;
  statusDados: StatusValidacao;
  observacao: string | null;
}

/**
 * Duas coisas diferentes convivem sob o nome "indicador".
 *
 * `medido` é número apurado, com valor, unidade e período — é o que a home
 * mostra em destaque. `catalogo_snis` é definição: a Tabela 25 do Plano de
 * Ações lista os indicadores do SNIS que *devem* ser observados, sem trazer
 * um único valor para a RMRJ.
 *
 * Misturar os dois faria 48 fichas vazias parecerem medição ausente, quando na
 * verdade nunca houve medição publicada. É a distinção que o achado INC-12 —
 * "indicadores sem especificação operacional completa" — cobra.
 */
export type NaturezaIndicador = 'medido' | 'catalogo_snis';

export interface Indicador {
  id: string;
  nome: string;
  natureza: NaturezaIndicador;
  valor: number | null;
  /** Nulo no catálogo: não há valor a exibir, e "0" seria mentira. */
  valorExibicao: string | null;
  /** Nulo no catálogo: a Tabela 25 não declara unidade. */
  unidade: string | null;
  periodoReferencia: string | null;
  fonte: string;
  tipoDado: StatusValidacao;
  statusValidacao: StatusValidacao;
  ultimaAtualizacao: string | null;
  observacao: string | null;
}

/**
 * Um valor de um indicador para um município, com a sua própria unidade, ano e
 * fonte.
 *
 * Ficou fora do tipo `Municipio` de propósito. Os dados municipais do
 * Diagnóstico vêm de tabelas diferentes, com bases e anos diferentes — SNIS
 * 2021, questionário de 2022, ICMS Ecológico. Empilhá-los como campos de um
 * mesmo registro obrigaria a inventar uma data de referência única para todos,
 * que é exatamente o que o achado INC-11 cobra que não se faça.
 */
export interface IndicadorMunicipal {
  id: string;
  municipioId: string;
  /** Chave estável do indicador, comum aos 22 municípios. */
  indicador: string;
  nome: string;
  valor: number | null;
  valorExibicao: string | null;
  unidade: string | null;
  periodoReferencia: string | null;
  fonte: string;
  statusValidacao: StatusValidacao;
  observacao: string | null;
}

/**
 * Um tema da matriz GUT do Plano de Ações, com a priorização que a fonte fez.
 *
 * Gravidade, Urgência e Tendência recebem nota de 1 a 5, e a pontuação é o
 * produto das três. É outra metodologia que a matriz de sete critérios com
 * pesos usada pelo sistema — e é justamente a sobreposição de métodos que o
 * achado INC-22 aponta.
 */
export interface TemaGut {
  id: string;
  numero: number;
  tema: string;
  gravidade: number;
  urgencia: number;
  tendencia: number;
  /** Produto de G x U x T — o critério que a Tabela 6 aplica. */
  pontuacao: number;
  /** O que a Tabela 5 imprime; diverge do produto numa das dezesseis linhas. */
  pontuacaoImpressa: number;
  ranking: number;
  projetosRelacionados: string[];
  fonte: string;
  observacao: string | null;
}

/** Estimativa de custo como transcrita das fontes, para migração. */
export interface EstimativaDeCustoRegistro {
  id: string;
  entityId: string;
  requiresNewDisbursement: boolean | null;
  capexMinCents: number | null;
  capexMaxCents: number | null;
  annualOpexCents: number | null;
  currency: 'BRL';
  baseYear: number | null;
  sourceLabel: string | null;
  assumptions: string[];
  confidenceScore: number | null;
  asOfDate: string | null;
  underEstimation: boolean;
}

export interface Eixo {
  id: string;
  nome: string;
  descricao: string;
  objetivo: string;
  responsavel: string;
  situacao: StatusProjeto;
  indicadoresRelacionados: string[];
  documentosRelacionados: string[];
}

export interface Projeto {
  id: string;
  nome: string;
  eixo: string;
  descricao: string;
  abrangencia: string;
  /**
   * Leitura da abrangência como lista de municípios.
   *
   * Opcional porque `projetos.json` — a transcrição embutida no bundle — não a
   * traz: ela é derivada, e derivação não se guarda na transcrição. Chega
   * preenchida no dado publicado. Quem desenha o mapa não lê este campo, e sim
   * aplica `municipiosDoProjeto` sobre `abrangencia`, para funcionar igual nos
   * dois casos; um teste prende as duas leituras ao mesmo resultado.
   */
  municipios?: string[] | null;
  responsavel: string;
  participantes: string[];
  status: StatusProjeto;
  percentualAvanco: number | null;
  inicioPrevisto: string | null;
  terminoPrevisto: string | null;
  ultimaAtualizacao: string | null;
  proximosPassos: string[];
  dependencias: string[];
  riscos: string[];
  documentosRelacionados: string[];
  fonte: string;
}

export interface Meta {
  id: string;
  nome: string;
  /**
   * Coluna "Objetivos Gerais" das tabelas OKR/SMART do Plano de Ações. Várias
   * metas compartilham o mesmo objetivo — é por ele que elas se agrupam.
   */
  objetivoGeral: string | null;
  linhaBase: string | null;
  resultadoAtual: string | null;
  resultadoEsperado: string;
  /** Nulo quando o Plano enuncia a meta sem fixar prazo. */
  prazo: string | null;
  municipios: string;
  /** Coluna "Responsáveis". Vazio quando o Plano não atribui a ninguém. */
  responsaveis: string[];
  situacao: StatusProjeto;
  metodologia: string | null;
  fonte: string;
  ultimaAtualizacao: string | null;
}

export interface ValorDivergente {
  fonte: string;
  valor: string;
}

export interface Infraestrutura {
  id: string;
  nome: string;
  quantidade: string;
  unidade: string;
  fonte: string;
  statusValidacao: StatusValidacao;
  valoresDivergentes: ValorDivergente[] | null;
  observacao: string | null;
}

export interface Documento {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  ano: number;
  orgao: string;
  formato: string;
  tamanho: string | null;
  link: string | null;
  versao: string;
}

/**
 * Tratamento editorial anotado na matriz consolidada do Relatório de
 * Inconsistências. Não é classificação nossa: cada achado da matriz carrega a
 * sua decisão junto ao título.
 *
 * **Não governa a publicação.** Em 16/08/2026 a matriz foi confrontada com a
 * seção 6.13 do Prompt de Criação da SPA, que nomeia os nove achados e exige
 * que a divergência permaneça visível ("nunca escolha silenciosamente uma das
 * versões conflitantes"). A especificação prevaleceu; a anotação continua
 * registrada como procedência, e fica fora da projeção pública.
 */
export type TratamentoEditorial =
  | 'nao_disponibilizar'
  | 'definir_na_modelagem'
  | 'divulgar_como_dado_de_epoca'
  | 'resolver_adotando_maior'
  | 'esquecer_no_momento';

/**
 * De onde veio o achado.
 *
 * Os nove primeiros saíram do Relatório Técnico de Inconsistências, encomendado
 * pelo IRM. Os demais saíram da leitura integral do Diagnóstico e do Prognóstico
 * feita depois, e não têm chancela institucional. Publicar os dois sem
 * distinguir daria ao segundo grupo um peso que ele ainda não tem.
 */
export type OrigemDoAchado = 'relatorio_de_inconsistencias' | 'leitura_das_fontes';

export interface Inconsistencia {
  id: string;
  /** Código do achado no Relatório de Inconsistências (INC-01 a INC-24). */
  codigoRelatorio: string | null;
  origemDoAchado: OrigemDoAchado;
  categoria: 'divergencia_de_dados' | 'ponto_em_revisao';
  titulo: string;
  descricao: string;
  impacto: string;
  situacao: StatusValidacao;
  areaResponsavel: string;
  encaminhamento: string | null;
  ultimaAtualizacao: string | null;
  fontes: ValorDivergente[] | null;
  tratamentoEditorial: TratamentoEditorial | null;
}


export interface EvolucaoEtapa {
  id: string;
  titulo: string;
  periodo: string;
  situacao: StatusProjeto;
  descricao: string;
  fonte: string;
}

export interface TermoGlossario {
  sigla: string;
  significado: string;
}

export interface Atualizacao {
  id: string;
  data: string;
  descricao: string;
  fonte: string;
  arquivosAfetados: string[];
}

/**
 * Central de Tratamento de Resíduos em operação.
 *
 * Tipo próprio, e não mais um registro de `Infraestrutura`: aquele modela
 * contagem agregada do que se pretende construir — "25 usinas de triagem" —,
 * e estas são instalações individuais que já operam, cada uma com capacidade,
 * vida útil, tratamento de chorume, biogás, energia e municípios atendidos.
 * Forçá-las no mesmo molde perderia tudo isso.
 */
export interface CentralDeTratamento {
  id: string;
  nome: string;
  operadora: string;
  /** Município onde a central fica, entre os 22 da RMRJ. */
  municipioSede: string;
  endereco: string;
  /** ISO AAAA-MM-DD, ou nulo quando a fonte não informa. */
  inicioOperacao: string | null;
  areaM2: number | null;
  capacidadeProjetoToneladas: number | null;
  capacidadeDiariaTdia: number | null;
  capacidadeAnualTano: number | null;
  recebimentoDiarioMedioTdia: number | null;
  vidaUtilAnos: number | null;
  lixiviadoDiarioM3: number | null;
  tecnologiaChorume: string | null;
  /** Texto com unidade: as fontes usam Nm³/ano numas e Nm³/h noutras. */
  biogas: string | null;
  geracaoEnergia: string | null;
  creditoCarbonoTco2e: number | null;
  custoNovaCelulaPorM2: number | null;
  opexPorTonelada: number | null;
  custoTratamentoChorumePorM3: number | null;
  municipiosAtendidos: string[];
  /** A CTR de Seropédica atende municípios fora da região; eles ficam como texto. */
  municipiosAtendidosForaDaRmrj: string[];
  fonte: string;
  statusValidacao: StatusValidacao;
  observacao: string | null;
}
