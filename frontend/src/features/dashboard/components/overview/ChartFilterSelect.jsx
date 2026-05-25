import { useEffect, useId, useRef, useState } from 'react'
import { FiChevronDown } from 'react-icons/fi'

/**
 * Compact chart header filter (mockup-style pill dropdown).
 */
export default function ChartFilterSelect({
  value,
  onChange,
  options,
  ariaLabel = 'Filter',
  className = '',
}) {
  const listId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const rows = Array.isArray(options) ? options : []
  const selected = rows.find((o) => o.id === value) || rows[0]

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (rows.length === 0) return null

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <span className="max-w-[9rem] truncate">{selected?.label || 'Select'}</span>
        <FiChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute right-0 z-30 mt-1 max-h-56 min-w-[10rem] overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-950"
        >
          {rows.map((opt) => {
            const active = opt.id === value
            return (
              <li key={opt.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange?.(opt.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-xs font-medium ${
                    active
                      ? 'bg-emerald-50 text-[#007a42] dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
