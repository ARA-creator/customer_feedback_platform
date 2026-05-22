import { Link } from 'react-router-dom'
import { FiChevronRight, FiExternalLink } from 'react-icons/fi'
import SettingsSubpageShell from '../../shared/components/settings/SettingsSubpageShell'
import { buildHelpGuide } from './helpGuide'

const APP_VERSION = '1.0.0'

function GuideLink({ to, title, description }) {
  return (
    <Link
      to={to}
      className="group flex gap-3 rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-[#009750]/40 hover:bg-[#009750]/[0.04] dark:border-gray-800 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-950/20"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-[#007a42] dark:group-hover:text-emerald-200">
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{description}</p>
      </div>
      <FiChevronRight
        className="mt-0.5 h-5 w-5 shrink-0 text-gray-400 group-hover:text-[#009750] dark:group-hover:text-emerald-400"
        aria-hidden
      />
    </Link>
  )
}

function GuideSection({ title, intro, children }) {
  return (
    <section className="card p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {intro ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{intro}</p> : null}
      <div className={`space-y-3 ${intro ? 'mt-4' : 'mt-0'}`}>{children}</div>
    </section>
  )
}

export default function SettingsHelpPage({ auth }) {
  const guide = buildHelpGuide(auth)

  return (
    <SettingsSubpageShell
      title="Help & about"
      description="How to move around Customer Pulse and where to find each area."
    >
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Quick start</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {guide.isAdmin
            ? 'You are signed in as a platform administrator. Use the sidebar Admin section for operations; Settings is under Account.'
            : 'Use the left sidebar to move between areas. Most day-to-day work flows Overview → Insights → Inbox.'}
        </p>
        <ol className="mt-4 space-y-2 list-decimal list-inside text-sm text-gray-700 dark:text-gray-300">
          {guide.workflowSteps.map((step) => (
            <li key={step} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
      </div>

      {guide.agentSections.length > 0 && (
        <GuideSection
          title="Dashboard & feedback"
          intro="Core screens for monitoring and responding to customer feedback."
        >
          {guide.agentSections.map((item) => (
            <GuideLink key={item.to} {...item} />
          ))}
        </GuideSection>
      )}

      {guide.adminSections.length > 0 && (
        <GuideSection
          title="Administration"
          intro="Manage users, channels, integrations, and platform configuration. Items shown depend on your permissions."
        >
          {guide.adminSections.map((item) => (
            <GuideLink key={item.to} {...item} />
          ))}
        </GuideSection>
      )}

      <GuideSection title="Settings" intro="Personalize alerts, appearance, and inbox behavior.">
        {guide.settingsLinks.map((item) => (
          <GuideLink key={item.to} {...item} />
        ))}
      </GuideSection>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Tips</h2>
        <ul className="mt-4 space-y-4">
          {guide.tips.map((tip) => (
            <li key={tip.title}>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tip.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{tip.body}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">About</h2>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium text-gray-900 dark:text-gray-100">Customer Pulse</span>
            {' · '}
            Version {APP_VERSION}
            {' · '}
            Enterprise Life
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Support
          </p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            For access, channel setup, or data issues, contact your platform administrator or IT team.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Privacy
          </p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Feedback may contain personal data. Handle exports and shared reports according to your
            organization&apos;s policy.
          </p>
        </div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#009750] hover:text-[#007a42] dark:text-emerald-400"
        >
          Back to all settings
          <FiExternalLink className="h-3.5 w-3.5 rotate-[-45deg]" aria-hidden />
        </Link>
      </div>
    </SettingsSubpageShell>
  )
}
