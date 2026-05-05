import Dashboard from '../../features/dashboard/components/Dashboard'

function DashboardOverviewPage({ userRole, onNavigateToInsights, onNavigateToInbox }) {
  return (
    <Dashboard
      mode="overview"
      isAdminUser={false}
      userRole={userRole}
      onNavigateToInsights={onNavigateToInsights}
      onNavigateToInbox={onNavigateToInbox}
    />
  )
}

export default DashboardOverviewPage

