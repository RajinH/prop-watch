'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WandSparkles } from 'lucide-react'
import { apiPost, apiPatch, apiGet } from '@/lib/propwatch/api/client'
import { useToast } from '@/components/ui/ToastProvider'
import AddressAutocomplete, { type AddressFields } from './AddressAutocomplete'
import {
  loadHtagAddressKey,
  saveHtagAddressKey,
  loadHtagEstimates,
  saveHtagEstimates,
  type HtagEstimatesCache,
} from '@/lib/storage'

interface PropertyRow {
  id: string
  portfolio_id: string
  name: string
  unit: string | null
  street: string | null
  city: string | null
  postcode: string | null
  state: string | null
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
}

interface FormState {
  // Property
  name: string
  unit: string
  street: string
  city: string
  postcode: string
  state: string
  // HTAG resolution (wizard-only, not submitted)
  htag_address_key: string
  htag_address_label: string
  // Financials
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

interface HtagCandidate {
  address_key: string
  address_label: string
  score: number
}

const STEPS = ['Property', 'Loan & Insurance', 'Financials'] as const
const LAST_STEP = STEPS.length - 1

export default function PropertyWizard({ mode, property }: Props) {
  const router = useRouter()
  const { toast } = useToast()

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
    unit: property?.unit ?? '',
    street: property?.street ?? '',
    city: property?.city ?? '',
    postcode: property?.postcode ?? '',
    state: property?.state ?? '',
    htag_address_key: '',
    htag_address_label: '',
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
  const [step, setStep] = useState(0)
  const [showLoan, setShowLoan] = useState(hasLoanData)
  const [showInsurance, setShowInsurance] = useState(hasInsuranceData)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // HTAG resolution state
  const [htagConflicts, setHtagConflicts] = useState<HtagCandidate[]>([])
  const [htagResolving, setHtagResolving] = useState(false)

  // Prefill state
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [prefillError, setPrefillError] = useState<string | null>(null)

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function buildAddressText(fields: {
    unit: string
    street: string
    city: string
    state: string
    postcode: string
  }): string {
    return [
      fields.unit ? `${fields.unit}/` : '',
      fields.street,
      fields.city,
      fields.state,
      fields.postcode,
      'Australia',
    ]
      .filter(Boolean)
      .join(' ')
  }

  async function resolveHtagAddress(fields: AddressFields) {
    const addressText = buildAddressText(fields)

    const cached = loadHtagAddressKey(addressText)
    if (cached) {
      setForm((prev) => ({
        ...prev,
        htag_address_key: cached.address_key,
        htag_address_label: cached.address_label,
      }))
      setHtagConflicts([])
      return
    }

    setHtagResolving(true)
    try {
      const data = await apiGet<{ results: HtagCandidate[]; total: number }>(
        `/api/htag/address-resolve?address=${encodeURIComponent(addressText)}`
      )

      const results = data.results ?? []
      if (results.length === 0) return

      const best = results[0]
      const clearWinner =
        best.score >= 0.8 &&
        (results.length === 1 || best.score - results[1].score >= 0.1)

      if (clearWinner) {
        const entry = {
          address_key: best.address_key,
          address_label: best.address_label,
          cachedAt: new Date().toISOString(),
        }
        saveHtagAddressKey(addressText, entry)
        setForm((prev) => ({
          ...prev,
          htag_address_key: best.address_key,
          htag_address_label: best.address_label,
        }))
        setHtagConflicts([])
      } else {
        setHtagConflicts(results.slice(0, 4))
      }
    } catch {
      // HTAG is best-effort — never surface resolution errors to the user
    } finally {
      setHtagResolving(false)
    }
  }

  function applyEstimates(est: HtagEstimatesCache) {
    setForm((prev) => {
      const next = { ...prev }
      if (est.price_estimate != null && !prev.current_value)
        next.current_value = String(Math.round(est.price_estimate))
      if (est.rent_estimate != null && !prev.monthly_rent)
        next.monthly_rent = String(Math.round((est.rent_estimate * 52) / 12))
      if (est.last_sold_price != null && !prev.purchase_price)
        next.purchase_price = String(Math.round(est.last_sold_price))
      if (est.last_sold_date != null && !prev.purchase_date)
        next.purchase_date = est.last_sold_date
      return next
    })
  }

  async function handlePrefill() {
    setPrefillError(null)
    if (!form.htag_address_key) {
      setPrefillError('Address could not be resolved. Enter financial details manually.')
      return
    }

    const cached = loadHtagEstimates(form.htag_address_key)
    if (cached) {
      applyEstimates(cached)
      return
    }

    setPrefillLoading(true)
    try {
      const data = await apiGet<{
        results: Array<{
          address_key: string
          price_estimate: number | null
          rent_estimate: number | null
          last_sold_price: number | null
          last_sold_date: string | null
        }>
      }>(`/api/htag/property-estimates?address_key=${encodeURIComponent(form.htag_address_key)}`)

      const est = data.results?.[0]
      if (!est) {
        setPrefillError('No estimates available for this property.')
        return
      }

      const entry: HtagEstimatesCache = {
        price_estimate: est.price_estimate,
        rent_estimate: est.rent_estimate,
        last_sold_price: est.last_sold_price,
        last_sold_date: est.last_sold_date,
        cachedAt: new Date().toISOString(),
      }
      saveHtagEstimates(form.htag_address_key, entry)
      applyEstimates(entry)
    } catch {
      setPrefillError('Could not fetch estimates. Please enter values manually.')
    } finally {
      setPrefillLoading(false)
    }
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.name.trim()) return 'Give the property a name to continue.'
      if (!form.street.trim()) return 'Street address is required.'
      if (!form.city.trim()) return 'City is required.'
      if (!form.state.trim()) return 'State is required.'
      if (!form.postcode.trim()) return 'Postcode is required.'
    }
    if (s === 2) {
      if (!form.current_value || Number(form.current_value) <= 0) return 'Current value must be greater than 0.'
      if (form.current_debt === '' || Number(form.current_debt) < 0) return 'Current debt is required.'
      if (form.monthly_rent === '' || Number(form.monthly_rent) < 0) return 'Monthly rent is required (use 0 if vacant).'
      if (!form.monthly_repayment || Number(form.monthly_repayment) < 0) return 'Monthly repayment is required.'
      if (!form.annual_expenses || Number(form.annual_expenses) < 0) return 'Annual expenses are required.'
    }
    return null
  }

  function goTo(target: number) {
    setError(null)
    setStep(target)
  }

  function goBack() {
    if (step > 0) goTo(step - 1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (step < LAST_STEP) {
      const stepError = validateStep(step)
      if (stepError) return setError(stepError)
      setStep(step + 1)
      return
    }

    const firstBadStep = validateStep(0) ? 0 : validateStep(2) ? 2 : null
    if (firstBadStep !== null) {
      setStep(firstBadStep)
      return setError(validateStep(firstBadStep))
    }

    // htag_address_key and htag_address_label are wizard-only — excluded from payload
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      ...(form.unit.trim() ? { unit: form.unit.trim() } : {}),
      ...(form.street.trim() ? { street: form.street.trim() } : {}),
      ...(form.city.trim() ? { city: form.city.trim() } : {}),
      ...(form.postcode.trim() ? { postcode: form.postcode.trim() } : {}),
      ...(form.state.trim() ? { state: form.state.trim() } : {}),
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
        await apiPost<{ property: PropertyRow }>('/api/properties', payload)
        toast('Property added.', 'success')
      } else {
        await apiPatch<{ property: PropertyRow }>(`/api/properties/${property!.id}`, payload)
        toast('Property updated.', 'success')
      }
      router.push('/properties')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/properties"
          className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          ← Back to properties
        </Link>
        <h1 className="mt-3 text-3xl font-black text-slate-900">
          {mode === 'create' ? 'Add a property' : 'Edit property'}
        </h1>
        <p className="text-slate-500 mt-1">
          {step === 0 && 'Name it and tell us where it is.'}
          {step === 1 && 'Loan and insurance details — optional, add them anytime.'}
          {step === 2 && 'A few numbers so we can track its performance.'}
        </p>
      </div>

      <Stepper step={step} onStepClick={(i) => i < step && goTo(i)} />

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col gap-5"
      >
        {step === 0 && (
          <>
            <Field label="Name" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputClass}
                placeholder="e.g. Brighton townhouse"
                autoFocus
              />
            </Field>

            <Field label="Street" required>
              <AddressAutocomplete
                value={form.street}
                onChange={(v) => set('street', v)}
                onSelect={(f) => {
                  setForm((prev) => ({
                    ...prev,
                    unit: f.unit,
                    street: f.street,
                    city: f.city,
                    postcode: f.postcode,
                    state: f.state,
                    htag_address_key: '',
                    htag_address_label: '',
                  }))
                  setHtagConflicts([])
                  resolveHtagAddress(f)
                }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Unit (optional)">
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => set('unit', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 12"
                />
              </Field>
              <Field label="City" required>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Sydney"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="State" required>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => set('state', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. NSW"
                />
              </Field>
              <Field label="Postcode" required>
                <input
                  type="text"
                  value={form.postcode}
                  onChange={(e) => set('postcode', e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 2000"
                />
              </Field>
            </div>

            {htagConflicts.length > 0 && !form.htag_address_key && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-2">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Multiple matching addresses found — please select one
                </p>
                {htagConflicts.map((c) => (
                  <button
                    key={c.address_key}
                    type="button"
                    onClick={() => {
                      const addressText = buildAddressText({
                        unit: form.unit,
                        street: form.street,
                        city: form.city,
                        state: form.state,
                        postcode: form.postcode,
                      })
                      saveHtagAddressKey(addressText, {
                        address_key: c.address_key,
                        address_label: c.address_label,
                        cachedAt: new Date().toISOString(),
                      })
                      setForm((prev) => ({
                        ...prev,
                        htag_address_key: c.address_key,
                        htag_address_label: c.address_label,
                      }))
                      setHtagConflicts([])
                    }}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-amber-50 transition-colors"
                  >
                    <span>{c.address_label}</span>
                    <span className="ml-3 text-xs text-slate-400 shrink-0">Select</span>
                  </button>
                ))}
              </div>
            )}

            {htagResolving && (
              <p className="text-xs text-slate-400">Resolving address…</p>
            )}

            {form.htag_address_key && (
              <p className="text-xs text-green-700">
                ✓ Address confirmed: {form.htag_address_label}
              </p>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <CollapsibleSection
              open={showLoan}
              onToggle={() => setShowLoan((v) => !v)}
              openLabel="Hide loan details"
              closedLabel="Add loan details"
            >
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
            </CollapsibleSection>

            <CollapsibleSection
              open={showInsurance}
              onToggle={() => setShowInsurance((v) => !v)}
              openLabel="Hide insurance details"
              closedLabel="Add insurance details"
            >
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
            </CollapsibleSection>

            {!showLoan && !showInsurance && (
              <p className="text-sm text-slate-400 text-center py-2">
                Nothing required here — you can finish now and add these later.
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Prefill from data</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Auto-fill estimated value, rent and purchase history
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrefill}
                disabled={prefillLoading || !form.htag_address_key}
                className="flex items-center gap-2 rounded-lg bg-green-800 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <WandSparkles size={14} />
                {prefillLoading ? 'Fetching…' : 'Prefill'}
              </button>
            </div>

            {prefillError && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                {prefillError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Current value ($)" required>
                <input
                  type="number"
                  min={0}
                  value={form.current_value}
                  onChange={(e) => set('current_value', e.target.value)}
                  className={inputClass}
                  placeholder="650000"
                  autoFocus
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
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 rounded-xl bg-red-50 px-4 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          {step === 0 ? (
            <Link
              href="/properties"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
          ) : (
            <button
              type="button"
              onClick={goBack}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← Back
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-xl bg-green-800 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {step < LAST_STEP
              ? 'Continue →'
              : submitting
                ? 'Saving…'
                : mode === 'create'
                  ? 'Add property'
                  : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Stepper({ step, onStepClick }: { step: number; onStepClick: (i: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const state = i === step ? 'current' : i < step ? 'done' : 'todo'
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => onStepClick(i)}
              disabled={i >= step}
              className={`flex items-center gap-2 ${i < step ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  state === 'current'
                    ? 'bg-green-800 text-white'
                    : state === 'done'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  state === 'todo' ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className={`h-px flex-1 ${i < step ? 'bg-green-200' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
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

function CollapsibleSection({
  open,
  onToggle,
  openLabel,
  closedLabel,
  children,
}: {
  open: boolean
  onToggle: () => void
  openLabel: string
  closedLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-semibold text-green-800 hover:text-green-700 transition-colors"
      >
        <span className={`text-base leading-none transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
        {open ? openLabel : closedLabel}
      </button>
      {open && <div className="mt-4 flex flex-col gap-4">{children}</div>}
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
