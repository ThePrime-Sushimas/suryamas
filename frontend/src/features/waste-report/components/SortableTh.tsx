import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

export type DetailSortColumn = 'date' | 'branch' | 'source' | 'product' | 'qty' | 'value' | 'reason'
export type SortDirection = 'asc' | 'desc'

export function SortableTh({
  label,
  column,
  active,
  direction,
  onSort,
  align = 'left',
}: {
  label: string
  column: DetailSortColumn
  active: DetailSortColumn | null
  direction: SortDirection
  onSort: (c: DetailSortColumn) => void
  align?: 'left' | 'right'
}) {
  const isActive = active === column
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 ${align === 'right' ? 'ml-auto' : ''}`}
      >
        {label}
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
        )}
      </button>
    </th>
  )
}
