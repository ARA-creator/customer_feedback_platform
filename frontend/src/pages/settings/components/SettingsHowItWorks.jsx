import { HOW_IT_WORKS_CARDS } from '../settingsConfig'

export default function SettingsHowItWorks() {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        How Customer Pulse works
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {HOW_IT_WORKS_CARDS.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/40"
          >
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{card.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
