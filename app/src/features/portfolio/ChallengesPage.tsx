import { Handshake, Scale } from 'lucide-react';
import {
  PARTICIPATION_LABEL,
  PARTICIPATION_NOTICE,
  PARTICIPATION_FORMS,
} from '../../domain/investment/pipeline';
import { Pill } from './StateLabels';

/**
 * Desafios e participação do mercado.
 *
 * O sistema DIVULGA formas de participação; ele não seleciona empresa. O aviso
 * de participação formal aparece antes de qualquer conteúdo — sem ele, uma
 * manifestação de interesse registrada aqui poderia ser lida como etapa de
 * habilitação, o que criaria um caminho informal de seleção.
 */
export function ChallengesPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-neutral-900">Desafios e participação do mercado</h1>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Problemas metropolitanos estruturados com evidência, território e formas possíveis de
        participação.
      </p>

      <div className="mt-5 flex items-start gap-3 rounded-lg border-2 border-status-amber bg-amber-50 p-4">
        <Scale aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-status-amber" />
        <div className="text-sm text-neutral-800">
          <p className="font-medium">Este canal divulga — não seleciona.</p>
          <p className="mt-1">{PARTICIPATION_NOTICE}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <Handshake aria-hidden="true" className="h-4 w-4" />
          Formas possíveis de participação
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {PARTICIPATION_FORMS.map((forma) => (
            <li
              key={forma}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800"
            >
              {PARTICIPATION_LABEL[forma]}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-neutral-900">Desafios publicados</h2>
        <div className="mt-3 rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm">
          <p className="font-medium text-neutral-800">Nenhum desafio publicado ainda</p>
          <p className="mx-auto mt-1 max-w-prose text-neutral-600">
            Um desafio só vai ao ar depois de ter problema, evidência, território, impacto, causas,
            restrições e contato institucional preenchidos, e de passar pelo fluxo de revisão e
            aprovação. Publicar um problema mal descrito atrai proposta que não resolve nada.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-neutral-900">
          Candidatos a desafio, a partir do plano
        </h2>
        <p className="mt-1 max-w-prose text-sm text-neutral-600">
          Problemas já documentados no PMetGIRS que se encaixam no formato. Ainda não são desafios
          publicados: precisam de estruturação e aprovação.
        </p>
        <ul className="mt-3 space-y-3">
          <Candidato
            titulo="Menos de 1% do resíduo metropolitano é reciclado"
            contexto="A composição estimada aponta quase 39% de material potencialmente reciclável (COMLURB, 2020), e apenas 11 dos 22 municípios têm coleta seletiva institucionalizada."
            formas={['tecnologia_engenharia_construcao', 'capacitacao_cooperativas']}
          />
          <Candidato
            titulo="90 toneladas de lixo flutuante por dia na Baía de Guanabara"
            contexto="Cerca de 71% são plásticos — um dos fatores associados à redução de 90% da pesca artesanal na baía."
            formas={['pesquisa_inovacao_piloto', 'tecnologia_engenharia_construcao']}
          />
          <Candidato
            titulo="23 áreas de passivo ambiental a remediar"
            contexto="Lixões e aterros controlados encerrados. Os casos mais críticos, pela proximidade com a Baía de Guanabara, são o Jardim Gramacho e o Itaoca."
            formas={['estudos_consultoria', 'financiamento_fundo_impacto']}
          />
          <Candidato
            titulo="1.759 catadores organizados em 95 empreendimentos"
            contexto="A cadeia de reciclagem depende de cooperativas que precisam de legalização, capacitação e acesso a crédito."
            formas={['capacitacao_cooperativas', 'iniciativa_esg']}
          />
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          Dados dos documentos técnicos do PMetGIRS. As formas de participação sugeridas são
          possibilidades, não convite formal.
        </p>
      </section>
    </div>
  );
}

function Candidato({
  titulo,
  contexto,
  formas,
}: {
  titulo: string;
  contexto: string;
  formas: Array<(typeof PARTICIPATION_FORMS)[number]>;
}) {
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="font-medium text-neutral-900">{titulo}</p>
      <p className="mt-1 text-sm text-neutral-600">{contexto}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {formas.map((f) => (
          <Pill key={f} tone="info">
            {PARTICIPATION_LABEL[f]}
          </Pill>
        ))}
      </div>
    </li>
  );
}
