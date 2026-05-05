import { useState } from 'react'
import { FiCheckCircle, FiArrowLeft, FiInbox } from 'react-icons/fi'
import { submitFeedback } from '../services/feedback.api'

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#009750] focus:outline-none focus:ring-2 focus:ring-[#009750]/20'
const labelClass = 'block text-sm font-medium text-gray-700'

function validEmail(value) {
  if (!value || !value.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function SubmitFeedbackForm({ onBackToOverview, onSubmitAnother, onGoToInbox }) {
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState('')
  const [category, setCategory] = useState('')
  const [email, setEmail] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
  const [consentText, setConsentText] = useState('')
  const [clientError, setClientError] = useState('')
  const [serverError, setServerError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successPayload, setSuccessPayload] = useState(null)

  const resetForm = () => {
    setMessage('')
    setRating('')
    setCategory('')
    setEmail('')
    setTagsInput('')
    setConsentGiven(false)
    setConsentText('')
    setClientError('')
    setServerError('')
    setMessageError('')
    setEmailError('')
    setSuccessPayload(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setClientError('')
    setServerError('')
    setMessageError('')
    setEmailError('')

    const trimmed = message.trim()
    if (!trimmed) {
      setMessageError('Please enter your feedback message.')
      return
    }
    if (trimmed.length < 5) {
      setMessageError('Add a bit more detail (at least 5 characters).')
      return
    }
    if (email.trim() && !validEmail(email)) {
      setEmailError('Enter a valid email address, or leave this field blank.')
      return
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const payload = {
      message: trimmed,
      source: 'web',
      consent_given: consentGiven,
    }

    if (rating !== '') {
      const n = Number(rating)
      if (Number.isInteger(n) && n >= 1 && n <= 5) {
        payload.rating = n
      }
    }
    if (category.trim()) payload.category = category.trim()
    if (email.trim()) payload.email = email.trim()
    if (tags.length) payload.tags = tags
    if (consentText.trim()) payload.consent_text = consentText.trim()

    setLoading(true)
    try {
      const data = await submitFeedback(payload)
      setSuccessPayload(data)
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Something went wrong. Please try again.'
      setServerError(typeof msg === 'string' ? msg : 'Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  if (successPayload?.feedback) {
    const fb = successPayload.feedback
    return (
      <div className="p-6 sm:p-8 max-w-lg mx-auto">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#009750]/10 text-[#009750]">
            <FiCheckCircle className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Thank you</h2>
          <p className="mt-2 text-sm text-gray-600">{successPayload.message}</p>
          <dl className="mt-6 space-y-2 text-left text-sm border-t border-gray-100 pt-6">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Reference</dt>
              <dd className="font-medium text-gray-900">#{fb.id}</dd>
            </div>
            {fb.sentiment_label != null && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Sentiment</dt>
                <dd className="font-medium text-gray-900 capitalize">{fb.sentiment_label}</dd>
              </div>
            )}
            {fb.category && (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Category</dt>
                <dd className="font-medium text-gray-900">{fb.category}</dd>
              </div>
            )}
          </dl>
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                resetForm()
                onGoToInbox?.()
              }}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#009750] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#007a42] focus:outline-none focus:ring-2 focus:ring-[#009750] focus:ring-offset-2"
            >
              <FiInbox className="h-4 w-4" aria-hidden />
              View in inbox
            </button>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  onSubmitAnother?.()
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#009750]/40 bg-[#009750]/5 px-4 py-2.5 text-sm font-medium text-[#047857] hover:bg-[#009750]/10 focus:outline-none focus:ring-2 focus:ring-[#009750]/40"
              >
                Submit another
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  onBackToOverview?.()
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
              >
                <FiArrowLeft className="h-4 w-4" aria-hidden />
                Back to overview
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          Submit feedback
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Share your experience. Your message helps us improve our service.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
        {(clientError || serverError) && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {clientError || serverError}
          </div>
        )}

        <div>
          <label htmlFor="feedback-message" className={labelClass}>
            Message <span className="text-red-600">*</span>
          </label>
          <textarea
            id="feedback-message"
            name="message"
            rows={5}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              if (messageError) setMessageError('')
            }}
            onBlur={() => {
              const t = message.trim()
              if (t.length > 0 && t.length < 5) {
                setMessageError('Add a bit more detail (at least 5 characters).')
              }
            }}
            className={`${inputClass} ${messageError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
            placeholder="Tell us what went well or what we could do better…"
            disabled={loading}
            required
            aria-invalid={messageError ? 'true' : 'false'}
            aria-describedby={messageError ? 'feedback-message-error' : undefined}
          />
          {messageError && (
            <p id="feedback-message-error" className="mt-1.5 text-xs text-red-600">
              {messageError}
            </p>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="feedback-rating" className={labelClass}>
              Rating (optional)
            </label>
            <select
              id="feedback-rating"
              name="rating"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className={`${inputClass} min-h-[44px]`}
              disabled={loading}
            >
              <option value="">No rating</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                  {n === 1 ? ' (poor)' : n === 5 ? ' (excellent)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="feedback-category" className={labelClass}>
              Category (optional)
            </label>
            <input
              id="feedback-category"
              name="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
              placeholder="e.g. claims, service"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="feedback-email" className={labelClass}>
            Email (optional)
          </label>
          <input
            id="feedback-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) setEmailError('')
            }}
            onBlur={() => {
              if (email.trim() && !validEmail(email)) {
                setEmailError('Enter a valid email address, or leave this field blank.')
              }
            }}
            className={`${inputClass} min-h-[44px] ${emailError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
            placeholder="For follow-up if needed"
            disabled={loading}
            aria-invalid={emailError ? 'true' : 'false'}
            aria-describedby={emailError ? 'feedback-email-error' : undefined}
          />
          {emailError && (
            <p id="feedback-email-error" className="mt-1.5 text-xs text-red-600">
              {emailError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="feedback-tags" className={labelClass}>
            Tags (optional)
          </label>
          <input
            id="feedback-tags"
            name="tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className={inputClass}
            placeholder="Comma-separated, e.g. billing, support"
            disabled={loading}
          />
        </div>

        <fieldset className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-4">
          <legend className={`${labelClass} px-1`}>Consent</legend>
          <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-[#009750] focus:ring-[#009750]"
              disabled={loading}
            />
            <span>I consent to the processing of this feedback as described in your privacy notice.</span>
          </label>
          <div>
            <label htmlFor="feedback-consent-text" className={labelClass}>
              Consent details (optional)
            </label>
            <input
              id="feedback-consent-text"
              name="consent_text"
              type="text"
              value={consentText}
              onChange={(e) => setConsentText(e.target.value)}
              className={inputClass}
              placeholder="e.g. version of notice accepted"
              disabled={loading}
            />
          </div>
        </fieldset>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => onBackToOverview?.()}
            className="inline-flex min-h-[44px] justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#009750]/30"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[44px] justify-center rounded-lg bg-[#009750] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#007a42] focus:outline-none focus:ring-2 focus:ring-[#009750] focus:ring-offset-2 disabled:opacity-60"
          >
            {loading ? 'Submitting…' : 'Submit feedback'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SubmitFeedbackForm
