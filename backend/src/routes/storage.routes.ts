import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { resolveBranchContext } from '../middleware/branch-context.middleware'
import { storageService } from '../services/storage.service'
import { sendSuccess } from '../utils/response.util'
import { handleError } from '../utils/error-handler.util'

const router = Router()

router.use(authenticate, resolveBranchContext)

/**
 * GET /api/v1/storage/signed-url?path=...&bucket=...
 * Generate a signed URL for viewing private files.
 * Valid for 15 minutes. Requires authentication.
 */
router.get('/signed-url', async (req: Request, res: Response) => {
  try {
    const path = req.query.path as string
    const bucket = req.query.bucket as string | undefined

    if (!path) {
      res.status(400).json({ success: false, message: 'path is required' })
      return
    }

    // Prevent path traversal
    if (path.includes('..') || path.startsWith('/')) {
      res.status(400).json({ success: false, message: 'Invalid path' })
      return
    }

    // Whitelist allowed buckets
    const ALLOWED_BUCKETS = ['invoices', 'buktisetoran', 'profilepictures']
    const targetBucket = bucket || 'invoices'
    if (!ALLOWED_BUCKETS.includes(targetBucket)) {
      res.status(400).json({ success: false, message: `bucket '${targetBucket}' not allowed` })
      return
    }

    // Tenant isolation: path must start with user's company_id for tenant-scoped buckets
    const companyId = req.context?.company_id
    const TENANT_SCOPED_BUCKETS = ['invoices', 'buktisetoran']
    if (TENANT_SCOPED_BUCKETS.includes(targetBucket) && companyId && !path.startsWith(`${companyId}/`)) {
      res.status(403).json({ success: false, message: 'Access denied to this file' })
      return
    }

    const signedUrl = await storageService.createSignedUrl(path, 900, targetBucket)
    sendSuccess(res, { url: signedUrl, expires_in: 900 }, 'Signed URL generated')
  } catch (error: unknown) {
    await handleError(res, error, req, { action: 'get_signed_url' })
  }
})

export default router
