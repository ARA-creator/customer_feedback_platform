import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiChevronUp } from 'react-icons/fi'

/**
 * Floating scroll-to-top control — portaled to document.body so parent
 * overflow/stacking never pins it inside the pagination bar.
 */
export default function InboxScrollToTopButton({ onScrollToTop, className = '' }) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const main = document.querySelector('main')
    const scroller = main || window

    const readTop = () => {
      if (main) return main.scrollTop || 0
      return window.scrollY || document.documentElement.scrollTop || 0
    }

    const onScroll = () => setVisible(readTop() > 180)
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <button
      type="button"
      onClick={() => onScrollToTop?.()}
      aria-label="Scroll to top"
      title="Scroll to top"
      className={`fixed bottom-8 left-1/2 z-[100] inline-flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-[#009750]/40 bg-[#009750] text-white shadow-xl shadow-black/20 transition-all duration-200 hover:scale-105 hover:bg-[#007a42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/50 focus-visible:ring-offset-2 dark:border-emerald-700 dark:bg-[#009750] dark:hover:bg-[#007a42] dark:focus-visible:ring-offset-gray-950 ${
        visible ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3'
      } ${className}`}
    >
      <FiChevronUp className="h-6 w-6" strokeWidth={3} aria-hidden />
    </button>,
    document.body,
  )
}
