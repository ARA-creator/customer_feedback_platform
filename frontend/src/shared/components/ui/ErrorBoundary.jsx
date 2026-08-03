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
    console.error('UI crashed:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            The app hit an unexpected error while rendering. Reload the page and try again.
          </p>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300">
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
