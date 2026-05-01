import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { paymentTermsController } from './payment-terms.controller'
import { PermissionService } from '../../services/permission.service'
import { createPaymentTermSchema, updatePaymentTermSchema, paymentTermIdSchema } from './payment-terms.schema'

const router = Router()

PermissionService.registerModule('payment_terms', 'Payment Terms Management').catch(() => {})

const sortFields = ['term_code', 'term_name', 'calculation_type', 'days', 'created_at', 'updated_at', 'id_payment_term']

router.use(authenticate, resolveBranchContext)

router.get('/', canView('payment_terms'), queryMiddleware({ allowedSortFields: sortFields, defaultSort: 'term_name' }), (req, res) => paymentTermsController.list(req, res))
router.get('/minimal/active', canView('payment_terms'), (req, res) => paymentTermsController.minimalActive(req, res))
router.get('/:id', canView('payment_terms'), validateSchema(paymentTermIdSchema), (req, res) => paymentTermsController.findById(req, res))
router.post('/', canInsert('payment_terms'), validateSchema(createPaymentTermSchema), (req, res) => paymentTermsController.create(req, res))
router.put('/:id', canUpdate('payment_terms'), validateSchema(updatePaymentTermSchema), (req, res) => paymentTermsController.update(req, res))
router.delete('/:id', canDelete('payment_terms'), validateSchema(paymentTermIdSchema), (req, res) => paymentTermsController.delete(req, res))
router.post('/:id/restore', canUpdate('payment_terms'), validateSchema(paymentTermIdSchema), (req, res) => paymentTermsController.restore(req, res))

export default router
