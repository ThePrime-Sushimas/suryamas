import { JOURNAL_TYPE_LABELS } from '../../shared/journal.constants'
import type { JournalType } from '../../shared/journal.types'
import { Wallet, ShoppingCart, Receipt, Package, Banknote, Landmark, Building2, Scale, ClipboardList, Users, CreditCard, PiggyBank, Tags } from 'lucide-react'

interface JournalTypeBadgeProps {
  type: JournalType
  className?: string
}

const typeIcons: Record<string, React.ReactNode> = {
  EXPENSE: <Wallet size={12} />,
  PURCHASE: <ShoppingCart size={12} />,
  SALES: <Receipt size={12} />,
  INVENTORY: <Package size={12} />,
  CASH: <Banknote size={12} />,
  BANK: <Landmark size={12} />,
  ASSET: <Building2 size={12} />,
  TAX: <Tags size={12} />,
  GENERAL: <Scale size={12} />,
  OPENING: <ClipboardList size={12} />,
  RECEIVABLE: <Users size={12} />,
  PAYROLL: <CreditCard size={12} />,
  PAYABLE: <ShoppingCart size={12} />,
  FINANCING: <PiggyBank size={12} />,
}

export const JournalTypeBadge = ({ type, className = '' }: JournalTypeBadgeProps) => {
  const label = JOURNAL_TYPE_LABELS[type]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 ${className}`}
    >
      {typeIcons[type]}
      {label}
    </span>
  )
}

