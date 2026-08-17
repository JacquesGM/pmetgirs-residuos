import { describe, expect, it } from 'vitest';
import dados from './arranjosDeTratamento.json';
import municipiosData from './municipios.json';
import type { ArranjoDeTratamento } from '../types';

const arranjos = dados as ArranjoDeTratamento[];
const municipios = (municipiosData as { id: string }[]).map((m) => m.id);

describe('arranjos de tratamento — Tabela 10 do Plano de Ações', () => {
  it('os 22 municípios estão em exatamente um arranjo', () => {
    const todos = arranjos.flatMap((a) => a.municipiosAtendidos);
    expect(todos).toHaveLength(22);
    expect(new Set(todos).size).toBe(22);
    for (const m of todos) expect(municipios).toContain(m);
  });

  it('as cinco contagens de usina batem com o Total Geral da tabela', () => {
    const soma = (k: keyof ArranjoDeTratamento) =>
      arranjos.reduce((s, a) => s + (a[k] as number), 0);
    expect(soma('usinasTriagem')).toBe(25);
    expect(soma('usinasCombustao')).toBe(13);
    expect(soma('usinasTermodegradacao')).toBe(15);
    expect(soma('usinasAsfalto')).toBe(6);
    expect(soma('usinasBiodigestao')).toBe(1);
  });

  it('o RSU somado dá o Total Geral de 16.929 t/dia', () => {
    expect(arranjos.reduce((s, a) => s + a.rsuSomadoTdia, 0)).toBe(16_929);
  });

  it('nove dos dez arranjos têm RSU declarado igual à soma dos municípios', () => {
    const batem = arranjos.filter((a) => a.rsuAssociadoTdia === a.rsuSomadoTdia);
    expect(batem).toHaveLength(9);
  });

  it('a única divergência é Nova Iguaçu e Belford Roxo, em 17 t/dia', () => {
    // A tabela declara 1.542 t/dia para o arranjo; os dois municípios somam
    // 1.559. Guardar os dois valores é o que permite ver a diferença — se o
    // registro tivesse só um campo de RSU, ela desapareceria.
    const divergentes = arranjos.filter((a) => a.rsuAssociadoTdia !== a.rsuSomadoTdia);
    expect(divergentes).toHaveLength(1);
    const [ni] = divergentes;
    expect(ni.id).toBe('nova-iguacu-belford-roxo');
    expect(ni.rsuSomadoTdia - ni.rsuAssociadoTdia).toBe(17);
    expect(ni.statusValidacao).toBe('informacao_divergente');
  });

  it('registra que o total desta tabela difere dos 16.926 das outras', () => {
    // Três tabelas independentes — Diagnóstico T14 e T15, Prognóstico T73 —
    // usam 16.926. Esta usa 16.929.
    const rio = arranjos.find((a) => a.id === 'rio-de-janeiro')!;
    expect(rio.observacao).toMatch(/16\.926/);
    expect(16_929 - 16_926).toBe(3);
  });

  it('seis arranjos são compartilhados e quatro são de um município só', () => {
    const compartilhados = arranjos.filter((a) => a.municipiosAtendidos.length > 1);
    expect(compartilhados).toHaveLength(6);
    expect(arranjos.filter((a) => a.municipiosAtendidos.length === 1)).toHaveLength(4);
  });
});
