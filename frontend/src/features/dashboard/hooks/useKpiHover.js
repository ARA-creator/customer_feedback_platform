import { useCallback, useState } from 'react'

export function useKpiHover() {
  const [activeKpiChange, setActiveKpiChange] = useState(null)

  const onKpiPointerEnter = useCallback(
    (key) => (e) => {
      if (e?.pointerType === 'mouse') setActiveKpiChange(key)
    },
    [],
  )

  const onKpiPointerLeave = useCallback(
    () => (e) => {
      if (e?.pointerType === 'mouse') setActiveKpiChange(null)
    },
    [],
  )

  return { activeKpiChange, setActiveKpiChange, onKpiPointerEnter, onKpiPointerLeave }
}

