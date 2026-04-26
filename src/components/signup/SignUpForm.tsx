'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveUser } from '@/lib/storage'

const PROPERTY_COUNT_OPTIONS = [
  { value: '1', label: '1 property' },
  { value: '2-5', label: '2–5 properties' },
  { value: '6-10', label: '6–10 properties' },
  { value: '10+', label: '10+ properties' },
]

export default function SignUpForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    propertyCount: '',
  })
  const [errors, setErrors] = useState<Partial<typeof form>>({})
  const [submitted, setSubmitted] = useState(false)

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  function validate(): boolean {
    const next: Partial<typeof form> = {}
    if (!form.name.trim()) next.name = 'Name is required'
    if (!form.email.trim() || !form.email.includes('@')) next.email = 'Enter a valid email'
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters'
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match'
    if (!form.propertyCount) next.propertyCount = 'Select how many properties you manage'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    saveUser(form.email)
    setSubmitted(true)
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 animate-fade-in text-center">
        <div className="h-14 w-14 rounded-full bg-green-700 flex items-center justify-center">
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-bold text-slate-900">Welcome, {form.name.split(' ')[0]}.</p>
        <p className="text-sm text-slate-400">Taking you to your portfolio…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Name */}
      <Field label="Full name" error={errors.name}>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Alex Johnson"
          className={inputClass(!!errors.name)}
        />
      </Field>

      {/* Email */}
      <Field label="Email" error={errors.email}>
        <input
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="alex@example.com"
          className={inputClass(!!errors.email)}
        />
      </Field>

      {/* Password */}
      <Field label="Password" error={errors.password} hint="Minimum 8 characters">
        <input
          type="password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          placeholder="••••••••"
          className={inputClass(!!errors.password)}
        />
      </Field>

      {/* Confirm password */}
      <Field label="Confirm password" error={errors.confirm}>
        <input
          type="password"
          value={form.confirm}
          onChange={(e) => set('confirm', e.target.value)}
          placeholder="••••••••"
          className={inputClass(!!errors.confirm)}
        />
      </Field>

      {/* Investor profile */}
      <Field label="How many properties do you manage?" error={errors.propertyCount}>
        <div className="grid grid-cols-2 gap-2">
          {PROPERTY_COUNT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => set('propertyCount', value)}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium text-left transition-all ${
                form.propertyCount === value
                  ? 'border-green-700 bg-green-50 text-green-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      <button
        type="submit"
        className="mt-1 w-full rounded-xl bg-green-800 px-6 py-3.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
      >
        Create account →
      </button>
    </form>
  )
}

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border px-4 py-3 text-sm text-slate-900 placeholder:text-slate-300 outline-none transition-all ${
    hasError
      ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
      : 'border-slate-200 bg-white focus:border-green-700 focus:ring-2 focus:ring-green-700/10'
  }`
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
