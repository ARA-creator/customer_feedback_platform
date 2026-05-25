import { FiArrowRight } from 'react-icons/fi'
import DashboardChartCard from './DashboardChartCard'
import ChartFilterSelect from './ChartFilterSelect'

const PRODUCT_BAR = '#5ec962'

function ChartSkeleton({ className = 'h-56' }) {
  return <div className={`w-full rounded-xl bg-gray-100 animate-pulse dark:bg-white/[0.06] ${className}`} />
}

function VolumeBar({ barPct }) {
  const width = Math.max(0, Math.min(100, barPct))
  return (
    <div className="h-2.5 w-full min-w-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <span
        className="block h-full rounded-full"
        style={{ width: `${width}%`, backgroundColor: PRODUCT_BAR }}
      />
    </div>
  )
}

function ProductRow({ row }) {
  return (
    <tr>
      <td className="py-3 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
      <td className="py-3 pr-3">
        <VolumeBar barPct={row.barPct} />
      </td>
      <td className="py-3 text-right text-sm tabular-nums text-gray-800 dark:text-gray-200">
        <span className="font-medium">{row.total.toLocaleString()}</span>
        <span className="text-gray-400 dark:text-gray-500"> ({row.sharePct}%)</span>
      </td>
    </tr>
  )
}

export default function ProductBreakdownCard({
  ready,
  rows = [],
  productFilter,
  onProductFilterChange,
  productFilterOptions = [],
  onViewAllProducts,
}) {
  const showFooter = Boolean(onViewAllProducts && rows.length > 0)

  return (
    <DashboardChartCard
      title="Product Breakdown"
      action={
        productFilterOptions.length > 0 ? (
          <ChartFilterSelect
            value={productFilter}
            onChange={onProductFilterChange}
            options={productFilterOptions}
            ariaLabel="Filter by product"
          />
        ) : null
      }
    >
      {!ready ? (
        <ChartSkeleton className="h-56" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No product matches in this period.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[38%]" />
                <col className="w-[30%]" />
              </colgroup>
              <thead>
                <tr className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  <th className="pb-2 pr-3 font-medium">Product</th>
                  <th className="pb-2 pr-3 font-medium">
                    <span className="sr-only">Volume bar</span>
                  </th>
                  <th className="pb-2 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ProductRow key={row.key} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          {showFooter && (
            <button
              type="button"
              onClick={onViewAllProducts}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              View all products
              <FiArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </>
      )}
    </DashboardChartCard>
  )
}
