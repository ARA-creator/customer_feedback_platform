import { useEffect, useState } from 'react'
import { FiChevronUp } from 'react-icons/fi'

/**
 * Floating circular scroll-to-top control (gradient pill + white chevron).
 * Tracks the app shell <main> scroller used by the inbox layout.
 */
export default function InboxScrollToTopButton({ onScrollToTop, threshold = 280 }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const main = document.querySelector('main')
    const target = main || window

    const readTop = () => {
      if (main) return main.scrollTop
      return window.scrollY || document.documentElement.scrollTop || 0
    }

    const onScroll = () => {
      setVisible(readTop() > threshold)
    }

    onScroll()
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [threshold])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => onScrollToTop?.()}
      aria-label="Scroll to top"
      title="Scroll to top"
      className="fixed bottom-6 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg shadow-sky-900/25 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 sm:bottom-8 sm:right-8"
      style={{
        background: 'linear-gradient(180deg, #7dd3fc 0%, #38bdf8 42%, #1d4ed8 100%)',
      }}
    >
      <FiChevronUp className="h-6 w-6" strokeWidth={3} aria-hidden />
    </button>
  )
}
