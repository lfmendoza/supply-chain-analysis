import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Topology from "./pages/Topology";
import Traceability from "./pages/Traceability";
import Simulation from "./pages/Simulation";
import Optimization from "./pages/Optimization";
import Comparison from "./pages/Comparison";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Topology />} />
        <Route path="traceability" element={<Traceability />} />
        <Route path="simulation" element={<Simulation />} />
        <Route path="optimization" element={<Optimization />} />
        <Route path="comparison" element={<Comparison />} />
      </Route>
    </Routes>
  );
}
