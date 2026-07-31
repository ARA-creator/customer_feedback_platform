import { Link } from 'react-router-dom'
import { FiZap } from 'react-icons/fi'
import { userIsAdminUI } from '../../../app/routes'

export default function SettingsTipsPanel({ auth }) {
  const isAdmin = userIsAdminUI(auth)

  return (
    <div className="rounded-2xl border border-[#009750]/20 bg-gradient-to-br from-emerald-50/90 to-white p-4 dark:from-emerald-950/30 dark:to-gray-950 dark:border-emerald-500/20">
      <div className="flex items-start gap-2">
        <FiZap className="h-5 w-5 shrink-0 text-[#009750] dark:text-emerald-400" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tips</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {isAdmin
              ? 'Confirm channels are ingesting under Admin → Channels. Set quiet hours under Notifications.'
              : 'Use the same time filter on Overview for all charts. Open Reports → Insights for deeper themes.'}
          </p>
        </div>
      </div>
      <Link
        to={isAdmin ? '/admin/channels' : '/settings/help'}
        className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-lg bg-[#009750] px-3 py-2 text-xs font-semibold text-white hover:bg-[#007a42]"
      >
        {isAdmin ? 'View channels' : 'Open navigation guide'}
      </Link>
    </div>
  )
}
