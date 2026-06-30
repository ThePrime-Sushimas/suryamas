import { RequestCard } from './RequestCard'
import type { PettyCashRequest } from '../types/pettyCash.types'

interface RequestCardListProps {
  rows: PettyCashRequest[]
  onRowClick: (id: string) => void
}

export function RequestCardList({ rows, onRowClick }: RequestCardListProps) {
  return (
    <div className="space-y-3 p-4">
      {rows.map((r) => (
        <RequestCard key={r.id} request={r} onClick={onRowClick} />
      ))}
    </div>
  )
}