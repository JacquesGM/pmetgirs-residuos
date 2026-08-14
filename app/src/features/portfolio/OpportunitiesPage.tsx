import { FileCheck, ShieldAlert } from 'lucide-react';
import {
  CERTAINTY_LABEL,
  FLOW_LABEL,
  PARTICIPATION_NOTICE,
  summarizeFlows,
  type FinancialFlow,
} from '../../domain/investment/pipeline';
import { Pill } from './StateLabels';

/**
 * Oportunidades de investimento.
 *
 * O exemplo abaixo é uma demonstração do formato da ficha executiva, marcada
 * como tal — não é uma oportunidade real do PMetGIRS. Ela existe para mostrar
 * como os quatro tipos de fluxo financeiro aparecem separados, cada um com seu
 * beneficiário e grau de certeza.
 */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const FLUXOS_EXEMPLO: FinancialFlow[] = [
  {
    id: 'ex-1',
    type: 'market_revenue',
    certainty: 'projected',
    beneficiary: 'Operador',
    amountCentsPerYear: 12_000_000_00,
    assumptions: ['preço de energia conforme leilão de referência'],
    evidenceIds: [],
  },
  {
    id: 'ex-2',
    type: 'public_saving',
    certainty: 'estimated',
    beneficiary: 'Municípios da RMRJ',
    amountCentsPerYear: 8_000_000_00,
    assumptions: ['redução de transporte a aterro'],
    evidenceIds: [],
  },
  {
    id: 'ex-3',
    type: 'socioenvironmental_benefit',
    certainty: 'estimated',
    beneficiary: 'Sociedade',
    amountCentsPerYear: null,
    assumptions: [],
    evidenceIds: [],
  },
];

export function OpportunitiesPage() {
  const resumo = summarizeFlows(FLUXOS_EXEMPLO);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-neutral-900">Oportunidades</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Fichas executivas para apresentação ao mercado, com os fluxos financeiros separados por tipo
        e beneficiário.
      </p>

      <div className="mt-5 rounded-lg border-2 border-status-amber bg-amber-50 p-4 text-sm text-neutral-800">
        <p className="font-medium">{PARTICIPATION_NOTICE}</p>
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-neutral-900">Oportunidades estruturadas</h2>
        <div className="mt-3 rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm">
          <p className="font-medium text-neutral-800">Nenhuma oportunidade estruturada ainda</p>
          <p className="mx-auto mt-1 max-w-prose text-neutral-600">
            Nenhum projeto do portfólio passou pelas etapas de estudo e viabilidade. Enquanto os
            investimentos do plano não forem conciliados — R$ 4,73 bilhões no Prognóstico contra
            R$ 12,5 bilhões no Plano de Ações — não há base para apresentar oportunidade ao mercado.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <FileCheck aria-hidden="true" className="h-4 w-4" />
            Formato da ficha financeira
          </h2>
          <Pill tone="warn">exemplo ilustrativo</Pill>
        </div>
        <p className="mt-1 max-w-prose text-sm text-neutral-600">
          Números fictícios, para mostrar o formato. Nenhum valor abaixo vem dos documentos do
          PMetGIRS.
        </p>

        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <caption className="sr-only">
              Fluxos financeiros de exemplo, separados por tipo, beneficiário e grau de certeza
            </caption>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Tipo de fluxo</th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Quem recebe</th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-neutral-700">Certeza</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold text-neutral-700">Por ano</th>
              </tr>
            </thead>
            <tbody>
              {FLUXOS_EXEMPLO.map((f) => (
                <tr key={f.id} className="border-b border-neutral-100 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-neutral-800">
                    {FLOW_LABEL[f.type]}
                  </th>
                  <td className="px-4 py-2.5 text-neutral-600">{f.beneficiary}</td>
                  <td className="px-4 py-2.5">
                    <Pill tone={f.certainty === 'contracted' ? 'ok' : 'warn'}>
                      {CERTAINTY_LABEL[f.certainty]}
                    </Pill>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {f.amountCentsPerYear === null ? (
                      <span className="italic text-neutral-500">não monetizado</span>
                    ) : (
                      brl.format(f.amountCentsPerYear / 100)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Caixa do operador
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900">
              {resumo.operatorCashCents === null ? '—' : brl.format(resumo.operatorCashCents / 100)}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Economia pública
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900">
              {resumo.publicSavingCents === null ? '—' : brl.format(resumo.publicSavingCents / 100)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">Não entra no caixa do operador.</p>
          </div>
        </div>

        {resumo.warnings.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-neutral-900">
              <ShieldAlert aria-hidden="true" className="h-4 w-4 text-status-amber" />
              Avisos de integridade financeira
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
              {resumo.warnings.map((w) => (
                <li key={w}>— {w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
