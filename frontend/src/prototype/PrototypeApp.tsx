import { Link, NavLink, Outlet } from 'react-router'
import { PrototypeStoreProvider } from './state/PrototypeStore'

// The 5 top-level entry points into the demo narrative. Checkpoint detail
// is reached by clicking a checkpoint on the Leaderboard, the same way a
// real product would link a row to its detail page, so it has no nav item
// of its own.
const prototypeNavItems = [
  { to: '/vision', label: 'Leaderboard' },
  { to: '/vision/submit', label: 'Submit' },
  { to: '/vision/runs', label: 'Runs' },
  { to: '/vision/compare', label: 'Compare' },
  { to: '/vision/history', label: 'Model History' },
]

// Own shell for the vision prototype: a mocked-data banner so nobody
// mistakes it for the real product, its own nav (the 5 items above,
// not the real app's 9), and a way back. Everything under here is
// self-contained — see prototype/README.md for what "self-contained"
// means and how to remove it.
export function PrototypeApp() {
  return (
    <PrototypeStoreProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-6 py-2 text-center text-xs font-medium text-amber-300">
          Vision prototype — every number on these pages is mocked for demo purposes. No backend, no real runs.
        </div>
        <header className="border-b border-slate-800">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-4">
            <Link to="/vision" className="text-lg font-semibold whitespace-nowrap">
              Evaluation Service <span className="text-slate-500">— Vision</span>
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm">
              {prototypeNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    isActive ? 'font-medium text-white' : 'text-slate-400 hover:text-slate-200'
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <Link to="/" className="ml-auto text-sm text-slate-500 hover:text-slate-300">
              ← Back to real app
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </main>
      </div>
    </PrototypeStoreProvider>
  )
}
