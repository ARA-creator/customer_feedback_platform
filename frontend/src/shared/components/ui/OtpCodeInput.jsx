import { useEffect, useRef } from 'react'
import { FiCheck } from 'react-icons/fi'

const LENGTH = 6

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '').slice(0, LENGTH)
}

export default function OtpCodeInput({ value = '', onChange, disabled = false, idPrefix = 'otp' }) {
  const inputsRef = useRef([])
  const code = digitsOnly(value)
  const slots = Array.from({ length: LENGTH }, (_, i) => code[i] || '')
  const filled = code.length === LENGTH

  useEffect(() => {
    if (!disabled && code.length === 0) {
      inputsRef.current[0]?.focus()
    }
  }, [disabled, code.length])

  const emit = (next) => {
    onChange?.(digitsOnly(next))
  }

  const focusIndex = (index) => {
    const el = inputsRef.current[Math.min(Math.max(index, 0), LENGTH - 1)]
    el?.focus()
    el?.select()
  }

  const applyDigits = (raw, startIndex = 0) => {
    const chunk = digitsOnly(raw)
    if (!chunk) return
    const current = code.split('')
    for (let i = 0; i < chunk.length && startIndex + i < LENGTH; i += 1) {
      current[startIndex + i] = chunk[i]
    }
    const merged = current.join('').slice(0, LENGTH)
    emit(merged)
    focusIndex(Math.min(startIndex + chunk.length, LENGTH - 1))
  }

  const handleChange = (index, e) => {
    const raw = e.target.value
    if (raw.length > 1) {
      applyDigits(raw, index)
      return
    }
    const digit = digitsOnly(raw)
    const current = code.split('')
    while (current.length < LENGTH) current.push('')
    current[index] = digit || ''
    emit(current.join('').slice(0, LENGTH))
    if (digit && index < LENGTH - 1) focusIndex(index + 1)
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (slots[index]) {
        const current = code.split('')
        while (current.length < LENGTH) current.push('')
        current[index] = ''
        emit(current.join('').slice(0, LENGTH))
        return
      }
      if (index > 0) {
        e.preventDefault()
        const current = code.split('')
        while (current.length < LENGTH) current.push('')
        current[index - 1] = ''
        emit(current.join('').slice(0, LENGTH))
        focusIndex(index - 1)
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      focusIndex(index - 1)
    }
    if (e.key === 'ArrowRight' && index < LENGTH - 1) {
      e.preventDefault()
      focusIndex(index + 1)
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    applyDigits(e.clipboardData?.getData('text') || '', 0)
  }

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5">
      <div className="flex items-center gap-2 sm:gap-2.5">
        {slots.map((digit, index) => (
          <input
            key={`${idPrefix}-${index}`}
            ref={(el) => {
              inputsRef.current[index] = el
            }}
            id={`${idPrefix}-${index}`}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            disabled={disabled}
            value={digit}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            className={`h-12 w-10 sm:h-14 sm:w-12 rounded-xl border text-center text-lg sm:text-xl font-semibold tabular-nums shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#009750]/40 ${
              digit
                ? 'border-[#009750]/50 bg-emerald-50/60 text-gray-900'
                : 'border-gray-200 bg-gray-50 text-gray-900'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
        ))}
      </div>
      {filled && (
        <span
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#009750] text-white"
          aria-hidden
        >
          <FiCheck className="h-4 w-4" strokeWidth={3} />
        </span>
      )}
    </div>
  )
}
