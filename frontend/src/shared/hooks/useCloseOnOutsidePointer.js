import { useEffect } from 'react'

/**
 * Close an open popover/menu when the user clicks or taps outside, or presses Escape.
 */
export function useCloseOnOutsidePointer(rootRef, open, setOpen) {
  useEffect(() => {
    if (!open) return undefined

    const onPointer = (event) => {
      const root = rootRef.current
      if (root && !root.contains(event.target)) {
        setOpen(false)
      }
    }

    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, rootRef, setOpen])
}
