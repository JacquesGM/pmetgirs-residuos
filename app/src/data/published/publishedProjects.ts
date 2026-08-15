import { legacyStatusFromExecution, legacyStatusFromValidation } from '../../domain/legacy';
import type { Projeto, StatusProjeto } from '../../types';
import { fetchPublishedCollection, type PublishedDocument } from './firestoreRest';

/**
 * Converte a projeção pública de um projeto para o tipo que a interface exibe.
 *
 * A projeção é deliberadamente mais pobre que o registro interno: a allowlist
 * da Fase 7 deixa passar 16 campos. Os que não atravessam ficam vazios aqui, e
 * é assim que deve ser — `dependencias` e `percentualAvanco`, por exemplo, não
 * são publicados, então a interface mostra ausência em vez de inventar valor.
 */
export function toProjeto(doc: PublishedDocument): Projeto {
  const d = doc.data;
  const texto = (chave: string): string => (typeof d[chave] === 'string' ? (d[chave] as string) : '');
  const lista = (chave: string): string[] =>
    Array.isArray(d[chave]) ? (d[chave] as unknown[]).filter((x): x is string => typeof x === 'string') : [];

  // A execução vem primeiro; quando indefinida, a interface mostra a situação
  // de validação. É o caso de `dado_em_validacao`, que descreve o dado e não a
  // execução — a migração deixa a execução em branco de propósito.
  const status: StatusProjeto | null =
    legacyStatusFromExecution(d.executionStatus as string | null) ??
    (legacyStatusFromValidation(d.validationStatus as string | null) as StatusProjeto | null);

  return {
    id: doc.id,
    nome: texto('name'),
    eixo: texto('axisId'),
    descricao: texto('description'),
    abrangencia: texto('territorialScale'),
    responsavel: texto('accountable'),
    participantes: lista('participants'),
    status: status ?? ('nao_iniciado' as StatusProjeto),
    // Não atravessam a fronteira pública.
    percentualAvanco: null,
    inicioPrevisto: null,
    terminoPrevisto: null,
    ultimaAtualizacao: typeof d.dataDate === 'string' ? d.dataDate : null,
    proximosPassos: lista('nextSteps'),
    dependencias: [],
    riscos: lista('risks'),
    documentosRelacionados: lista('relatedDocumentIds'),
    fonte: texto('sourceLabel'),
  };
}

/**
 * Projetos publicados, ou `null` se nada foi publicado ou a leitura falhou.
 *
 * `null` é o sinal para manter o conteúdo embutido no bundle. Ver
 * `fetchPublishedCollection`.
 */
export async function fetchPublishedProjects(sinal?: AbortSignal): Promise<Projeto[] | null> {
  const docs = await fetchPublishedCollection('projects', sinal);
  if (!docs) return null;
  const projetos = docs.map(toProjeto).filter((p) => p.nome !== '');
  return projetos.length > 0 ? projetos : null;
}
