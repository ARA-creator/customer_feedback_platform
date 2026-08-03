import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import DashboardChartCard from './DashboardChartCard'
import { CHART_TOOLTIP } from './chartUi'

function ChartSkeleton({ className = 'h-72' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

export default function VolumeByChannelCard({
  ready,
  channelRows = [],
  channelTotal = 0,
}) {
  return (
    <DashboardChartCard title="Volume by Channel">
      {!ready ? (
        <ChartSkeleton className="h-72" />
      ) : channelRows.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No channel volume in this period.</p>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="relative h-52 w-52 shrink-0 sm:h-56 sm:w-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelRows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="90%"
                  paddingAngle={1.5}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {channelRows.map((entry) => (
                    <Cell key={entry.source} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold leading-none tabular-nums tracking-tight text-gray-900 dark:text-gray-100">
                {channelTotal.toLocaleString()}
              </span>
              <span className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">Total</span>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-3">
            {channelRows.map((row) => (
              <li key={row.source} className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2.5 font-medium text-gray-800 dark:text-gray-200">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.fill }}
                    aria-hidden
                  />
                  <span className="truncate">{row.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{row.pct}%</span>
                  <span className="text-gray-400 dark:text-gray-500"> ({row.value.toLocaleString()})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardChartCard>
  )
}
