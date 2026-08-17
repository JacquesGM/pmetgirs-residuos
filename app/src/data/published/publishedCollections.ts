import {
  legacyStatusFromExecution,
  legacyStatusFromSourceType,
  legacyStatusFromValidation,
} from '../../domain/legacy';
import type { PublicCollection } from '../../domain/publication/sanitize';
import type {
  Documento,
  Inconsistencia,
  Infraestrutura,
  TermoGlossario,
  ValorDivergente,
  Eixo,
  Indicador,
  IndicadorMunicipal,
  CentralDeTratamento,
  ViabilidadeEconomica,
  Vazadouro,
  ComponenteRsu,
  EtapaCronograma,
  Meta,
  Municipio,
  StatusProjeto,
  StatusValidacao,
} from '../../types';
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
 * O legado tem uma coluna só; a migração a espalhou em validação e atualidade,
 * preenchendo com defaults o que o valor original não dizia. Voltar exige saber
 * qual dos dois campos carrega informação real e qual é apenas default — e a
 * resposta muda por coleção.
 *
 * Dois erros concretos, ambos de 15/08/2026, definem a regra:
 *
 *  - Reconstruir só pela validação fazia `em_atualizacao` voltar como
 *    `dado_municipal_declarado`, o primeiro valor com validação `not_assessed`.
 *    Não é impreciso, é **falso**: afirma uma procedência que ninguém declarou.
 *  - Reconstruir pela atualidade primeiro fazia os 22 municípios virarem
 *    `dado_historico`, porque a migração default `actualityStatus` para
 *    `'historical'` mesmo em dado oficial validado.
 *
 * Daí a ordem: validação específica vence; `not_assessed` não é resposta; e só
 * então a atualidade decide.
 */
export function statusDeValidacaoLegado(
  validationStatus: string | null,
  actualityStatus: string | null,
): StatusValidacao {
  // Uma validação específica sempre vence. `not_assessed` não conta: é o valor
  // que a migração usa quando o status legado não falava de validação, e
  // tratá-lo como resposta faria o inverso escolher o primeiro casamento —
  // `dado_municipal_declarado`, uma afirmação de procedência que ninguém fez.
  const porValidacao = legacyStatusFromValidation(validationStatus) as StatusValidacao | null;
  if (porValidacao && validationStatus !== 'not_assessed') return porValidacao;

  // Sem validação específica, a atualidade é o sinal que restou.
  //
  // A ordem importa nos dois sentidos. Municípios recebem
  // `actualityStatus: 'historical'` por default da migração, mesmo sendo dado
  // oficial validado; se a atualidade viesse primeiro, os 22 apareceriam como
  // "dado histórico". Indicadores `em_atualizacao`, ao contrário, só carregam
  // atualidade — e é ela que descreve o registro.
  if (actualityStatus === 'updating') return 'em_atualizacao';
  if (actualityStatus === 'historical') return 'dado_historico';

  return porValidacao ?? 'estimativa_tecnica';
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
    // Sem natureza declarada, trata como medido: é o que os 8 indicadores
    // publicados antes da Tabela 25 sempre foram.
    natureza: textoOuNulo(d, 'nature') === 'catalogo_snis' ? 'catalogo_snis' : 'medido',
    valor: numero(d, 'value'),
    valorExibicao: textoOuNulo(d, 'displayValue'),
    unidade: textoOuNulo(d, 'unit'),
    periodoReferencia: textoOuNulo(d, 'referencePeriod'),
    fonte: texto(d, 'sourceLabel'),
    tipoDado,
    statusValidacao,
    ultimaAtualizacao: textoOuNulo(d, 'dataDate'),
    observacao: textoOuNulo(d, 'note'),
  };
}


// -------------------------------------------------- indicadores municipais

export function toIndicadorMunicipal(doc: PublishedDocument): IndicadorMunicipal {
  const d = doc.data;
  return {
    id: doc.id,
    municipioId: texto(d, 'municipalityId'),
    indicador: texto(d, 'indicator'),
    nome: texto(d, 'name'),
    valor: numero(d, 'value'),
    valorExibicao: textoOuNulo(d, 'displayValue'),
    unidade: textoOuNulo(d, 'unit'),
    periodoReferencia: textoOuNulo(d, 'referencePeriod'),
    fonte: texto(d, 'sourceLabel'),
    // O legado é o valor exato da coluna de situação; a reconstrução a partir
    // de validação e atualidade produziria rótulo falso, como já produziu.
    statusValidacao: (textoOuNulo(d, 'legacyStatus') as StatusValidacao | null) ??
      statusDeValidacaoLegado(
        d.validationStatus as string | null,
        d.actualityStatus as string | null,
      ),
    observacao: textoOuNulo(d, 'note'),
  };
}

