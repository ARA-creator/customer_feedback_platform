import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiChevronDown, FiLogOut, FiSettings, FiBell } from 'react-icons/fi'
import { pathForView } from '../../../app/routes'
import { displayNameFromUser, formatUserRole, getUserInitialsFromUser } from '../../lib/userDisplay'

export default function UserProfileMenu({ user, onSignOut }) {
  const navigate = useNavigate()
  const menuId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)

  const email = user?.email || ''
  const name = displayNameFromUser(user)
  const initials = getUserInitialsFromUser(user)
  const roleLabel = formatUserRole(user?.role)

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

  const go = (view) => {
    setOpen(false)
    navigate(pathForView(view))
  }

  if (!email) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className="inline-flex min-h-[44px] max-w-[min(100%,14rem)] items-center gap-2 rounded-xl border border-gray-200 bg-white pl-1.5 pr-2.5 py-1.5 text-left shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
      >
        <span className="relative shrink-0">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#009750] to-[#0d9f5c] text-xs font-semibold text-white"
            aria-hidden
          >
            {initials}
          </span>
          <span
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-900"
            title="Signed in"
            aria-hidden
          />
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</span>
            <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{roleLabel}</span>
          </span>
        </span>
        <FiChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-gray-400 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-950"
        >
          <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-800 sm:hidden">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
            <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{roleLabel}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => go('settings')}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            <FiSettings className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => go('notifications')}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            <FiBell className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
            Notifications
          </button>
          {onSignOut && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-gray-800" role="separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSignOut()
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                <FiLogOut className="h-4 w-4 shrink-0" aria-hidden />
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
