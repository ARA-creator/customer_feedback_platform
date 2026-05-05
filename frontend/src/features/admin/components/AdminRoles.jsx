import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiCheck, FiEdit2, FiKey, FiRefreshCw, FiSlash, FiX } from 'react-icons/fi'
import { adminListPermissions, adminListRoles, adminSetRolePermissions } from '../services/admin.api'

export default function AdminRoles() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [editingRoleId, setEditingRoleId] = useState(null)
  /** @type {Record<number, string[]>} maps role id -> selected permission keys */
  const [draftByRole, setDraftByRole] = useState({})

  const permissionCount = useMemo(() => permissions.length, [permissions])
  const sortedPerms = useMemo(
    () => [...permissions].sort((a, b) => String(a.key).localeCompare(String(b.key))),
    [permissions]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [r, p] = await Promise.all([adminListRoles(), adminListPermissions()])
      setRoles(r?.roles || [])
      setPermissions(p?.permissions || [])
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startEdit = (role) => {
    setEditingRoleId(role.id)
    setDraftByRole((d) => ({
      ...d,
      [role.id]: [...(role.permission_keys || [])].sort(),
    }))
  }

  const cancelEdit = () => {
    setEditingRoleId(null)
  }

  const setDraftKeys = (roleId, keys) => {
    const uniq = Array.from(new Set(keys.map((k) => String(k).trim().toLowerCase()).filter(Boolean))).sort()
    setDraftByRole((d) => ({ ...d, [roleId]: uniq }))
  }

  const togglePermission = (roleId, key, checked) => {
    const k = String(key).toLowerCase()
    const cur = new Set(draftByRole[roleId] || [])
    if (checked) cur.add(k)
    else cur.delete(k)
    setDraftKeys(roleId, Array.from(cur))
  }

  const selectAllForRole = (roleId) => {
    setDraftKeys(
      roleId,
      sortedPerms.map((p) => p.key)
    )
  }

  const clearAllForRole = (roleId) => {
    setDraftKeys(roleId, [])
  }

  const saveRole = async (roleId) => {
    setSaving(true)
    setError(null)
    try {
      await adminSetRolePermissions(roleId, { permission_keys: draftByRole[roleId] || [] })
      setEditingRoleId(null)
      await load()
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to save permissions'
      const unknown = e?.response?.data?.unknown
      setError(unknown && Array.isArray(unknown) ? `${msg}: ${unknown.join(', ')}` : msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
            <FiKey className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Roles & permissions</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Edit which permissions each role grants. Changes apply to all users with that role.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
              {permissionCount} permissions
            </span>
            <button
              type="button"
              onClick={load}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <div className="mt-6 space-y-4">
            {roles.map((r) => {
              const isEditing = editingRoleId === r.id
              const selected = new Set((isEditing ? draftByRole[r.id] : r.permission_keys) || [])
              return (
                <div key={r.id} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{r.description || '—'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {isEditing ? `${selected.size} selected` : `${(r.permission_keys || []).length} permissions`}
                      </span>
                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                          title="Edit permissions"
                          aria-label="Edit permissions"
                        >
                          <FiEdit2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => selectAllForRole(r.id)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <FiCheck className="h-3.5 w-3.5" />
                            All
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => clearAllForRole(r.id)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <FiSlash className="h-3.5 w-3.5" />
                            None
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => saveRole(r.id)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[#009750] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#007a42] disabled:opacity-60"
                          >
                            <FiCheck className="h-3.5 w-3.5" />
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={cancelEdit}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <FiX className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 max-h-[min(24rem,55vh)] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                      <ul className="space-y-2">
                        {sortedPerms.map((p) => {
                          const on = selected.has(String(p.key).toLowerCase())
                          return (
                            <li key={p.id}>
                              <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-white dark:hover:bg-gray-950">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#009750] focus:ring-[#009750]"
                                  checked={on}
                                  onChange={(e) => togglePermission(r.id, p.key, e.target.checked)}
                                />
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100">{p.key}</span>
                                  {p.description && (
                                    <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">{p.description}</span>
                                  )}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(r.permission_keys || []).slice(0, 24).map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                          {k}
                        </span>
                      ))}
                      {(r.permission_keys || []).length > 24 && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                          +{(r.permission_keys || []).length - 24} more
                        </span>
                      )}
                      {(r.permission_keys || []).length === 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">No permissions — click Edit to assign.</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {roles.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
                No roles found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
