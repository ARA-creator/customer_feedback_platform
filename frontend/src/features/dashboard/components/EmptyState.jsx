import { FiLink2, FiUploadCloud } from 'react-icons/fi'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  primaryLabel,
  primaryOnClick,
  primaryIcon: PrimaryIcon = FiUploadCloud,
  secondaryLabel,
  secondaryOnClick,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#009750]/5 text-[#009750]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mb-4">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {primaryLabel && (
          <button
            type="button"
            onClick={primaryOnClick}
            className="inline-flex items-center rounded-full bg-[#009750] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#007a42] transition-colors"
          >
            <PrimaryIcon className="w-3.5 h-3.5 mr-1.5" />
            {primaryLabel}
          </button>
        )}
        {secondaryLabel && (
          <button
            type="button"
            onClick={secondaryOnClick}
            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FiLink2 className="w-3.5 h-3.5 mr-1.5" />
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
