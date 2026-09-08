'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Info, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { apiDelete } from '@/lib/propwatch/api/client'
import PageHero from '@/components/ui/PageHero'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import PropertyMap from './PropertyMap'
import { formatCurrencyShort } from '@/lib/formatters'

interface PropertyRow {
  id: string
  portfolio_id: string
  name: string
  unit: string | null
  street: string | null
  city: string | null
  postcode: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
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
  initialProperties: PropertyRow[]
  portfolioId: string | null
}

/** Single-line address for the card subtitle and the map's accessible label. */
function formatAddress(p: PropertyRow): string {
  const street = [p.unit?.trim(), p.street?.trim()].filter(Boolean).join('/')
  const locality = [p.city?.trim(), p.state?.trim(), p.postcode?.trim()]
    .filter(Boolean)
    .join(' ')
  return [street, locality].filter(Boolean).join(', ')
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">{value}</p>
    </div>
  )
}

export default function PropertiesShell({ initialProperties }: Props) {
  const [properties, setProperties] = useState<PropertyRow[]>(initialProperties)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // The property awaiting delete confirmation; null when the dialog is closed.
  const [pendingDelete, setPendingDelete] = useState<PropertyRow | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  // A backfilled geocode is persisted server-side; mirroring it into local state
  // keeps the card from re-requesting if it remounts before the next refresh.
  function handleResolved(id: string, coords: { latitude: number; longitude: number }) {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...coords } : p))
    )
  }

  // Only ever reached via the confirmation dialog — removing a property also
  // discards its snapshot history, so it is never a one-click action.
  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await apiDelete(`/api/properties/${id}`)
      setProperties((prev) => prev.filter((p) => p.id !== id))
      setPendingDelete(null)
      toast('Property removed.', 'success')
      router.refresh()
    } catch {
      // Leave the dialog open so the user can retry without hunting for the
      // card again; the toast explains why nothing changed.
      toast('Failed to remove property.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        icon={Building2}
        eyebrow="Portfolio"
        title="Properties"
        description={
          properties.length === 0
            ? 'No properties yet.'
            : `${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} in your portfolio`
        }
        action={
          <Link
            href="/properties/new"
            className="rounded-xl bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors shrink-0"
          >
            + Add property
          </Link>
        }
        callout={
          <>
            <Info size={15} className="shrink-0 text-slate-400 mt-0.5" />
            <span>
              Each property feeds into your portfolio metrics, risk score, and scenario modelling across the app.
            </span>
          </>
        }
      />

      {properties.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
          <p className="text-slate-400 text-sm">Add your first property to get started.</p>
          <Link
            href="/properties/new"
            className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Add your first property →
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => {
            const tenanted = p.monthly_rent > 0
            return (
              <div
                key={p.id}
                className="animate-fade-in flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative">
                  <PropertyMap
                    propertyId={p.id}
                    latitude={p.latitude}
                    longitude={p.longitude}
                    addressLabel={formatAddress(p)}
                    canGeocode={!!p.street?.trim()}
                    onResolved={(coords) => handleResolved(p.id, coords)}
                    className="h-40 w-full border-b border-slate-100"
                  />
                  <span
                    className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm ${
                      tenanted
                        ? 'bg-green-100/95 text-green-800'
                        : 'bg-white/95 text-slate-500'
                    }`}
                  >
                    {tenanted ? 'Tenanted' : 'Vacant'}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{p.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {formatAddress(p) || 'No address on record'}
                    </p>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-3">
                    <Metric label="Value" value={formatCurrencyShort(p.current_value)} />
                    <Metric
                      label="Rent"
                      value={tenanted ? `${formatCurrencyShort(p.monthly_rent)}/mo` : '—'}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
                  <Link
                    href={`/properties/${p.id}/edit`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => setPendingDelete(p)}
                    disabled={deletingId === p.id}
                    className="flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    {deletingId === p.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        destructive
        busy={deletingId !== null}
        title="Remove this property?"
        description={
          <>
            <span className="font-medium text-slate-700">{pendingDelete?.name}</span> will
            be permanently deleted, along with its recorded history. Your portfolio
            metrics, risk score, and scenarios will all be recalculated without it.
          </>
        }
        confirmLabel="Remove property"
        cancelLabel="Keep it"
        onConfirm={() => pendingDelete && handleDelete(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
