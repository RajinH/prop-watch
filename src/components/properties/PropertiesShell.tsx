'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/ToastProvider'
import { apiDelete } from '@/lib/propwatch/api/client'
import PropertyForm from './PropertyForm'

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
  initialProperties: PropertyRow[]
  portfolioId: string | null
}

export default function PropertiesShell({ initialProperties, portfolioId }: Props) {
  const [properties, setProperties] = useState<PropertyRow[]>(initialProperties)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<PropertyRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  function openCreate() {
    setEditTarget(null)
    setModalMode('create')
  }

  function openEdit(property: PropertyRow) {
    setEditTarget(property)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditTarget(null)
  }

  function handleSuccess(property: PropertyRow) {
    if (modalMode === 'create') {
      setProperties((prev) => [...prev, property])
      toast('Property added.', 'success')
    } else {
      setProperties((prev) => prev.map((p) => (p.id === property.id ? property : p)))
      toast('Property updated.', 'success')
    }
    closeModal()
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await apiDelete(`/api/properties/${id}`)
      setProperties((prev) => prev.filter((p) => p.id !== id))
      toast('Property removed.', 'success')
      router.refresh()
    } catch {
      toast('Failed to remove property.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Properties</h1>
            <p className="text-slate-500 mt-1">
              {properties.length === 0
                ? 'No properties yet.'
                : `${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} in your portfolio`}
            </p>
          </div>
          {portfolioId && (
            <button
              onClick={openCreate}
              className="rounded-xl bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors shrink-0"
            >
              + Add property
            </button>
          )}
        </div>

        {properties.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm">Add your first property to get started.</p>
            {portfolioId && (
              <button
                onClick={openCreate}
                className="rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Add your first property →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {properties.map((p) => (
              <div
                key={p.id}
                className="animate-fade-in rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{p.name}</p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Value: ${p.current_value.toLocaleString('en-AU')} AUD
                      {p.monthly_rent > 0
                        ? ` · Rent: $${p.monthly_rent.toLocaleString('en-AU')}/mo`
                        : ' · Vacant'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.monthly_rent > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.monthly_rent > 0 ? 'Tenanted' : 'Vacant'}
                    </span>
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deletingId === p.id ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalMode && portfolioId && (
        <PropertyForm
          mode={modalMode}
          property={editTarget ?? undefined}
          portfolioId={portfolioId}
          onSuccess={handleSuccess}
          onClose={closeModal}
        />
      )}
    </>
  )
}
