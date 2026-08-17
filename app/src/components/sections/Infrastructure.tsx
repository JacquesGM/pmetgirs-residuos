import { AlertTriangle } from 'lucide-react';
import infraestruturasData from '../../data/infraestruturas.json';
import type { Infraestrutura } from '../../types';
import { Section } from '../ui/Section';
import { StatusBadge, statusLabel } from '../ui/StatusBadge';
import { Card } from '../ui/Card';
import { InfrastructureDivergenceChart } from '../charts/InfrastructureDivergenceChart';
import { InfrastructureCompositionChart } from '../charts/InfrastructureCompositionChart';
import { DownloadButton } from '../ui/DownloadButton';
import type { DownloadColumn } from '../../lib/download';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const infraestruturasEmbutidas = infraestruturasData as Infraestrutura[];

const colunasInfraestruturas: DownloadColumn<Infraestrutura>[] = [
  { key: 'nome', label: 'Infraestrutura' },
  { key: 'quantidade', label: 'Quantidade de referência' },
  { key: 'unidade', label: 'Unidade' },
  { key: 'statusValidacao', label: 'Situação do dado', value: (row) => statusLabel(row.statusValidacao) },
  {
    key: 'valoresDivergentes',
    label: 'Valores divergentes por fonte',
    value: (row) => row.valoresDivergentes?.map((v) => `${v.fonte}: ${v.valor}`).join(' | '),
  },
  { key: 'fonte', label: 'Fonte' },
  { key: 'observacao', label: 'Observação' },
];

export function Infrastructure() {
  const infraestruturas = useColecaoPublicada<Infraestrutura>('infraestruturas', infraestruturasEmbutidas);

  return (
    <Section
      headingLevel={1}
      id="infraestrutura"
      title="Infraestrutura planejada"
      subtitle="Infraestrutura prevista no Plano de Ações e no Prognóstico Geral. Nada aqui foi construído ainda."
    >
      <div className="mb-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />
        <p>
          <strong>Aviso de transparência:</strong> os documentos divergem sobre{' '}
          <strong>quantas</strong> unidades térmicas estão previstas — 20 no Prognóstico Geral e 28 no
          Plano de Ações — e também sobre como esse total se divide entre combustão e gaseificação. O
          Plano de Ações diverge de si mesmo: a sua tabela e o seu texto trocam os dois números. Todas
          as versões aparecem abaixo, sem escolher uma.
        </p>
      </div>

      <div className="mb-6">
        <DownloadButton
          filename="infraestruturas-pmetgirs"
          title="Infraestrutura planejada — PMetGIRS"
          data={infraestruturas}
          columns={colunasInfraestruturas}
        />
      </div>

      <Card className="mb-6">
        <InfrastructureDivergenceChart />
      </Card>

      <Card className="mb-6">
        <InfrastructureCompositionChart />
      </Card>

      {/* Tabela completa — telas médias e grandes */}
      <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Infraestrutura</th>
              <th scope="col" className="px-4 py-3 font-semibold">Quantidade de referência</th>
              <th scope="col" className="px-4 py-3 font-semibold">Situação</th>
              <th scope="col" className="px-4 py-3 font-semibold">Fonte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {infraestruturas.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-3 font-medium text-neutral-900">{item.nome}</td>
                <td className="px-4 py-3">
                  <span>{item.quantidade}</span>
                  {item.valoresDivergentes && (
                    <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
                      {item.valoresDivergentes.map((v) => (
                        <li key={v.fonte}>
                          {v.fonte}: {v.valor}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.statusValidacao} />
                </td>
                <td className="px-4 py-3 text-neutral-500">{item.fonte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista de cards — celular, conforme guia de UI/UX (seção 7: tabela vira cards) */}
      <ul className="space-y-3 md:hidden">
        {infraestruturas.map((item) => (
          <li key={item.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-neutral-900">{item.nome}</p>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-neutral-500">Quantidade de referência</dt>
                <dd className="text-right font-medium text-neutral-900">{item.quantidade}</dd>
              </div>
              {item.valoresDivergentes && (
                <ul className="space-y-0.5 rounded-md bg-neutral-50 p-2 text-xs text-neutral-500">
                  {item.valoresDivergentes.map((v) => (
                    <li key={v.fonte}>
                      {v.fonte}: {v.valor}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">Situação</dt>
                <dd>
                  <StatusBadge status={item.statusValidacao} />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-neutral-500">Fonte</dt>
                <dd className="text-right text-neutral-500">{item.fonte}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </Section>
  );
}
