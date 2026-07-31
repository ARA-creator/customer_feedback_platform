import { Link } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import { buildHelpGuide } from './helpGuide'
import { HELP_RESOURCES } from './settingsConfig'

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
    <div className="space-y-5">
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Resources</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Links to documentation and support channels configured by your organization.
        </p>
        <ul className="mt-4 space-y-2">
          {HELP_RESOURCES.map((item) => (
            <li key={item.title}>
              {item.to ? (
                <Link
                  to={item.to}
                  className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{item.description}</p>
                  </div>
                  <FiChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                </Link>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2.5 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                  <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{item.description}</p>
                  {item.placeholder && (
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500 italic">
                      URL not configured — ask your administrator.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Quick start</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {guide.isAdmin
            ? 'You are signed in as a platform administrator. Use the sidebar Admin section for operations; Settings is under Account.'
            : 'Use the left sidebar to move between areas. Most day-to-day work flows Overview → Reports (Insights) → Inbox.'}
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
      </div>
    </div>
  )
}
