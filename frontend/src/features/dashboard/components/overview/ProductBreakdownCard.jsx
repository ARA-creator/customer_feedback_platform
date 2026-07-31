import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiArrowRight, FiChevronRight, FiX } from 'react-icons/fi'
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
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatWhenShort(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function sentimentColor(label) {
  const s = String(label || '').toLowerCase()
  if (s === 'positive') return SENTIMENT_COLORS.Positive
  if (s === 'negative') return SENTIMENT_COLORS.Negative
  return SENTIMENT_COLORS.Neutral
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
      </td>
      <td className="py-3 text-right text-sm tabular-nums text-gray-800 dark:text-gray-200">
        <span className="font-medium">{row.total.toLocaleString()}</span>
        <span className="text-gray-400 dark:text-gray-500"> ({row.sharePct}%)</span>
      </td>
    </tr>
  )
}

function ProductInsightModal({
  open,
  productName,
  detail,
  loading,
  error,
  onClose,
  timeFilterLabel,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const product = detail?.product
  const policies = Array.isArray(detail?.policies) ? detail.policies : []
  const feedbackItems = Array.isArray(detail?.feedback_items) ? detail.feedback_items : []
  const verifiedNumbers = Array.isArray(product?.verified_policy_numbers)
    ? product.verified_policy_numbers
    : []

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-insight-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-emerald-200/80 bg-white shadow-xl sm:rounded-2xl dark:border-emerald-900/40 dark:bg-gray-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Product insight
            </p>
            <h2
              id="product-insight-title"
              className="mt-0.5 truncate text-lg font-semibold text-gray-900 dark:text-gray-50"
            >
              {product?.name || productName || 'Product'}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Policy numbers linked to this product type
              {timeFilterLabel ? ` · ${timeFilterLabel}` : ''}
              {product?.product_prefix ? ` · ${product.product_prefix}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close product insight"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {product ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {Number(product.total || 0).toLocaleString()}
                </span>{' '}
                feedback ·{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {Number(product.policy_count || policies.length || 0).toLocaleString()}
                </span>{' '}
                {Number(product.policy_count || policies.length || 0) === 1 ? 'policy' : 'policies'}
                {Number(product.verified_policy_count || 0) > 0
                  ? ` · ${Number(product.verified_policy_count).toLocaleString()} with policy numbers`
                  : ''}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                On platform since {formatWhenShort(product.first_seen_at)}
              </p>
            </div>
          ) : null}

          {product ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: 'Positive', pct: product.positive_pct, color: SENTIMENT_COLORS.Positive },
                { label: 'Neutral', pct: product.neutral_pct, color: SENTIMENT_COLORS.Neutral },
                { label: 'Negative', pct: product.negative_pct, color: SENTIMENT_COLORS.Negative },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2 dark:border-gray-800 dark:bg-gray-900/60"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{s.label}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums" style={{ color: s.color }}>
                    {s.pct}%
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {verifiedNumbers.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Policy numbers for this type
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {verifiedNumbers.map((num) => (
                  <span
                    key={num}
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-2 py-1 font-mono text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {loading ? (
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Loading policy feedback…</p>
          ) : error ? (
            <p className="mt-6 text-sm text-rose-700 dark:text-rose-300">{error}</p>
          ) : (
            <>
              {policies.length > 0 ? (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Policy-level sentiment
                  </p>
                  <div className="max-h-52 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">Policy</th>
                          <th className="px-3 py-2.5 font-medium">Sentiment</th>
                          <th className="px-3 py-2.5 text-right font-medium">Feedback</th>
                          <th className="px-3 py-2.5 text-right font-medium">Arrived</th>
                          <th className="px-3 py-2.5 text-right font-medium">Last heard</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((p) => (
                          <tr key={p.policy_hash} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                              {p.policy_number ? (
                                <span className="font-mono text-xs font-semibold">{p.policy_number}</span>
                              ) : (
                                <span className="text-xs">{p.policy_masked || '—'}</span>
                              )}
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
                              {formatWhenShort(p.first_seen_at)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-gray-600 dark:text-gray-300">
                              {formatWhenShort(p.last_seen_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  What they complained about
                </p>
                {feedbackItems.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No individual feedback rows available for this product in the selected period.
                  </p>
                ) : (
                  <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">Policy number</th>
                          <th className="px-3 py-2.5 font-medium">Policy type</th>
                          <th className="px-3 py-2.5 font-medium">What they said</th>
                          <th className="px-3 py-2.5 font-medium">Sentiment</th>
                          <th className="px-3 py-2.5 text-right font-medium">Received</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feedbackItems.map((item) => (
                          <tr
                            key={item.feedback_id}
                            className="border-t border-gray-100 align-top dark:border-gray-800"
                          >
                            <td className="px-3 py-2.5">
                              {item.policy_number ? (
                                <span className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                                  {item.policy_number}
                                </span>
                              ) : (
                                <span className="text-xs text-amber-700 dark:text-amber-300">
                                  No number (name match)
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-200">
                              {item.policy_type || '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              {item.theme ? (
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  {item.theme}
                                </p>
                              ) : null}
                              <p className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
                                {item.complaint || 'No message text available.'}
                              </p>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
                                style={{
                                  color: sentimentColor(item.sentiment),
                                  backgroundColor: `${sentimentColor(item.sentiment)}22`,
                                }}
                              >
                                {item.sentiment || 'neutral'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs tabular-nums text-gray-600 dark:text-gray-300">
                              {formatWhen(item.received_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
  totalProductCount = 0,
  timeWindow = 'all',
  timeFilterLabel = '',
}) {
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const showFooter = Boolean(onViewAllProducts && rows.length > 0)
  const visibleCount = rows.length

  const closeModal = () => setSelected(null)

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

  useEffect(() => {
    if (!selected) return
    if (productFilter !== 'all' && selected.key !== productFilter) {
      setSelected(null)
    }
  }, [productFilter, selected])

  return (
    <>
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
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Select a product to see linked policy numbers, complaints, and when each arrived.
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
                    <th className="pb-2 pr-3 font-medium">Volume</th>
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
                {showAllProducts
                  ? 'Show fewer products'
                  : `View all products (${Number(totalProductCount).toLocaleString()})`}
                <FiArrowRight
                  className={`h-4 w-4 ${showAllProducts ? 'rotate-90' : ''}`}
                  aria-hidden
                />
              </button>
            )}
            {!showAllProducts && totalProductCount > visibleCount ? (
              <p className="mt-2 text-center text-[11px] text-gray-500 dark:text-gray-400">
                Showing {visibleCount} of {Number(totalProductCount).toLocaleString()} products
              </p>
            ) : null}
          </>
        )}
      </DashboardChartCard>

      <ProductInsightModal
        open={Boolean(selected)}
        productName={selected?.name}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeModal}
        timeFilterLabel={timeFilterLabel}
      />
    </>
  )
}
