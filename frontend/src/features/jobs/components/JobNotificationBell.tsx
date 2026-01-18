/**
 * Job Notification Bell Component
 */

import { useState, useEffect } from 'react'
import { Bell, Download, X, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'
import { useJobsStore } from '../store/jobs.store'
import type { Job } from '../types/jobs.types'

const STATUS_CONFIG = {
  pending: { label: 'Waiting for process', color: 'text-yellow-600', icon: Clock },
  processing: { label: 'Processing', color: 'text-blue-600', icon: Loader },
  completed: { label: 'Completed', color: 'text-green-600', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-red-600', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-gray-600', icon: XCircle },
}

export function JobNotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const { jobs, loading, fetchRecentJobs, downloadFile } = useJobsStore()

  // Poll every 15 seconds (reduced from 5s to decrease server load)
  useEffect(() => {
    fetchRecentJobs()
    const interval = setInterval(fetchRecentJobs, 15000)
    return () => clearInterval(interval)
  }, [fetchRecentJobs])

  const activeJobsCount = jobs.filter(j => j.status === 'pending' || j.status === 'processing').length

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  const isExpired = (job: Job) => {
    if (!job.expires_at) return false
    return new Date(job.expires_at) < new Date()
  }

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {activeJobsCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
            {activeJobsCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Reporting Queue List</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subtitle */}
            <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600 border-b border-gray-200">
              Last 10 processed files. Download within 12 hours to avoid expiration.
            </div>

            {/* Jobs List */}
            <div className="flex-1 overflow-y-auto">
              {loading && jobs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p>Loading jobs...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No recent jobs</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {jobs.map((job) => {
                    const config = STATUS_CONFIG[job.status]
                    const StatusIcon = config.icon
                    const expired = isExpired(job)

                    return (
                      <div key={job.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {job.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <StatusIcon className={`w-4 h-4 ${config.color} ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                              <span className={`text-sm ${config.color}`}>
                                {config.label}
                              </span>
                            </div>
                            {job.status === 'processing' && (
                              <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${job.progress}%` }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{job.progress}%</p>
                              </div>
                            )}
                            {job.error_message && (
                              <p className="text-sm text-red-600 mt-1">{job.error_message}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(job.created_at)}
                            </p>
                          </div>

                          {job.status === 'completed' && !expired && (
                            <button
                              onClick={() => downloadFile(job)}
                              className="shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Download"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          )}
                        </div>

                        {expired && (
                          <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            File expired
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
