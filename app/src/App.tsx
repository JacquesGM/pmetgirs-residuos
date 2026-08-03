import { Route, Routes } from 'react-router-dom';
import { RootLayout } from './components/layout/RootLayout';
import { NotFound } from './pages/NotFound';
import { routes } from './routes';

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        {routes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
