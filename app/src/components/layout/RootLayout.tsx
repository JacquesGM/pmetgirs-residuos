import { Outlet } from 'react-router-dom';
import { SkipLink } from './SkipLink';
import { Header } from './Header';
import { Footer } from './Footer';
import { BackToTop } from './BackToTop';
import { ScrollToTop } from './ScrollToTop';
import { RouteTitle } from './RouteTitle';
import { VLibrasWidget } from './VLibrasWidget';

export function RootLayout() {
  return (
    <>
      <SkipLink />
      <ScrollToTop />
      <RouteTitle />
      <Header />
      <main id="conteudo-principal">
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
      <VLibrasWidget />
    </>
  );
}
