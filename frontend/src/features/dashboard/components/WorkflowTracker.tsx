import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Lock } from 'lucide-react'
import type { WorkflowStep, StepStatus } from '../types/dashboard.types'

interface Props {
  periodLabel: string
  totalStatements: number
  unmatchedCount: number
  reconciledCount: number
  unreconciledCount: number
  cashPending: number
  feeDiscrepancyCount: number
}

const statusConfig: Record<StepStatus, { dot: string; badge: string; badgeText: string }> = {
  done:   { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', badgeText: 'Selesai' },
  warn:   { dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',       badgeText: 'Perlu Tindakan' },
  error:  { dot: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',            badgeText: 'Masalah' },
  idle:   { dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',               badgeText: 'Menunggu' },
  locked: { dot: 'bg-gray-300',    badge: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',               badgeText: 'Terkunci' },
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
  if (status === 'error') return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
  if (status === 'locked') return <Lock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
  return <div className="w-2 h-2 rounded-full bg-gray-400" />
}

export function WorkflowTracker({
  periodLabel, totalStatements, unmatchedCount, reconciledCount,
  unreconciledCount, cashPending, feeDiscrepancyCount,
}: Props) {
  const navigate = useNavigate()

  const hasBlockers = unreconciledCount > 0 || cashPending > 0 || feeDiscrepancyCount > 0

  const steps: WorkflowStep[] = useMemo(() => {
    const s1Status: StepStatus = totalStatements > 0
      ? (unmatchedCount > 0 ? 'warn' : 'done')
      : 'idle'

    const s2Status: StepStatus = reconciledCount > 0
      ? (unreconciledCount > 0 ? 'warn' : 'done')
      : 'idle'

    const s3Status: StepStatus = cashPending > 0 ? 'warn' : 'done'

    const s4Status: StepStatus = feeDiscrepancyCount > 0
      ? (feeDiscrepancyCount > 2 ? 'error' : 'warn')
      : (totalStatements > 0 ? 'done' : 'idle')

    const s5Locked = hasBlockers
    const s6Locked = hasBlockers

    return [
      { number: 1, name: 'Bank Statement', subtitle: 'Import & match', status: s1Status, detail: `${totalStatements} imported · ${unmatchedCount} unmatched`, href: '/bank-statement-import', isLocked: false },
      { number: 2, name: 'Bank Reconciliation', subtitle: 'Match vs POS', status: s2Status, detail: `${reconciledCount} matched · ${unreconciledCount} unreconciled`, href: '/bank-reconciliation', isLocked: false },
      { number: 3, name: 'Cash Count', subtitle: 'Setoran kas', status: s3Status, detail: `${cashPending} pending deposit`, href: '/cash-counts', isLocked: false },
      { number: 4, name: 'Fee Discrepancy', subtitle: 'Review selisih fee', status: s4Status, detail: `${feeDiscrepancyCount} unresolved`, href: '/bank-reconciliation/fee-discrepancy-review', isLocked: false },
      { number: 5, name: 'Journal Entries', subtitle: 'Posting jurnal', status: s5Locked ? 'locked' : 'idle', detail: s5Locked ? 'Selesaikan step 2–4' : 'Siap posting', href: '/accounting/journals', isLocked: s5Locked },
      { number: 6, name: 'Trial Balance', subtitle: 'Laporan neraca saldo', status: s6Locked ? 'locked' : 'idle', detail: s6Locked ? 'Selesaikan step 2–4' : 'Siap generate', href: '/accounting/trial-balance', isLocked: s6Locked },
    ]
  }, [totalStatements, unmatchedCount, reconciledCount, unreconciledCount, cashPending, feeDiscrepancyCount, hasBlockers])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Workflow Tracker</span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{periodLabel}</span>
      </div>

      <div className="p-3">
        {steps.map((step, i) => {
          const cfg = statusConfig[step.status]
          const isLast = i === steps.length - 1
          return (
            <div key={step.number} className="flex gap-2.5" style={step.isLocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    step.status === 'done' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                    step.status === 'warn' ? 'bg-amber-100 dark:bg-amber-900/30' :
                    step.status === 'error' ? 'bg-rose-100 dark:bg-rose-900/30' :
                    'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  <StepIcon status={step.status} />
                </div>
                {!isLast && <div className="w-px flex-1 min-h-3 bg-gray-200 dark:bg-gray-700 my-0.5" />}
              </div>
              <button
                disabled={step.isLocked}
                onClick={() => !step.isLocked && step.href && navigate(step.href)}
                className={`flex-1 flex items-center justify-between pb-3 text-left ${
                  step.isLocked ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-1.5 px-1.5 rounded-lg transition-colors duration-120'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {step.number}. {step.name}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{step.subtitle}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{step.detail}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${cfg.badge}`}>
                  {cfg.badgeText}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
