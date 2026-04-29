'use client'

import { useState } from 'react'
import { apiPost, apiPatch } from '@/lib/propwatch/api/client'

interface PropertyRow {
  id: string
  portfolio_id: string
  name: string
  current_value: number
  current_debt: number
  monthly_rent: number
  monthly_repayment: number
  annual_expenses: number
  purchase_price: number | null
  purchase_date: string | null
  [key: string]: unknown
}

interface Props {
  mode: 'create' | 'edit'
  property?: PropertyRow
  portfolioId: string
  onSuccess: (property: PropertyRow) => void
  onClose: () => void
}

interface FormState {
  name: string
  current_value: string
  current_debt: string
  monthly_rent: string
  monthly_repayment: string
  annual_expenses: string
  purchase_price: string
  purchase_date: string
}

export default function PropertyForm({ mode, property, onSuccess, onClose }: Props) {
  const [form, setForm] = useState<FormState>({
    name: property?.name ?? '',
    current_value: property?.current_value?.toString() ?? '',
    current_debt: property?.current_debt?.toString() ?? '',
    monthly_rent: property?.monthly_rent?.toString() ?? '',
    monthly_repayment: property?.monthly_repayment?.toString() ?? '',
    annual_expenses: property?.annual_expenses?.toString() ?? '',
    purchase_price: property?.purchase_price?.toString() ?? '',
    purchase_date: property?.purchase_date ?? '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) return setError('Name is required.')
    if (!form.current_value || Number(form.current_value) <= 0) return setError('Current value must be greater than 0.')
    if (form.current_debt === '' || Number(form.current_debt) < 0) return setError('Current debt is required.')
    if (form.monthly_rent === '' || Number(form.monthly_rent) < 0) return setError('Monthly rent is required (use 0 if vacant).')
    if (!form.monthly_repayment || Number(form.monthly_repayment) < 0) return setError('Monthly repayment is required.')
    if (!form.annual_expenses || Number(form.annual_expenses) < 0) return setError('Annual expenses are required.')

    const payload = {
      name: form.name.trim(),
      current_value: Number(form.current_value),
      current_debt: Number(form.current_debt),
      monthly_rent: Number(form.monthly_rent),
      monthly_repayment: Number(form.monthly_repayment),
      annual_expenses: Number(form.annual_expenses),
      ...(form.purchase_price ? { purchase_price: Number(form.purchase_price) } : {}),
      ...(form.purchase_date ? { purchase_date: form.purchase_date } : {}),
    }

    setSubmitting(true)
    try {
      if (mode === 'create') {
        const result = await apiPost<{ property: PropertyRow }>('/api/properties', payload)
        onSuccess(result.property)
      } else {
        const result = await apiPatch<{ property: PropertyRow }>(`/api/properties/${property!.id}`, payload)
        onSuccess(result.property)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {mode === 'create' ? 'Add property' : 'Edit property'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={inputClass}
              placeholder="e.g. Brighton townhouse"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Current value ($)" required>
              <input
                type="number"
                min={0}
                value={form.current_value}
                onChange={(e) => set('current_value', e.target.value)}
                className={inputClass}
                placeholder="650000"
              />
            </Field>
            <Field label="Current debt ($)" required>
              <input
                type="number"
                min={0}
                value={form.current_debt}
                onChange={(e) => set('current_debt', e.target.value)}
                className={inputClass}
                placeholder="420000"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Monthly rent ($)" required>
              <input
                type="number"
                min={0}
                value={form.monthly_rent}
                onChange={(e) => set('monthly_rent', e.target.value)}
                className={inputClass}
                placeholder="0 if vacant"
              />
            </Field>
            <Field label="Monthly repayment ($)" required>
              <input
                type="number"
                min={0}
                value={form.monthly_repayment}
                onChange={(e) => set('monthly_repayment', e.target.value)}
                className={inputClass}
                placeholder="2100"
              />
            </Field>
          </div>

          <Field label="Annual expenses ($)" required>
            <input
              type="number"
              min={0}
              value={form.annual_expenses}
              onChange={(e) => set('annual_expenses', e.target.value)}
              className={inputClass}
              placeholder="6000"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Purchase price (optional)">
              <input
                type="number"
                min={0}
                value={form.purchase_price}
                onChange={(e) => set('purchase_price', e.target.value)}
                className={inputClass}
                placeholder="500000"
              />
            </Field>
            <Field label="Purchase date (optional)">
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) => set('purchase_date', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {error && (
            <p className="text-sm text-red-600 rounded-xl bg-red-50 px-4 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-green-800 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Saving…' : mode === 'create' ? 'Add property' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-700'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
