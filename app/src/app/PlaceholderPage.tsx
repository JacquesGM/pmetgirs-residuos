import { Construction } from 'lucide-react';

/**
 * Página ainda não implementada.
 *
 * A rota existe desde a Fase 1 para que a navegação, os guards e as Security
 * Rules possam ser exercitados de ponta a ponta. O conteúdo chega na fase
 * indicada. Ela diz o que ainda não faz, em vez de simular um painel vazio com
 * números inventados.
 */
export function PlaceholderPage({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
        <Construction aria-hidden="true" className="mx-auto h-8 w-8 text-neutral-400" />
        <p className="mt-3 font-medium text-neutral-800">Em construção — {phase}</p>
        <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">{description}</p>
        <p className="mt-4 text-xs text-neutral-500">
          A rota já existe e está protegida. Nenhum dado é exibido porque nenhum dado foi migrado
          ainda.
        </p>
      </div>
    </div>
  );
}