// -------------------------------------------- cronograma de instalação

export function toEtapaCronograma(doc: PublishedDocument): EtapaCronograma {
  const d = doc.data;
  return {
    id: doc.id,
    tecnologia: texto(d, 'name'),
    ordem: numero(d, 'displayOrder') ?? 0,
    curtoPrazo: numero(d, 'shortTerm'),
    medioPrazo: numero(d, 'mediumTerm'),
    longoPrazo: numero(d, 'longTerm'),
    total: numero(d, 'total') ?? 0,
    fonte: texto(d, 'sourceLabel'),
    statusValidacao: textoOuNulo(d, 'note') ? 'informacao_divergente' : 'estimativa_tecnica',
    observacao: textoOuNulo(d, 'note'),
  };
}

// ------------------------------------------- composição gravimétrica do RSU

export function toComponenteRsu(doc: PublishedDocument): ComponenteRsu {
  const d = doc.data;
  return {
    id: doc.id,
    grupo: texto(d, 'group'),
    grupoRotulo: texto(d, 'groupLabel'),
    nome: texto(d, 'name'),
    percentual: numero(d, 'percentage') ?? 0,
    baseDoPercentual: texto(d, 'percentageBase'),
    toneladasDia: numero(d, 'dailyTonnes') ?? 0,
    ordem: numero(d, 'displayOrder') ?? 0,
    fonte: texto(d, 'sourceLabel'),
    statusValidacao: 'estimativa_tecnica',
    observacao: textoOuNulo(d, 'note'),
  };
}

// ------------------------------------------------------------ vazadouros

