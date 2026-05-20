import { useEffect, useMemo, useState } from 'react'
import { getWordFrequencies } from '../services/dashboard.api'

function weightToRem(weight, minW, maxW) {
  if (maxW <= minW) return 1.1
  const t = (weight - minW) / (maxW - minW)
  return 0.85 + t * 1.35
}

/**
 * Client-rendered tag cloud (works when server cannot generate PNG on Vercel).
 */
export default function OverviewWordCloud({ timeWindow, isDarkMode }) {
  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getWordFrequencies({ time_window: timeWindow })
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data?.words) ? data.words : []
        setWords(list.filter((w) => w?.text && Number(w.weight) > 0))
      })
      .catch((e) => {
        if (cancelled) return
        setWords([])
        setError(e?.message || 'Failed to load word cloud')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [timeWindow])

  const stats = useMemo(() => {
    const weights = words.map((w) => Number(w.weight) || 0)
    return {
      min: weights.length ? Math.min(...weights) : 0,
      max: weights.length ? Math.max(...weights) : 0,
    }
  }, [words])

  if (loading) {
    return (
      <div className="w-full h-full min-h-[16rem] bg-gray-50 dark:bg-white/[0.04] rounded-xl animate-pulse" />
    )
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center text-sm text-rose-600 dark:text-rose-300 px-6 text-center">
        {error}
      </div>
    )
  }

  if (!words.length) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center text-sm text-gray-500 dark:text-gray-400 px-6 text-center">
        Word cloud will appear when feedback data is available for this period.
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-[16rem] flex-wrap items-center justify-center gap-x-3 gap-y-2 p-4 sm:p-6"
      role="img"
      aria-label="Word cloud of common feedback terms"
    >
      {words.map((w, idx) => (
        <span
          key={`${w.text}-${idx}`}
          className="inline-block font-semibold leading-tight transition-opacity hover:opacity-80"
          style={{
            fontSize: `${weightToRem(Number(w.weight), stats.min, stats.max)}rem`,
            color: isDarkMode ? '#6ee7b7' : '#047857',
            opacity: 0.55 + (Number(w.weight) - stats.min) / Math.max(stats.max - stats.min, 1) * 0.45,
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  )
}
