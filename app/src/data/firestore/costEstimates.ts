import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getDb, workspaceId } from '../firebase/client';
import { estimativaEmBranco } from '../../domain/costEstimate';
import type { EstimativaDeCusto } from '../../domain/costEstimate';
import type { CostCategoryResult } from '../../domain/scoring/score';

/**
 * Leitura das estimativas de custo. Uma por projeto, id igual ao do projeto.
 *
 * Só leitura: os valores vêm dos documentos técnicos pela migração, que é
 * onde `validarEstimativa` roda. O caminho de escrita pela interface saiu em
 * 16/08/2026 — um formulário aqui seria um convite a digitar número sem fonte,
 * que é exatamente o defeito que este sistema documenta nos planos.
 *
 * A faixa de custo é gravada junto pela migração, pelo mesmo `categoriaDe` que
 * a tela usaria — arquivo e tela nunca discordam sobre a faixa de um projeto.
 */

function base(): string {
  return `workspaces/${workspaceId()}`;
}

export interface EstimativaGravada {
  id: string;
  entityId: string;
  estimativa: EstimativaDeCusto;
  costCategory: CostCategoryResult;
  version: number;
  raw: Record<string, unknown>;
}

function paraEstimativa(id: string, d: Record<string, unknown>): EstimativaGravada {
  const num = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : null);
  const txt = (k: string) => (typeof d[k] === 'string' && d[k] !== '' ? (d[k] as string) : null);
  return {
    id,
    entityId: String(d.entityId ?? ''),
    estimativa: {
      ...estimativaEmBranco(),
      requiresNewDisbursement:
        typeof d.requiresNewDisbursement === 'boolean' ? d.requiresNewDisbursement : null,
      capexMinCents: num('capexMinCents'),
      capexMaxCents: num('capexMaxCents'),
      annualOpexCents: num('annualOpexCents'),
      baseYear: num('baseYear'),
      sourceLabel: txt('sourceLabel'),
      assumptions: Array.isArray(d.assumptions) ? (d.assumptions as string[]) : [],
      confidenceScore: num('confidenceScore'),
      asOfDate: txt('asOfDate'),
      underEstimation: d.underEstimation === true,
    },
    costCategory: (txt('costCategory') ?? 'not_informed') as CostCategoryResult,
    version: num('version') ?? 1,
    raw: d,
  };
}

export async function getEstimativa(projetoId: string): Promise<EstimativaGravada | null> {
  const snap = await getDoc(doc(getDb(), `${base()}/costEstimates/${projetoId}`));
  return snap.exists() ? paraEstimativa(snap.id, snap.data() as Record<string, unknown>) : null;
}

export async function listEstimativas(): Promise<EstimativaGravada[]> {
  const snap = await getDocs(collection(getDb(), `${base()}/costEstimates`));
  return snap.docs.map((d) => paraEstimativa(d.id, d.data() as Record<string, unknown>));
}

