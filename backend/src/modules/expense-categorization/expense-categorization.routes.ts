import { Router } from 'express'
import { expenseCategorizationController } from './expense-categorization.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import {
  createRuleSchema, updateRuleSchema, deleteRuleSchema,
  categorizeManualSchema, uncategorizeSchema, autoCategorizeSchema,
  listUncategorizedSchema, generateJournalSchema,
} from './expense-categorization.schema'

PermissionService.registerModule('cash_flow', 'Cash Flow & Expense Categorization').catch((err) => {
  console.error('Failed to register cash_flow module:', err instanceof Error ? err.message : err)
})

const MODULE = 'cash_flow'
const router = Router()

router.use(authenticate, resolveBranchContext)

// Rules CRUD
router.get('/rules', canView(MODULE), (req, res) => expenseCategorizationController.listRules(req, res))
router.post('/rules', canInsert(MODULE), validateSchema(createRuleSchema), (req, res) => expenseCategorizationController.createRule(req, res))
router.put('/rules/:id', canUpdate(MODULE), validateSchema(updateRuleSchema), (req, res) => expenseCategorizationController.updateRule(req, res))
router.delete('/rules/:id', canDelete(MODULE), validateSchema(deleteRuleSchema), (req, res) => expenseCategorizationController.deleteRule(req, res))

// Categorization actions
router.post('/auto', canUpdate(MODULE), validateSchema(autoCategorizeSchema), (req, res) => expenseCategorizationController.autoCategorize(req, res))
router.post('/manual', canUpdate(MODULE), validateSchema(categorizeManualSchema), (req, res) => expenseCategorizationController.categorizeManual(req, res))
router.post('/uncategorize', canUpdate(MODULE), validateSchema(uncategorizeSchema), (req, res) => expenseCategorizationController.uncategorize(req, res))

// List uncategorized
router.get('/uncategorized', canView(MODULE), validateSchema(listUncategorizedSchema), (req, res) => expenseCategorizationController.listUncategorized(req, res))

// Generate journal
router.post('/generate-journal', canInsert(MODULE), validateSchema(generateJournalSchema), (req, res) => expenseCategorizationController.generateJournal(req, res))

export default router
