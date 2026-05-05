import Dashboard from '../../features/dashboard/components/Dashboard'

function DashboardInsightsPage({ userRole, onNavigateBack, onNavigateToInbox }) {
  return (
    <Dashboard
      mode="insights"
      isAdminUser={false}
      userRole={userRole}
      onNavigateBack={onNavigateBack}
      onNavigateToInbox={onNavigateToInbox}
    />
  )
}

export default DashboardInsightsPage

