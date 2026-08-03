import { FiChevronUp } from 'react-icons/fi'

/**
 * Inline scroll-to-top control for the inbox pagination bar (brand green).
 */
export default function InboxScrollToTopButton({ onScrollToTop, className = '' }) {
  return (
    <button
      type="button"
      onClick={() => onScrollToTop?.()}
      aria-label="Scroll to top"
      title="Scroll to top"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#009750]/30 bg-[#009750] text-white shadow-sm transition-colors hover:bg-[#007a42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009750]/40 focus-visible:ring-offset-2 dark:border-emerald-800 dark:bg-[#009750] dark:hover:bg-[#007a42] dark:focus-visible:ring-offset-gray-950 ${className}`}
    >
      <FiChevronUp className="h-5 w-5" strokeWidth={3} aria-hidden />
    </button>
  )
}
