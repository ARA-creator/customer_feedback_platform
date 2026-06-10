/** Official-style JotForm mark (`/icons/jotform.png`). */
export default function JotformIcon({ className = 'h-4 w-4', title = 'JotForm' }) {
  return (
    <img
      src="/icons/jotform.png"
      alt=""
      aria-label={title}
      title={title}
      className={`inline-block shrink-0 object-contain ${className}`}
      draggable={false}
    />
  )
}
