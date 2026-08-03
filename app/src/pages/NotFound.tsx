import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <Compass aria-hidden="true" className="h-12 w-12 text-brand-blue-500" />
      <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-brand-blue-600">
        Erro 404
      </p>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
        Página não encontrada
      </h1>
      <p className="mt-3 text-neutral-600">
        O endereço acessado não existe ou foi movido. Volte para a página inicial do PMetGIRS ou use o
        menu para encontrar o conteúdo que procura.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-brand-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-600"
      >
        Voltar à página inicial
      </Link>
    </div>
  );
}
