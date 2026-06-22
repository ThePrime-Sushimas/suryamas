import { Send, CheckCircle, XCircle, RotateCcw, FileText, Banknote, Clock } from 'lucide-react'
import { formatDateShort } from '../../../shared/journal.utils'
import type { JournalHeaderWithLines } from '../../types/journal-header.types'

interface AuditTimelineCardProps {
  journal: JournalHeaderWithLines
}

export function AuditTimelineCard({ journal }: AuditTimelineCardProps) {
  const timelineEvents = [
    journal.created_at && {
      date: journal.created_at,
      user: journal.created_by_name,
      action: 'Dibuat',
      icon: <FileText className="w-4 h-4" />,
      color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    },
    journal.submitted_at && {
      date: journal.submitted_at,
      user: journal.submitted_by_name,
      action: 'Dikirim',
      icon: <Send className="w-4 h-4" />,
      color: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400',
    },
    journal.approved_at && {
      date: journal.approved_at,
      user: journal.approved_by_name,
      action: 'Disetujui',
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
    },
    journal.posted_at && {
      date: journal.posted_at,
      user: journal.posted_by_name,
      action: 'Diposting',
      icon: <Banknote className="w-4 h-4" />,
      color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
    },
    journal.rejected_at && {
      date: journal.rejected_at,
      user: journal.rejected_by_name,
      action: 'Ditolak',
      icon: <XCircle className="w-4 h-4" />,
      color: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
    },
    journal.is_reversed && journal.reversal_date && {
      date: journal.reversal_date,
      user: journal.reversed_by_name,
      action: 'Dibalikkan',
      icon: <RotateCcw className="w-4 h-4" />,
      color: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400',
    },
  ].filter(Boolean) as Array<{
    date: string
    user?: string
    action: string
    icon: React.ReactNode
    color: string
  }>

  // Sort by date descending
  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Riwayat Aktivitas
        </h3>
      </div>
      <div className="p-4">
        {timelineEvents.length > 0 ? (
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
            
            <div className="space-y-4">
              {timelineEvents.map((event, index) => (
                <div key={index} className="relative flex gap-3">
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${event.color}`}>
                    {event.icon}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{event.action}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateShort(event.date)}</p>
                    {event.user && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">oleh {event.user}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Belum ada aktivitas</p>
        )}
      </div>
    </div>
  )
}
