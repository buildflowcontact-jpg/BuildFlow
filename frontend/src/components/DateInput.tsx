import { useRef } from 'react'
import { Calendar, X } from 'lucide-react'

type DateInputProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  min?: string
  max?: string
  error?: string
}

export function DateInput({ value, onChange, className = '', min, max, error }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => {
    const input = inputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.focus()
  }

  const clearDate = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onChange('')
  }

  const isInvalid = !!error

  return (
    <div>
      <div className={`relative ${isInvalid ? 'ring-2 ring-red-300 rounded-xl' : ''}`}>
        <input
          ref={inputRef}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(e.target.value)}
          className={`${className} pr-20 [&::-webkit-calendar-picker-indicator]:opacity-0 ${
            isInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
          }`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
          {value && (
            <button
              type="button"
              onClick={clearDate}
              className="inline-flex items-center justify-center h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
              aria-label="Effacer la date"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex items-center justify-center h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
            aria-label="Ouvrir le calendrier"
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      </div>
      {error && value && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
