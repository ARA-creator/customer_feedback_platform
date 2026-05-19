import Dashboard from '../../features/dashboard/components/Dashboard'

function DashboardOverviewPage({ userRole, onNavigateToInsights, onNavigateToInbox, registerRefresh }) {
  return (
    <Dashboard
      mode="overview"
      isAdminUser={false}
      userRole={userRole}
      onNavigateToInsights={onNavigateToInsights}
      onNavigateToInbox={onNavigateToInbox}
      registerRefresh={registerRefresh}
    />
  )
}

export default DashboardOverviewPage

