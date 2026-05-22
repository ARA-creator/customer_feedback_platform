import { userIsAdminUI } from '../../app/routes'
import SettingsDisplaySection from './SettingsDisplaySection'

export default function SettingsDisplayPage({ auth }) {
  return <SettingsDisplaySection isAdminUser={userIsAdminUI(auth)} />
}
