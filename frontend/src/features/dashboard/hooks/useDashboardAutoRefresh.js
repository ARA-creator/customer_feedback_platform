import { useEffect, useRef, useState } from 'react'

export function useDashboardAutoRefresh({ isAdminUser, storageKey }) {
  const [dashboardAutoRefresh, setDashboardAutoRefresh] = useState(false)
  const dashboardAutoRefreshRef = useRef(false)

  useEffect(() => {
    if (!isAdminUser) {
      setDashboardAutoRefresh(false)
      return
    }
    try {
      const s = localStorage.getItem(storageKey)
      setDashboardAutoRefresh(s === '1' || s === 'true')
    } catch {
      // ignore
    }
  }, [isAdminUser, storageKey])

  useEffect(() => {
    dashboardAutoRefreshRef.current = isAdminUser && dashboardAutoRefresh
  }, [isAdminUser, dashboardAutoRefresh])

  const setAndPersistDashboardAutoRefresh = (on) => {
    setDashboardAutoRefresh(on)
    try {
      localStorage.setItem(storageKey, on ? '1' : '0')
    } catch {
      // ignore
    }
  }

  return {
    dashboardAutoRefresh,
    setDashboardAutoRefresh: setAndPersistDashboardAutoRefresh,
    dashboardAutoRefreshRef,
  }
}

