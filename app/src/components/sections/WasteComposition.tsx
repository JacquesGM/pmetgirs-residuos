import composicaoData from '../../data/composicaoRsu.json';
import type { ComponenteRsu } from '../../types';
import { InfoDisclosure } from '../ui/InfoDisclosure';
import { DownloadButton } from '../ui/DownloadButton';
import type { DownloadColumn } from '../../lib/download';
import { useColecaoPublicada } from '../../data/snapshot/useColecaoPublicada';

const composicaoEmbutida = composicaoData as ComponenteRsu[];

const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`;
const ton = (v: number) => `${Math.round(v).toLocaleString('pt-BR')} t/dia`;

/** Uma cor por componente do grupo principal; os demais herdam neutro. */
const COR: Record<string, string> = {
  'Matéria orgânica': 'bg-brand-green-600',
  Recicláveis: 'bg-brand-blue-600',
  'Outros componentes': 'bg-neutral-400',
};

const colunas: DownloadColumn<ComponenteRsu>[] = [
  { key: 'grupoRotulo', label: 'Grupo' },
  { key: 'nome', label: 'Componente' },
  { key: 'percentual', label: 'Percentual' },
  { key: 'baseDoPercentual', label: 'Base do percentual' },
  { key: 'toneladasDia', label: 'Toneladas por dia' },
  { key: 'fonte', label: 'Fonte' },
  { key: 'observacao', label: 'Ressalvas' },
];

/**
 * O que há dentro do lixo metropolitano.
 *
 * É a base de todo o dimensionamento das 45 usinas propostas, e o portal não a
 * mostrava. A tela repete em cada bloco a BASE do percentual, porque a fonte
 * usa bases diferentes na mesma tabela: sem isso, 18,76% de plástico é lido
 * como 18,76% do lixo — quase o dobro do real.
 */
export function WasteComposition() {
  const componentes = useColecaoPublicada<ComponenteRsu>('composicao-rsu', composicaoEmbutida);
  const grupo = (g: string) =>
    componentes.filter((c) => c.grupo === g).sort((a, b) => a.ordem - b.ordem);

  const principal = grupo('principal');
  const reciclaveis = grupo('reciclaveis');
  const outros = grupo('outros');

  if (principal.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-neutral-900">O que há dentro do lixo</h2>
      <p className="mt-1 max-w-prose text-sm text-neutral-600">
        Composição gravimétrica do RSU metropolitano — a base sobre a qual todo o dimensionamento
        de usinas foi feito.
      </p>

      <div className="mt-4">
        <DownloadButton
          filename="composicao-rsu-pmetgirs"
          title="Composição gravimétrica do RSU — PMetGIRS"
          data={componentes}
          columns={colunas}
        />
      </div>

      {/* Barra proporcional: a leitura mais rápida da divisão em três. */}
      <div className="mt-6 flex h-8 w-full overflow-hidden rounded-md" role="img"
        aria-label={principal.map((c) => `${c.nome}: ${pct(c.percentual)}`).join('; ')}>
        {principal.map((c) => (
          <div
            key={c.id}
            className={`${COR[c.nome] ?? 'bg-neutral-300'} flex items-center justify-center`}
            style={{ width: `${c.percentual}%` }}
          >
            {c.percentual > 12 && (
              <span className="px-2 text-xs font-medium text-white">{pct(c.percentual)}</span>
            )}
          </div>
        ))}
      </div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {principal.map((c) => (
          <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <dt className="flex items-center gap-2 text-sm font-medium text-neutral-800">
              <span className={`h-3 w-3 shrink-0 rounded-sm ${COR[c.nome] ?? 'bg-neutral-300'}`} aria-hidden="true" />
              {c.nome}
            </dt>
            <dd className="mt-1.5">
              <span className="text-2xl font-bold tabular-nums text-neutral-900">{pct(c.percentual)}</span>
              <span className="block text-sm text-neutral-600">{ton(c.toneladasDia)}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Detalhe
          titulo="Recicláveis discriminados"
          base="Percentuais da fração de recicláveis"
          itens={reciclaveis}
          ressalva={reciclaveis[0]?.observacao ?? null}
          rodape={
            <>
              Os quatro somam 38,71% da fração de recicláveis. Os outros 61,29% dela não são
              discriminados pela fonte.
            </>
          }
        />
        <Detalhe
          titulo="Outros componentes discriminados"
          base="Percentuais da fração de outros componentes"
          itens={outros}
          ressalva={null}
          rodape={
            <>
              Absorventes descartáveis e tecido somam metade desta fração — mais que inertes,
              madeira e eletrônicos juntos.
            </>
          }
        />
      </div>

      <p className="mt-4 text-xs text-neutral-500">Fonte: {principal[0].fonte}</p>
    </div>
  );
}

function Detalhe({
  titulo,
  base,
  itens,
  ressalva,
  rodape,
}: {
  titulo: string;
  base: string;
  itens: ComponenteRsu[];
  ressalva: string | null;
  rodape: React.ReactNode;
}) {
  if (itens.length === 0) return null;
  const maior = Math.max(...itens.map((i) => i.percentual));

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="text-base font-semibold text-neutral-900">{titulo}</h3>
      {/* A base repetida em cada bloco, e não uma vez no topo: é o que impede a
          leitura de que todo percentual desta tela se refere ao lixo inteiro. */}
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-neutral-500">{base}</p>

      <ul className="mt-3 space-y-2">
        {itens.map((i) => (
          <li key={i.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-neutral-800">{i.nome}</span>
              <span className="shrink-0 tabular-nums font-medium text-neutral-900">
                {pct(i.percentual)}
                <span className="ml-2 font-normal text-neutral-500">{ton(i.toneladasDia)}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand-blue-500"
                style={{ width: `${(i.percentual / maior) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm text-neutral-600">{rodape}</p>
      {ressalva && <InfoDisclosure label="Ambiguidade na fonte">{ressalva}</InfoDisclosure>}
    </div>
  );
}
