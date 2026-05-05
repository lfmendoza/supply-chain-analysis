import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Topology from "./pages/Topology";
import Traceability from "./pages/Traceability";
import Simulation from "./pages/Simulation";
import Optimization from "./pages/Optimization";
import Comparison from "./pages/Comparison";
import OperationsLab from "./pages/OperationsLab";
import QueryExplorer from "./pages/QueryExplorer";
import Algorithms from "./pages/Algorithms";
import RubricMatrix from "./pages/RubricMatrix";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="topology" element={<Topology />} />
        <Route path="operations" element={<OperationsLab />} />
        <Route path="queries" element={<QueryExplorer />} />
        <Route path="algorithms" element={<Algorithms />} />
        <Route path="traceability" element={<Traceability />} />
        <Route path="simulation" element={<Simulation />} />
        <Route path="optimization" element={<Optimization />} />
        <Route path="comparison" element={<Comparison />} />
        <Route path="rubric" element={<RubricMatrix />} />
      </Route>
    </Routes>
  );
}
