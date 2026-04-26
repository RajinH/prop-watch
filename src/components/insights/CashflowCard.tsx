'use client'

import type { CashflowResult } from '@/engine/types'
import { formatCashflow, formatCurrencyShort } from '@/lib/formatters'

interface Props {
  cashflow: CashflowResult
  style?: React.CSSProperties
}

export default function CashflowCard({ cashflow, style }: Props) {
  const isPositive = cashflow.isPositive

  return (
    <div
      className="animate-slide-up rounded-2xl border border-slate-100 bg-white p-5 flex flex-col gap-4 shadow-sm"
      style={style}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Cash Flow</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {isPositive ? 'Positive' : 'Negative'}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span
          className={`text-3xl font-bold ${isPositive ? 'text-green-800' : 'text-red-700'}`}
        >
          {formatCashflow(cashflow.monthlyCashflow)}
        </span>
        <span className="text-sm text-slate-400">
          {formatCurrencyShort(Math.abs(cashflow.annualCashflow))}/year
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-400">Rent income</span>
          <span className="text-sm font-medium text-slate-700">
            {cashflow.monthlyRentalIncome > 0
              ? `$${cashflow.monthlyRentalIncome.toLocaleString('en-AU')}/mo`
              : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-400">Expenses</span>
          <span className="text-sm font-medium text-slate-700">
            -${Math.round(cashflow.monthlyExpenses).toLocaleString('en-AU')}/mo
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-400">Mortgage</span>
          <span className="text-sm font-medium text-slate-700">
            {cashflow.monthlyMortgagePayment > 0
              ? `-$${cashflow.monthlyMortgagePayment.toLocaleString('en-AU')}/mo`
              : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
