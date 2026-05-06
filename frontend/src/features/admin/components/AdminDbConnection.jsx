import { useEffect, useMemo, useState } from 'react'
import {
  adminGetDbConfig,
  adminSaveDbConnection,
  adminTestDbConnection,
} from '../services/admin.api'

const DIALECTS = [
  { id: 'mysql', label: 'MySQL' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'sqlite', label: 'SQLite' },
]

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</div>
      {hint ? <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</div> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

export default function AdminDbConnection() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [currentMasked, setCurrentMasked] = useState('')
  const [savedMasked, setSavedMasked] = useState('')

  const [mode, setMode] = useState('params') // params | url

  const [dialect, setDialect] = useState('mysql')
  const [driver, setDriver] = useState('') // optional
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('')
  const [database, setDatabase] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [sqlitePath, setSqlitePath] = useState(':memory:')
  const [url, setUrl] = useState('')

  const payload = useMemo(() => {
    if (mode === 'url') return { url }
    if (dialect === 'sqlite') return { dialect: 'sqlite', path: sqlitePath }
    const base = {
      dialect,
      driver: driver || undefined,
      host,
      port: port === '' ? undefined : Number(port),
      database,
      username,
      password,
    }
    return base
  }, [mode, url, dialect, driver, host, port, database, username, password, sqlitePath])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await adminGetDbConfig()
        if (!mounted) return
        setCurrentMasked(String(res?.current_database_url_masked || ''))
        setSavedMasked(String(res?.saved_database_url_masked || ''))
      } catch (e) {
        if (!mounted) return
        setError(e?.message || 'Failed to load DB configuration')
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
        kind === 'test' ? await adminTestDbConnection(payload) : await adminSaveDbConnection(payload)
      if (res?.ok) {
        const masked = String(res?.database_url_masked || '')
        if (kind === 'save') {
          setSavedMasked(masked)
          setNotice(
            res?.restart_required
              ? 'Saved. Restart the backend server to connect to the new database.'
              : 'Saved.',
          )
        } else {
          setNotice('Connection test succeeded.')
        }
      } else {
        setError(String(res?.error || 'Request failed'))
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Request failed'
      setError(String(msg))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 flex justify-center">
      <div className="w-full max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Database connection</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Test connection parameters before saving. Saving updates <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">DATABASE_URL</code>{' '}
            (restart required).
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/60">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">Current DB (masked)</div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 break-all">
            {loading ? 'Loading…' : currentMasked || '—'}
          </div>
          <div className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">Saved DB (masked)</div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 break-all">
            {loading ? 'Loading…' : savedMasked || '—'}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/60">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">New connection</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('params')}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  mode === 'params'
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-white text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-200 dark:border-gray-800'
                }`}
              >
                Use fields
              </button>
              <button
                type="button"
                onClick={() => setMode('url')}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  mode === 'url'
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                    : 'bg-white text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-200 dark:border-gray-800'
                }`}
              >
                Use URL
              </button>
            </div>
          </div>

          {mode === 'url' ? (
            <div className="mt-4">
              <Field
                label="Database URL"
                hint="Example: mysql+pymysql://user:pass@host:3306/dbname"
              >
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  placeholder="mysql+pymysql://…"
                />
              </Field>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Dialect">
                <select
                  value={dialect}
                  onChange={(e) => setDialect(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                >
                  {DIALECTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>

              {dialect !== 'sqlite' ? (
                <>
                  <Field label="Host">
                    <input
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      placeholder="db.example.com"
                    />
                  </Field>
                  <Field label="Port (optional)">
                    <input
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      placeholder={dialect === 'mysql' ? '3306' : '5432'}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="Database name">
                    <input
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      placeholder="customer_feedback"
                    />
                  </Field>
                  <Field label="Username (optional)">
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      placeholder="dbuser"
                    />
                  </Field>
                  <Field label="Password (optional)">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      placeholder="••••••••"
                      type="password"
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Driver (optional)" hint="Example: pymysql, mysqlconnector, asyncpg, pg8000">
                    <input
                      value={driver}
                      onChange={(e) => setDriver(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      placeholder=""
                    />
                  </Field>
                </>
              ) : (
                <Field
                  label="SQLite path"
                  hint="Use a filename (relative) or absolute path. Use :memory: for in-memory."
                >
                  <input
                    value={sqlitePath}
                    onChange={(e) => setSqlitePath(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                    placeholder=":memory:"
                  />
                </Field>
              )}
            </div>
          )}

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200">
              {notice}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run('test')}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {busy ? 'Working…' : 'Test connection'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run('save')}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              {busy ? 'Working…' : 'Save (restart required)'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

