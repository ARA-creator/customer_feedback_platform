const MODULES = [
  { id: 'overview', label: 'Overview' },
  { id: 'ops', label: 'Ops & SLA' },
  { id: 'workforce', label: 'Workforce' },
  { id: 'impact', label: 'Impact & repeats' },
  { id: 'drivers', label: 'Drivers & segments' },
  { id: 'quality', label: 'Quality & text' },
  { id: 'leadership', label: 'Leadership' },
]

export { MODULES }

export default function InsightsModuleNav({ active, onChange }) {
  return (
    <nav
      className="sticky top-0 z-20 -mx-1 overflow-x-auto pb-1"
      aria-label="Insights modules"
    >
      <div className="inline-flex min-w-full gap-1 rounded-xl border border-gray-200/90 bg-gray-50/90 p-1 dark:border-gray-800 dark:bg-gray-950/70">
        {MODULES.map((m) => {
          const selected = active === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                selected
                  ? 'bg-[#009750] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
