import { Link } from 'react-router-dom';
import { AlertTriangle, MapPin } from 'lucide-react';
import atualizacoes from '../../data/atualizacoes.json';
import type { Atualizacao } from '../../types';

const ultimaAtualizacao = (atualizacoes as Atualizacao[])[0];

function formatLocalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function Hero() {
  return (
    <section id="topo" className="relative overflow-hidden bg-gradient-to-br from-brand-blue-700 via-brand-blue-600 to-brand-green-600 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue-100">
            Instituto Rio Metrópole — Transparência pública
          </p>
          <h1
            id="hero-titulo"
            tabIndex={-1}
            className="mt-3 text-3xl font-extrabold leading-tight outline-none sm:text-4xl lg:text-5xl"
          >
            PMetGIRS — Gestão Metropolitana de Resíduos Sólidos
          </h1>
          <p className="mt-4 max-w-xl text-base text-brand-blue-50 sm:text-lg">
            Acompanhe as metas, projetos e resultados do planejamento integrado de resíduos sólidos
            dos 22 municípios da Região Metropolitana do Rio de Janeiro.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#visao-geral"
              className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-brand-blue-700 hover:bg-brand-blue-50"
            >
              Conheça o plano
            </a>
            <Link
              to="/projetos"
              className="rounded-md border border-white/70 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Acompanhe os projetos
            </Link>
          </div>
          <div className="mt-8 flex flex-col gap-2 text-sm text-brand-blue-50 sm:flex-row sm:items-center sm:gap-4">
            <span>
              Última atualização dos dados:{' '}
              <strong className="font-semibold text-white">
                {formatLocalDate(ultimaAtualizacao.data)}
              </strong>
            </span>
            <Link
              to="/transparencia"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
            >
              <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
              Alguns dados seguem em validação — ver seção Transparência
            </Link>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative mx-auto flex h-56 w-full max-w-sm items-center justify-center rounded-2xl border border-white/20 bg-white/10 sm:h-72"
        >
          <MapPin className="h-16 w-16 text-white/70" />
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/70">
            Mapa estilizado da Região Metropolitana do Rio de Janeiro
          </span>
        </div>
      </div>
    </section>
  );
}
