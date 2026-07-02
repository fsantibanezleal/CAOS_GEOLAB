import { Route, Routes } from 'react-router-dom';
import { Layout } from './shell/Layout';
import { Workbench } from './pages/Workbench';
import { Pipeline } from './pages/Pipeline';
import { Tools } from './pages/Tools';
import { Credits } from './pages/Credits';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Workbench />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/credits" element={<Credits />} />
      </Route>
    </Routes>
  );
}
