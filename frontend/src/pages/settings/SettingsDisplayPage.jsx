import { userIsAdminUI } from '../../app/routes'
import SettingsDisplaySection from './SettingsDisplaySection'
import SettingsSubpageShell from '../../shared/components/settings/SettingsSubpageShell'

export default function SettingsDisplayPage({ auth }) {
  const isAdminUser = userIsAdminUI(auth)

  return (
    <SettingsSubpageShell
      title="Display"
      description="Appearance and layout preferences for this device."
    >
      <SettingsDisplaySection isAdminUser={isAdminUser} />
    </SettingsSubpageShell>
  )
}
