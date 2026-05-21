import { useEffect, useMemo, useState } from 'react'
import {
  adminGetEnterpriseAuth,
  adminSaveEnterpriseAuth,
  adminTestEnterpriseAuth,
} from '../services/admin.api'

const ROLE_OPTIONS = ['agent', 'team_lead', 'analyst', 'cx_manager', 'super_admin', 'auditor']

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</div>
      {hint ? <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</div> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function emptyMappingRow() {
  return { azure_group: '', role: 'agent' }
}

export default function AdminEnterpriseAuth() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [configured, setConfigured] = useState(false)
  const [source, setSource] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [clearSecret, setClearSecret] = useState(false)
  const [secretConfigured, setSecretConfigured] = useState(false)
  const [secretFromDb, setSecretFromDb] = useState(false)
  const [secretFromEnv, setSecretFromEnv] = useState(false)
  const [domainsText, setDomainsText] = useState('')
  const [defaultRole, setDefaultRole] = useState('agent')
  const [roleMapping, setRoleMapping] = useState([emptyMappingRow()])
  const [loginPath, setLoginPath] = useState('/api/auth/enterprise/login')

  const payload = useMemo(
    () => ({
      enabled,
      tenant_id: tenantId.trim(),
      client_id: clientId.trim(),
      redirect_uri: redirectUri.trim(),
      enterprise_email_domains: domainsText
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
      default_role: defaultRole,
      role_mapping: roleMapping
        .map((row) => ({
          azure_group: String(row.azure_group || '').trim(),
          role: String(row.role || '').trim(),
        }))
        .filter((row) => row.azure_group && row.role),
      ...(clientSecret.trim() ? { client_secret: clientSecret.trim() } : {}),
      ...(clearSecret ? { clear_client_secret: true } : {}),
    }),
    [
      enabled,
      tenantId,
      clientId,
      redirectUri,
      domainsText,
      defaultRole,
      roleMapping,
      clientSecret,
      clearSecret,
    ],
  )

  const applyView = (res) => {
    setConfigured(Boolean(res?.configured))
    setSource(String(res?.source || ''))
    setEnabled(res?.enabled !== false)
    setTenantId(String(res?.tenant_id || ''))
    setClientId(String(res?.client_id || ''))
    setRedirectUri(String(res?.redirect_uri || ''))
    setSecretConfigured(Boolean(res?.client_secret_configured))
    setSecretFromDb(Boolean(res?.client_secret_from_database))
    setSecretFromEnv(Boolean(res?.client_secret_from_environment))
    const domains = Array.isArray(res?.enterprise_email_domains) ? res.enterprise_email_domains : []
    setDomainsText(domains.join(', '))
    setDefaultRole(String(res?.default_role || 'agent'))
    const rows = Array.isArray(res?.role_mapping) ? res.role_mapping : []
    setRoleMapping(rows.length ? rows.map((r) => ({ azure_group: r.azure_group || '', role: r.role || 'agent' })) : [emptyMappingRow()])
    setLoginPath(String(res?.login_path || '/api/auth/enterprise/login'))
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await adminGetEnterpriseAuth()
        if (!mounted) return
        applyView(res)
      } catch (e) {
        if (!mounted) return
        setError(e?.response?.data?.error || e?.message || 'Failed to load enterprise SSO settings')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const run = async (kind) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res =
        kind === 'test'
          ? await adminTestEnterpriseAuth(payload)
          : await adminSaveEnterpriseAuth(payload)
      if (kind === 'save') {
        applyView(res)
        setClientSecret('')
        setClearSecret(false)
        setNotice('Enterprise SSO settings saved.')
      } else if (res?.ok) {
        setNotice(res?.message || 'Connection test succeeded.')
      } else {
        setError(String(res?.error || 'Connection test failed'))
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Request failed'
      setError(String(msg))
    } finally {
      setBusy(false)
    }
  }

  const updateMapping = (index, field, value) => {
    setRoleMapping((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  return (
    <div className="p-6 flex justify-center">
      <div className="w-full max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Enterprise SSO (Azure AD)</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Configure Microsoft Entra ID for the &ldquo;I have an Enterprise email&rdquo; sign-in path. Settings saved here
              override environment variables. Client secrets are encrypted at rest.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              configured
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
            }`}
          >
            {configured ? 'Ready for login' : 'Not fully configured'}
          </span>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : (
          <div className="mt-6 space-y-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
            {source && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Effective config source: <strong>{source}</strong>
                {secretFromDb ? ' · secret in database' : null}
                {secretFromEnv && !secretFromDb ? ' · secret from environment' : null}
              </p>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              Enable enterprise SSO
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tenant ID" hint="Directory (tenant) ID from Azure app registration">
                <input
                  className="input w-full"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  autoComplete="off"
                />
              </Field>
              <Field label="Client ID" hint="Application (client) ID">
                <input
                  className="input w-full"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </div>

            <Field
              label="Redirect URI"
              hint="Must match the URI registered in Entra ID (what Flask receives after any /api rewrite)"
            >
              <input
                className="input w-full font-mono text-sm"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                placeholder="http://127.0.0.1:5000/auth/enterprise/callback"
              />
            </Field>

            <Field
              label="Client secret"
              hint={
                secretConfigured
                  ? 'A secret is already stored. Leave blank to keep it, or enter a new value to replace.'
                  : 'Required for SSO unless only configured via environment variables.'
              }
            >
              <input
                type="password"
                className="input w-full"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={secretConfigured ? '•••••••• (unchanged if empty)' : 'Paste client secret'}
                autoComplete="new-password"
              />
              {secretConfigured && (
                <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={clearSecret}
                    onChange={(e) => setClearSecret(e.target.checked)}
                  />
                  Clear stored secret (falls back to env if set)
                </label>
              )}
            </Field>

            <Field
              label="Enterprise email domains"
              hint="Comma-separated. Users with these domains use SSO; others use external signup."
            >
              <input
                className="input w-full"
                value={domainsText}
                onChange={(e) => setDomainsText(e.target.value)}
                placeholder="enterprisegroup.net.gh, enterprise-life.com"
              />
            </Field>

            <Field label="Default role" hint="When no Azure AD group maps to a Customer Pulse role">
              <select className="input w-full" value={defaultRole} onChange={(e) => setDefaultRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-100">Azure AD group → role mapping</div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Match Azure security group display names to platform roles.
              </p>
              <div className="mt-2 space-y-2">
                {roleMapping.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2">
                    <input
                      className="input min-w-[12rem] flex-1"
                      value={row.azure_group}
                      onChange={(e) => updateMapping(idx, 'azure_group', e.target.value)}
                      placeholder="Azure group display name"
                    />
                    <select
                      className="input w-40"
                      value={row.role}
                      onChange={(e) => updateMapping(idx, 'role', e.target.value)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                      onClick={() => setRoleMapping((rows) => rows.filter((_, i) => i !== idx))}
                      disabled={roleMapping.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs font-medium text-[#009750] hover:underline"
                  onClick={() => setRoleMapping((rows) => [...rows, emptyMappingRow()])}
                >
                  Add mapping row
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Login URL for testing: <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{loginPath}</code>
            </p>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                {notice}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run('test')}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {busy ? 'Working…' : 'Test connection'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run('save')}
                className="rounded-lg bg-[#009750] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
