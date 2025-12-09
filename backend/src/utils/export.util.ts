import { Response } from 'express'
import { AuthRequest } from '../types/common.types'
import { ExportService } from '../services/export.service'
import { sendError } from './response.util'
import { logInfo, logError } from '../config/logger'

export async function handleExportToken(req: AuthRequest, res: Response) {
  try {
    const token = ExportService.generateToken(req.user!.id)
    res.json({ success: true, data: { token } })
  } catch (error) {
    logError('Failed to generate export token', { error: (error as Error).message, user: req.user?.id })
    sendError(res, (error as Error).message, 400)
  }
}

export async function handleExport(
  req: AuthRequest,
  res: Response,
  exportFn: (filter?: any) => Promise<Buffer>,
  filename: string
) {
  try {
    const { token } = req.query
    if (!token || !ExportService.validateToken(token as string, req.user!.id)) {
      return sendError(res, 'Invalid or expired export token', 403)
    }

    const buffer = await exportFn((req as any).filterParams)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}-${timestamp}.xlsx`)
    res.send(buffer)
    
    logInfo('Data exported', { user: req.user?.id, filename })
  } catch (error) {
    logError('Failed to export data', { error: (error as Error).message, user: req.user?.id })
    sendError(res, (error as Error).message, 400)
  }
}

export async function handleImportPreview(
  req: AuthRequest,
  res: Response,
  previewFn: (buffer: Buffer) => Promise<any[]>
) {
  try {
    if (!req.file) return sendError(res, 'No file uploaded', 400)
    
    const preview = await previewFn(req.file.buffer)
    res.json({ success: true, data: { preview: preview.slice(0, 10), total: preview.length } })
  } catch (error) {
    logError('Failed to preview import', { error: (error as Error).message, user: req.user?.id })
    sendError(res, (error as Error).message, 400)
  }
}

export async function handleImport(
  req: AuthRequest,
  res: Response,
  importFn: (buffer: Buffer, skipDuplicates: boolean) => Promise<any>
) {
  try {
    if (!req.file) return sendError(res, 'No file uploaded', 400)
    
    const { skipDuplicates } = req.body
    const result = await importFn(req.file.buffer, skipDuplicates === 'true')
    
    logInfo('Data imported', { result, user: req.user?.id })
    res.json({ success: true, data: result, message: 'Import completed' })
  } catch (error) {
    logError('Failed to import data', { error: (error as Error).message, user: req.user?.id })
    sendError(res, (error as Error).message, 400)
  }
}
