import { legacyStatusFromExecution, legacyStatusFromValidation } from '../../domain/legacy';
import type { Projeto, StatusProjeto } from '../../types';
import {
  fetchPublishedCollection,
  type AcessoPublico,
  type PublishedDocument,
} from './firestoreRest';

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

  // O valor original da coluna de situação vem publicado por exceção
  // declarada — é o único exato. A reconstrução fica como reserva, para
  // registros de releases antigos que ainda não o carreguem.
  //
  // Sem ele, `dado_em_validacao` voltava como `em_validacao`: os dois mapeiam
  // para a mesma validação interna, e o desempatador era justamente este campo.
  const legado = typeof d.legacyStatus === 'string' ? (d.legacyStatus as StatusProjeto) : null;
  const status: StatusProjeto | null =
    legado ??
    legacyStatusFromExecution(d.executionStatus as string | null) ??
    (legacyStatusFromValidation(d.validationStatus as string | null) as StatusProjeto | null);

  return {
    id: doc.id,
    nome: texto('name'),
    eixo: texto('axisId'),
    descricao: texto('description'),
    abrangencia: texto('territorialScale'),
    // `null` atravessa como `null`: dois projetos têm a abrangência declarada
    // indeterminada pela fonte, e `[]` afirmaria "nenhum município".
    municipios: Array.isArray(d.municipalityIds) ? lista('municipalityIds') : null,
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
export async function fetchPublishedProjects(
  acesso: AcessoPublico,
  sinal?: AbortSignal,
): Promise<Projeto[] | null> {
  const docs = await fetchPublishedCollection('projects', acesso, sinal);
  if (!docs) return null;
  const projetos = docs
    .map(toProjeto)
    .filter((p) => p.nome !== '')
    // Ordem estável pelo id: o snapshot precisa ser byte-idêntico para a mesma
    // entrada, senão o SHA-256 muda sem o conteúdo mudar e a verificação perde
    // o sentido. A ordem em que o Firestore devolve documentos não é garantida.
    .sort((a, b) => a.id.localeCompare(b.id, 'pt-BR'));
  return projetos.length > 0 ? projetos : null;
}
