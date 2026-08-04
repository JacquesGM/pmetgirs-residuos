import { describe, expect, it } from 'vitest';
import { buildCsv, cellValue, type DownloadColumn } from './download';

interface Registro {
  nome: string;
  fonte: string;
  observacao: string | null;
  quantidade: number;
}

const colunas: DownloadColumn<Registro>[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'fonte', label: 'Fonte' },
  { key: 'observacao', label: 'Observação' },
  { key: 'quantidade', label: 'Quantidade' },
];

describe('cellValue', () => {
  it('retorna o valor bruto convertido para string', () => {
    const row: Registro = { nome: 'Item A', fonte: 'Fonte X', observacao: null, quantidade: 5 };
    expect(cellValue(row, { key: 'quantidade', label: 'Quantidade' })).toBe('5');
  });

  it('usa a função value quando fornecida, ignorando o valor bruto da chave', () => {
    const row: Registro = { nome: 'Item A', fonte: 'Fonte X', observacao: null, quantidade: 5 };
    const coluna: DownloadColumn<Registro> = { key: 'quantidade', label: 'Dobro', value: (r) => r.quantidade * 2 };
    expect(cellValue(row, coluna)).toBe('10');
  });

  it('marca null, undefined e string vazia como travessão (para exibição em PDF)', () => {
    const row: Registro = { nome: 'Item A', fonte: 'Fonte X', observacao: null, quantidade: 5 };
    expect(cellValue(row, { key: 'observacao', label: 'Observação' })).toBe('—');
  });
});

describe('buildCsv', () => {
  it('usa os rótulos das colunas como cabeçalho, não as chaves', () => {
    const csv = buildCsv<Registro>([], colunas);
    expect(csv).toBe('Nome,Fonte,Observação,Quantidade');
  });

  it('não deixa "—" vazar para o CSV quando o valor é nulo (diferente do PDF)', () => {
    const row: Registro = { nome: 'Item A', fonte: 'Fonte X', observacao: null, quantidade: 5 };
    const csv = buildCsv([row], colunas);
    const [, dataLine] = csv.split('\r\n');
    expect(dataLine).toBe('Item A,Fonte X,,5');
  });

  it('coloca entre aspas e escapa campos com vírgula', () => {
    const row: Registro = { nome: 'Item, com vírgula', fonte: 'Fonte X', observacao: null, quantidade: 1 };
    const csv = buildCsv([row], colunas);
    const [, dataLine] = csv.split('\r\n');
    expect(dataLine.startsWith('"Item, com vírgula",')).toBe(true);
  });

  it('escapa aspas duplas duplicando-as dentro do campo entre aspas', () => {
    const row: Registro = { nome: 'Ditos "entre aspas"', fonte: 'Fonte X', observacao: null, quantidade: 1 };
    const csv = buildCsv([row], colunas);
    const [, dataLine] = csv.split('\r\n');
    expect(dataLine.startsWith('"Ditos ""entre aspas""",')).toBe(true);
  });

  it('separa múltiplas linhas com CRLF', () => {
    const rows: Registro[] = [
      { nome: 'A', fonte: 'F', observacao: null, quantidade: 1 },
      { nome: 'B', fonte: 'F', observacao: null, quantidade: 2 },
    ];
    const csv = buildCsv(rows, colunas);
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});
