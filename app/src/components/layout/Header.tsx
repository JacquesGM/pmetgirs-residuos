import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FileText, Menu, TextCursorInput, X } from 'lucide-react';
import logoIrm from '../../assets/logo-irm-branca-horizontal.png';
import logoGovernoRj from '../../assets/logo-governo-rj.png';
import { routes } from '../../routes';

const navItems = routes.filter((route) => route.label);

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const location = useLocation();

  const toggleLargeText = () => {
    const next = !largeText;
    setLargeText(next);
    document.documentElement.style.fontSize = next ? '112.5%' : '';
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 shadow-md">
      <div className="bg-brand-blue-950">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5 sm:px-6 lg:px-8">
          <img src={logoGovernoRj} alt="" className="h-4 w-auto sm:h-5" />
          <span className="text-[10px] font-semibold tracking-wide text-brand-blue-100 sm:text-xs">
            Governo do Estado do Rio de Janeiro
          </span>
        </div>
      </div>

      <div className="bg-brand-blue-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 text-left">
            <img src={logoIrm} alt="Instituto Rio Metrópole" className="h-8 w-auto sm:h-9" />
            <span className="hidden border-l border-white/25 pl-3 leading-tight sm:block xl:hidden">
              <span className="block text-xs font-semibold text-brand-blue-100">PMetGIRS</span>
              <span className="block text-[11px] text-brand-blue-200">Transparência pública</span>
            </span>
          </Link>

          <nav aria-label="Navegação principal" className="hidden xl:block">
            <ul className="flex flex-nowrap items-center gap-0.5">
              {navItems.map((route) => (
                <li key={route.path} className="shrink-0">
                  <NavLink
                    to={route.path}
                    end={route.path === '/'}
                    className={({ isActive }) =>
                      `inline-block whitespace-nowrap rounded-md border-b-2 px-2 py-2 text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'border-brand-green-500 text-white'
                          : 'border-transparent text-brand-blue-100 hover:border-brand-green-500 hover:text-white'
                      }`
                    }
                  >
                    {route.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLargeText}
              aria-pressed={largeText}
              className="hidden min-h-[44px] items-center gap-1.5 rounded-md border border-white/30 px-2.5 text-xs font-medium text-white hover:bg-white/10 sm:inline-flex"
            >
              <TextCursorInput aria-hidden="true" className="h-4 w-4" />
              Texto maior
            </button>
            <Link
              to="/documentos"
              className="hidden min-h-[44px] items-center gap-1.5 rounded-md bg-white px-3 text-sm font-medium text-brand-blue-800 hover:bg-brand-blue-50 sm:inline-flex"
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              Acessar documentos
            </Link>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-white/30 text-white xl:hidden"
              aria-expanded={menuOpen}
              aria-controls="menu-mobile"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="menu-mobile" aria-label="Navegação móvel" className="border-t border-white/15 xl:hidden">
            <ul className="flex flex-col px-4 py-2">
              {navItems.map((route) => (
                <li key={route.path} className="border-b border-white/10 last:border-0">
                  <NavLink
                    to={route.path}
                    end={route.path === '/'}
                    className={({ isActive }) =>
                      `block min-h-[44px] py-3 text-sm font-medium ${
                        isActive ? 'text-white' : 'text-brand-blue-100'
                      }`
                    }
                  >
                    {route.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
