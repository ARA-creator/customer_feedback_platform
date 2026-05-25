import { useState } from 'react'
import { FiEdit2 } from 'react-icons/fi'
import { authUpdateProfile } from '../../../features/auth/services/auth.api'
import {
  displayNameFromUser,
  formatLastActive,
  formatMemberSince,
  formatUserRole,
  getUserInitialsFromUser,
} from '../../../shared/lib/userDisplay'

export default function AccountInformationCard({ auth }) {
  const [editOpen, setEditOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const email = auth?.email || '—'
  const displayName = displayNameFromUser(auth)
  const initials = getUserInitialsFromUser(auth)
  const roleLabel = formatUserRole(auth?.role)
  const memberSince = formatMemberSince(auth?.created_at)
  const lastActive = formatLastActive(auth?.last_login_at)

  const openEdit = () => {
    setNameDraft(auth?.full_name || displayNameFromUser(auth))
    setError(null)
    setEditOpen(true)
  }

  const saveProfile = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await authUpdateProfile({ full_name: nameDraft.trim() || null })
      setEditOpen(false)
      try {
        window.dispatchEvent(new CustomEvent('cfp-auth-updated', { detail: { user: res?.user } }))
      } catch {
        // ignore
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="card p-6 sm:p-8">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Account information</h2>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="relative shrink-0 self-start">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full bg-[#10B981] text-2xl font-bold text-white shadow-sm"
              aria-hidden
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={openEdit}
              className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white text-[#10B981] shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/40 dark:border-gray-950 dark:bg-gray-900 dark:hover:bg-gray-800"
              aria-label="Edit profile photo or name"
              title="Edit profile"
            >
              <FiEdit2 className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{displayName}</h3>
              <span className="inline-flex rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                {roleLabel}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 break-all">{email}</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{roleLabel}</p>
            {memberSince ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Member since {memberSince}</p>
            ) : null}
            <p className="text-sm text-gray-400 dark:text-gray-500">Last active {lastActive}</p>
          </div>
        </div>

        <div className="mt-8 flex justify-center sm:justify-start">
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
          >
            Edit profile
          </button>
        </div>
      </div>

      {editOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
          onClick={() => !saving && setEditOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-profile-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Edit profile
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Update how your name appears across the app. Email and role are managed by your administrator.
            </p>
            <label className="mt-4 block text-xs font-semibold text-gray-700 dark:text-gray-300" htmlFor="profile-name">
              Full name
            </label>
            <input
              id="profile-name"
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={160}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#009750]/35 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            {error ? (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-400" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditOpen(false)}
                className="inline-flex min-h-[40px] items-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveProfile}
                className="inline-flex min-h-[40px] items-center rounded-xl bg-[#009750] px-4 text-sm font-semibold text-white hover:bg-[#007a42] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
