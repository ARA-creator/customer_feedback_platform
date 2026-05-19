import Dashboard from '../../features/dashboard/components/Dashboard'

function DashboardInsightsPage({ userRole, onNavigateBack, onNavigateToInbox, registerRefresh }) {
  return (
    <Dashboard
      mode="insights"
      isAdminUser={false}
      userRole={userRole}
      onNavigateBack={onNavigateBack}
      onNavigateToInbox={onNavigateToInbox}
      registerRefresh={registerRefresh}
    />
  )
}

export default DashboardInsightsPage

