import { legacyStatusFromSourceType, legacyStatusFromValidation } from '../../domain/legacy';
import type { PublicCollection } from '../../domain/publication/sanitize';
import type { Documento, Indicador, StatusValidacao } from '../../types';
import type { PublishedDocument } from './firestoreRest';
import { toProjeto } from './publishedProjects';

/**
 * Mapeadores da projeção pública de volta ao formato que o portal exibe.
 *
 * A projeção usa os nomes internos, em inglês, e é mais pobre que o registro
 * privado — a allowlist decide o que atravessa. Estes mapeadores fazem o
 * caminho de volta, e o que não atravessou fica ausente em vez de inventado.
 *
 * Rodam no **gerador de snapshot**, não no navegador: a conversão acontece uma
 * vez por release, e o portal recebe o arquivo já no formato final.
 */

function texto(d: Record<string, unknown>, chave: string): string {
  return typeof d[chave] === 'string' ? (d[chave] as string) : '';
}

function textoOuNulo(d: Record<string, unknown>, chave: string): string | null {
  return typeof d[chave] === 'string' && d[chave] !== '' ? (d[chave] as string) : null;
}

function numero(d: Record<string, unknown>, chave: string): number | null {
  return typeof d[chave] === 'number' ? (d[chave] as number) : null;
}

// ------------------------------------------------------------------ documentos

/**
 * Documentos não têm status a reconverter — mas perdem a própria versão. Ver o
 * comentário em `versao`.
 */
export function toDocumento(doc: PublishedDocument): Documento {
  const d = doc.data;
  return {
    id: doc.id,
    titulo: texto(d, 'title'),
    descricao: texto(d, 'description'),
    categoria: texto(d, 'category'),
    ano: numero(d, 'year') ?? 0,
    orgao: texto(d, 'organization'),
    formato: texto(d, 'format'),
    tamanho: textoOuNulo(d, 'size'),
    // Sem URL o documento é listado e não entregue. Continua explícito.
    link: textoOuNulo(d, 'url'),
    // Perdido na migração por colisão de nome com o envelope. Fica vazio em
    // vez de exibir o contador interno como se fosse a versão do documento.
    versao: '',
  };
}

// ------------------------------------------------------------------ indicadores

/**
 * Reconstrói a coluna legada de situação do dado.
 *
 * A atualidade vem antes da validação, e a ordem não é arbitrária. Valores como
 * `em_atualizacao` e `dado_historico` só carregam atualidade — nenhum valor de
 * validação —, então na migração viraram `validationStatus: 'not_assessed'`.
 * Reconstruir só a partir da validação faria `em_atualizacao` voltar como
 * `dado_municipal_declarado`, que é o primeiro valor com essa validação.
 *
 * Isso não seria só impreciso: seria **falso**. O portal passaria a afirmar que
 * o número veio de declaração municipal quando ninguém declarou nada. Num
 * portal de transparência, errar a procedência de um dado é pior que não
 * informá-la. Aconteceu em 15/08/2026, com quatro indicadores.
 */
function statusDeValidacaoLegado(
  validationStatus: string | null,
  actualityStatus: string | null,
): StatusValidacao {
  if (actualityStatus === 'updating') return 'em_atualizacao';
  if (actualityStatus === 'historical') return 'dado_historico';
  return (
    (legacyStatusFromValidation(validationStatus) as StatusValidacao | null) ?? 'estimativa_tecnica'
  );
}

/**
 * O indicador legado tem duas colunas de status: origem do dado e situação. A
 * origem (`sourceType`) volta 1:1; a situação é reconstruída acima, porque
 * depende de atualidade e validação juntas.
 */
export function toIndicador(doc: PublishedDocument): Indicador {
  const d = doc.data;

  const tipoDado =
    (legacyStatusFromSourceType(d.sourceType as string | null) as StatusValidacao | null) ??
    'estimativa_tecnica';

  const statusValidacao = statusDeValidacaoLegado(
    d.validationStatus as string | null,
    d.actualityStatus as string | null,
  );

  return {
    id: doc.id,
    nome: texto(d, 'name'),
    valor: numero(d, 'value'),
    valorExibicao: texto(d, 'displayValue'),
    unidade: texto(d, 'unit'),
    periodoReferencia: texto(d, 'referencePeriod'),
    fonte: texto(d, 'sourceLabel'),
    tipoDado,
    statusValidacao,
    ultimaAtualizacao: textoOuNulo(d, 'dataDate'),
    observacao: textoOuNulo(d, 'note'),
  };
}

// ------------------------------------------------------------------ registro

export interface ColecaoPublicavel {
  /**
   * Coleção sob publicWorkspaces.
   *
   * O tipo é `PublicCollection`, não `string`: assim é impossível registrar
   * aqui uma coleção que não tenha allowlist definida — o compilador recusa
   * antes de qualquer dado atravessar a fronteira.
   */
  colecao: PublicCollection;
  /** Arquivo gerado, sem extensão — vira `current/<arquivo>.json`. */
  arquivo: string;
  /** Rótulo para a tela de publicação. */
  rotulo: string;
  mapear: (doc: PublishedDocument) => { id: string };
}

/**
 * Coleções que hoje têm caminho completo: allowlist cobrindo o que o portal
 * exibe, mapeador de volta e seção ligada.
 *
 * As demais — eixos, municípios, metas, infraestruturas, inconsistências —
 * ficam de fora enquanto perderem campos na travessia. Publicar uma seção pela
 * metade é pior que não publicar: o cidadão vê menos do que já via.
 */
export const COLECOES_PUBLICAVEIS: ColecaoPublicavel[] = [
  { colecao: 'projects', arquivo: 'projetos', rotulo: 'Projetos', mapear: toProjeto },
  { colecao: 'documents', arquivo: 'documentos', rotulo: 'Documentos', mapear: toDocumento },
  { colecao: 'indicators', arquivo: 'indicadores', rotulo: 'Indicadores', mapear: toIndicador },
];
