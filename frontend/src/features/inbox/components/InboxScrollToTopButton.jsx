import { FiChevronUp } from 'react-icons/fi'

/**
 * Brand-green scroll-to-top control. Parent positions it (floating under pagination).
 */
export default function InboxScrollToTopButton({ onScrollToTop, className = '' }) {
  return (
    <button
      type="button"
      onClick={() => onScrollToTop?.()}
      aria-label="Scroll to top"
      title="Scroll to top"
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#009750]/40 bg-[#009750] text-white shadow-lg shadow-[#009750]/30 transition-transform hover:scale-105 hover:bg-[#007a42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 focus-visible:ring-offset-2 dark:border-emerald-700 dark:bg-[#009750] dark:shadow-black/40 dark:hover:bg-[#007a42] dark:focus-visible:ring-offset-gray-950 ${className}`}
    >
      <FiChevronUp className="h-5 w-5" strokeWidth={3} aria-hidden />
    </button>
  )
}
