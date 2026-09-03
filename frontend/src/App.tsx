import { NavLink, Outlet } from 'react-router'

// The nine pages from EVAL_SERVICE_PLAN.md, Section 13. Leaderboard is
// the front door and lives at "/"; the rest are one level down.
const navItems = [
  { to: '/', label: 'Leaderboard' },
  { to: '/checkpoints', label: 'Checkpoints' },
  { to: '/standards', label: 'Standards' },
  { to: '/s3-browser', label: 'S3 Browser' },
  { to: '/submit', label: 'Submit' },
  { to: '/runs', label: 'Runs' },
  { to: '/compare', label: 'Compare' },
  { to: '/endpoints', label: 'Endpoints' },
  { to: '/cluster', label: 'Cluster' },
]

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-4">
          <span className="text-lg font-semibold whitespace-nowrap">Evaluation Service</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive ? 'font-medium text-white' : 'text-slate-400 hover:text-slate-200'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default App
