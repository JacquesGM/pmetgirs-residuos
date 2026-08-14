import atualizacoes from '../../data/atualizacoes.json';
import documentos from '../../data/documentos.json';
import eixos from '../../data/eixos.json';
import evolucao from '../../data/evolucao.json';
import glossario from '../../data/glossario.json';
import inconsistencias from '../../data/inconsistencias.json';
import indicadores from '../../data/indicadores.json';
import infraestruturas from '../../data/infraestruturas.json';
import metas from '../../data/metas.json';
import municipios from '../../data/municipios.json';
import projetos from '../../data/projetos.json';
import type {
  Atualizacao,
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
import type { PublicContentRepository } from '../repositories/types';

/**
 * Implementação estática, lendo os 11 JSON versionados.
 *
 * Continua sendo a fonte do portal até que a leitura pelo Firestore seja
 * validada em conteúdo, segurança e função. É o caminho de volta se a migração
 * precisar ser revertida — por isso não será removida junto com a Fase 2.
 */
export class StaticContentRepository implements PublicContentRepository {
  async listMunicipalities(): Promise<Municipio[]> {
    return municipios as Municipio[];
  }

  async listIndicators(): Promise<Indicador[]> {
    return indicadores as Indicador[];
  }

  async listAxes(): Promise<Eixo[]> {
    return eixos as Eixo[];
  }

  async listProjects(): Promise<Projeto[]> {
    return projetos as Projeto[];
  }

  async listGoals(): Promise<Meta[]> {
    return metas as Meta[];
  }

  async listInfrastructures(): Promise<Infraestrutura[]> {
    return infraestruturas as Infraestrutura[];
  }

  async listDocuments(): Promise<Documento[]> {
    return documentos as Documento[];
  }

  async listInconsistencies(): Promise<Inconsistencia[]> {
    return inconsistencias as Inconsistencia[];
  }

  async listTimeline(): Promise<EvolucaoEtapa[]> {
    return evolucao as EvolucaoEtapa[];
  }

  async listGlossary(): Promise<TermoGlossario[]> {
    return glossario as TermoGlossario[];
  }

  async getLastLoadDate(): Promise<string | null> {
    const registros = atualizacoes as Atualizacao[];
    return registros[0]?.data ?? null;
  }
}

export const staticContentRepository = new StaticContentRepository();
