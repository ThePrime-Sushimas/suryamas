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

PermissionService.registerModule('cash_flow', 'Cash Flow & Expense Categorization').catch((error) => {
  console.error('Failed to register cash_flow module:', error.message)
})

const MODULE = 'cash_flow'
const router = Router()

router.use(authenticate, resolveBranchContext)

// Rules CRUD
router.get('/rules', canView(MODULE), expenseCategorizationController.listRules)
router.post('/rules', canInsert(MODULE), validateSchema(createRuleSchema), expenseCategorizationController.createRule)
router.put('/rules/:id', canUpdate(MODULE), validateSchema(updateRuleSchema), expenseCategorizationController.updateRule)
router.delete('/rules/:id', canDelete(MODULE), validateSchema(deleteRuleSchema), expenseCategorizationController.deleteRule)

// Categorization actions
router.post('/auto', canUpdate(MODULE), validateSchema(autoCategorizeSchema), expenseCategorizationController.autoCategorize)
router.post('/manual', canUpdate(MODULE), validateSchema(categorizeManualSchema), expenseCategorizationController.categorizeManual)
router.post('/uncategorize', canUpdate(MODULE), validateSchema(uncategorizeSchema), expenseCategorizationController.uncategorize)

// List uncategorized
router.get('/uncategorized', canView(MODULE), validateSchema(listUncategorizedSchema), expenseCategorizationController.listUncategorized)

// Generate journal from categorized statements
router.post('/generate-journal', canInsert(MODULE), validateSchema(generateJournalSchema), expenseCategorizationController.generateJournal)

export default router
