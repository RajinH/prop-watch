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
  loan_type: string | null
  interest_rate: number | null
  interest_rate_type: string | null
  loan_term_years: number | null
  lender: string | null
  fixed_rate_expiry: string | null
  insurer: string | null
  annual_insurance_premium: number | null
  insurance_policy_type: string | null
  insurance_renewal_date: string | null
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
  // Core
  name: string
  current_value: string
  current_debt: string
  monthly_rent: string
  monthly_repayment: string
  annual_expenses: string
  purchase_price: string
  purchase_date: string
  // Loan
  lender: string
  interest_rate: string
  interest_rate_type: string
  loan_type: string
  loan_term_years: string
  fixed_rate_expiry: string
  // Insurance
  insurer: string
  insurance_policy_type: string
  annual_insurance_premium: string
  insurance_renewal_date: string
}

export default function PropertyForm({ mode, property, onSuccess, onClose }: Props) {
  const hasLoanData = !!(
    property?.lender ||
    property?.interest_rate ||
    property?.interest_rate_type ||
    property?.loan_type ||
    property?.loan_term_years ||
    property?.fixed_rate_expiry
  )
  const hasInsuranceData = !!(
    property?.insurer ||
    property?.annual_insurance_premium ||
    property?.insurance_policy_type ||
    property?.insurance_renewal_date
  )

  const [form, setForm] = useState<FormState>({
    name: property?.name ?? '',
    current_value: property?.current_value?.toString() ?? '',
    current_debt: property?.current_debt?.toString() ?? '',
    monthly_rent: property?.monthly_rent?.toString() ?? '',
    monthly_repayment: property?.monthly_repayment?.toString() ?? '',
    annual_expenses: property?.annual_expenses?.toString() ?? '',
    purchase_price: property?.purchase_price?.toString() ?? '',
    purchase_date: property?.purchase_date ?? '',
    lender: property?.lender ?? '',
    interest_rate: property?.interest_rate != null ? (property.interest_rate * 100).toString() : '',
    interest_rate_type: property?.interest_rate_type ?? '',
    loan_type: property?.loan_type ?? '',
    loan_term_years: property?.loan_term_years?.toString() ?? '',
    fixed_rate_expiry: property?.fixed_rate_expiry ?? '',
    insurer: property?.insurer ?? '',
    insurance_policy_type: property?.insurance_policy_type ?? '',
    annual_insurance_premium: property?.annual_insurance_premium?.toString() ?? '',
    insurance_renewal_date: property?.insurance_renewal_date ?? '',
  })
  const [showLoan, setShowLoan] = useState(hasLoanData)
  const [showInsurance, setShowInsurance] = useState(hasInsuranceData)
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

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      current_value: Number(form.current_value),
      current_debt: Number(form.current_debt),
      monthly_rent: Number(form.monthly_rent),
      monthly_repayment: Number(form.monthly_repayment),
      annual_expenses: Number(form.annual_expenses),
      ...(form.purchase_price ? { purchase_price: Number(form.purchase_price) } : {}),
      ...(form.purchase_date ? { purchase_date: form.purchase_date } : {}),
    }

    if (showLoan) {
      if (form.lender) payload.lender = form.lender.trim()
      if (form.interest_rate) payload.interest_rate = Number(form.interest_rate) / 100
      if (form.interest_rate_type) payload.interest_rate_type = form.interest_rate_type
      if (form.loan_type) payload.loan_type = form.loan_type
      if (form.loan_term_years) payload.loan_term_years = Number(form.loan_term_years)
      if (form.fixed_rate_expiry) payload.fixed_rate_expiry = form.fixed_rate_expiry
    }

    if (showInsurance) {
      if (form.insurer) payload.insurer = form.insurer.trim()
      if (form.insurance_policy_type) payload.insurance_policy_type = form.insurance_policy_type
      if (form.annual_insurance_premium) payload.annual_insurance_premium = Number(form.annual_insurance_premium)
      if (form.insurance_renewal_date) payload.insurance_renewal_date = form.insurance_renewal_date
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
          {/* Core fields */}
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

          {/* Loan details section */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowLoan((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-green-800 hover:text-green-700 transition-colors"
            >
              <span className={`text-base leading-none transition-transform ${showLoan ? 'rotate-45' : ''}`}>+</span>
              {showLoan ? 'Hide loan details' : 'Add loan details'}
            </button>

            {showLoan && (
              <div className="mt-3 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Lender">
                    <input
                      type="text"
                      value={form.lender}
                      onChange={(e) => set('lender', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. ANZ"
                    />
                  </Field>
                  <Field label="Interest rate (%)">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.01}
                      value={form.interest_rate}
                      onChange={(e) => set('interest_rate', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 6.5"
                    />
                  </Field>
                </div>

                <Field label="Rate type">
                  <RadioGroup
                    value={form.interest_rate_type}
                    onChange={(v) => set('interest_rate_type', v)}
                    options={[
                      { value: 'variable', label: 'Variable' },
                      { value: 'fixed', label: 'Fixed' },
                      { value: 'split', label: 'Split' },
                    ]}
                  />
                </Field>

                <Field label="Loan type">
                  <RadioGroup
                    value={form.loan_type}
                    onChange={(v) => set('loan_type', v)}
                    options={[
                      { value: 'principal_and_interest', label: 'P&I' },
                      { value: 'interest_only', label: 'Interest only' },
                    ]}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Loan term (years)">
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={form.loan_term_years}
                      onChange={(e) => set('loan_term_years', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 25"
                    />
                  </Field>
                  {(form.interest_rate_type === 'fixed' || form.interest_rate_type === 'split') && (
                    <Field label="Fixed rate expiry">
                      <input
                        type="date"
                        value={form.fixed_rate_expiry}
                        onChange={(e) => set('fixed_rate_expiry', e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Insurance details section */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowInsurance((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-green-800 hover:text-green-700 transition-colors"
            >
              <span className={`text-base leading-none transition-transform ${showInsurance ? 'rotate-45' : ''}`}>+</span>
              {showInsurance ? 'Hide insurance details' : 'Add insurance details'}
            </button>

            {showInsurance && (
              <div className="mt-3 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Insurer">
                    <input
                      type="text"
                      value={form.insurer}
                      onChange={(e) => set('insurer', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Suncorp"
                    />
                  </Field>
                  <Field label="Annual premium ($)">
                    <input
                      type="number"
                      min={0}
                      value={form.annual_insurance_premium}
                      onChange={(e) => set('annual_insurance_premium', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 1800"
                    />
                  </Field>
                </div>

                <Field label="Policy type">
                  <RadioGroup
                    value={form.insurance_policy_type}
                    onChange={(v) => set('insurance_policy_type', v)}
                    options={[
                      { value: 'landlord', label: 'Landlord' },
                      { value: 'building', label: 'Building' },
                      { value: 'contents', label: 'Contents' },
                      { value: 'combined', label: 'Combined' },
                    ]}
                  />
                </Field>

                <Field label="Renewal date">
                  <input
                    type="date"
                    value={form.insurance_renewal_date}
                    onChange={(e) => set('insurance_renewal_date', e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
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

function RadioGroup({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(value === opt.value ? '' : opt.value)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.value
              ? 'bg-green-800 border-green-800 text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
