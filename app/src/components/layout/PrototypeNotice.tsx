import { AlertTriangle } from 'lucide-react';

/**
 * Aviso exigido pelo Prompt Mestre enquanto o sistema estiver hospedado em
 * domínio ou conta pessoal. O texto é literal do documento e não deve ser
 * reescrito: ele delimita a responsabilidade institucional do IRM sobre o que
 * está publicado aqui.
 *
 * Sai por configuração — `VITE_CANAL_OFICIAL=true` — e não por remoção de
 * código, para que a retirada seja uma decisão de implantação registrada, e
 * dependa de autorização institucional em vez de um commit.
 */
export function PrototypeNotice() {
  if (import.meta.env.VITE_CANAL_OFICIAL === 'true') return null;

  return (
    <aside
      aria-labelledby="aviso-prototipo-titulo"
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-status-amber"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-relaxed">
          <strong id="aviso-prototipo-titulo" className="font-semibold">
            Protótipo técnico em desenvolvimento.
          </strong>{' '}
          Esta página ainda não constitui canal oficial de divulgação do Instituto Rio Metrópole.
        </p>
      </div>
    </aside>
  );
}
