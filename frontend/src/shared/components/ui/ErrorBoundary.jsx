import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    const msg = typeof error?.message === 'string' ? error.message : 'Unexpected error'
    return { hasError: true, message: msg }
  }

  componentDidCatch(error, info) {
    // Keep this minimal; production errors are still visible in Vercel logs / browser console.
    console.error('UI crashed:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen app-shell-bg text-gray-900 dark:text-gray-100 flex items-center justify-center p-6">
        <div className="card p-6 max-w-lg w-full">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            The app hit an unexpected error while rendering. Reload the page and try again.
          </p>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {this.state.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-lg bg-[#009750] px-4 py-2 text-sm font-semibold text-white hover:bg-[#007a42]"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}