export function toVazadouro(doc: PublishedDocument): Vazadouro {
  const d = doc.data;
  const municipios = Array.isArray(d.municipalityIds)
    ? (d.municipalityIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  return {
    id: doc.id,
    nome: texto(d, 'name'),
    municipioId: municipios[0] ?? '',
    estagio: texto(d, 'stage'),
    primeiraEtapa: textoOuNulo(d, 'firstStage'),
    tratamentoPrimario: textoOuNulo(d, 'primaryTreatment'),
    tratamentoSecundario: textoOuNulo(d, 'secondaryTreatment'),
    tratamentoTerciario: textoOuNulo(d, 'tertiaryTreatment'),
    anoEncerramento: numero(d, 'closureYear'),
    fonte: texto(d, 'sourceLabel'),
    statusValidacao: textoOuNulo(d, 'note') ? 'informacao_divergente' : 'dado_oficial_validado',
    observacao: textoOuNulo(d, 'note'),
  };
}

// ---------------------------------------------------- viabilidade econômica

export function toViabilidadeEconomica(doc: PublishedDocument): ViabilidadeEconomica {
  const d = doc.data;
  return {
    id: doc.id,
    tipo: (textoOuNulo(d, 'kind') === 'tecnologia' ? 'tecnologia' : 'cenario'),
    nome: texto(d, 'name'),
    rsuTdia: numero(d, 'dailyMswTonnes'),
    crdTdia: numero(d, 'dailyCdwTonnes'),
    reciclaveisTdia: numero(d, 'dailyRecyclablesTonnes'),
    usinasCombustao: numero(d, 'combustionPlants'),
    usinasTermodegradacao: numero(d, 'thermalDegradationPlants'),
    usinasTriagem: numero(d, 'sortingPlants'),
    capexTotalReais: numero(d, 'totalCapexReais'),
    receitaAnualReais: numero(d, 'annualRevenueReais'),
    capexPorUsinaReais: numero(d, 'capexPerPlantReais'),
    receitaAnualPorUsinaReais: numero(d, 'annualRevenuePerPlantReais'),
    opexAnualReais: numero(d, 'annualOpexReais'),
    fonte: texto(d, 'sourceLabel'),
    statusValidacao: 'estimativa_tecnica',
    observacao: textoOuNulo(d, 'note'),
  };
}

// -------------------------------------------------- centrais de tratamento

/** Lista de texto vinda da projeção; ausente vira lista vazia, nunca nulo. */
function listaDeTexto(d: Record<string, unknown>, chave: string): string[] {
  return Array.isArray(d[chave]) ? (d[chave] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
}

export function toCentralDeTratamento(doc: PublishedDocument): CentralDeTratamento {
  const d = doc.data;
  return {
    id: doc.id,
    nome: texto(d, 'name'),
    operadora: texto(d, 'operator'),
    municipioSede: texto(d, 'hostMunicipalityId'),
    endereco: texto(d, 'address'),
    inicioOperacao: textoOuNulo(d, 'operationStartDate'),
    areaM2: numero(d, 'areaM2'),
    capacidadeProjetoToneladas: numero(d, 'designCapacityTonnes'),
    capacidadeDiariaTdia: numero(d, 'dailyCapacityTonnes'),
    capacidadeAnualTano: numero(d, 'annualCapacityTonnes'),
    recebimentoDiarioMedioTdia: numero(d, 'averageDailyIntakeTonnes'),
    vidaUtilAnos: numero(d, 'usefulLifeYears'),
    lixiviadoDiarioM3: numero(d, 'dailyLeachateM3'),
    tecnologiaChorume: textoOuNulo(d, 'leachateTechnology'),
    biogas: textoOuNulo(d, 'biogasLabel'),
    geracaoEnergia: textoOuNulo(d, 'energyLabel'),
    creditoCarbonoTco2e: numero(d, 'carbonCreditsTco2e'),
    custoNovaCelulaPorM2: numero(d, 'newCellCostPerM2'),
    opexPorTonelada: numero(d, 'opexPerTonne'),
    custoTratamentoChorumePorM3: numero(d, 'leachateCostPerM3'),
    municipiosAtendidos: listaDeTexto(d, 'municipalityIds'),
    municipiosAtendidosForaDaRmrj: listaDeTexto(d, 'servedOutsideRegion'),
    fonte: texto(d, 'sourceLabel'),
    statusValidacao: 'dado_oficial_validado',
    observacao: textoOuNulo(d, 'note'),
  };
}

// ------------------------------------------------------------------ eixos

/** Situação de execução, com o mesmo cuidado do inverso dos projetos. */
function situacaoLegada(executionStatus: unknown): StatusProjeto {
  return (legacyStatusFromExecution(executionStatus as string | null) ?? 'nao_iniciado') as StatusProjeto;
}

function lista(d: Record<string, unknown>, chave: string): string[] {
  return Array.isArray(d[chave])
    ? (d[chave] as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
}

export function toEixo(doc: PublishedDocument): Eixo {
  const d = doc.data;
  return {
    id: doc.id,
    nome: texto(d, 'name'),
    descricao: texto(d, 'description'),
    objetivo: texto(d, 'objective'),
    responsavel: texto(d, 'accountable'),
    situacao: situacaoLegada(d.executionStatus),
    indicadoresRelacionados: lista(d, 'relatedIndicatorIds'),
    documentosRelacionados: lista(d, 'relatedDocumentIds'),
  };
}

// ------------------------------------------------------------------ municípios

export function toMunicipio(doc: PublishedDocument): Municipio {
  const d = doc.data;
  return {
    id: doc.id,
    nome: texto(d, 'name'),
    areaTerritorialKm2: numero(d, 'territorialAreaKm2') ?? 0,
    areaUrbanizadaKm2: numero(d, 'urbanizedAreaKm2') ?? 0,
    populacao: numero(d, 'population') ?? 0,
    populacaoAno: numero(d, 'populationYear') ?? 0,
    densidadeDemografica: numero(d, 'populationDensity') ?? 0,
    // Anos diferentes convivem porque a fonte é assim.
    densidadeAno: numero(d, 'densityYear') ?? 0,
    lat: numero(d, 'lat') ?? 0,
    lng: numero(d, 'lng') ?? 0,
    fonte: texto(d, 'sourceLabel'),
    statusDados: statusDeValidacaoLegado(
      d.validationStatus as string | null,
      d.actualityStatus as string | null,
    ),
    observacao: textoOuNulo(d, 'note'),
  };
}

// ------------------------------------------------------------------ metas

export function toMeta(doc: PublishedDocument): Meta {
  const d = doc.data;
  return {
    id: doc.id,
    nome: texto(d, 'name'),
    objetivoGeral: textoOuNulo(d, 'generalObjective'),
    linhaBase: textoOuNulo(d, 'baseline'),
    resultadoAtual: textoOuNulo(d, 'currentResult'),
    resultadoEsperado: texto(d, 'expectedResult'),
    prazo: textoOuNulo(d, 'deadline'),
    responsaveis: Array.isArray(d.responsibleParties)
      ? (d.responsibleParties as unknown[]).map(String)
      : [],
    municipios: texto(d, 'scope'),
    situacao: situacaoLegada(d.executionStatus),
    metodologia: textoOuNulo(d, 'methodology'),
    fonte: texto(d, 'sourceLabel'),
    ultimaAtualizacao: textoOuNulo(d, 'dataDate'),
  };
}


// ------------------------------------------------- alegações de valor

/**
 * Índice de alegações por entidade: `infrastructures/usinas-triagem` → as
 * fontes que afirmam quantidades diferentes para aquele item.
 *
 * O portal exibe a divergência dentro do próprio registro, então o gerador
 * junta as alegações ao pai antes de escrever o arquivo. O cidadão recebe
 * "cada fonte diz X", que é o que ele já via.
 */
export type IndiceDeEvidencias = Map<string, ValorDivergente[]>;

export function indexarEvidencias(docs: PublishedDocument[]): IndiceDeEvidencias {
  const indice = new Map<string, Array<ValorDivergente & { ordem: string }>>();
  for (const doc of docs) {
    const d = doc.data;
    const tipo = texto(d, 'entityType');
    const entidade = texto(d, 'entityId');
    if (!tipo || !entidade) continue;

    const chave = `${tipo}/${entidade}`;
    const lista = indice.get(chave) ?? [];
    lista.push({
      ordem: doc.id,
      fonte: texto(d, 'sourceDocumentId'),
      valor: String(d.value ?? ''),
    });
    indice.set(chave, lista);
  }

  // Ordena pelo id da alegação, que a migração gerou como `<entidade>--claim-N`
  // seguindo a ordem do documento original. Ordenar pelo nome da fonte também
  // daria determinismo, mas trocaria a ordem que o autor escolheu por uma
  // alfabética — e em divergência de dados a sequência das fontes é parte da
  // leitura.
  for (const lista of indice.values()) {
    lista.sort((a, b) => a.ordem.localeCompare(b.ordem, 'pt-BR', { numeric: true }));
  }

  return new Map(
    [...indice].map(([chave, lista]) => [
      chave,
      lista.map(({ fonte, valor }) => ({ fonte, valor })),
    ]),
  );
}

function divergencias(
  indice: IndiceDeEvidencias | undefined,
  tipo: string,
  id: string,
): ValorDivergente[] | null {
  const lista = indice?.get(`${tipo}/${id}`);
  // Uma alegação sozinha não é divergência. O portal só mostra o bloco quando
  // há mais de uma fonte, e o campo nulo é o que sinaliza isso.
  return lista && lista.length > 1 ? lista : null;
}

// ------------------------------------------------------------------ infraestruturas

export function toInfraestrutura(
  doc: PublishedDocument,
  ctx?: ContextoDeMapeamento,
): Infraestrutura {
  const d = doc.data;
  return {
    id: doc.id,
    nome: texto(d, 'name'),
    quantidade: texto(d, 'quantityLabel'),
    unidade: texto(d, 'unit'),
    fonte: texto(d, 'sourceLabel'),
    // O valor original vem publicado por exceção declarada. A reconstrução
    // continua como reserva, para registros antigos que ainda não o carreguem.
    statusValidacao: (textoOuNulo(d, 'legacyStatus') as StatusValidacao | null) ??
      statusDeValidacaoLegado(
        d.validationStatus as string | null,
        d.actualityStatus as string | null,
      ),
    valoresDivergentes: divergencias(ctx?.evidencias, 'infrastructures', doc.id),
    observacao: textoOuNulo(d, 'note'),
  };
}

// ------------------------------------------------------------------ inconsistências

export function toInconsistencia(
  doc: PublishedDocument,
  ctx?: ContextoDeMapeamento,
): Inconsistencia {
  const d = doc.data;
  const categoria = texto(d, 'category');
  return {
    id: doc.id,
    codigoRelatorio: textoOuNulo(d, 'reportCode'),
    origemDoAchado:
      textoOuNulo(d, 'findingOrigin') === 'leitura_das_fontes'
        ? 'leitura_das_fontes'
        : 'relatorio_de_inconsistencias',
    // Nulo aqui significa retido, e o portal esconde. Isso protege contra
    // snapshot antigo: os gerados antes da matriz não trazem o campo, e um
    // achado retido que sobreviva num arquivo velho não volta à tela.
    tratamentoEditorial: textoOuNulo(d, 'publicationPolicy') as
      Inconsistencia['tratamentoEditorial'],
    categoria: categoria === 'ponto_em_revisao' ? 'ponto_em_revisao' : 'divergencia_de_dados',
    titulo: texto(d, 'title'),
    descricao: texto(d, 'description'),
    impacto: texto(d, 'impact'),
    situacao: (textoOuNulo(d, 'legacyStatus') as StatusValidacao | null) ??
      statusDeValidacaoLegado(
        d.validationStatus as string | null,
        d.actualityStatus as string | null,
      ),
    areaResponsavel: texto(d, 'accountableArea'),
    encaminhamento: textoOuNulo(d, 'nextStep'),
    ultimaAtualizacao: textoOuNulo(d, 'dataDate'),
    fontes: divergencias(ctx?.evidencias, 'inconsistencies', doc.id),
  };
}

// ------------------------------------------------------------------ glossário

export function toTermoGlossario(doc: PublishedDocument): TermoGlossario {
  const d = doc.data;
  return { sigla: texto(d, 'acronym'), significado: texto(d, 'meaning') };
}

// ------------------------------------------------------------------ registro

/** Dados de outras coleções de que um mapeador precisa. */
export interface ContextoDeMapeamento {
  evidencias: IndiceDeEvidencias;
}

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
  mapear: (doc: PublishedDocument, ctx?: ContextoDeMapeamento) => object;
  /**
   * Campo usado para ordenar, garantindo arquivo byte-idêntico entre
   * execuções. O padrão é `id`; o glossário não tem id e ordena por `sigla`.
   */
  chaveDeOrdenacao?: string;
  /**
   * Se falso, a coleção é publicada e lida, mas não vira arquivo próprio.
   *
   * É o caso das alegações de valor: o portal não tem tela de alegações
   * soltas — mostra a divergência dentro do registro que diverge. Emitir um
   * arquivo que ninguém lê só aumentaria a superfície publicada.
   */
  emiteArquivo?: boolean;
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
  { colecao: 'axes', arquivo: 'eixos', rotulo: 'Eixos', mapear: toEixo },
  { colecao: 'municipalities', arquivo: 'municipios', rotulo: 'Municípios', mapear: toMunicipio },
  { colecao: 'goals', arquivo: 'metas', rotulo: 'Metas', mapear: toMeta },
  {
    colecao: 'infrastructures',
    arquivo: 'infraestruturas',
    rotulo: 'Infraestruturas',
    mapear: toInfraestrutura,
  },
  {
    colecao: 'inconsistencies',
    arquivo: 'inconsistencias',
    rotulo: 'Inconsistências',
    mapear: toInconsistencia,
  },
  {
    colecao: 'evidence',
    arquivo: 'evidencias',
    rotulo: 'Alegações de valor',
    mapear: () => ({}),
    emiteArquivo: false,
  },
  {
    colecao: 'installationSchedule',
    arquivo: 'cronograma-instalacao',
    rotulo: 'Cronograma de instalação',
    mapear: toEtapaCronograma,
  },
  {
    colecao: 'wasteComposition',
    arquivo: 'composicao-rsu',
    rotulo: 'Composição do RSU',
    mapear: toComponenteRsu,
  },
  {
    colecao: 'dumpsites',
    arquivo: 'vazadouros',
    rotulo: 'Vazadouros',
    mapear: toVazadouro,
  },
  {
    colecao: 'economicViability',
    arquivo: 'viabilidade-economica',
    rotulo: 'Viabilidade econômica',
    mapear: toViabilidadeEconomica,
  },
  {
    colecao: 'treatmentCentrals',
    arquivo: 'centrais-de-tratamento',
    rotulo: 'Centrais de tratamento',
    mapear: toCentralDeTratamento,
  },
  {
    colecao: 'municipalIndicators',
    arquivo: 'indicadores-municipais',
    rotulo: 'Indicadores municipais',
    mapear: toIndicadorMunicipal,
  },
  {
    colecao: 'glossary',
    arquivo: 'glossario',
    rotulo: 'Glossário',
    mapear: toTermoGlossario,
    chaveDeOrdenacao: 'sigla',
  },
];

export const COLECAO_DE_EVIDENCIAS = 'evidence' as const;
