import { describe, expect, it } from 'vitest';
import municipios from './municipios.json';
import indicadores from './indicadores.json';
import eixos from './eixos.json';
import projetos from './projetos.json';
import metas from './metas.json';
import infraestruturas from './infraestruturas.json';
import documentos from './documentos.json';
import inconsistencias from './inconsistencias.json';
import evolucao from './evolucao.json';
import { routes } from '../routes';
import { KNOWN_STATUSES } from '../components/ui/StatusBadge';
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
} from '../types';

function uniqueIds(items: { id: string }[]): Set<string> {
  return new Set(items.map((item) => item.id));
}

describe('municipios.json', () => {
  it('has exactly 22 municípios (RMRJ, LC nº 184/2018)', () => {
    expect((municipios as Municipio[]).length).toBe(22);
  });

  it('has unique ids', () => {
    const list = municipios as Municipio[];
    expect(uniqueIds(list).size).toBe(list.length);
  });
});

describe('referential integrity between data files', () => {
  const eixoIds = uniqueIds(eixos as Eixo[]);
  const documentoIds = uniqueIds(documentos as Documento[]);
  const indicadorIds = uniqueIds(indicadores as Indicador[]);

  it('every projeto.eixo references an existing eixo', () => {
    for (const projeto of projetos as Projeto[]) {
      expect(eixoIds.has(projeto.eixo), `projeto "${projeto.id}" referencia eixo inexistente "${projeto.eixo}"`).toBe(true);
    }
  });

  it('every eixo.documentosRelacionados references an existing documento', () => {
    for (const eixo of eixos as Eixo[]) {
      for (const docId of eixo.documentosRelacionados) {
        expect(documentoIds.has(docId), `eixo "${eixo.id}" referencia documento inexistente "${docId}"`).toBe(true);
      }
    }
  });

  it('every eixo.indicadoresRelacionados references an existing indicador', () => {
    for (const eixo of eixos as Eixo[]) {
      for (const indId of eixo.indicadoresRelacionados) {
        expect(indicadorIds.has(indId), `eixo "${eixo.id}" referencia indicador inexistente "${indId}"`).toBe(true);
      }
    }
  });
});

describe('inconsistencias.json — regra de não esconder divergência', () => {
  it('toda divergência de dados cita pelo menos 2 fontes', () => {
    const divergencias = (inconsistencias as Inconsistencia[]).filter(
      (item) => item.categoria === 'divergencia_de_dados',
    );
    expect(divergencias.length).toBeGreaterThan(0);
    for (const item of divergencias) {
      expect(item.fontes, `"${item.titulo}" deveria ter fontes`).not.toBeNull();
      expect(item.fontes!.length, `"${item.titulo}" tem menos de 2 fontes`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('routes.tsx', () => {
  it('has unique paths', () => {
    const paths = routes.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('has a leading slash on every path', () => {
    for (const route of routes) {
      expect(route.path.startsWith('/')).toBe(true);
    }
  });
});

describe('status values used in data match StatusBadge known statuses', () => {
  const known = new Set(KNOWN_STATUSES);

  it('municipios.json statusDados', () => {
    for (const m of municipios as Municipio[]) expect(known.has(m.statusDados)).toBe(true);
  });

  it('indicadores.json statusValidacao / tipoDado', () => {
    for (const i of indicadores as Indicador[]) {
      expect(known.has(i.statusValidacao)).toBe(true);
      expect(known.has(i.tipoDado)).toBe(true);
    }
  });

  it('eixos.json situacao', () => {
    for (const e of eixos as Eixo[]) expect(known.has(e.situacao)).toBe(true);
  });

  it('projetos.json status', () => {
    for (const p of projetos as Projeto[]) expect(known.has(p.status)).toBe(true);
  });

  it('metas.json situacao', () => {
    for (const m of metas as Meta[]) expect(known.has(m.situacao)).toBe(true);
  });

  it('infraestruturas.json statusValidacao', () => {
    for (const i of infraestruturas as Infraestrutura[]) expect(known.has(i.statusValidacao)).toBe(true);
  });

  it('inconsistencias.json situacao', () => {
    for (const i of inconsistencias as Inconsistencia[]) expect(known.has(i.situacao)).toBe(true);
  });

  it('evolucao.json situacao', () => {
    for (const e of evolucao as EvolucaoEtapa[]) expect(known.has(e.situacao)).toBe(true);
  });
});
