import type { StatusValidacao } from '../../types';

const placeholderByStatus: Partial<Record<StatusValidacao, string>> = {
  em_atualizacao: 'Em atualização',
  em_validacao: 'Em validação',
  dado_preliminar: 'Dado preliminar',
  informacao_divergente: 'Informação divergente',
};

/**
 * Renders a value, or an explicit placeholder ("Não informado" / "Em atualização" / "Em validação")
 * when the value is null — never a silent blank or a zero standing in for missing data.
 */
export function DataValue({
  value,
  status,
  className = '',
}: {
  value: string | number | null | undefined;
  status?: StatusValidacao;
  className?: string;
}) {
  if (value === null || value === undefined || value === '') {
    const placeholder = (status && placeholderByStatus[status]) || 'Não informado';
    return <span className={`italic text-neutral-500 ${className}`}>{placeholder}</span>;
  }
  return <span className={className}>{value}</span>;
}
