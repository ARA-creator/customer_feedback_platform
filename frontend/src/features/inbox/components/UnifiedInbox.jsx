import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiAlertTriangle,
  FiChevronDown,
  FiChevronRight,
  FiGlobe,
  FiImage,
  FiInbox,
  FiLink2,
  FiLoader,
  FiMessageSquare,
  FiMic,
  FiRefreshCw,
  FiSliders,
  FiUser,
  FiVideo,
  FiX,
} from 'react-icons/fi'
import {
  FaEnvelope,
  FaFacebook,
  FaGoogle,
  FaInstagram,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
} from 'react-icons/fa6'
import {
  approveReplyDraft,
  createFeedbackNote,
  createMicroSurvey,
  createReplyDraft,
  generateReplyDraft,
  getCustomerProfile,
  getFeedbackFeed,
  getFeedbackWorkflow,
  getSourceCounts,
  listTeams,
  listAssignableUsers,
  listFeedbackNotes,
  listReplyDrafts,
  markReplySeen,
  rephraseReplyDraft,
  resolveFeedback,
  sendReplyDraft,
  updateFeedbackWorkflow,
} from '../services/inbox.api'

const SOURCE_ORDER = ['all', 'email', 'web', 'google_forms', 'whatsapp', 'x', 'tiktok', 'instagram', 'facebook']

function formatRelativeTime(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function normalizeSourceGroup(value) {
  const s = String(value || '').toLowerCase()
  if (!s) return ''
  if (s === 'email' || s.includes('mail')) return 'email'
  if (s === 'web' || s.startsWith('web_') || s.startsWith('web-') || s.includes('webform')) return 'web'
  if (s.includes('whatsapp')) return 'whatsapp'
  if (s === 'x' || s.includes('x_') || s.includes('x-') || s.includes('x ')) return 'x'
  if (s.includes('tiktok')) return 'tiktok'
  if (s.includes('instagram')) return 'instagram'
  if (s.includes('facebook')) return 'facebook'
  if (s.includes('google')) return 'google_forms'
  return s
}

function SourceLogo({ source }) {
  const s = normalizeSourceGroup(source)
  const className = 'h-4 w-4'
  if (s === 'whatsapp') return <FaWhatsapp className={className} style={{ color: '#25D366' }} />
  if (s === 'instagram') return <FaInstagram className={className} style={{ color: '#E1306C' }} />
  if (s === 'facebook') return <FaFacebook className={className} style={{ color: '#1877F2' }} />
  if (s === 'tiktok') return <FaTiktok className={className} style={{ color: '#00F2EA' }} />
  if (s === 'google_forms') return <FaGoogle className={className} style={{ color: '#4285F4' }} />
  if (s === 'email') return <FaEnvelope className={className} style={{ color: '#6B7280' }} />
  if (s === 'x') return <FaXTwitter className={className} style={{ color: '#111827' }} />
  return <FiGlobe className={className} />
}

function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#009750]/10 text-[#009750] dark:bg-emerald-500/10 dark:text-emerald-300">
        <FiInbox className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">No feedback found</h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Try widening the date range or clearing a few filters.
      </p>
    </div>
  )
}

