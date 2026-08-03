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

export interface Indicador {
  id: string;
  nome: string;
  valor: number | null;
  valorExibicao: string;
  unidade: string;
  periodoReferencia: string;
  fonte: string;
  tipoDado: StatusValidacao;
  statusValidacao: StatusValidacao;
  ultimaAtualizacao: string | null;
  observacao: string | null;
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
  linhaBase: string | null;
  resultadoAtual: string | null;
  resultadoEsperado: string;
  prazo: string;
  municipios: string;
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

export interface Inconsistencia {
  id: string;
  categoria: 'divergencia_de_dados' | 'ponto_em_revisao';
  titulo: string;
  descricao: string;
  impacto: string;
  situacao: StatusValidacao;
  areaResponsavel: string;
  encaminhamento: string | null;
  ultimaAtualizacao: string | null;
  fontes: ValorDivergente[] | null;
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
