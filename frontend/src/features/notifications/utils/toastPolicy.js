const TYPE_TO_PREF = {
  new_feedback: 'new_feedback',
  assigned_to_me: 'assigned_to_me',
  anomaly_alert: 'anomaly_alerts',
  anomaly: 'anomaly_alerts',
  admin_user_event: 'admin_user_events',
}

/** Whether a live toast should show for this notification and saved prefs. */
export function shouldShowLiveToast(notification, prefs) {
  if (!notification) return false
  if (prefs?.realtime === false) return false
  const t = String(notification.type || '').toLowerCase()
  const key = TYPE_TO_PREF[t]
  if (key) return Boolean(prefs?.[key])
  return Boolean(
    prefs?.new_feedback || prefs?.assigned_to_me || prefs?.anomaly_alerts || prefs?.admin_user_events,
  )
}
