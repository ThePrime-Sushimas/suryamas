import { useState } from 'react'
import api from '../lib/axios'

interface ApiResponse<T> {
  success: boolean
  data: T
}

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  endpoint: string
  title: string
}

export default function ImportModal({ isOpen, onClose, onSuccess, endpoint, title }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      alert('Only Excel files (.xlsx, .xls) are allowed')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setFile(selectedFile)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const { data } = await api.post<ApiResponse<any>>(`${endpoint}/import/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setPreview(data.data)
    } catch (error) {
      alert('Failed to preview file')
    }
  }

  const handleImport = async () => {
    if (!file) return
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('skipDuplicates', String(skipDuplicates))
      const { data } = await api.post<ApiResponse<any>>(`${endpoint}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(data.data)
      if (data.data.failed === 0) {
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 2000)
      }
    } catch (error: any) {
      alert(error.message || 'Import failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Import {title}</h2>

        {!result && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Excel File</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {preview && (
              <>
                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="mr-2"
                    />
                    Skip duplicate entries
                  </label>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Preview (First 10 rows of {preview.total})</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border">
                      <thead className="bg-gray-100">
                        <tr>
                          {preview.preview[0] && Object.keys(preview.preview[0]).filter(k => k !== '_rowNumber').map((key: string) => (
                            <th key={key} className="border px-2 py-1 text-sm">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((row: any, idx: number) => (
                          <tr key={idx}>
                            {Object.entries(row).filter(([k]) => k !== '_rowNumber').map(([key, value]: [string, any]) => (
                              <td key={key} className="border px-2 py-1 text-sm">{String(value)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {result && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Import Result</h3>
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-green-600">✓ Success: {result.success}</p>
              <p className="text-red-600">✗ Failed: {result.failed}</p>
              {result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-semibold">Errors:</p>
                  <ul className="list-disc pl-5 max-h-40 overflow-y-auto">
                    {result.errors.map((err: any, idx: number) => (
                      <li key={idx} className="text-sm">Row {err.row}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && preview && (
            <button
              onClick={handleImport}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
