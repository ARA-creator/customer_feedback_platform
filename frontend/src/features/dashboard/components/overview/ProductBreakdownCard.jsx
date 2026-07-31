import { useEffect, useState } from 'react'
import { FiArrowLeft, FiArrowRight, FiChevronRight } from 'react-icons/fi'
import { SENTIMENT_COLORS } from '../../constants/palette'
import { getProductDetail } from '../../services/dashboard.api'
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

function MiniSentiment({ positivePct = 0, neutralPct = 0, negativePct = 0 }) {
  return (
    <div className="flex h-1.5 w-full min-w-[72px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <span style={{ width: `${positivePct}%`, backgroundColor: SENTIMENT_COLORS.Positive }} />
      <span style={{ width: `${neutralPct}%`, backgroundColor: SENTIMENT_COLORS.Neutral }} />
      <span style={{ width: `${negativePct}%`, backgroundColor: SENTIMENT_COLORS.Negative }} />
    </div>
  )
}

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function ProductRow({ row, selected, onSelect }) {
  return (
    <tr
      className={`cursor-pointer border-t border-transparent transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 ${
        selected ? 'bg-emerald-50/80 dark:bg-emerald-950/30' : ''
      }`}
      onClick={() => onSelect?.(row)}
    >
      <td className="py-3 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        <span className="inline-flex items-center gap-1">
          {row.name}
          <FiChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden />
        </span>
      </td>
      <td className="py-3 pr-3">
        <VolumeBar barPct={row.barPct} />
        <div className="mt-1.5">
          <MiniSentiment
            positivePct={row.positivePct}
            neutralPct={row.neutralPct}
            negativePct={row.negativePct}
          />
        </div>
      </td>
      <td className="py-3 text-right text-sm tabular-nums text-gray-800 dark:text-gray-200">
        <span className="font-medium">{row.total.toLocaleString()}</span>
        <span className="text-gray-400 dark:text-gray-500"> ({row.sharePct}%)</span>
      </td>
    </tr>
  )
}

function ProductInsightPanel({
  productName,
  detail,
  loading,
  error,
  onBack,
  timeFilterLabel,
}) {
  const product = detail?.product
  const policies = Array.isArray(detail?.policies) ? detail.policies : []

  return (
    <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
          >
            <FiArrowLeft className="h-3.5 w-3.5" />
            All products
          </button>
          <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-50">
            {product?.name || productName}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Policy-level sentiment
            {timeFilterLabel ? ` · ${timeFilterLabel}` : ''}
            {product?.product_prefix ? ` · ${product.product_prefix}` : ''}
          </p>
        </div>
        {product ? (
          <div className="text-right text-xs text-gray-600 dark:text-gray-300">
            <p>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {Number(product.total || 0).toLocaleString()}
              </span>{' '}
              feedback · {Number(product.policy_count || 0).toLocaleString()}{' '}
              {product.policy_count === 1 ? 'policy' : 'policies'}
            </p>
            <p className="mt-1">
              On platform since {formatWhen(product.first_seen_at)}
            </p>
          </div>
        ) : null}
      </div>

      {product ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Positive', pct: product.positive_pct, color: SENTIMENT_COLORS.Positive },
            { label: 'Neutral', pct: product.neutral_pct, color: SENTIMENT_COLORS.Neutral },
            { label: 'Negative', pct: product.negative_pct, color: SENTIMENT_COLORS.Negative },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-white/70 bg-white/80 px-2.5 py-2 dark:border-white/5 dark:bg-gray-950/40"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{s.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums" style={{ color: s.color }}>
                {s.pct}%
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading policy insight…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>
      ) : policies.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          No policies linked to this product in the selected period.
        </p>
      ) : (
        <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-950">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 font-medium">Policy</th>
                <th className="px-3 py-2 font-medium">Sentiment</th>
                <th className="px-3 py-2 text-right font-medium">Feedback</th>
                <th className="px-3 py-2 text-right font-medium">Arrived</th>
                <th className="px-3 py-2 text-right font-medium">Last heard</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.policy_hash} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                    <span className="font-mono text-xs">{p.policy_masked || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <MiniSentiment
                      positivePct={p.positive_pct}
                      neutralPct={p.neutral_pct}
                      negativePct={p.negative_pct}
                    />
                    <p className="mt-1 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                      {p.positive_pct}% pos · {p.neutral_pct}% neu · {p.negative_pct}% neg
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-800 dark:text-gray-200">
                    {Number(p.total || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-gray-600 dark:text-gray-300">
                    {formatWhen(p.first_seen_at)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-gray-600 dark:text-gray-300">
                    {formatWhen(p.last_seen_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ProductBreakdownCard({
  ready,
  rows = [],
  productFilter,
  onProductFilterChange,
  productFilterOptions = [],
  onViewAllProducts,
  showAllProducts = false,
  timeWindow = 'all',
  timeFilterLabel = '',
}) {
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const showFooter = Boolean(onViewAllProducts && rows.length > 0 && !selected)

  useEffect(() => {
    if (!selected?.key) {
      setDetail(null)
      setDetailError(null)
      return
    }
    let cancelled = false
    const [keyPrefix, ...groupParts] = String(selected.key).split('|')
    const product_prefix = String(selected.product_prefix || keyPrefix || '').trim()
    if (!product_prefix) return undefined
    const product_group =
      selected.product_group != null ? String(selected.product_group) : groupParts.join('|')

    setDetailLoading(true)
    setDetailError(null)
    const params = { product_prefix, time_window: timeWindow || 'all', product_group }

    getProductDetail(params)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setDetail(null)
          setDetailError(e?.response?.data?.error || e?.message || 'Failed to load product insight')
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selected, timeWindow])

  // Clear selection if filtered away
  useEffect(() => {
    if (!selected) return
    if (productFilter !== 'all' && selected.key !== productFilter) {
      setSelected(null)
    }
  }, [productFilter, selected])

  return (
    <DashboardChartCard
      title="Product Breakdown"
      action={
        productFilterOptions.length > 0 && !selected ? (
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
      ) : selected ? (
        <ProductInsightPanel
          productName={selected.name}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onBack={() => setSelected(null)}
          timeFilterLabel={timeFilterLabel}
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Select a product to see policy-level sentiment and when each policy first appeared.
          </p>
          <div className={`overflow-x-auto ${showAllProducts ? 'max-h-80 overflow-y-auto' : ''}`}>
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[38%]" />
                <col className="w-[30%]" />
              </colgroup>
              <thead>
                <tr className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  <th className="pb-2 pr-3 font-medium">Product</th>
                  <th className="pb-2 pr-3 font-medium">Volume / sentiment</th>
                  <th className="pb-2 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ProductRow
                    key={row.key}
                    row={row}
                    selected={selected?.key === row.key}
                    onSelect={setSelected}
                  />
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
              {showAllProducts ? 'Show fewer products' : 'View all products'}
              <FiArrowRight
                className={`h-4 w-4 ${showAllProducts ? 'rotate-90' : ''}`}
                aria-hidden
              />
            </button>
          )}
        </>
      )}
    </DashboardChartCard>
  )
}