function MediaStrip({ media, expanded = false }) {
  if (!Array.isArray(media) || media.length === 0) return null
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {media.slice(0, expanded ? 8 : 4).map((item, idx) => {
        const type = String(item?.type || 'file').toLowerCase()
        const url = item?.url
        if (!url) return null
        const icon =
          type === 'image' ? <FiImage className="h-4 w-4" /> : type === 'video' ? <FiVideo className="h-4 w-4" /> : type === 'audio' ? <FiMic className="h-4 w-4" /> : <FiLink2 className="h-4 w-4" />
        if (type === 'image') {
          return (
            <a
              key={`${url}-${idx}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            >
              <img src={item.thumb_url || url} alt={item.caption || 'Feedback media'} className="h-40 w-full object-cover" />
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                {icon}
                <span>{item.caption || 'Image preview'}</span>
              </div>
            </a>
          )
        }
        if (type === 'video') {
          return (
            <div key={`${url}-${idx}`} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <video controls className="h-40 w-full rounded-lg bg-black">
                <source src={url} type={item.mime_type || 'video/mp4'} />
              </video>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                {icon}
                <span>{item.caption || 'Video preview'}</span>
              </div>
            </div>
          )
        }
        if (type === 'audio') {
          return (
            <div key={`${url}-${idx}`} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <audio controls className="w-full">
                <source src={url} type={item.mime_type || 'audio/mpeg'} />
              </audio>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                {icon}
                <span>{item.caption || 'Audio preview'}</span>
              </div>
            </div>
          )
        }
        return (
          <a
            key={`${url}-${idx}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-h-[96px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {icon}
            <span className="capitalize">{item.caption || type}</span>
          </a>
        )
      })}
    </div>
  )
}

function FeedbackCard({ item, onOpen, onOpenCustomer }) {
  const meta = item.channel_metadata || {}
  const media = meta.media || []
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.sentiment_label === 'negative' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : item.sentiment_label === 'positive' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
              {item.sentiment_label || 'unknown'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
              <SourceLogo source={item.source_group || item.source} />
              {item.source_group || item.source || 'source'}
            </span>
            {item.category && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                {item.category}
              </span>
            )}
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Impact {item.impact_score ?? item.priority ?? 0}
            </span>
          </div>
          <p className="mt-3 line-clamp-3 text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">
            {item.message || item.message_preview || 'No message'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>{item.customer_label || item.customer_id || 'Unknown customer'}</span>
            <span>{item.created_at ? formatRelativeTime(item.created_at) : ''}</span>
            {meta.location && <span>{meta.location}</span>}
            {meta.language && <span>{String(meta.language).toUpperCase()}</span>}
            {meta.campaign && <span>Campaign: {meta.campaign}</span>}
          </div>
          <MediaStrip media={media} />
        </div>
        <div className="shrink-0">
          {item.customer_key && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenCustomer(item)
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FiUser className="h-4 w-4" />
              Customer 360
            </button>
          )}
        </div>
      </div>
    </button>
  )
}

function DetailDrawer({
  item,
  customerProfile,
  customerLoading,
  workflow,
  notes,
  replyDrafts,
  workflowBusy,
  draftTone,
  setDraftTone,
  brandVoice,
  setBrandVoice,
  draftVisibility,
  setDraftVisibility,
  manualReply,
  setManualReply,
  composerStatus,
  internalNote,
  setInternalNote,
  onClose,
  onOpenCustomer,
  onAskGeminiDraft,
  onRedoDraft,
  onRephraseReply,
  onSaveDraft,
  onSaveNote,
  onUpdateWorkflow,
  onApproveDraft,
  onSendDraft,
  onResolve,
  onMarkSeen,
  onCreateSurvey,
  canAssign,
  teams,
  assignableUsers,
}) {
  if (!item) return null
  const meta = item.channel_metadata || {}
  return (
    <div className="fixed inset-0 z-40 bg-black/40">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-950">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Feedback details</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">ID #{item.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Impact {item.impact_score ?? item.priority ?? 0}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {item.source_group || item.source}
              </span>
              {item.category && (
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {item.category}
                </span>
              )}
              {item.priority_reason_summary && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {item.priority_reason_summary}
                </span>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-200">
              {item.message || item.message_preview || 'No message'}
            </p>
            <MediaStrip media={meta.media} expanded />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Metadata</h3>
              <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                <p><span className="font-medium text-gray-800 dark:text-gray-200">Customer:</span> {item.customer_label || item.customer_id || 'Unknown'}</p>
                <p><span className="font-medium text-gray-800 dark:text-gray-200">Created:</span> {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</p>
                <p><span className="font-medium text-gray-800 dark:text-gray-200">Priority:</span> {item.priority ?? '—'}</p>
                <p><span className="font-medium text-gray-800 dark:text-gray-200">Sentiment score:</span> {item.sentiment_score ?? '—'}</p>
                {meta.location && <p><span className="font-medium text-gray-800 dark:text-gray-200">Location:</span> {meta.location}</p>}
                {meta.language && <p><span className="font-medium text-gray-800 dark:text-gray-200">Language:</span> {meta.language}</p>}
                {meta.campaign && <p><span className="font-medium text-gray-800 dark:text-gray-200">Campaign:</span> {meta.campaign}</p>}
                {item.impact_factors && (
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">Impact factors</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(item.impact_factors).map(([key, value]) => (
                        <span key={key} className="rounded-full bg-white px-2.5 py-1 text-[11px] dark:bg-gray-950">
                          {key.replace(/_/g, ' ')}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Customer 360</h3>
                {item.customer_key && (
                  <button
                    type="button"
                    onClick={() => onOpenCustomer(item)}
                    className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Refresh
                  </button>
                )}
              </div>
              {customerLoading ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <FiLoader className="h-4 w-4 animate-spin" />
                  Loading profile…
                </div>
              ) : customerProfile?.customer ? (
                <div className="mt-3 space-y-3 text-xs text-gray-600 dark:text-gray-400">
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Name:</span> {customerProfile.customer.label}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Total feedback:</span> {customerProfile.customer.total_feedback}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Customer tier:</span> {customerProfile.customer.customer_tier || '—'}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Lifecycle stage:</span> {customerProfile.customer.lifecycle_stage || '—'}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Company:</span> {customerProfile.customer.company || '—'}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">First seen:</span> {customerProfile.customer.first_seen_at ? new Date(customerProfile.customer.first_seen_at).toLocaleString() : '—'}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Last seen:</span> {customerProfile.customer.last_seen_at ? new Date(customerProfile.customer.last_seen_at).toLocaleString() : '—'}</p>
                  {!!customerProfile.identifiers?.length && (
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200">Linked identifiers</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {customerProfile.identifiers.map((ident) => (
                          <span key={`${ident.identifier_type}-${ident.identifier_value}`} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] dark:bg-gray-800">
                            {ident.identifier_type}: {ident.label || ident.identifier_value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">Source mix</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(customerProfile.customer.source_counts || {}).map(([key, value]) => (
                        <span key={key} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] dark:bg-gray-800">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No customer profile available.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Purchases</h3>
              {customerProfile?.purchases?.length ? (
                <div className="mt-3 space-y-3">
                  {customerProfile.purchases.slice(0, 5).map((purchase) => (
                    <div key={purchase.id} className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{purchase.product_name}</p>
                      <p>{purchase.product_line || 'Product line not set'}</p>
                      <p>{purchase.amount != null ? `${purchase.currency || 'GHS'} ${purchase.amount}` : 'Amount not set'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No purchases linked.</p>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Support tickets</h3>
              {customerProfile?.tickets?.length ? (
                <div className="mt-3 space-y-3">
                  {customerProfile.tickets.slice(0, 5).map((ticket) => (
                    <div key={ticket.id} className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{ticket.subject}</p>
                      <p>{ticket.status} · {ticket.priority}</p>
                      <p>{ticket.summary || 'No summary'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No support tickets linked.</p>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Demographics</h3>
              {customerProfile?.demographics ? (
                <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Age range:</span> {customerProfile.demographics.age_range || '—'}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Gender:</span> {customerProfile.demographics.gender || '—'}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Location:</span> {customerProfile.demographics.location || '—'}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Language:</span> {customerProfile.demographics.language || '—'}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Segment:</span> {customerProfile.demographics.segment || '—'}</p>
                  <p><span className="font-medium text-gray-800 dark:text-gray-200">Occupation:</span> {customerProfile.demographics.occupation || '—'}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No demographics linked.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Workflow & SLA</h3>
                {workflowBusy && <span className="text-xs text-gray-500 dark:text-gray-400">Saving…</span>}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {canAssign ? (
                  <div>
                    <input
                      list="cfp-team-options"
                      value={workflow?.assigned_team || ''}
                      onChange={(e) => onUpdateWorkflow({ assigned_team: e.target.value })}
                      placeholder="Assign team (type to search)"
                      className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                    <datalist id="cfp-team-options">
                      {(teams || []).map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                ) : (
                  <input
                    value={workflow?.assigned_team || ''}
                    readOnly
                    placeholder="Assigned team"
                    className="min-h-[44px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  />
                )}
                {canAssign ? (
                  <select
                    value={workflow?.assigned_user_id ?? ''}
                    onChange={(e) => onUpdateWorkflow({ assigned_user_id: e.target.value ? Number(e.target.value) : null })}
                    className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="">Unassigned</option>
                    {(assignableUsers || []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label || u.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={workflow?.assigned_user_id ? `User #${workflow.assigned_user_id}` : ''}
                    readOnly
                    placeholder="Assigned user"
                    className="min-h-[44px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  />
                )}
                <select
                  value={workflow?.status || 'Open'}
                  onChange={(e) => onUpdateWorkflow({ status: e.target.value })}
                  className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option>Open</option>
                  <option>Investigating</option>
                  <option>Fixed</option>
                  <option>Closed</option>
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">Approval: {workflow?.approval_status || 'not_requested'}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">SLA: {workflow?.sla_due_at ? new Date(workflow.sla_due_at).toLocaleString() : 'Not set'}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">Seen: {workflow?.customer_seen_status || 'unknown'}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => onUpdateWorkflow({ escalate: true })} className="inline-flex min-h-[40px] items-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700">Escalate</button>
                <button type="button" onClick={onResolve} className="inline-flex min-h-[40px] items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700">Resolve + follow up</button>
                <button type="button" onClick={onMarkSeen} className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">Mark seen</button>
                <button type="button" onClick={onCreateSurvey} className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">Send micro-survey</button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Internal notes & collaboration</h3>
              <textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Add an internal note. Use @name for mentions."
                className="mt-3 min-h-[96px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={onSaveNote} className="inline-flex min-h-[40px] items-center rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black dark:bg-gray-100 dark:text-gray-900">Save note</button>
              </div>
              <div className="mt-4 space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                    <p className="whitespace-pre-wrap">{note.body}</p>
                    <p className="mt-1 text-[11px] text-gray-400">{note.created_at ? new Date(note.created_at).toLocaleString() : ''}</p>
                  </div>
                ))}
                {notes.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No internal notes yet.</p>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Omnichannel response composer</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onAskGeminiDraft} className="inline-flex min-h-[40px] items-center rounded-lg bg-[#009750] px-3 py-2 text-xs font-medium text-white hover:bg-[#007a42]">Draft with Gemini</button>
                <button type="button" onClick={onRedoDraft} className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">Redo</button>
                <button type="button" onClick={onRephraseReply} className="inline-flex min-h-[40px] items-center rounded-lg border border-[#009750] bg-white px-3 py-2 text-xs font-medium text-[#009750] hover:bg-emerald-50 dark:border-emerald-600 dark:bg-gray-950 dark:text-emerald-300 dark:hover:bg-emerald-950/30">Rephrase with Gemini</button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select value={draftTone} onChange={(e) => setDraftTone(e.target.value)} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                <option value="empathetic">Empathetic</option>
                <option value="professional">Professional</option>
                <option value="firm">Firm</option>
                <option value="warm">Warm</option>
              </select>
              <input value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} placeholder="Brand voice guidelines" className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
              <label className="inline-flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                <span className="text-sm">Public reply</span>
                <input
                  type="checkbox"
                  checked={draftVisibility === 'public'}
                  onChange={(e) => setDraftVisibility(e.target.checked ? 'public' : 'private')}
                  className="h-4 w-4"
                />
              </label>
            </div>
            {draftVisibility === 'public' && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Public replies require approval. After saving, check <span className="font-semibold">Admin → Approval queue</span>.
              </div>
            )}
            {composerStatus && (
              <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${composerStatus.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : composerStatus.type === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300' : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'}`}>
                {composerStatus.message}
              </div>
            )}
            <textarea value={manualReply} onChange={(e) => setManualReply(e.target.value)} placeholder="Primary reply" className="mt-3 min-h-[120px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onSaveDraft} className="inline-flex min-h-[40px] items-center rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black dark:bg-gray-100 dark:text-gray-900">Save draft</button>
            </div>
            <div className="mt-4 space-y-3">
              {replyDrafts.map((draft) => (
                <div key={draft.id} className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 dark:bg-gray-950">{draft.channel}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 dark:bg-gray-950">{draft.approval_status}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 dark:bg-gray-950">{draft.send_status}</span>
                      {draft.ai_generated && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{draft.model_name || 'AI draft'}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onApproveDraft(draft.id)} className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">Approve</button>
                      <button type="button" onClick={() => onSendDraft(draft.id)} className="inline-flex min-h-[36px] items-center rounded-lg bg-[#009750] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#007a42]">Queue internal send</button>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap">{draft.body}</p>
                </div>
              ))}
              {replyDrafts.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No reply drafts yet.</p>}
            </div>
          </div>

          {customerProfile?.history?.length > 0 && (
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent history</h3>
              <div className="mt-3 space-y-3">
                {customerProfile.history.slice(0, 6).map((historyItem) => (
                  <div key={historyItem.id} className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{historyItem.source_group || historyItem.source}</span>
                      <span>{formatRelativeTime(historyItem.created_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2">{historyItem.message_preview || historyItem.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getDateParams(dateRange, customDateFrom, customDateTo) {
  if (dateRange === 'custom') {
    return { date_from: customDateFrom || undefined, date_to: customDateTo || undefined }
  }
  if (dateRange === '7d' || dateRange === '30d') {
    const days = dateRange === '7d' ? 7 : 30
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return { date_from: from.toISOString(), date_to: undefined }
  }
  return { date_from: undefined, date_to: undefined }
}

function groupFeedItems(items, groupBy) {
  if (groupBy === 'none') {
    return [{ key: 'all', label: 'All feedback', items }]
  }
  const groups = new Map()
  items.forEach((item) => {
    const meta = item.channel_metadata || {}
    let key = item.id
    let label = 'Ungrouped'
    if (groupBy === 'customer') {
      key = item.customer_key || `feedback:${item.id}`
      label = item.customer_label || item.customer_id || 'Unknown customer'
    } else if (groupBy === 'campaign') {
      key = meta.campaign || 'No campaign'
      label = meta.campaign || 'No campaign'
    } else if (groupBy === 'topic') {
      key = item.category || 'Uncategorized'
      label = item.category || 'Uncategorized'
    }
    const existing = groups.get(key) || { key, label, items: [] }
    existing.items.push(item)
    groups.set(key, existing)
  })
  return Array.from(groups.values())
}

export default function UnifiedInbox({ permissions = [] }) {
  const [feedItems, setFeedItems] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [sourceCounts, setSourceCounts] = useState({ all: 0 })

  const [searchQuery, setSearchQuery] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [customerTierFilter, setCustomerTierFilter] = useState('')
  const [groupBy, setGroupBy] = useState('none')
  const [queueMode, setQueueMode] = useState('chronological')
  const [collapsedGroups, setCollapsedGroups] = useState({})

  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [customerProfile, setCustomerProfile] = useState(null)
  const [customerLoading, setCustomerLoading] = useState(false)
  const [workflow, setWorkflow] = useState(null)
  const [notes, setNotes] = useState([])
  const [replyDrafts, setReplyDrafts] = useState([])
  const [workflowBusy, setWorkflowBusy] = useState(false)
  const [draftTone, setDraftTone] = useState('empathetic')
  const [brandVoice, setBrandVoice] = useState('professional, calm, reassuring')
  const [draftVisibility, setDraftVisibility] = useState('private') // private | public
  const [manualReply, setManualReply] = useState('')
  const [composerStatus, setComposerStatus] = useState(null)
  const [internalNote, setInternalNote] = useState('')

  const [teams, setTeams] = useState([])
  const [assignableUsers, setAssignableUsers] = useState([])
  const canAssign = useMemo(() => (Array.isArray(permissions) ? permissions : []).includes('feedback.assign'), [permissions])

  const sentinelRef = useRef(null)

  const { date_from, date_to } = useMemo(
    () => getDateParams(dateRange, customDateFrom, customDateTo),
    [dateRange, customDateFrom, customDateTo]
  )

  const serverParams = useMemo(
    () => ({
      q: searchQuery || undefined,
      sentiment: sentimentFilter,
      source: sourceFilter,
      category: categoryFilter,
      priority: priorityFilter,
      date_from,
      date_to,
      location: locationFilter || undefined,
      campaign: campaignFilter || undefined,
      language: languageFilter || undefined,
      customer_tier: customerTierFilter || undefined,
      sort: queueMode === 'priority' ? 'impact' : 'chronological',
      limit: 40,
    }),
    [searchQuery, sentimentFilter, sourceFilter, categoryFilter, priorityFilter, date_from, date_to, locationFilter, campaignFilter, languageFilter, customerTierFilter, queueMode]
  )

  const loadFeed = async ({ reset = false, cursor = null } = {}) => {
    try {
      if (reset) {
        setLoadingInitial(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }
      const payload = await getFeedbackFeed({
        ...serverParams,
        cursor_created_at: cursor?.cursor_created_at,
        cursor_id: cursor?.cursor_id,
      })
      const items = payload?.items || []
      setFeedItems((prev) => {
        const map = new Map((reset ? [] : prev).map((item) => [item.id, item]))
        items.forEach((item) => map.set(item.id, item))
        return Array.from(map.values())
      })
      setNextCursor(payload?.next_cursor || null)
      setHasMore(Boolean(payload?.has_more))
    } catch (err) {
      console.error('Failed to load unified feed', err)
      setError(err?.response?.data?.error || 'Failed to load inbox')
    } finally {
      setLoadingInitial(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setFeedItems([])
    setNextCursor(null)
    setHasMore(true)
    loadFeed({ reset: true, cursor: null })
  }, [serverParams])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getSourceCounts({
          q: searchQuery || undefined,
          sentiment: sentimentFilter,
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          priority: priorityFilter,
          date_from,
          date_to,
          location: locationFilter || undefined,
          campaign: campaignFilter || undefined,
          language: languageFilter || undefined,
          customer_tier: customerTierFilter || undefined,
        })
        if (cancelled) return
        setSourceCounts({ all: data?.total || 0, ...(data?.raw || {}), ...(data?.grouped || {}) })
      } catch {
        if (!cancelled) setSourceCounts({ all: feedItems.length })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchQuery, sentimentFilter, categoryFilter, priorityFilter, date_from, date_to, locationFilter, campaignFilter, languageFilter, customerTierFilter])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || queueMode === 'priority') return undefined
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0]
      if (first?.isIntersecting && !loadingMore && nextCursor) {
        loadFeed({ reset: false, cursor: nextCursor })
      }
    }, { rootMargin: '400px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [nextCursor, hasMore, loadingMore, queueMode])

  const filteredBySearch = useMemo(() => feedItems, [feedItems])

  const categoryOptions = useMemo(() => Array.from(new Set(feedItems.map((item) => item.category).filter(Boolean))).sort(), [feedItems])
  const groupedItems = useMemo(() => groupFeedItems(filteredBySearch, groupBy), [filteredBySearch, groupBy])

  const openCustomerProfile = async (item) => {
    setSelectedFeedback(item)
    if (!item?.customer_key) return
    setCustomerLoading(true)
    try {
      const data = await getCustomerProfile(item.customer_key)
      setCustomerProfile(data)
    } catch (err) {
      console.error('Failed to fetch customer profile', err)
      setCustomerProfile(null)
    } finally {
      setCustomerLoading(false)
    }
  }

  const openDetails = async (item) => {
    setSelectedFeedback(item)
    if (item?.customer_key) {
      await openCustomerProfile(item)
    } else {
      setCustomerProfile(null)
    }
  }

  useEffect(() => {
    if (!selectedFeedback?.id) {
      setWorkflow(null)
      setNotes([])
      setReplyDrafts([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [workflowData, notesData, draftsData] = await Promise.all([
          getFeedbackWorkflow(selectedFeedback.id),
          listFeedbackNotes(selectedFeedback.id),
          listReplyDrafts(selectedFeedback.id),
        ])
        if (cancelled) return
        setWorkflow(workflowData?.workflow || null)
        setNotes(notesData?.notes || [])
        setReplyDrafts(draftsData?.drafts || [])
      } catch (err) {
        console.error('Failed to load workflow context', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedFeedback?.id])

  const refreshWorkflowContext = async (feedbackId) => {
    const [workflowData, notesData, draftsData] = await Promise.all([
      getFeedbackWorkflow(feedbackId),
      listFeedbackNotes(feedbackId),
      listReplyDrafts(feedbackId),
    ])
    setWorkflow(workflowData?.workflow || null)
    setNotes(notesData?.notes || [])
    setReplyDrafts(draftsData?.drafts || [])
  }

  useEffect(() => {
    if (!selectedFeedback?.id) return
    if (!canAssign) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await listTeams()
        if (!cancelled) setTeams(Array.isArray(data?.teams) ? data.teams : [])
      } catch {
        if (!cancelled) setTeams([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedFeedback?.id, canAssign])

  useEffect(() => {
    if (!selectedFeedback?.id) return
    if (!canAssign) return
    let cancelled = false
    ;(async () => {
      try {
        const team = workflow?.assigned_team || undefined
        const data = await listAssignableUsers({ team })
        if (!cancelled) setAssignableUsers(Array.isArray(data?.users) ? data.users : [])
      } catch {
        if (!cancelled) setAssignableUsers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedFeedback?.id, canAssign, workflow?.assigned_team])

  const clearFilters = () => {
    setSearchQuery('')
    setSentimentFilter('all')
    setSourceFilter('all')
    setCategoryFilter('all')
    setPriorityFilter('all')
    setDateRange('all')
    setCustomDateFrom('')
    setCustomDateTo('')
    setLocationFilter('')
    setCampaignFilter('')
    setLanguageFilter('')
    setCustomerTierFilter('')
  }

  const saveNote = async () => {
    if (!selectedFeedback?.id || !internalNote.trim()) return
    setWorkflowBusy(true)
    try {
      await createFeedbackNote(selectedFeedback.id, {
        body: internalNote.trim(),
        note_type: 'internal',
        mentions: Array.from(new Set((internalNote.match(/@\w+/g) || []).map((m) => m.slice(1)))),
      })
      setInternalNote('')
      await refreshWorkflowContext(selectedFeedback.id)
    } finally {
      setWorkflowBusy(false)
    }
  }

  const askGeminiDraft = async () => {
    if (!selectedFeedback?.id) return
    setWorkflowBusy(true)
    setComposerStatus({ type: 'info', message: 'Requesting a draft from Gemini...' })
    try {
      const data = await generateReplyDraft(selectedFeedback.id, {
        tone: draftTone,
        brand_voice: brandVoice,
        public_response: draftVisibility === 'public',
      })
      setManualReply(data?.draft?.body || '')
      setComposerStatus(
        data?.draft?.ai_generated
          ? { type: 'success', message: `Draft generated by ${data?.draft?.model_name || 'Gemini'}.` }
          : { type: 'warning', message: 'Gemini did not respond, so a fallback template was inserted instead.' }
      )
    } finally {
      setWorkflowBusy(false)
    }
  }

  const redoGeminiDraft = async () => {
    // Same as drafting, but explicit user intent to regenerate.
    await askGeminiDraft()
  }

  const handleRephraseReply = async () => {
    if (!selectedFeedback?.id || !manualReply.trim()) {
      setComposerStatus({ type: 'warning', message: 'Type a reply first, then ask Gemini to rephrase it.' })
      return
    }
    setWorkflowBusy(true)
    setComposerStatus({ type: 'info', message: 'Rephrasing your text with Gemini...' })
    try {
      const data = await rephraseReplyDraft(selectedFeedback.id, {
        text: manualReply,
        tone: draftTone,
        brand_voice: brandVoice,
        public_response: draftVisibility === 'public',
      })
      setManualReply(data?.draft?.body || manualReply)
      setComposerStatus(
        data?.draft?.ai_generated
          ? { type: 'success', message: `Rephrased by ${data?.draft?.model_name || 'Gemini'}.` }
          : { type: 'warning', message: 'Gemini did not return a rewrite, so your original text was kept.' }
      )
    } finally {
      setWorkflowBusy(false)
    }
  }

  const saveDraft = async () => {
    if (!selectedFeedback?.id || !manualReply.trim()) return
    setWorkflowBusy(true)
    try {
      await createReplyDraft(selectedFeedback.id, {
        body: manualReply.trim(),
        tone: draftTone,
        brand_guidelines: brandVoice,
        ai_generated: false,
        channel: draftVisibility === 'public' ? (selectedFeedback.source_group || selectedFeedback.source || 'web') : 'internal',
        visibility: draftVisibility,
        approval_status: 'pending',
      })
      setManualReply('')
      await refreshWorkflowContext(selectedFeedback.id)
    } finally {
      setWorkflowBusy(false)
    }
  }

  const updateWorkflowStatus = async (payload) => {
    if (!selectedFeedback?.id) return
    setWorkflowBusy(true)
    try {
      await updateFeedbackWorkflow(selectedFeedback.id, payload)
      await refreshWorkflowContext(selectedFeedback.id)
    } finally {
      setWorkflowBusy(false)
    }
  }

  const handleApproveDraft = async (draftId) => {
    setWorkflowBusy(true)
    try {
      await approveReplyDraft(draftId)
      await refreshWorkflowContext(selectedFeedback.id)
    } finally {
      setWorkflowBusy(false)
    }
  }

  const handleSendDraft = async (draftId) => {
    setWorkflowBusy(true)
    try {
      await sendReplyDraft(draftId)
      await refreshWorkflowContext(selectedFeedback.id)
    } finally {
      setWorkflowBusy(false)
    }
  }

  const handleResolve = async () => {
    if (!selectedFeedback?.id) return
    setWorkflowBusy(true)
    try {
      await resolveFeedback(selectedFeedback.id, { status: 'Closed', auto_follow_up: true })
      await refreshWorkflowContext(selectedFeedback.id)
    } finally {
      setWorkflowBusy(false)
    }
  }

  const handleSeen = async () => {
    if (!replyDrafts[0]?.id) return
    setWorkflowBusy(true)
    try {
      await markReplySeen(replyDrafts[0].id, { seen_status: 'seen' })
      await refreshWorkflowContext(selectedFeedback.id)
    } finally {
      setWorkflowBusy(false)
    }
  }

  const handleSurvey = async () => {
    if (!selectedFeedback?.id) return
    setWorkflowBusy(true)
    try {
      await createMicroSurvey(selectedFeedback.id, {
        survey_type: 'post_resolution',
        response_score: 5,
        response_text: 'Customer satisfied with the response.',
      })
      await refreshWorkflowContext(selectedFeedback.id)
    } finally {
      setWorkflowBusy(false)
    }
  }

  return (
    <div className="relative space-y-6 p-4 sm:p-6 lg:p-8">
      <DetailDrawer
        item={selectedFeedback}
        customerProfile={customerProfile}
        customerLoading={customerLoading}
        workflow={workflow}
        notes={notes}
        replyDrafts={replyDrafts}
        workflowBusy={workflowBusy}
        draftTone={draftTone}
        setDraftTone={setDraftTone}
        brandVoice={brandVoice}
        setBrandVoice={setBrandVoice}
        draftVisibility={draftVisibility}
        setDraftVisibility={setDraftVisibility}
        manualReply={manualReply}
        setManualReply={setManualReply}
        composerStatus={composerStatus}
        internalNote={internalNote}
        setInternalNote={setInternalNote}
        canAssign={canAssign}
        teams={teams}
        assignableUsers={assignableUsers}
        onClose={() => {
          setSelectedFeedback(null)
          setCustomerProfile(null)
          setWorkflow(null)
          setNotes([])
          setReplyDrafts([])
          setComposerStatus(null)
        }}
        onOpenCustomer={openCustomerProfile}
        onAskGeminiDraft={askGeminiDraft}
        onRedoDraft={redoGeminiDraft}
        onRephraseReply={handleRephraseReply}
        onSaveDraft={saveDraft}
        onSaveNote={saveNote}
        onUpdateWorkflow={updateWorkflowStatus}
        onApproveDraft={handleApproveDraft}
        onSendDraft={handleSendDraft}
        onResolve={handleResolve}
        onMarkSeen={handleSeen}
        onCreateSurvey={handleSurvey}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Unified inbox</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            One chronological feed across channels with grouping, filtering, and Customer 360.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={queueMode}
            onChange={(e) => setQueueMode(e.target.value)}
            className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="chronological">Chronological feed</option>
            <option value="priority">Priority queue</option>
          </select>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="none">No grouping</option>
            <option value="customer">Group by customer</option>
            <option value="topic">Group by topic</option>
            <option value="campaign">Group by campaign</option>
          </select>
          <button
            type="button"
            onClick={() => loadFeed({ reset: true })}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FiRefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="card p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Search all feedback</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Keywords, customer, topic, location…"
              className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Search runs against the feedback index, so it can find historical feedback across the dataset.
            </p>
          </div>
          <div className="lg:col-span-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Sentiment</label>
              <select value={sentimentFilter} onChange={(e) => setSentimentFilter(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                <option value="all">All</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Priority</label>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                <option value="all">All</option>
                <option value="high">High priority</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                <option value="all">All</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Date range</label>
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                <option value="all">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="Location" className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
          <input value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} placeholder="Campaign" className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
          <input value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} placeholder="Language" className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
          <input value={customerTierFilter} onChange={(e) => setCustomerTierFilter(e.target.value)} placeholder="Customer tier" className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
        </div>

        {dateRange === 'custom' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
            <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {SOURCE_ORDER.map((source) => {
            const active = sourceFilter === source
            const count = sourceCounts[source] || 0
            return (
              <button
                key={source}
                type="button"
                onClick={() => setSourceFilter(source)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'}`}
              >
                {source !== 'all' && <SourceLogo source={source} />}
                <span>{source === 'all' ? 'All' : source === 'x' ? 'X' : source.replace(/_/g, ' ')}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                  {count}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FiSliders className="h-4 w-4" />
            Clear filters
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loadingInitial ? (
        <div className="card p-8">
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <FiLoader className="h-4 w-4 animate-spin" />
            Loading unified feed…
          </div>
        </div>
      ) : groupedItems.length === 0 || (groupedItems.length === 1 && groupedItems[0].items.length === 0) ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {groupedItems.map((group) => {
            const collapsed = Boolean(collapsedGroups[group.key])
            return (
              <div key={group.key} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 text-left dark:border-gray-800"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.label}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {group.items.length} item{group.items.length === 1 ? '' : 's'} · newest {formatRelativeTime(group.items[0]?.created_at)}
                    </p>
                  </div>
                  {collapsed ? <FiChevronRight className="h-5 w-5 text-gray-400" /> : <FiChevronDown className="h-5 w-5 text-gray-400" />}
                </button>
                {!collapsed && (
                  <div className="space-y-3 p-4">
                    {group.items.map((item) => (
                      <FeedbackCard key={item.id} item={item} onOpen={openDetails} onOpenCustomer={openCustomerProfile} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div ref={sentinelRef} />

      {loadingMore && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500 dark:text-gray-400">
          <FiLoader className="h-4 w-4 animate-spin" />
          Loading more…
        </div>
      )}

      {!loadingMore && hasMore && queueMode !== 'priority' && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => nextCursor && loadFeed({ reset: false, cursor: nextCursor })}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FiMessageSquare className="h-4 w-4" />
            Load more
          </button>
        </div>
      )}

      {queueMode === 'priority' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Priority mode combines sentiment, recency, channel reach, engagement, customer value, and repeat-support risk. Open any item to see the exact impact factors behind its score.
        </div>
      )}
    </div>
  )
}
