import {
  FiBell,
  FiHelpCircle,
  FiInbox,
  FiMonitor,
  FiShield,
  FiUser,
} from 'react-icons/fi'
import {
  userCanViewReports,
  userIsAdminUI,
} from '../../app/routes'

export const SETTINGS_TABS = [
  { to: '/settings/account', label: 'Account', icon: FiUser, end: false },
  { to: '/settings/display', label: 'Display', icon: FiMonitor, end: false },
  { to: '/settings/notifications', label: 'Notifications', icon: FiBell, end: false },
  { to: '/settings/inbox', label: 'Inbox', icon: FiInbox, end: false },
  { to: '/settings/security', label: 'Security', icon: FiShield, end: false },
  { to: '/settings/help', label: 'Help', icon: FiHelpCircle, end: true },
]

export const HOW_IT_WORKS_CARDS = [
  {
    title: 'Centralize feedback',
    description: 'Collect feedback from email, WhatsApp, forms, and social channels in one place.',
  },
  {
    title: 'Analyze & prioritize',
    description: 'Use Insights for themes, channels, and peak times to see what matters most.',
  },
  {
    title: 'Collaborate & act',
    description: 'Triage in the Inbox, archive items, and open Customer 360 when available.',
  },
  {
    title: 'Close the loop',
    description: 'Stay on top of alerts and reply approvals so customers get timely follow-up.',
  },
]

/** @param {object} auth */
export function buildQuickActions(auth) {
  const isAdmin = userIsAdminUI(auth)
  const perms = Array.isArray(auth?.permissions) ? auth.permissions : []
  const isSuperAdmin = String(auth?.role || '').toLowerCase() === 'super_admin'
  const canIntegrations = perms.includes('admin.manage_integrations') || isSuperAdmin
  const canUsers = perms.includes('admin.manage_users') || isSuperAdmin
  const canRoles = perms.includes('admin.manage_roles')
  const canReports = userCanViewReports(auth)

  const actions = []

  if (canUsers) {
    actions.push({
      to: '/admin/users',
      title: 'Invite & manage users',
      description: 'Approve signups, assign roles, and manage access.',
    })
  }
  if (canRoles) {
    actions.push({
      to: '/admin/roles',
      title: 'Roles & permissions',
      description: 'Configure what each role can do in the platform.',
    })
  }
  if (canReports) {
    actions.push({
      to: '/reports',
      title: 'Export your data',
      description: 'Custom exports and scheduled report definitions.',
    })
  } else if (!isAdmin) {
    actions.push({
      to: '/',
      title: 'Export overview data',
      description: 'Download a CSV summary from the Overview time filter row.',
    })
  }
  if (canIntegrations) {
    actions.push({
      to: '/admin/channels',
      title: 'Channels & webhooks',
      description: 'Connection status and setup for ingest channels.',
    })
  }

  actions.push({
    to: '/settings/display',
    title: 'Display preferences',
    description: 'Theme, defaults, and notification sounds.',
  })

  return actions
}

export const HELP_RESOURCES = [
  {
    title: 'Navigate the platform',
    description: 'Overview, Inbox, Insights, and admin areas with direct links.',
    to: '/settings/help',
    external: false,
  },
  {
    title: 'Documentation',
    description: 'Product guides and setup notes (add your org URL in deployment config).',
    href: null,
    external: true,
    placeholder: true,
  },
  {
    title: 'Contact support',
    description: 'Reach your platform administrator or IT team for access and channel issues.',
    href: null,
    external: true,
    placeholder: true,
  },
]

export const INTEGRATION_CHANNEL_ROWS = [
  { id: 'email', label: 'Email', statusPath: 'email' },
  { id: 'whatsapp', label: 'WhatsApp', statusPath: 'whatsapp_twilio' },
  { id: 'google_forms', label: 'Google Forms', statusPath: 'google_forms' },
  { id: 'meta', label: 'Instagram / Facebook', statusPath: 'meta' },
  { id: 'x', label: 'X (Twitter)', statusPath: 'x' },
  { id: 'tiktok', label: 'TikTok', statusPath: 'tiktok' },
]
