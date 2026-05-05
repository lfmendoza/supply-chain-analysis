import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Topology" },
  { to: "/traceability", label: "Traceability" },
  { to: "/simulation", label: "Simulation" },
  { to: "/optimization", label: "Optimization" },
  { to: "/comparison", label: "Comparison" }
];

export default function Layout() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand-900 text-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-8">
          <h1 className="text-lg font-semibold tracking-tight">
            Supply Chain Network <span className="text-brand-100/80">Analysis & Optimization</span>
          </h1>
          <nav className="flex gap-6 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `transition border-b-2 pb-1 ${
                    isActive ? "border-brand-100 text-white" : "border-transparent text-brand-100/70 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <Outlet />
      </main>
      <footer className="text-xs text-slate-500 text-center py-4">
        Neo4j AuraDB · OR-Tools CP-SAT · scikit-learn · Database 2 academic project
      </footer>
    </div>
  );
}
