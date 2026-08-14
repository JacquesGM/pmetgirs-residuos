import { useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import {
  DEFAULT_COST_THRESHOLDS,
  DEFAULT_HORIZON,
  DEFAULT_POLICY,
  PolicyError,
  validateWeights,
  type WeightedCriterion,
} from '../../domain/scoring/policy';
import { useAuth } from '../../app/AuthProvider';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/**
 * Configurações de pontuação.
 *
 * A validação de soma 100 roda ao vivo: pesos que não somam 100 produzem uma
 * nota sem significado, então o botão de salvar fica indisponível até bater.
 *
 * Salvar gera uma nova policyVersion. Avaliações antigas guardam a versão que
 * as gerou — mexer nos pesos não pode reescrever a história das decisões já
 * tomadas.
 */
export function SettingsPage() {
  const { hasRole } = useAuth();
  const podeEditar = hasRole(['owner']);

  const [pesos, setPesos] = useState<WeightedCriterion[]>(DEFAULT_POLICY.priority);
  const total = pesos.reduce((s, c) => s + c.weight, 0);
  const somaOk = Math.abs(total - 100) < 1e-9;

  let erroValidacao: string | null = null;
  try {
    validateWeights(pesos, 'priorização');
  } catch (e) {
    erroValidacao = e instanceof PolicyError ? e.message : 'Configuração inválida.';
  }

  function alterar(key: string, valor: number) {
    setPesos((atual) => atual.map((c) => (c.key === key ? { ...c, weight: valor } : c)));
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-neutral-900">Configurações</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Parâmetros de governança do sistema. Não são números do PMetGIRS: precisam de aprovação
        institucional antes de uso oficial.
      </p>

      {!podeEditar && (
        <p className="mt-5 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-700">
          Somente o proprietário altera estes parâmetros. Você pode consultá-los.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold text-neutral-900">Pesos da priorização</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Precisam somar exatamente 100. Pesos que não somam 100 produzem uma nota sem significado.
        </p>

        <div className="mt-4 space-y-3">
          {pesos.map((c) => (
            <div key={c.key} className="grid grid-cols-[1fr_auto] items-center gap-4">
              <label htmlFor={`peso-${c.key}`} className="text-sm">
                <span className="font-medium text-neutral-800">{c.label}</span>
                <span className="block text-xs text-neutral-500">{c.help}</span>
              </label>
              <span className="flex items-center gap-2">
                <input
                  id={`peso-${c.key}`}
                  type="number"
                  min={0}
                  max={100}
                  disabled={!podeEditar}
                  value={c.weight}
                  onChange={(e) => alterar(c.key, Number(e.target.value))}
                  className="min-h-11 w-20 rounded-md border border-neutral-300 px-3 text-right text-sm tabular-nums disabled:bg-neutral-100"
                />
                <span className="text-sm text-neutral-500">%</span>
              </span>
            </div>
          ))}
        </div>

        <div
          className={`mt-4 flex items-center justify-between rounded-md border px-4 py-3 ${
            somaOk ? 'border-brand-green-300 bg-brand-green-50' : 'border-status-red bg-red-50'
          }`}
          role="status"
        >
          <span className="text-sm font-medium text-neutral-800">Soma dos pesos</span>
          <span className={`text-lg font-bold tabular-nums ${somaOk ? 'text-brand-green-700' : 'text-status-red'}`}>
            {total}%
          </span>
        </div>

        {erroValidacao && (
          <p className="mt-2 flex items-start gap-2 text-sm text-status-red" role="alert">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {erroValidacao}
          </p>
        )}

        {podeEditar && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!somaOk}
              title={somaOk ? undefined : 'Ajuste os pesos para somar 100 antes de salvar'}
              className="min-h-11 rounded-md bg-brand-blue-700 px-4 text-sm font-medium text-white hover:bg-brand-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Salvar como versão {DEFAULT_POLICY.version + 1}
            </button>
            <button
              type="button"
              onClick={() => setPesos(DEFAULT_POLICY.priority)}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Restaurar padrão
            </button>
          </div>
        )}

        <p className="mt-3 text-xs text-neutral-500">
          Salvar cria uma nova versão da política. As avaliações já feitas continuam guardando a
          versão que as gerou — alterar os pesos não reescreve decisões passadas.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-neutral-900">Faixas de custo</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Valores iniciais para desenvolvimento. Precisam de aprovação da governança.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <Faixa rotulo="Baixo custo" valor={`até ${brl.format(DEFAULT_COST_THRESHOLDS.lowMaxCents / 100)}`} />
          <Faixa
            rotulo="Médio custo"
            valor={`até ${brl.format(DEFAULT_COST_THRESHOLDS.mediumMaxCents / 100)}`}
          />
          <Faixa
            rotulo="Alto custo"
            valor={`acima de ${brl.format(DEFAULT_COST_THRESHOLDS.mediumMaxCents / 100)}`}
          />
        </dl>
        <p className="mt-2 text-xs text-neutral-500">
          A classificação usa o teto do intervalo de CAPEX: para saber se cabe no orçamento, o que
          importa é o pior caso. &quot;Sem novo desembolso&quot; substitui a expressão &quot;sem
          custo&quot; — executar com equipe própria tem custo.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-neutral-900">Horizonte temporal</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <Faixa rotulo="Curto prazo" valor={`até ${DEFAULT_HORIZON.shortMaxMonths} meses`} />
          <Faixa
            rotulo="Médio prazo"
            valor={`${DEFAULT_HORIZON.shortMaxMonths + 1} a ${DEFAULT_HORIZON.mediumMaxMonths} meses`}
          />
          <Faixa rotulo="Longo prazo" valor={`acima de ${DEFAULT_HORIZON.mediumMaxMonths} meses`} />
        </dl>
        <p className="mt-2 text-xs text-neutral-500">
          A classificação por duração é sugestão. O horizonte real considera maturidade, estudos,
          licenciamento, contratação, dependências e capacidade institucional — não só o tempo de obra.
        </p>
      </section>
    </div>
  );
}

function Faixa({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</dt>
      <dd className="mt-0.5 text-sm font-medium text-neutral-800">{valor}</dd>
    </div>
  );
}
