'use client'

import { useState, useEffect } from 'react'
import { apiPost, apiGet } from '@/lib/propwatch/api/client'
import type { PortfolioSnapshotInsert } from '@/lib/propwatch/engine/types'

interface ScenarioResult {
  total_value: number
  total_debt: number
  total_equity: number
  monthly_cashflow: number
  weighted_lvr: number | null
  yield: number | null
}

interface ScenarioDelta {
  total_value: number
  total_equity: number
  monthly_cashflow: number
  weighted_lvr: number | null
}

interface ScenarioInsight {
  type: string
  severity: string
  title: string
  description: string
}

interface SavedScenario {
  id: string
  name: string
  config: Record<string, number>
}

interface Assumptions {
  interestRateDeltaPercent: string
  rentDeltaPercent: string
  expenseDeltaPercent: string
  valueDeltaPercent: string
}

interface Props {
  portfolioSnapshot: PortfolioSnapshotInsert
}

type PresetAssumptions = Partial<{
  interestRateDeltaPercent: number
  rentDeltaPercent: number
  expenseDeltaPercent: number
  valueDeltaPercent: number
}>

const PRESETS: { label: string; assumptions: PresetAssumptions }[] = [
  { label: 'Rate +1%', assumptions: { interestRateDeltaPercent: 1 } },
  { label: 'Rate +2%', assumptions: { interestRateDeltaPercent: 2 } },
  { label: 'Expenses +20%', assumptions: { expenseDeltaPercent: 20 } },
  { label: 'Values −10%', assumptions: { valueDeltaPercent: -10 } },
]

