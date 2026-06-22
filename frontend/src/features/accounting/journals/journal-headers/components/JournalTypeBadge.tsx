import { JOURNAL_TYPE_LABELS } from '../../shared/journal.constants'
import type { JournalType } from '../../shared/journal.types'
import { Wallet, ShoppingCart, Receipt, Package, Banknote, Landmark, Building2, Scale, ClipboardList, Users, CreditCard, PiggyBank, Tags } from 'lucide-react'

interface JournalTypeBadgeProps {
  type: JournalType
  className?: string
}

const typeIcons: Record<string, React.ReactNode> = {
  EXPENSE: <Receipt size={12} />,
  PURCHASE: <ShoppingCart size={12} />,
  SALES: <Banknote size={12} />,
  INVENTORY: <Package size={12} />,
  CASH: <Banknote size={12} />,
  BANK: <Landmark size={12} />,
  ASSET: <Building2 size={12} />,
  TAX: <Tags size={12} />,
  GENERAL: <Scale size={12} />,
  OPENING: <ClipboardList size={12} />,
  RECEIVABLE: <Users size={12} />,
  PAYROLL: <CreditCard size={12} />,
  PAYABLE: <Wallet size={12} />,
  FINANCING: <PiggyBank size={12} />,
}

const typeColorClasses: Record<string, string> = {
  // Revenue
  SALES:      'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  // Cost & Expense
  EXPENSE:    'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  PURCHASE:   'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  PAYABLE:    'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  PAYROLL:    'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
  // Assets & Inventory
  INVENTORY:  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  ASSET:      'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  // Cash & Bank
  CASH:       'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  BANK:       'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  FINANCING:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
  RECEIVABLE: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  // Admin
  TAX:        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  GENERAL:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  OPENING:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

export const JournalTypeBadge = ({ type, className = '' }: JournalTypeBadgeProps) => {
  const label = JOURNAL_TYPE_LABELS[type]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
        typeColorClasses[type] ?? 'bg-gray-100 text-gray-600'
      } ${className}`}
    >
      {typeIcons[type]}
      {label}
    </span>
  )
}
