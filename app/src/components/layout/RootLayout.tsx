import { Outlet } from 'react-router-dom';
import { SkipLink } from './SkipLink';
import { Header } from './Header';
import { Footer } from './Footer';
import { BackToTop } from './BackToTop';
import { ScrollToTop } from './ScrollToTop';
import { RouteTitle } from './RouteTitle';
import { VLibrasWidget } from './VLibrasWidget';
import { PrototypeNotice } from './PrototypeNotice';

export function RootLayout() {
  return (
    <>
      <SkipLink />
      <ScrollToTop />
      <RouteTitle />
      <PrototypeNotice />
      <Header />
      {/*
        tabIndex={-1} é o que faz o "Ir para o conteúdo" funcionar de verdade:
        sem ele o navegador rola até aqui mas deixa o foco no cabeçalho, e o
        próximo Tab devolve o usuário para a navegação que ele acabou de pular.
      */}
      <main id="conteudo-principal" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
      <VLibrasWidget />
    </>
  );
}
