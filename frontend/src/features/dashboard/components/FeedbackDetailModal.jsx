import {
  FiArchive,
  FiCheckCircle,
  FiFlag,
  FiMail,
  FiThumbsDown,
  FiThumbsUp,
  FiUserPlus,
  FiX,
} from 'react-icons/fi'

export default function FeedbackDetailModal({
  open,
  feedback,
  reactionsById,
  onClose,
  onUpdateStatus,
  onSetReaction,
  getStatus,
  getStatusClasses,
  safeParseJson,
  formatSentimentWord,
}) {
  if (!open || !feedback) return null

  const status = getStatus(feedback)
  const r = reactionsById?.[feedback.id] || {
    thumbsUp: false,
    thumbsDown: false,
    flagged: false,
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Feedback Details</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              ID #{feedback.id}{' '}
              {feedback.created_at && `· ${new Date(feedback.created_at).toLocaleString()}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-offset-gray-900"
          >
            <span className="sr-only">Close</span>
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(status)}`}>
              {status}
            </span>
            {feedback.sentiment_label && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  feedback.sentiment_label === 'negative'
                    ? 'bg-red-100 text-red-700'
                    : feedback.sentiment_label === 'positive'
                      ? 'bg-[#009750]/10 text-[#009750]'
                      : 'bg-gray-100 text-gray-700'
                }`}
              >
                {formatSentimentWord(feedback.sentiment_label)}
              </span>
            )}
            {feedback.category && (
              <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                {feedback.category}
              </span>
            )}
            {feedback.priority && (
              <span className="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-700 font-semibold">
                Priority: {feedback.priority}
              </span>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {feedback.message || feedback.message_preview || 'No message'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
            <div className="space-y-1">
              {feedback.source && (
                <p>
                  <span className="font-medium text-gray-700">Source:</span> {feedback.source}
                </p>
              )}

              {feedback.source === 'web' &&
                (() => {
                  const meta = safeParseJson(feedback.channel_metadata)
                  const url = meta?.url
                  const publisher = meta?.publisher
                  const matchedKeyword = meta?.matched_keyword
                  const query = meta?.query
                  return (
                    <div className="space-y-1">
                      {url && (
                        <p className="break-all">
                          <span className="font-medium text-gray-700">URL:</span>{' '}
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[#009750] hover:underline"
                          >
                            {url}
                          </a>
                        </p>
                      )}
                      {publisher && (
                        <p>
                          <span className="font-medium text-gray-700">Publisher:</span> {publisher}
                        </p>
                      )}
                      {matchedKeyword && (
                        <p>
                          <span className="font-medium text-gray-700">Matched keyword:</span> {matchedKeyword}
                        </p>
                      )}
                      {query && (
                        <p className="break-words">
                          <span className="font-medium text-gray-700">Query:</span> {query}
                        </p>
                      )}
                    </div>
                  )
                })()}

              {feedback.customer_id && (
                <p>
                  <span className="font-medium text-gray-700">Customer ID:</span> {feedback.customer_id}
                </p>
              )}
              {feedback.rating && (
                <p>
                  <span className="font-medium text-gray-700">Rating:</span> Rating {feedback.rating}/5
                </p>
              )}
            </div>

            <div className="space-y-1">
              <p>
                <span className="font-medium text-gray-700">Sentiment score:</span>{' '}
                {feedback.sentiment_score != null ? feedback.sentiment_score.toFixed(3) : '—'}
              </p>
              {feedback.tags && Array.isArray(feedback.tags) && (
                <p>
                  <span className="font-medium text-gray-700">Tags:</span> {feedback.tags.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onUpdateStatus(feedback, 'Resolved')}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              <FiCheckCircle className="w-4 h-4" />
              Mark as resolved
            </button>
            <button
              type="button"
              onClick={() => onUpdateStatus(feedback, 'In Progress')}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
            >
              <FiUserPlus className="w-4 h-4" />
              Assign
            </button>
            <button
              type="button"
              onClick={() => onUpdateStatus(feedback, 'New')}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#009750] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#007a42] transition-colors"
            >
              <FiMail className="w-4 h-4" />
              Reply
            </button>
            <button
              type="button"
              onClick={() => onUpdateStatus(feedback, 'Archived')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <FiArchive className="w-4 h-4" />
              Archive
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSetReaction(feedback.id, 'thumbsUp')}
              className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                r.thumbsUp
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FiThumbsUp className="w-3.5 h-3.5 mr-1" />
              Helpful
            </button>
            <button
              type="button"
              onClick={() => onSetReaction(feedback.id, 'thumbsDown')}
              className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                r.thumbsDown
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FiThumbsDown className="w-3.5 h-3.5 mr-1" />
              Not helpful
            </button>
            <button
              type="button"
              onClick={() => onSetReaction(feedback.id, 'flag')}
              className={`inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                r.flagged
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FiFlag className="w-3.5 h-3.5 mr-1" />
              Flag
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

