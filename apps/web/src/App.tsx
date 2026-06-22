import { Route, Routes } from 'react-router-dom';
import { Layout } from './shell/Layout';
import { Workbench } from './pages/Workbench';
import { Credits } from './pages/Credits';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Workbench />} />
        <Route path="/credits" element={<Credits />} />
      </Route>
    </Routes>
  );
}
