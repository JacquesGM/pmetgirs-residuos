/**
 * Leitura da abrangência declarada como lista de municípios.
 *
 * Este módulo existe separado da migração por um motivo específico: a regra
 * precisa valer igual nos dois lados. A migração a aplica para gravar
 * `municipalityIds`; o portal a aplica para desenhar o mapa a partir do dado
 * embutido, que não passa pela migração.
 *
 * Se cada lado tivesse a sua cópia, bastaria uma mudança na redação de uma
 * abrangência para o mapa e o banco discordarem sem que nada falhasse.
 */

/** Minúsculas, sem acento. */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Municípios de um projeto, a partir da abrangência declarada.
 *
 * "Região Metropolitana do Rio de Janeiro" não é texto vago neste banco: são
 * os 22 municípios de `municipios.json`, e um dos projetos escreve o número
 * por extenso — "RMRJ — 22 municípios" —, confirmando a leitura.
 *
 * Qualquer outra abrangência devolve `null`, nunca `[]`. Os dois casos que
 * caem aqui são indeterminação declarada pela fonte, não falha de modelagem:
 * "Os Invisíveis" diz *municípios participantes a definir*, e a remediação
 * fala em **áreas** — "até 23 áreas identificadas preliminarmente" —, que são
 * um teto sobre outra unidade, não uma lista de municípios.
 *
 * `[]` afirmaria "nenhum município". `null` diz "a fonte não informa", que é
 * o que de fato acontece.
 */
export function municipiosDoProjeto(
  abrangencia: string,
  municipiosDaRmrj: string[],
): string[] | null {
  const texto = normalizarTexto(abrangencia);
  const ehMetropolitano =
    texto.includes('regiao metropolitana do rio de janeiro') || texto.includes('rmrj');
  return ehMetropolitano ? [...municipiosDaRmrj] : null;
}
