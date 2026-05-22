import { Line, LineChart, ResponsiveContainer } from 'recharts'

export default function MiniSparkline({ data, color = '#009750', height = 32 }) {
  const rows = Array.isArray(data) ? data : []
  if (!rows.length) {
    return <div className="h-8 w-full rounded bg-gray-100/80 dark:bg-gray-900/50" aria-hidden />
  }
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
