import { useState } from 'react'
import api from '../lib/axios'
import { useToast } from '@/contexts/ToastContext'

interface ApiResponse<T> {
  success: boolean
  data: T
}

interface ExportButtonProps {
  endpoint: string
  filename: string
  filter?: any
}

export default function ExportButton({ endpoint, filename, filter = {} }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const { error } = useToast()

  const handleExport = async () => {
    setIsExporting(true)
    setProgress(10)
    try {
      const { data: tokenData } = await api.get<ApiResponse<{ token: string }>>(`${endpoint}/export/token`)
      setProgress(50)
      const params = new URLSearchParams({ token: tokenData.data.token, ...filter })
      const response = await api.get(`${endpoint}/export?${params}`, { responseType: 'blob' })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      setProgress(100)
      setTimeout(() => setProgress(0), 1000)
    } catch (err) {
      setProgress(0)
      error('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isExporting ? 'Exporting...' : 'Export Excel'}
      </button>
      {progress > 0 && (
        <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all" style={{ width: `${progress}%` }} />
      )}
    </div>
  )
}
