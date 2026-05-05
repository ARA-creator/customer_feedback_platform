import { createContext, useContext, useMemo } from 'react'

/**
 * Keep data vs actions separate so components can subscribe
 * to only what they need. (Fewer re-renders, fewer “why did this update?” moments.)
 */
const DashboardDataContext = createContext(null)
const DashboardActionsContext = createContext(null)

export function DashboardProvider({ data, actions, children }) {
  const memoData = useMemo(() => data, [data])
  const memoActions = useMemo(() => actions, [actions])

  return (
    <DashboardDataContext.Provider value={memoData}>
      <DashboardActionsContext.Provider value={memoActions}>
        {children}
      </DashboardActionsContext.Provider>
    </DashboardDataContext.Provider>
  )
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) {
    throw new Error('useDashboardData must be used within <DashboardProvider />')
  }
  return ctx
}

export function useDashboardActions() {
  const ctx = useContext(DashboardActionsContext)
  if (!ctx) {
    throw new Error('useDashboardActions must be used within <DashboardProvider />')
  }
  return ctx
}

