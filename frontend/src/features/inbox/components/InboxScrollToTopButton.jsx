import { useEffect, useState } from 'react'
import { FiChevronUp } from 'react-icons/fi'

/**
 * Brand-green scroll-to-top FAB, fixed near the bottom of the viewport.
 * Appears after a modest scroll so it stays reachable without going to the list footer.
 */
export default function InboxScrollToTopButton({ onScrollToTop, className = '' }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const main = document.querySelector('main')
    const getTop = () => {
      if (main) return main.scrollTop || 0
      return window.scrollY || document.documentElement.scrollTop || 0
    }
    const onScroll = () => setVisible(getTop() > 160)
    onScroll()
    const target = main || window
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => onScrollToTop?.()}
      aria-label="Scroll to top"
      title="Scroll to top"
      className={`fixed bottom-6 left-1/2 z-40 inline-flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-[#009750]/40 bg-[#009750] text-white shadow-lg shadow-[#009750]/30 transition-transform hover:scale-105 hover:bg-[#007a42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 focus-visible:ring-offset-2 dark:border-emerald-700 dark:bg-[#009750] dark:shadow-black/40 dark:hover:bg-[#007a42] dark:focus-visible:ring-offset-gray-950 sm:bottom-8 ${className}`}
    >
      <FiChevronUp className="h-5 w-5" strokeWidth={3} aria-hidden />
    </button>
  )
}
