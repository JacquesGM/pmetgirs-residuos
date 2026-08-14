import type {
  Documento,
  Eixo,
  EvolucaoEtapa,
  Inconsistencia,
  Indicador,
  Infraestrutura,
  Meta,
  Municipio,
  Projeto,
  TermoGlossario,
} from '../../types';

/**
 * Contratos de leitura do portal público.
 *
 * Componentes React nunca importam `firebase/firestore`. Eles dependem destas
 * interfaces, o que permite duas coisas: comparar a implementação estática com
 * a do Firestore durante a migração, e testar o domínio sem rede.
 */

export interface PublicContentRepository {
  listMunicipalities(): Promise<Municipio[]>;
  listIndicators(): Promise<Indicador[]>;
  listAxes(): Promise<Eixo[]>;
  listProjects(): Promise<Projeto[]>;
  listGoals(): Promise<Meta[]>;
  listInfrastructures(): Promise<Infraestrutura[]>;
  listDocuments(): Promise<Documento[]>;
  listInconsistencies(): Promise<Inconsistencia[]>;
  listTimeline(): Promise<EvolucaoEtapa[]>;
  listGlossary(): Promise<TermoGlossario[]>;
  /** Data da carga dos dados públicos — distinta da data de referência de cada dado. */
  getLastLoadDate(): Promise<string | null>;
}

export interface Page<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
}
