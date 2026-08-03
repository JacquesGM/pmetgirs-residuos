import { AlertTriangle } from 'lucide-react';
import infraestruturasData from '../../data/infraestruturas.json';
import type { Infraestrutura } from '../../types';
import { Section } from '../ui/Section';
import { StatusBadge } from '../ui/StatusBadge';
import { Card } from '../ui/Card';
import { InfrastructureDivergenceChart } from '../charts/InfrastructureDivergenceChart';
import { DownloadButton } from '../ui/DownloadButton';

const infraestruturas = infraestruturasData as Infraestrutura[];

export function Infrastructure() {
  return (
    <Section
      id="infraestrutura"
      title="Infraestrutura planejada"
      subtitle="Quantidades de referência da infraestrutura prevista no Plano de Ações e no Prognóstico Geral. Nenhuma destas unidades está construída ou em operação — trata-se de planejamento."
    >
      <div className="mb-6 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />
        <p>
          <strong>Aviso de transparência:</strong> os documentos apresentam divergência na
          distribuição das 28 unidades térmicas entre usinas de combustão e usinas de gaseificação
          (termodegradação). A informação permanece <strong>Em validação</strong> até a consolidação
          oficial — as duas versões são apresentadas abaixo, sem escolher silenciosamente uma delas.
        </p>
      </div>

      <div className="mb-6">
        <DownloadButton filename="infraestruturas-pmetgirs.json" data={infraestruturas} />
      </div>

      <Card className="mb-6">
        <InfrastructureDivergenceChart />
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
