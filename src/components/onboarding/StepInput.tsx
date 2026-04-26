'use client'

interface StepInputProps {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  prefix?: string
  placeholder?: string
  disabled?: boolean
  inputMode?: 'text' | 'numeric' | 'decimal'
}

export default function StepInput({
  id,
  label,
  hint,
  value,
  onChange,
  prefix,
  placeholder,
  disabled,
  inputMode = 'decimal',
}: StepInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 focus-within:border-green-700 focus-within:ring-2 focus-within:ring-green-700/10 transition-all">
        {prefix && <span className="text-slate-400 text-sm select-none">{prefix}</span>}
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-slate-900 placeholder:text-slate-300 text-base outline-none disabled:opacity-40"
        />
      </div>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
