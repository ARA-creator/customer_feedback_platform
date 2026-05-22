import { useEffect, useRef, useState } from 'react'
import { DISPLAY_PREFS_CHANGED, loadDisplayPreferences, saveDisplayPreferences } from '../../../shared/lib/displayPreferences'

export function useDashboardAutoRefresh({ isAdminUser }) {
  const [dashboardAutoRefresh, setDashboardAutoRefresh] = useState(() => {
    if (!isAdminUser) return false
    return Boolean(loadDisplayPreferences().dashboardAutoRefresh)
  })
  const dashboardAutoRefreshRef = useRef(false)

  useEffect(() => {
    if (!isAdminUser) {
      setDashboardAutoRefresh(false)
      return
    }
    setDashboardAutoRefresh(Boolean(loadDisplayPreferences().dashboardAutoRefresh))
    const onChanged = (e) => {
      setDashboardAutoRefresh(Boolean(e?.detail?.dashboardAutoRefresh))
    }
    window.addEventListener(DISPLAY_PREFS_CHANGED, onChanged)
    return () => window.removeEventListener(DISPLAY_PREFS_CHANGED, onChanged)
  }, [isAdminUser])

  useEffect(() => {
    dashboardAutoRefreshRef.current = isAdminUser && dashboardAutoRefresh
  }, [isAdminUser, dashboardAutoRefresh])

  const setAndPersistDashboardAutoRefresh = (on) => {
    if (!isAdminUser) return
    setDashboardAutoRefresh(on)
    saveDisplayPreferences({ dashboardAutoRefresh: on })
  }

  return {
    dashboardAutoRefresh,
    setDashboardAutoRefresh: setAndPersistDashboardAutoRefresh,
    dashboardAutoRefreshRef,
  }
}
