import {
  userCanApproveReplies,
  userCanViewReports,
  userIsAdminUI,
} from '../../app/routes'

/**
 * @param {object} auth - user from /auth/me
 * @returns {{ agentSections: array, adminSections: array, sharedSections: array, settingsLinks: array, tips: array }}
 */
export function buildHelpGuide(auth) {
  const isAdmin = userIsAdminUI(auth)
  const canReports = userCanViewReports(auth)
  const perms = Array.isArray(auth?.permissions) ? auth.permissions : []
  const isSuperAdmin = String(auth?.role || '').toLowerCase() === 'super_admin'
  const canWebhooks =
    perms.includes('admin.manage_integrations') || isSuperAdmin
  const canUsers = perms.includes('admin.manage_users') || isSuperAdmin
  const canRoles = perms.includes('admin.manage_roles')
  const canIntegrations = perms.includes('admin.manage_integrations')
  const canActivity =
    perms.includes('admin.manage_users') ||
    perms.includes('admin.view_audit_logs') ||
    perms.includes('admin.manage_roles')
  const canApprove = userCanApproveReplies(auth)

  const agentSections = [
    {
      to: '/',
      title: 'Overview',
      description:
        'Dashboard home: KPI cards (total, negative, positive, neutral), sentiment and trend charts, and source breakdown. Use the time filter (Today, week, month, All time) to change what you see. Click a KPI card to open the inbox with that filter.',
    },
    {
      to: '/insights',
      title: 'Insights',
      description:
        'Deeper analysis: theme landscape, channel monitors, source × theme matrix, top issues (negative volume), and peak feedback times. Open from Overview via the charts area, or go here directly. Use Investigate to jump into the inbox with filters applied.',
    },
    {
      to: '/inbox',
      title: 'Inbox',
      description:
        'Read and act on feedback from all channels. Search, filter by source, sentiment, theme, and date. Open a message for details, policy matches, and archive. Link to Customer 360 when a customer key is available.',
    },
    {
      to: '/notifications',
      title: 'Notifications',
      description:
        'In-app alerts for new feedback, assignments, sentiment spikes, and more. Click a notification to open the related inbox item or admin screen. Configure types under Settings → Notifications.',
    },
  ]

  if (canReports) {
    agentSections.push({
      to: '/reports',
      title: 'Reports',
      description:
        'Export feedback data or manage scheduled report definitions. Use custom export for ad-hoc CSV-style downloads.',
    })
  }

  const adminSections = [
    {
      to: '/admin',
      title: 'Admin overview',
      description:
        'Platform health, user approvals, theme backfill, and high-level admin actions. This is the default home for admin accounts.',
    },
  ]

  if (canWebhooks) {
    adminSections.push({
      to: '/admin/channels',
      title: 'Webhooks & channels',
      description:
        'Connection status for email, WhatsApp, and other ingest channels. Copy webhook URLs and follow setup steps for Twilio and integrations.',
    })
  }
  if (canUsers) {
    adminSections.push({
      to: '/admin/users',
      title: 'Users',
      description: 'Approve, suspend, and manage user accounts, roles, and access.',
    })
  }
  if (canRoles) {
    adminSections.push({
      to: '/admin/roles',
      title: 'Roles & permissions',
      description: 'Define roles and which permissions each role has.',
    })
  }
  if (canIntegrations) {
    adminSections.push({
      to: '/admin/integrations',
      title: 'Integrations health',
      description: 'Monitor ingestion pipelines and integration errors.',
    })
    adminSections.push({
      to: '/admin/db',
      title: 'Database connection',
      description: 'Verify database connectivity for operations.',
    })
    adminSections.push({
      to: '/admin/enterprise-sso',
      title: 'Enterprise SSO',
      description: 'Configure Microsoft / Azure AD sign-in for your organization.',
    })
  }
  if (canApprove) {
    adminSections.push({
      to: '/admin/reply-approvals',
      title: 'Reply approvals',
      description: 'Review and approve outbound reply drafts before they are sent.',
    })
  }
  if (canActivity) {
    adminSections.push({
      to: '/admin/activity',
      title: 'User activity',
      description: 'Audit trail of sign-ins and important admin actions.',
    })
  }

  const settingsLinks = [
    { to: '/settings/account', title: 'Account', description: 'Your email, role, and sign-in method.' },
    { to: '/settings/display', title: 'Display', description: 'Theme, text size, layout, and default date ranges.' },
    { to: '/settings/notifications', title: 'Notifications', description: 'Alert types and quiet hours.' },
    { to: '/settings/inbox', title: 'Inbox', description: 'Default filters and clearing local archives.' },
    { to: '/settings/security', title: 'Security', description: 'Change your password (local accounts).' },
  ]

  const tips = [
    {
      title: 'Overview filters',
      body: 'On Overview, use the time pills (Today, This week, All time, etc.) and sentiment pills (All, Positive, Negative, Neutral) together—every chart and KPI updates for both.',
    },
    {
      title: 'Header controls',
      body: 'Use the moon icon for quick light/dark mode. On Overview and Insights, refresh reloads data; admins can enable auto-refresh in Display settings.',
    },
    {
      title: 'From Insights to Inbox',
      body: 'Select a theme or channel, then use Investigate or Open inbox to continue with those filters applied.',
    },
    {
      title: 'Sidebar',
      body: 'Collapse the sidebar on desktop with the chevron at the top. On mobile, open the menu from the header.',
    },
    {
      title: 'Customer 360',
      body: 'From an inbox message with a customer key, use View customer to see history for that customer (agents only).',
    },
    {
      title: 'Inbox keyboard shortcuts',
      body: 'With the list focused (click outside search), press J and K to move, Enter to open, and Esc to clear. Press ⌘K (Ctrl+K on Windows) to focus search.',
    },
    {
      title: 'Notifications',
      body: 'Enable Live toast alerts under Settings → Notifications to see pop-ups while signed in. Read notifications from previous months are archived automatically at the start of each month.',
    },
  ]

  if (isAdmin) {
    tips.unshift({
      title: 'Admin vs agent views',
      body: 'Admin accounts use the Admin section in the sidebar. Agents use Overview and Inbox; you will not see both at once.',
    })
  }

  return {
    isAdmin,
    agentSections: isAdmin ? [] : agentSections,
    adminSections: isAdmin ? adminSections : [],
    settingsLinks,
    tips,
    workflowSteps: isAdmin
      ? [
          'Open Admin overview for platform status and pending user approvals.',
          'Use Webhooks & channels to confirm email and WhatsApp ingestion.',
          'Manage users and roles when onboarding or changing access.',
          'Check Notifications for admin events (user changes, integrations).',
        ]
      : [
          'Start on Overview for sentiment and volume at a glance.',
          'Switch the time filter to match the period you care about.',
          'Open Insights for themes, channels, and peak times.',
          'Use Inbox to read messages, archive, and follow up.',
          'Adjust Settings → Notifications and Display to suit your workflow.',
        ],
  }
}
