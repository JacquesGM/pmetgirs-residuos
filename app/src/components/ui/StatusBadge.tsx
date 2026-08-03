import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calculator,
  CheckCircle2,
  Circle,
  FileCheck,
  FileClock,
  Gavel,
  Hammer,
  History,
  PauseCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { StatusProjeto, StatusValidacao } from '../../types';

type StatusKey = StatusProjeto | StatusValidacao;

interface StatusConfig {
  label: string;
  classes: string;
  Icon: LucideIcon;
}

const statusConfig: Record<StatusKey, StatusConfig> = {
  nao_iniciado: { label: 'Não iniciado', classes: 'bg-neutral-100 text-neutral-700 border-neutral-300', Icon: Circle },
  em_estruturacao: { label: 'Em estruturação', classes: 'bg-brand-blue-50 text-brand-blue-700 border-brand-blue-300', Icon: Settings2 },
  em_estudo: { label: 'Em estudo', classes: 'bg-brand-blue-50 text-brand-blue-700 border-brand-blue-300', Icon: Search },
  em_contratacao: { label: 'Em contratação', classes: 'bg-purple-50 text-purple-700 border-purple-300', Icon: Gavel },
  em_licenciamento: { label: 'Em licenciamento', classes: 'bg-purple-50 text-purple-700 border-purple-300', Icon: FileCheck },
  em_implantacao: { label: 'Em implantação', classes: 'bg-brand-blue-100 text-brand-blue-700 border-brand-blue-300', Icon: Hammer },
  em_operacao: { label: 'Em operação', classes: 'bg-brand-green-50 text-brand-green-700 border-brand-green-300', Icon: CheckCircle2 },
  concluido: { label: 'Concluído', classes: 'bg-brand-green-50 text-brand-green-700 border-brand-green-300', Icon: CheckCircle2 },
  suspenso: { label: 'Paralisado', classes: 'bg-red-50 text-status-red border-red-300', Icon: PauseCircle },
  dado_em_validacao: { label: 'Dado em validação', classes: 'bg-amber-50 text-status-amber border-amber-300', Icon: AlertTriangle },
  dado_oficial_validado: { label: 'Dado oficial validado', classes: 'bg-brand-green-50 text-brand-green-700 border-brand-green-300', Icon: ShieldCheck },
  dado_municipal_declarado: { label: 'Dado municipal declarado', classes: 'bg-brand-blue-50 text-brand-blue-700 border-brand-blue-300', Icon: Building2 },
  estimativa_tecnica: { label: 'Estimativa técnica', classes: 'bg-neutral-100 text-neutral-700 border-neutral-300', Icon: Calculator },
  dado_historico: { label: 'Dado histórico', classes: 'bg-neutral-100 text-neutral-600 border-neutral-300', Icon: History },
  dado_preliminar: { label: 'Dado preliminar', classes: 'bg-amber-50 text-status-amber border-amber-300', Icon: FileClock },
  em_atualizacao: { label: 'Em atualização', classes: 'bg-amber-50 text-status-amber border-amber-300', Icon: RefreshCw },
  em_validacao: { label: 'Em validação', classes: 'bg-amber-50 text-status-amber border-amber-300', Icon: AlertTriangle },
  informacao_divergente: { label: 'Informação divergente', classes: 'bg-red-50 text-status-red border-red-300', Icon: AlertOctagon },
};

export function StatusBadge({ status, className = '' }: { status: StatusKey; className?: string }) {
  const config = statusConfig[status];
  if (!config) return null;
  const { label, classes, Icon } = config;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${classes} ${className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function statusLabel(status: StatusKey): string {
  return statusConfig[status]?.label ?? status;
}
