import type { ReactNode } from 'react';

/**
 * Rótulos em português para os estados do domínio.
 *
 * O código fala inglês; a interface, português. Um estado desconhecido é
 * mostrado como veio, em vez de sumir — se apareceu, alguém precisa ver.
 */

const EXECUTION: Record<string, string> = {
  not_started: 'Não iniciado',
  structuring: 'Em estruturação',
  study: 'Em estudo',
  procurement: 'Em contratação',
  licensing: 'Em licenciamento',
  implementation: 'Em implantação',
  operation: 'Em operação',
  completed: 'Concluído',
  paused: 'Paralisado',
  cancelled: 'Cancelado',
};

const VALIDATION: Record<string, string> = {
  not_assessed: 'Não avaliado',
  preliminary: 'Preliminar',
  in_validation: 'Em validação',
  validated: 'Validado',
  divergent: 'Divergente',
  rejected: 'Rejeitado',
};

const ACTUALITY: Record<string, string> = {
  current: 'Atual',
  historical: 'Histórico',
  outdated: 'Desatualizado',
  updating: 'Em atualização',
  no_date: 'Sem data',
};

const ACTION: Record<string, string> = {
  create: 'Criou',
  update: 'Alterou',
  archive: 'Arquivou',
  submit: 'Enviou para revisão',
  approve: 'Aprovou',
  reject: 'Devolveu',
  publish: 'Publicou',
  access_change: 'Alterou acesso',
};

const ROLE: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  editor: 'Editor',
  reviewer: 'Revisor',
  viewer: 'Leitor',
  external_partner: 'Parceiro',
};

export const executionLabel = (v: string | null) => (v ? (EXECUTION[v] ?? v) : 'Não informado');
export const validationLabel = (v: string | null) => (v ? (VALIDATION[v] ?? v) : 'Não avaliado');
export const actualityLabel = (v: string | null) => (v ? (ACTUALITY[v] ?? v) : 'Sem data');
export const actionLabel = (v: string) => ACTION[v] ?? v;
export const roleLabel = (v: string) => ROLE[v] ?? v;

type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'alert';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  info: 'bg-brand-blue-50 text-brand-blue-700 border-brand-blue-300',
  ok: 'bg-brand-green-50 text-brand-green-700 border-brand-green-300',
  warn: 'bg-amber-50 text-status-amber border-amber-300',
  alert: 'bg-red-50 text-status-red border-red-300',
};

export function toneForExecution(v: string | null): Tone {
  if (!v) return 'neutral';
  if (['operation', 'completed'].includes(v)) return 'ok';
  if (['implementation', 'procurement', 'licensing'].includes(v)) return 'info';
  if (['paused', 'cancelled'].includes(v)) return 'alert';
  return 'neutral';
}

export function toneForValidation(v: string | null): Tone {
  if (v === 'validated') return 'ok';
  if (v === 'divergent' || v === 'rejected') return 'alert';
  if (v === 'in_validation' || v === 'preliminary') return 'warn';
  return 'neutral';
}

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
