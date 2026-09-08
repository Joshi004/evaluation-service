import { NavLink, Outlet } from 'react-router'

// The six pages confirmed by decision D5 (docs/IMPLEMENTATION_PHASES.md):
// S3 Browser, Compare and Cluster were cut from the original nine.
// Leaderboard is the front door and lives at "/"; the rest are one level
// down.
const navItems = [
  { to: '/', label: 'Leaderboard' },
  { to: '/checkpoints', label: 'Checkpoints' },
  { to: '/standards', label: 'Standards' },
  { to: '/submit', label: 'Submit' },
  { to: '/runs', label: 'Runs' },
  { to: '/endpoints', label: 'Endpoints' },
]

// Deliberately separate from navItems above: the vision prototype is a
// mocked demo, not one of the nine real pages, and it gets its own shell
// once you're inside it (see src/prototype/PrototypeApp.tsx). This is the
// only place the real app links to it.
const visionPrototypeLink = { to: '/vision', label: 'Vision Demo' }

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
          <NavLink
            to={visionPrototypeLink.to}
            className="ml-auto rounded-full border border-amber-500/30 px-3 py-1 text-sm font-medium text-amber-300 hover:bg-amber-500/10"
          >
            {visionPrototypeLink.label}
          </NavLink>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default App
