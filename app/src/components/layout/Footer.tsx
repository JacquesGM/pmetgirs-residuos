import { Link } from 'react-router-dom';
import atualizacoes from '../../data/atualizacoes.json';
import type { Atualizacao } from '../../types';
import logoIrm from '../../assets/logo-irm-branca-horizontal.png';
import { routes } from '../../routes';

const ultimaAtualizacao = (atualizacoes as Atualizacao[])[0];

function formatLocalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const colunas = [
  {
    titulo: 'Acesso à informação',
    itens: [
      'Esta página é um canal de transparência ativa do PMetGIRS.',
      'Pedidos formais de acesso à informação seguem o canal oficial do IRM (a ser disponibilizado nesta versão do site).',
    ],
  },
  {
    titulo: 'Privacidade e acessibilidade',
    itens: [
      'Não são coletados dados pessoais nesta página pública.',
      'Busca-se conformidade com WCAG 2.1 nível AA; use o botão "Texto maior" no topo da página.',
    ],
  },
  {
    titulo: 'Dados abertos',
    itens: [
      'Os dados públicos do PMetGIRS são estruturados com fonte e data de referência.',
      'Baixe os dados de indicadores, projetos, infraestrutura e municípios em CSV ou PDF diretamente nas páginas correspondentes.',
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-900 text-neutral-300">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <img src={logoIrm} alt="Instituto Rio Metrópole" className="h-9 w-auto" />
            <p className="mt-3 text-sm text-neutral-400">
              Autoridade executiva da Região Metropolitana do Rio de Janeiro, responsável pela
              elaboração e acompanhamento do PMetGIRS.
            </p>
            <p className="mt-3 text-sm text-neutral-400">
              <span className="block font-medium text-neutral-200">Contato</span>
              Canal oficial de contato do IRM a ser disponibilizado nesta página.
            </p>
            <p className="mt-3 text-sm">
              <a
                href="https://www.rj.gov.br/irm"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-brand-blue-300 hover:text-brand-blue-200 hover:underline"
              >
                Site institucional do IRM
              </a>
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Mapa do site</p>
            <ul className="mt-2 space-y-2 text-sm">
              {routes.map((route) => (
                <li key={route.path}>
                  <Link
                    to={route.path}
                    className="text-brand-blue-300 hover:text-brand-blue-200 hover:underline"
                  >
                    {route.label ?? route.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {colunas.map((coluna) => (
            <div key={coluna.titulo}>
              <p className="text-sm font-semibold text-white">{coluna.titulo}</p>
              <ul className="mt-2 space-y-2 text-sm text-neutral-400">
                {coluna.itens.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-neutral-800 pt-6 text-xs text-neutral-500">
          <p>
            Última atualização desta página: <strong className="text-neutral-300">{formatLocalDate(ultimaAtualizacao.data)}</strong>.
            As informações têm como fonte o Diagnóstico Geral, o Prognóstico Geral e o Plano de Ações
            do PMetGIRS (ENGECONSULT, 2024) e permanecem sujeitas a confirmação e atualização pelas
            fontes oficiais. Dados em validação estão sinalizados explicitamente ao longo da página;
            consulte a seção{' '}
            <Link to="/transparencia" className="text-brand-blue-300 hover:text-brand-blue-200 hover:underline">
              Transparência
            </Link>
            .
          </p>
          <p className="mt-4">
            © {new Date().getFullYear()} Instituto Rio Metrópole. Conteúdo em elaboração progressiva:
            esta é a versão inicial (MVP) da página pública do PMetGIRS.
          </p>
        </div>
      </div>
    </footer>
  );
}
