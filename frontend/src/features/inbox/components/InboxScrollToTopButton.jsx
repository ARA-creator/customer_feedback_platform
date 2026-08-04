import { FiChevronUp } from 'react-icons/fi'

/**
 * Floating scroll-to-top control (brand green), centered near the bottom of the viewport.
 */
export default function InboxScrollToTopButton({ onScrollToTop, className = '' }) {
  return (
    <button
      type="button"
      onClick={() => onScrollToTop?.()}
      aria-label="Scroll to top"
      title="Scroll to top"
      className={`fixed bottom-6 left-1/2 z-40 inline-flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-[#009750]/30 bg-[#009750] text-white shadow-lg shadow-[#009750]/25 transition-transform hover:scale-105 hover:bg-[#007a42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 focus-visible:ring-offset-2 dark:border-emerald-800 dark:bg-[#009750] dark:shadow-black/40 dark:hover:bg-[#007a42] dark:focus-visible:ring-offset-gray-950 ${className}`}
    >
      <FiChevronUp className="h-5 w-5" strokeWidth={3} aria-hidden />
    </button>
  )
}