function fmt(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function pct(n: number | null) {
  return n !== null ? (n * 100).toFixed(1) + '%' : '—'
}

function DeltaCell({ delta }: { delta: number }) {
  const positive = delta >= 0
  return (
    <span className={`text-sm font-semibold ${positive ? 'text-green-700' : 'text-red-600'}`}>
      {positive ? '+' : '−'}{fmt(delta)}
    </span>
  )
}

function DeltaPct({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-slate-400">—</span>
  const positive = delta <= 0
  return (
    <span className={`text-sm font-semibold ${positive ? 'text-green-700' : 'text-red-600'}`}>
      {delta >= 0 ? '+' : ''}{(delta * 100).toFixed(1)}pp
    </span>
  )
}

export default function ScenariosTab({ portfolioSnapshot: snap }: Props) {
  const [assumptions, setAssumptions] = useState<Assumptions>({
    interestRateDeltaPercent: '',
    rentDeltaPercent: '',
    expenseDeltaPercent: '',
    valueDeltaPercent: '',
  })
  const [result, setResult] = useState<{ result: ScenarioResult; delta: ScenarioDelta; insights: ScenarioInsight[] } | null>(null)
  const [running, setRunning] = useState(false)
  const [scenarioName, setScenarioName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<{ scenarios: SavedScenario[] }>('/api/scenarios')
      .then((r) => setSavedScenarios(r.scenarios))
      .catch(() => {})
  }, [])

  function applyPreset(preset: typeof PRESETS[number]) {
    setAssumptions({
      interestRateDeltaPercent: String(preset.assumptions.interestRateDeltaPercent ?? ''),
      rentDeltaPercent: String(preset.assumptions.rentDeltaPercent ?? ''),
      expenseDeltaPercent: String(preset.assumptions.expenseDeltaPercent ?? ''),
      valueDeltaPercent: String(preset.assumptions.valueDeltaPercent ?? ''),
    })
    setResult(null)
  }

  function loadSaved(scenario: SavedScenario) {
    const c = scenario.config
    setAssumptions({
      interestRateDeltaPercent: String(c.interestRateDeltaPercent ?? ''),
      rentDeltaPercent: String(c.rentDeltaPercent ?? ''),
      expenseDeltaPercent: String(c.expenseDeltaPercent ?? ''),
      valueDeltaPercent: String(c.valueDeltaPercent ?? ''),
    })
    setResult(null)
  }

  async function runScenario() {
    setError(null)
    setRunning(true)
    try {
      const body: Record<string, number> = {}
      if (assumptions.interestRateDeltaPercent !== '') body.interestRateDeltaPercent = Number(assumptions.interestRateDeltaPercent)
      if (assumptions.rentDeltaPercent !== '') body.rentDeltaPercent = Number(assumptions.rentDeltaPercent)
      if (assumptions.expenseDeltaPercent !== '') body.expenseDeltaPercent = Number(assumptions.expenseDeltaPercent)
      if (assumptions.valueDeltaPercent !== '') body.valueDeltaPercent = Number(assumptions.valueDeltaPercent)
      const data = await apiPost<{ result: ScenarioResult; delta: ScenarioDelta; insights: ScenarioInsight[] }>(
        '/api/scenario/run',
        { assumptions: body }
      )
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run scenario')
    } finally {
      setRunning(false)
    }
  }

  async function saveScenario() {
    if (!scenarioName.trim()) return
    setSaving(true)
    try {
      const config: Record<string, number> = {}
      if (assumptions.interestRateDeltaPercent !== '') config.interestRateDeltaPercent = Number(assumptions.interestRateDeltaPercent)
      if (assumptions.rentDeltaPercent !== '') config.rentDeltaPercent = Number(assumptions.rentDeltaPercent)
      if (assumptions.expenseDeltaPercent !== '') config.expenseDeltaPercent = Number(assumptions.expenseDeltaPercent)
      if (assumptions.valueDeltaPercent !== '') config.valueDeltaPercent = Number(assumptions.valueDeltaPercent)
      const { scenario } = await apiPost<{ scenario: SavedScenario }>('/api/scenario/save', {
        name: scenarioName.trim(),
        config,
      })
      setSavedScenarios((prev) => [scenario, ...prev])
      setScenarioName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save scenario')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-700'

  return (
    <div className="flex flex-col gap-8">
      {/* Presets */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">Quick presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Builder */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col gap-4">
        <p className="text-sm font-semibold text-slate-700">Scenario builder</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { field: 'interestRateDeltaPercent' as const, label: 'Interest Rate Δ%', placeholder: 'e.g. +1.5 or -0.5' },
            { field: 'rentDeltaPercent' as const, label: 'Rent Δ%', placeholder: 'e.g. -10 (10% drop)' },
            { field: 'expenseDeltaPercent' as const, label: 'Expense Δ%', placeholder: 'e.g. +20' },
            { field: 'valueDeltaPercent' as const, label: 'Property Value Δ%', placeholder: 'e.g. -5' },
          ].map(({ field, label, placeholder }) => (
            <div key={field} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
              <input
                type="number"
                value={assumptions[field]}
                onChange={(e) => setAssumptions((prev) => ({ ...prev, [field]: e.target.value }))}
                placeholder={placeholder}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}
        <button
          onClick={runScenario}
          disabled={running}
          className="w-full rounded-xl bg-green-800 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
        >
          {running ? 'Running…' : 'Run scenario'}
        </button>
      </div>

      {/* Before/After table */}
      {result && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Before vs After</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Metric', 'Current', 'Scenario', 'Change'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: 'Monthly Cashflow',
                  current: (snap.monthly_cashflow >= 0 ? '+' : '-') + fmt(snap.monthly_cashflow),
                  scenario: (result.result.monthly_cashflow >= 0 ? '+' : '-') + fmt(result.result.monthly_cashflow),
                  delta: <DeltaCell delta={result.delta.monthly_cashflow} />,
                },
                {
                  label: 'Total Equity',
                  current: fmt(snap.total_equity),
                  scenario: fmt(result.result.total_equity),
                  delta: <DeltaCell delta={result.delta.total_equity} />,
                },
                {
                  label: 'LVR',
                  current: pct(snap.weighted_lvr),
                  scenario: pct(result.result.weighted_lvr),
                  delta: <DeltaPct delta={result.delta.weighted_lvr} />,
                },
                {
                  label: 'Gross Yield',
                  current: pct(snap.yield),
                  scenario: pct(result.result.yield),
                  delta: null,
                },
              ].map((row) => (
                <tr key={row.label} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                  <td className="px-4 py-3 text-slate-600">{row.current}</td>
                  <td className="px-4 py-3 text-slate-600">{row.scenario}</td>
                  <td className="px-4 py-3">{row.delta ?? <span className="text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.insights.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Scenario warnings</p>
              {result.insights.map((i, idx) => (
                <div key={idx} className={`rounded-xl border px-4 py-2.5 ${i.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <p className="text-sm font-semibold text-slate-800">{i.title}</p>
                  <p className="text-sm text-slate-500">{i.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save scenario */}
      {result && (
        <div className="flex gap-3">
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Name this scenario…"
            className={`flex-1 ${inputClass}`}
          />
          <button
            onClick={saveScenario}
            disabled={saving || !scenarioName.trim()}
            className="rounded-xl bg-green-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60 shrink-0"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {/* Saved scenarios */}
      {savedScenarios.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-700">Saved scenarios</p>
          {savedScenarios.map((scenario) => (
            <div key={scenario.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm font-medium text-slate-800">{scenario.name}</p>
              <button
                onClick={() => loadSaved(scenario)}
                className="text-xs font-semibold text-green-800 hover:text-green-700 transition-colors"
              >
                Load →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
