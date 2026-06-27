import { logInfo } from '../../config/logger'
import { AppError } from '../../utils/errors.base'
import { resolveDocumentUploadExtension, DOCUMENT_UPLOAD_EXTENSIONS } from '../../utils/document-upload.util'
import { storageService } from '../../services/storage.service'
import { AuditService } from '../monitoring/monitoring.service'
import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
import { stockRepository } from '../stock/stock.repository'
import { getCompanyIdForBranch, requireBranchAccess } from '../../utils/branch-access.util'
import { pettyCashRepository } from './petty-cash.repository'
import type { PettyCashRequest, PettyCashExpense, PettyCashSettlement, CreateRequestDto, ApproveRequestDto, RejectRequestDto, CreateExpenseDto, UpdateExpenseDto, CreateSettlementDto, VoidSettlementDto } from './petty-cash.types'
import {
  PettyCashRequestNotFoundError,
  PettyCashInvalidStatusError,
  PettyCashBranchHasActiveRequestError,
  PettyCashCoaMissingError,
  PettyCashExpenseNotFoundError,
  PettyCashInventoryFieldsRequiredError,
  PettyCashInsufficientBalanceError,
  PettyCashExpenseAlreadySettledError,
  PettyCashSettlementExistsError,
  PettyCashReturnBankRequiredError,
  PettyCashRefillBankRequiredError,
  PettyCashNegativeBalanceError,
  PettyCashReturnExceedsBalanceError,
  PettyCashSettlementNotFoundError,
  PettyCashVoidBlockedByExpenseError,
  PettyCashVoidBlockedByRefillError,
} from './petty-cash.errors'

export class PettyCashService {
  // ─── LIST & GET ──────────────────────────────────────────────────────────────

  async listRequests(
    query: Record<string, string>,
    branchIds: string[],
  ): Promise<{ data: PettyCashRequest[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = Number(query.page ?? 1)
    const limit = Number(query.limit ?? 25)
    const { data, total } = await pettyCashRepository.findAll({
      branch_id: query.branch_id,
      status: query.status,
      date_from: query.date_from,
      date_to: query.date_to,
      search: query.search,
      sort_by: query.sort_by,
      sort_order: query.sort_order,
      page,
      limit,
    }, branchIds)
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } }
  }

  async getRequest(id: string, branchIds: string[]): Promise<any> {
    const result = await pettyCashRepository.findByIdWithDetails(id, branchIds)
    if (!result) throw new PettyCashRequestNotFoundError(id)
    return result
  }

  async listExpenses(
    requestId: string,
    query: Record<string, string>,
    branchIds: string[],
  ): Promise<{ data: PettyCashExpense[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = Number(query.page ?? 1)
    const limit = Number(query.limit ?? 50)
    const { data, total } = await pettyCashRepository.findExpensesByRequestId(requestId, { page, limit }, branchIds)
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } }
  }

  async getExpenseReport(
    query: Record<string, string>,
    branchIds: string[],
  ): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number } }> {
    return pettyCashRepository.findExpensesForReport({
      branch_id: query.branch_id,
      date_from: query.date_from,
      date_to: query.date_to,
      search: query.search,
      limit: query.limit ? Number(query.limit) : undefined,
    }, branchIds)
  }

  // ─── CREATE REQUEST ─────────────────────────────────────────────────────────

  async createRequest(
    dto: CreateRequestDto,
    branchIds: string[],
    userId: string,
  ): Promise<PettyCashRequest> {
    // Access check
    requireBranchAccess(dto.branch_id, branchIds)

    // Resolve company
    const companyId = await getCompanyIdForBranch(dto.branch_id)
    if (!companyId) {
      throw new PettyCashCoaMissingError('Branch tidak terhubung ke company manapun')
    }

    // Validate COA exists
    const coaValid = await pettyCashRepository.coaExistsForCompany(dto.petty_cash_coa_id, companyId)
    if (!coaValid) {
      throw new PettyCashCoaMissingError(
        `petty_cash_coa_id (${dto.petty_cash_coa_id}) tidak ditemukan atau tidak aktif untuk company ini`,
      )
    }

    // Generate number + insert (within transaction for advisory lock)
    const request = await pettyCashRepository.withTransaction(async (client) => {
      const branchCode = await pettyCashRepository.findBranchCode(client, dto.branch_id)
      const requestNumber = await pettyCashRepository.generateRequestNumber(client, companyId, branchCode)

      return pettyCashRepository.create(client, {
        company_id: companyId,
        branch_id: dto.branch_id,
        request_number: requestNumber,
        amount_requested: dto.amount_requested,
        petty_cash_coa_id: dto.petty_cash_coa_id,
        description: dto.description,
        created_by: userId,
      })
    })

    await AuditService.log('CREATE', 'petty_cash_requests', request.id, userId, undefined, {
      request_number: request.request_number,
      amount_requested: request.amount_requested,
    })
    logInfo('Petty cash request created', { id: request.id, request_number: request.request_number })

    return request
  }

  // ─── APPROVE REQUEST ────────────────────────────────────────────────────────

  async approveRequest(
    id: string,
    dto: ApproveRequestDto,
    branchIds: string[],
    userId: string,
  ): Promise<PettyCashRequest> {
    // Lightweight pre-check (fast-fail for obvious issues, NOT authoritative)
    const request = await pettyCashRepository.findById(id)
    if (!request) throw new PettyCashRequestNotFoundError(id)
    requireBranchAccess(request.branch_id, branchIds)

    // Validate amount > 0
    if (!dto.amount_disbursed || dto.amount_disbursed <= 0) {
      throw new PettyCashInvalidStatusError('amount_disbursed must be > 0', 'positive number')
    }

    const companyId = request.company_id

    // ALL authoritative checks + mutations INSIDE single transaction
    await pettyCashRepository.withTransaction(async (client) => {
      // 1. Advisory lock on branch — serializes all approve attempts for the same branch.
      //    Prevents phantom-read: concurrent approves on different PENDING requests
      //    in the same branch would both see 0 DISBURSED rows without this lock.
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`petty_cash_branch_disburse:${request.branch_id}`],
      )

      // 2. Lock request row + re-validate status (prevent double-approve on same request)
      const lockedRequest = await pettyCashRepository.findByIdForUpdate(client, id)
      if (!lockedRequest || lockedRequest.status !== 'PENDING') {
        throw new PettyCashInvalidStatusError(
          lockedRequest?.status ?? 'NOT_FOUND',
          'PENDING',
        )
      }

      // 3. Check no other DISBURSED in same branch (defense in depth — now reliable
      //    because advisory lock guarantees no concurrent approve can be mid-flight)
      const activeRequest = await pettyCashRepository.findActiveDisbursedRequestForUpdate(
        client,
        lockedRequest.branch_id,
      )
      if (activeRequest) {
        throw new PettyCashBranchHasActiveRequestError(
          lockedRequest.branch_id,
          activeRequest.request_number,
        )
      }

      // 4. Resolve bank COA
      const bankCoaId = await pettyCashRepository.findBankCoaId(
        client,
        dto.source_bank_account_id,
        companyId,
      )
      if (!bankCoaId) {
        throw new PettyCashCoaMissingError(
          `Bank account (id: ${dto.source_bank_account_id}) tidak memiliki COA mapping untuk company ini`,
        )
      }

      // 5. Update request → DISBURSED
      await pettyCashRepository.updateStatusToDisbursed(client, id, {
        amount_disbursed: dto.amount_disbursed,
        source_bank_account_id: dto.source_bank_account_id,
        approved_by: userId,
      })

      // 6. Create disburse journal (DRAFT)
      const amount = dto.amount_disbursed
      const desc = `Pencairan Kas Kecil — ${lockedRequest.request_number}`

      const journal = await journalHeadersService.create(
        {
          company_id: companyId,
          branch_id: lockedRequest.branch_id,
          journal_date: new Date().toISOString().slice(0, 10),
          journal_type: 'CASH',
          description: desc,
          source_module: 'petty_cash',
          reference_type: 'petty_cash_disburse',
          reference_id: lockedRequest.id,
          reference_number: lockedRequest.request_number,
          currency: 'IDR',
          exchange_rate: 1,
          lines: [
            {
              line_number: 1,
              account_id: lockedRequest.petty_cash_coa_id,
              description: desc,
              debit_amount: amount,
              credit_amount: 0,
            },
            {
              line_number: 2,
              account_id: bankCoaId,
              description: desc,
              debit_amount: 0,
              credit_amount: amount,
            },
          ],
        },
        userId,
        client,
      )

      // 7. Auto-post: DRAFT → SUBMITTED → APPROVED → POSTED
      await journalHeadersService.submitAsUser(journal.id, userId, client)
      await journalHeadersService.approveAsUser(journal.id, userId, client)
      await journalHeadersService.postAsUser(journal.id, userId, client)

      // 8. Store journal reference
      await pettyCashRepository.setDisburseJournalId(client, id, journal.id)
    })

    // Audit — best effort, outside transaction
    await AuditService.log('UPDATE', 'petty_cash_requests', id, userId, { status: 'PENDING' }, {
      status: 'DISBURSED',
      amount_disbursed: dto.amount_disbursed,
    })
    logInfo('Petty cash request approved & disbursed', { id, user_id: userId })

    return (await pettyCashRepository.findById(id))!
  }

  // ─── REJECT REQUEST ─────────────────────────────────────────────────────────

  async rejectRequest(
    id: string,
    dto: RejectRequestDto,
    branchIds: string[],
    userId: string,
  ): Promise<PettyCashRequest> {
    const request = await pettyCashRepository.findById(id)
    if (!request) throw new PettyCashRequestNotFoundError(id)
    requireBranchAccess(request.branch_id, branchIds)

    if (request.status !== 'PENDING') {
      throw new PettyCashInvalidStatusError(request.status, 'PENDING')
    }

    await pettyCashRepository.updateStatusToRejected(id, {
      rejected_by: userId,
      rejection_reason: dto.rejection_reason,
    })

    await AuditService.log('UPDATE', 'petty_cash_requests', id, userId, { status: 'PENDING' }, {
      status: 'REJECTED',
      rejection_reason: dto.rejection_reason,
    })
    logInfo('Petty cash request rejected', { id, user_id: userId })

    return (await pettyCashRepository.findById(id))!
  }

  // ─── CREATE EXPENSE ─────────────────────────────────────────────────────────

  async createExpense(
    requestId: string,
    dto: CreateExpenseDto,
    branchIds: string[],
    userId: string,
  ): Promise<PettyCashExpense> {
    // Fast-fail pre-checks (outside transaction)
    const request = await pettyCashRepository.findById(requestId)
    if (!request) throw new PettyCashRequestNotFoundError(requestId)
    requireBranchAccess(request.branch_id, branchIds)

    if (!dto.amount || dto.amount <= 0) {
      throw new PettyCashInvalidStatusError('amount must be > 0', 'positive number')
    }

    const companyId = request.company_id

    // Validate category + get affects_inventory flag
    const category = await pettyCashRepository.findCategoryWithInventoryFlag(dto.category_id)
    if (!category) {
      throw new PettyCashCoaMissingError(`category_id (${dto.category_id}) tidak ditemukan`)
    }

    // Validate inventory fields if user sends product_id (intent to record as inventory)
    if (category.affects_inventory) {
      // affects_inventory is now a DEFAULT hint for frontend checkbox.
      // Actual enforcement is based on whether product_id is provided.
    }
    if (dto.product_id) {
      const missing: string[] = []
      if (!dto.warehouse_id) missing.push('warehouse_id')
      if (!dto.qty || dto.qty <= 0) missing.push('qty')
      if (missing.length > 0) {
        throw new PettyCashInventoryFieldsRequiredError(missing)
      }
    }

    // All authoritative checks + insert inside transaction
    const expense = await pettyCashRepository.withTransaction(async (client) => {
      // 1. Advisory lock — serialize expense inserts for this request
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`petty_cash_request_balance:${requestId}`],
      )

      // 2. Lock request + re-validate status
      const lockedRequest = await pettyCashRepository.findByIdForUpdate(client, requestId)
      if (!lockedRequest || lockedRequest.status !== 'DISBURSED') {
        throw new PettyCashInvalidStatusError(
          lockedRequest?.status ?? 'NOT_FOUND',
          'DISBURSED',
        )
      }

      // 3. Check balance
      const totalExisting = await pettyCashRepository.sumExpensesByRequestId(client, requestId)
      const available = (lockedRequest.amount_disbursed ?? 0) + lockedRequest.carried_amount
      if (totalExisting + dto.amount > available + 0.01) {
        throw new PettyCashInsufficientBalanceError(available - totalExisting, dto.amount)
      }

      // 4. Resolve expense_coa_id
      // Priority: user override > category.default_coa_id > purpose-based fallback
      let resolvedCoaId: string
      if (dto.expense_coa_id) {
        // User override — validate exists
        const coaValid = await pettyCashRepository.coaExistsForCompany(dto.expense_coa_id, companyId, client)
        if (!coaValid) {
          throw new PettyCashCoaMissingError(`expense_coa_id (${dto.expense_coa_id}) tidak ditemukan atau tidak aktif`)
        }
        resolvedCoaId = dto.expense_coa_id
      } else if (category.default_coa_id) {
        // Category has its own default COA (e.g. Transport → 610401)
        resolvedCoaId = category.default_coa_id
      } else {
        // Fallback: resolve from accounting purpose
        const purposeCode = dto.product_id ? 'PUR-INV' : 'CSH-OUT'
        const coaId = await pettyCashRepository.findDebitCoaByPurposeCode(client, purposeCode, companyId)
        if (!coaId) {
          throw new PettyCashCoaMissingError(
            `DEBIT account untuk purpose '${purposeCode}' belum ter-mapping di company ini`,
          )
        }
        resolvedCoaId = coaId
      }

      // 5. Insert expense
      const newExpense = await pettyCashRepository.createExpense(client, {
        request_id: requestId,
        company_id: companyId,
        branch_id: lockedRequest.branch_id,
        expense_date: dto.expense_date ?? new Date().toISOString().slice(0, 10),
        amount: dto.amount,
        description: dto.description,
        category_id: dto.category_id,
        sub_category_id: dto.sub_category_id,
        expense_coa_id: resolvedCoaId,
        product_id: dto.product_id,
        product_uom_id: dto.product_uom_id,
        qty: dto.qty,
        unit_price: dto.unit_price,
        warehouse_id: dto.warehouse_id,
        receipt_url: dto.receipt_url,
        created_by: userId,
      })

      // 6. Stock movement — realtime (Option B: stock immediate, journal at settlement)
      if (dto.product_id && dto.warehouse_id && dto.qty && dto.qty > 0) {
        const qty = dto.qty
        const costPerUnit = dto.unit_price != null && dto.unit_price > 0
          ? dto.unit_price
          : (qty > 0 ? dto.amount / qty : dto.amount)

        const balance = await stockRepository.getBalanceForUpdate(client, dto.warehouse_id, dto.product_id)
        const currentQty = balance ? Number(balance.qty) : 0
        const currentAvgCost = balance ? Number(balance.avg_cost) : 0
        const newQty = currentQty + qty
        const newAvgCost = newQty > 0
          ? ((currentQty * currentAvgCost) + (qty * costPerUnit)) / newQty
          : costPerUnit

        const movement = await stockRepository.createMovement(client, {
          warehouse_id: dto.warehouse_id,
          product_id: dto.product_id,
          movement_type: 'IN_PURCHASE',
          qty,
          cost_per_unit: costPerUnit,
          reference_type: 'petty_cash' as any,
          reference_id: requestId,
          notes: `Petty cash: ${dto.description || lockedRequest.request_number}`,
          movement_date: dto.expense_date ?? new Date().toISOString().slice(0, 10),
          created_by: userId,
        }, newQty)

        await stockRepository.upsertBalance(client, dto.warehouse_id, dto.product_id, newQty, newAvgCost)
        await pettyCashRepository.updateExpenseStockMovementId(client, newExpense.id, movement.id)
      }

      return newExpense
    })

    await AuditService.log('CREATE', 'petty_cash_expenses', expense.id, userId, undefined, {
      request_id: requestId,
      amount: expense.amount,
      category_id: expense.category_id,
      affects_inventory: category.affects_inventory,
    })
    logInfo('Petty cash expense created', { id: expense.id, request_id: requestId, amount: expense.amount })

    return expense
  }

  // ─── UPDATE EXPENSE ─────────────────────────────────────────────────────────

  async updateExpense(
    expenseId: string,
    dto: UpdateExpenseDto,
    branchIds: string[],
    userId: string,
  ): Promise<PettyCashExpense> {
    // Fast-fail pre-checks
    const expense = await pettyCashRepository.findExpenseById(expenseId)
    if (!expense) throw new PettyCashExpenseNotFoundError(expenseId)
    if (expense.settlement_id) throw new PettyCashExpenseAlreadySettledError(expenseId)

    const request = await pettyCashRepository.findById(expense.request_id)
    if (!request) throw new PettyCashRequestNotFoundError(expense.request_id)
    requireBranchAccess(request.branch_id, branchIds)

    if (request.status !== 'DISBURSED') {
      throw new PettyCashInvalidStatusError(request.status, 'DISBURSED')
    }

    const companyId = request.company_id

    // Determine affects_inventory for effective category
    let affectsInventory = false
    if (dto.category_id) {
      const cat = await pettyCashRepository.findCategoryWithInventoryFlag(dto.category_id)
      if (!cat) throw new PettyCashCoaMissingError(`category_id (${dto.category_id}) tidak ditemukan`)
      affectsInventory = cat.affects_inventory
    } else {
      const cat = await pettyCashRepository.findCategoryWithInventoryFlag(expense.category_id)
      affectsInventory = cat?.affects_inventory ?? false
    }

    // Validate inventory fields if affects_inventory after update
    if (affectsInventory) {
      const effectiveProductId = dto.product_id ?? expense.product_id
      const effectiveWarehouseId = dto.warehouse_id ?? expense.warehouse_id
      const effectiveQty = dto.qty ?? expense.qty
      const missing: string[] = []
      if (!effectiveProductId) missing.push('product_id')
      if (!effectiveWarehouseId) missing.push('warehouse_id')
      if (!effectiveQty || effectiveQty <= 0) missing.push('qty')
      if (missing.length > 0) {
        throw new PettyCashInventoryFieldsRequiredError(missing)
      }
    }

    // If amount is changing, need balance re-validation with advisory lock
    const amountChanging = dto.amount !== undefined && dto.amount !== expense.amount

    const updated = await pettyCashRepository.withTransaction(async (client) => {
      if (amountChanging) {
        // Advisory lock for balance check
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          [`petty_cash_request_balance:${expense.request_id}`],
        )

        // Re-validate request status
        const lockedRequest = await pettyCashRepository.findByIdForUpdate(client, expense.request_id)
        if (!lockedRequest || lockedRequest.status !== 'DISBURSED') {
          throw new PettyCashInvalidStatusError(lockedRequest?.status ?? 'NOT_FOUND', 'DISBURSED')
        }

        // Check balance (exclude this expense from sum)
        const totalOthers = await pettyCashRepository.sumExpensesByRequestId(
          client, expense.request_id, expenseId,
        )
        const available = (lockedRequest.amount_disbursed ?? 0) + lockedRequest.carried_amount
        if (totalOthers + dto.amount! > available + 0.01) {
          throw new PettyCashInsufficientBalanceError(available - totalOthers, dto.amount!)
        }
      }

      // Resolve COA if category changed or expense_coa_id overridden
      let resolvedCoaId: string | undefined
      if (dto.expense_coa_id) {
        const coaValid = await pettyCashRepository.coaExistsForCompany(dto.expense_coa_id, companyId, client)
        if (!coaValid) {
          throw new PettyCashCoaMissingError(`expense_coa_id (${dto.expense_coa_id}) tidak ditemukan atau tidak aktif`)
        }
        resolvedCoaId = dto.expense_coa_id
      } else if (dto.category_id && dto.category_id !== expense.category_id) {
        // Category changed — re-resolve COA
        const purposeCode = affectsInventory ? 'PUR-INV' : 'CSH-OUT'
        const coaId = await pettyCashRepository.findDebitCoaByPurposeCode(client, purposeCode, companyId)
        if (!coaId) {
          throw new PettyCashCoaMissingError(`DEBIT account untuk purpose '${purposeCode}' belum ter-mapping`)
        }
        resolvedCoaId = coaId
      }

      // Build update payload (only changed fields)
      const updateData: Record<string, unknown> = {}
      if (dto.expense_date !== undefined) updateData.expense_date = dto.expense_date
      if (dto.amount !== undefined) updateData.amount = dto.amount
      if (dto.description !== undefined) updateData.description = dto.description
      if (dto.category_id !== undefined) updateData.category_id = dto.category_id
      if (dto.sub_category_id !== undefined) updateData.sub_category_id = dto.sub_category_id
      if (resolvedCoaId) updateData.expense_coa_id = resolvedCoaId
      if (dto.product_id !== undefined) updateData.product_id = dto.product_id
      if (dto.product_uom_id !== undefined) updateData.product_uom_id = dto.product_uom_id
      if (dto.qty !== undefined) updateData.qty = dto.qty
      if (dto.unit_price !== undefined) updateData.unit_price = dto.unit_price
      if (dto.warehouse_id !== undefined) updateData.warehouse_id = dto.warehouse_id
      if (dto.receipt_url !== undefined) updateData.receipt_url = dto.receipt_url

      if (Object.keys(updateData).length === 0) {
        return expense // nothing to update
      }

      const updatedExpense = await pettyCashRepository.updateExpense(client, expenseId, updateData, userId)

      // Stock movement handling: reverse old + create new if inventory fields changed
      const effectiveProductId = dto.product_id !== undefined ? dto.product_id : expense.product_id
      const effectiveWarehouseId = dto.warehouse_id !== undefined ? dto.warehouse_id : expense.warehouse_id
      const effectiveQty = dto.qty !== undefined ? dto.qty : expense.qty
      const effectiveUnitPrice = dto.unit_price !== undefined ? dto.unit_price : expense.unit_price
      const effectiveAmount = dto.amount !== undefined ? dto.amount : expense.amount

      const hadMovement = !!expense.stock_movement_id
      const shouldHaveMovement = !!effectiveProductId && !!effectiveWarehouseId && !!effectiveQty && effectiveQty > 0

      const inventoryFieldsChanged = hadMovement && (
        dto.product_id !== undefined || dto.warehouse_id !== undefined ||
        dto.qty !== undefined || dto.unit_price !== undefined || dto.amount !== undefined
      )

      // Reverse old movement if it existed AND (fields changed OR no longer inventory)
      if (hadMovement && (inventoryFieldsChanged || !shouldHaveMovement)) {
        const oldMovement = await pettyCashRepository.findStockMovementById(client, expense.stock_movement_id!)
        if (oldMovement) {
          const balance = await stockRepository.getBalanceForUpdate(client, oldMovement.warehouse_id, oldMovement.product_id)
          const currentQty = balance ? Number(balance.qty) : 0
          const currentAvgCost = balance ? Number(balance.avg_cost) : 0
          const newQty = currentQty - Number(oldMovement.qty)

          await stockRepository.createMovement(client, {
            warehouse_id: oldMovement.warehouse_id,
            product_id: oldMovement.product_id,
            movement_type: 'OUT_REVERSAL',
            qty: Number(oldMovement.qty),
            cost_per_unit: Number(oldMovement.cost_per_unit),
            reference_type: 'petty_cash' as any,
            reference_id: expense.request_id,
            notes: `Update expense — reversal`,
            movement_date: oldMovement.movement_date,
            created_by: userId,
          }, newQty)

          await stockRepository.upsertBalance(client, oldMovement.warehouse_id, oldMovement.product_id, newQty, currentAvgCost)
          await pettyCashRepository.clearExpenseStockMovementId(client, expenseId)
        }
      }

      // Create new movement if should have one AND (didn't have before OR fields changed)
      if (shouldHaveMovement && (!hadMovement || inventoryFieldsChanged)) {
        const qty = effectiveQty!
        // Priority: explicit unit_price > derived from amount/qty
        const costPerUnit = effectiveUnitPrice != null && effectiveUnitPrice > 0
          ? effectiveUnitPrice
          : (qty > 0 ? effectiveAmount / qty : effectiveAmount)

        const balance = await stockRepository.getBalanceForUpdate(client, effectiveWarehouseId!, effectiveProductId!)
        const currentQty = balance ? Number(balance.qty) : 0
        const currentAvgCost = balance ? Number(balance.avg_cost) : 0
        const newQty = currentQty + qty
        const newAvgCost = newQty > 0
          ? ((currentQty * currentAvgCost) + (qty * costPerUnit)) / newQty
          : costPerUnit

        const movement = await stockRepository.createMovement(client, {
          warehouse_id: effectiveWarehouseId!,
          product_id: effectiveProductId!,
          movement_type: 'IN_PURCHASE',
          qty,
          cost_per_unit: costPerUnit,
          reference_type: 'petty_cash' as any,
          reference_id: expense.request_id,
          notes: `Petty cash: ${updatedExpense.description || ''}`,
          movement_date: updatedExpense.expense_date,
          created_by: userId,
        }, newQty)

        await stockRepository.upsertBalance(client, effectiveWarehouseId!, effectiveProductId!, newQty, newAvgCost)
        await pettyCashRepository.updateExpenseStockMovementId(client, expenseId, movement.id)
      }

      return updatedExpense
    })

    await AuditService.log('UPDATE', 'petty_cash_expenses', expenseId, userId,
      { amount: expense.amount, category_id: expense.category_id },
      { amount: updated.amount, category_id: updated.category_id },
    )
    logInfo('Petty cash expense updated', { id: expenseId, request_id: expense.request_id })

    return updated
  }

  // ─── DELETE EXPENSE ─────────────────────────────────────────────────────────

  async deleteExpense(
    expenseId: string,
    branchIds: string[],
    userId: string,
  ): Promise<void> {
    const expense = await pettyCashRepository.findExpenseById(expenseId)
    if (!expense) throw new PettyCashExpenseNotFoundError(expenseId)
    if (expense.settlement_id) throw new PettyCashExpenseAlreadySettledError(expenseId)

    const request = await pettyCashRepository.findById(expense.request_id)
    if (!request) throw new PettyCashRequestNotFoundError(expense.request_id)
    requireBranchAccess(request.branch_id, branchIds)

    if (request.status !== 'DISBURSED') {
      throw new PettyCashInvalidStatusError(request.status, 'DISBURSED')
    }

    await pettyCashRepository.withTransaction(async (client) => {
      // Reverse stock movement if exists
      if (expense.stock_movement_id) {
        const movement = await pettyCashRepository.findStockMovementById(client, expense.stock_movement_id)
        if (movement) {
          const balance = await stockRepository.getBalanceForUpdate(client, movement.warehouse_id, movement.product_id)
          const currentQty = balance ? Number(balance.qty) : 0
          const currentAvgCost = balance ? Number(balance.avg_cost) : 0
          const newQty = currentQty - Number(movement.qty)

          await stockRepository.createMovement(client, {
            warehouse_id: movement.warehouse_id,
            product_id: movement.product_id,
            movement_type: 'OUT_REVERSAL',
            qty: Number(movement.qty),
            cost_per_unit: Number(movement.cost_per_unit),
            reference_type: 'petty_cash' as any,
            reference_id: expense.request_id,
            notes: `Delete expense — reversal`,
            movement_date: movement.movement_date,
            created_by: userId,
          }, newQty)

          await stockRepository.upsertBalance(client, movement.warehouse_id, movement.product_id, newQty, currentAvgCost)
        }
      }

      await pettyCashRepository.softDeleteExpense(expenseId, userId, client)
    })

    await AuditService.log('DELETE', 'petty_cash_expenses', expenseId, userId, {
      amount: expense.amount,
      category_id: expense.category_id,
      request_id: expense.request_id,
      stock_reversed: !!expense.stock_movement_id,
    })
    logInfo('Petty cash expense deleted', { id: expenseId, request_id: expense.request_id, stock_reversed: !!expense.stock_movement_id })
  }

  // ─── CREATE SETTLEMENT ──────────────────────────────────────────────────────

  async createSettlement(
    requestId: string,
    dto: CreateSettlementDto,
    branchIds: string[],
    userId: string,
  ): Promise<PettyCashSettlement> {
    // Fast-fail pre-checks
    const request = await pettyCashRepository.findById(requestId)
    if (!request) throw new PettyCashRequestNotFoundError(requestId)
    requireBranchAccess(request.branch_id, branchIds)

    if (dto.amount_returned < 0) {
      throw new PettyCashInvalidStatusError('amount_returned cannot be negative', '>= 0')
    }
    if (dto.amount_returned > 0 && !dto.return_bank_account_id) {
      throw new PettyCashReturnBankRequiredError()
    }
    if (dto.refill_amount && dto.refill_amount > 0 && !dto.refill_bank_account_id) {
      throw new PettyCashRefillBankRequiredError()
    }

    const companyId = request.company_id
    const TOLERANCE = 1000

    // All steps in 1 transaction
    const settlement = await pettyCashRepository.withTransaction(async (client) => {
      // ── STEP 1 — Lock & validate request ──────────────────────────────────
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`petty_cash_request_balance:${requestId}`],
      )

      const lockedRequest = await pettyCashRepository.findByIdForUpdate(client, requestId)
      if (!lockedRequest || lockedRequest.status !== 'DISBURSED') {
        throw new PettyCashInvalidStatusError(lockedRequest?.status ?? 'NOT_FOUND', 'DISBURSED')
      }

      // Check no existing settlement
      const existingSettlement = await pettyCashRepository.findSettlementByRequestId(client, requestId)
      if (existingSettlement) {
        throw new PettyCashSettlementExistsError(requestId)
      }

      // ── STEP 2 — Calculate totals ─────────────────────────────────────────
      const totalDisbursed = (lockedRequest.amount_disbursed ?? 0) + lockedRequest.carried_amount
      const totalExpenses = await pettyCashRepository.sumExpensesByRequestId(client, requestId)
      const remainingBalance = totalDisbursed - totalExpenses

      if (remainingBalance < -0.01) {
        throw new PettyCashNegativeBalanceError(remainingBalance)
      }

      // ── STEP 3 — Validate allocation ──────────────────────────────────────
      let carriedToAmount = remainingBalance - dto.amount_returned
      if (carriedToAmount < -TOLERANCE) {
        throw new PettyCashReturnExceedsBalanceError(remainingBalance, dto.amount_returned)
      }
      if (carriedToAmount < 0) carriedToAmount = 0 // clamp within tolerance

      // ── STEP 4 — Group expenses by COA ────────────────────────────────────
      const coaGroups = await pettyCashRepository.getExpenseCoaGrouped(client, requestId)

      // Resolve return bank COA if needed
      let returnBankCoaId: string | null = null
      if (dto.amount_returned > 0) {
        returnBankCoaId = await pettyCashRepository.findBankCoaId(client, dto.return_bank_account_id!, companyId)
        if (!returnBankCoaId) {
          throw new PettyCashCoaMissingError(
            `Bank account pengembalian (id: ${dto.return_bank_account_id}) tidak memiliki COA mapping`,
          )
        }
      }

      // ── STEP 5 — Insert settlement (journal_id = NULL for now) ────────────
      const settlementDate = dto.settlement_date ?? new Date().toISOString().slice(0, 10)
      const settlementRow = await pettyCashRepository.insertSettlement(client, {
        request_id: requestId,
        company_id: companyId,
        branch_id: lockedRequest.branch_id,
        settlement_date: settlementDate,
        total_disbursed: totalDisbursed,
        total_expenses: totalExpenses,
        remaining_balance: remainingBalance,
        amount_returned: dto.amount_returned,
        return_bank_account_id: dto.return_bank_account_id,
        notes: dto.notes,
        created_by: userId,
      })

      // ── STEP 6 — Create settlement journal + auto-post ────────────────────
      const creditAmount = totalExpenses + dto.amount_returned
      const desc = `Settlement Kas Kecil — ${lockedRequest.request_number}`
      let lineNum = 1

      const journalLines: Array<{ line_number: number; account_id: string; description: string; debit_amount: number; credit_amount: number }> = []

      // DEBIT lines: 1 per unique expense_coa_id
      for (const group of coaGroups) {
        journalLines.push({
          line_number: lineNum++,
          account_id: group.expense_coa_id,
          description: desc,
          debit_amount: group.total_amount,
          credit_amount: 0,
        })
      }

      // DEBIT line: return to bank (if any)
      if (dto.amount_returned > 0 && returnBankCoaId) {
        journalLines.push({
          line_number: lineNum++,
          account_id: returnBankCoaId,
          description: `Pengembalian sisa kas kecil — ${lockedRequest.request_number}`,
          debit_amount: dto.amount_returned,
          credit_amount: 0,
        })
      }

      // CREDIT line: petty cash COA
      journalLines.push({
        line_number: lineNum++,
        account_id: lockedRequest.petty_cash_coa_id,
        description: desc,
        debit_amount: 0,
        credit_amount: creditAmount,
      })

      const journal = await journalHeadersService.create(
        {
          company_id: companyId,
          branch_id: lockedRequest.branch_id,
          journal_date: settlementDate,
          journal_type: 'CASH',
          description: desc,
          source_module: 'petty_cash',
          reference_type: 'petty_cash_settlement',
          reference_id: settlementRow.id,
          reference_number: lockedRequest.request_number,
          currency: 'IDR',
          exchange_rate: 1,
          lines: journalLines,
        },
        userId,
        client,
      )

      // Auto-post
      await journalHeadersService.submitAsUser(journal.id, userId, client)
      await journalHeadersService.approveAsUser(journal.id, userId, client)
      await journalHeadersService.postAsUser(journal.id, userId, client)

      // ── STEP 7 — Link expenses to settlement ─────────────────────────────
      // Note: Stock movements already created per-expense at input time (Option B).
      // Settlement only handles journal + close.
      await pettyCashRepository.setExpensesSettlementId(client, requestId, settlementRow.id)

      // ── STEP 8 — Close request ───────────────────────────────────────────
      await pettyCashRepository.updateStatusToClosed(client, requestId, userId)

      // ── STEP 9 — Refill logic (3 scenarios) ─────────────────────────────
      let carriedToId: string | null = null

      if (carriedToAmount > 0 || (dto.refill_amount && dto.refill_amount > 0)) {
        // Generate number for new request
        const branchCode = await pettyCashRepository.findBranchCode(client, lockedRequest.branch_id)
        const newRequestNumber = await pettyCashRepository.generateRequestNumber(client, companyId, branchCode)

        const refillAmount = dto.refill_amount ?? 0

        // 10a. Create new request FIRST (disburse_journal_id = NULL for now)
        const newRequest = await pettyCashRepository.createCarriedRequest(client, {
          company_id: companyId,
          branch_id: lockedRequest.branch_id,
          request_number: newRequestNumber,
          amount_requested: refillAmount,
          amount_disbursed: refillAmount,
          carried_amount: carriedToAmount,
          carried_from_id: requestId,
          petty_cash_coa_id: lockedRequest.petty_cash_coa_id,
          source_bank_account_id: refillAmount > 0 ? (dto.refill_bank_account_id ?? null) : null,
          disburse_journal_id: null,
          created_by: userId,
        })

        // 10b. If refill_amount > 0 (Skenario B): create disburse journal for NEW request
        if (refillAmount > 0) {
          const refillBankCoaId = await pettyCashRepository.findBankCoaId(
            client, dto.refill_bank_account_id!, companyId,
          )
          if (!refillBankCoaId) {
            throw new PettyCashCoaMissingError(
              `Bank account refill (id: ${dto.refill_bank_account_id}) tidak memiliki COA mapping`,
            )
          }

          const refillDesc = `Pencairan Kas Kecil — ${newRequestNumber}`
          const refillJournal = await journalHeadersService.create(
            {
              company_id: companyId,
              branch_id: lockedRequest.branch_id,
              journal_date: settlementDate,
              journal_type: 'CASH',
              description: refillDesc,
              source_module: 'petty_cash',
              reference_type: 'petty_cash_disburse',
              reference_id: newRequest.id,
              reference_number: newRequestNumber,
              currency: 'IDR',
              exchange_rate: 1,
              lines: [
                { line_number: 1, account_id: lockedRequest.petty_cash_coa_id, description: refillDesc, debit_amount: refillAmount, credit_amount: 0 },
                { line_number: 2, account_id: refillBankCoaId, description: refillDesc, debit_amount: 0, credit_amount: refillAmount },
              ],
            },
            userId,
            client,
          )

          await journalHeadersService.submitAsUser(refillJournal.id, userId, client)
          await journalHeadersService.approveAsUser(refillJournal.id, userId, client)
          await journalHeadersService.postAsUser(refillJournal.id, userId, client)

          // 10c. Link journal back to new request
          await pettyCashRepository.setDisburseJournalId(client, newRequest.id, refillJournal.id)
        }
        // Skenario A (pure carry): refillAmount = 0, no journal, disburse_journal_id stays NULL

        carriedToId = newRequest.id
      }
      // Skenario C: carriedToAmount = 0 AND refill_amount = 0 → no new request

      // ── STEP 10 — Update settlement with journal_id and carried_to_id ─────
      await pettyCashRepository.updateSettlementJournalAndCarry(
        client, settlementRow.id, journal.id, carriedToId,
      )

      return { ...settlementRow, journal_id: journal.id, carried_to_id: carriedToId }
    })

    // Audit — outside transaction
    await AuditService.log('CREATE', 'petty_cash_settlements', settlement.id, userId, undefined, {
      request_id: requestId,
      total_expenses: settlement.total_expenses,
      amount_returned: settlement.amount_returned,
      carried_to_id: settlement.carried_to_id,
    })
    logInfo('Petty cash settlement created', {
      id: settlement.id, request_id: requestId, total_expenses: settlement.total_expenses,
    })

    return settlement
  }

  // ─── VOID SETTLEMENT ────────────────────────────────────────────────────────

  async voidSettlement(
    settlementId: string,
    dto: VoidSettlementDto,
    branchIds: string[],
    userId: string,
  ): Promise<void> {
    // Fast-fail pre-checks
    const settlement = await pettyCashRepository.findSettlementById(settlementId)
    if (!settlement) throw new PettyCashSettlementNotFoundError(settlementId)

    const request = await pettyCashRepository.findById(settlement.request_id)
    if (!request) throw new PettyCashRequestNotFoundError(settlement.request_id)
    requireBranchAccess(request.branch_id, branchIds)

    if (request.status !== 'CLOSED') {
      throw new PettyCashInvalidStatusError(request.status, 'CLOSED')
    }

    // All steps atomic
    await pettyCashRepository.withTransaction(async (client) => {
      // ── STEP 1 — Lock & guard ──────────────────────────────────────────────
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`petty_cash_request_balance:${settlement.request_id}`],
      )

      const lockedRequest = await pettyCashRepository.findByIdForUpdate(client, settlement.request_id)
      if (!lockedRequest || lockedRequest.status !== 'CLOSED') {
        throw new PettyCashInvalidStatusError(lockedRequest?.status ?? 'NOT_FOUND', 'CLOSED')
      }

      // Guard: check carried_to request
      if (settlement.carried_to_id) {
        const carriedRequest = await pettyCashRepository.findCarriedRequestForUpdate(client, settlement.carried_to_id)
        if (carriedRequest) {
          // Block if carried request has a disburse journal (Skenario B already posted)
          if (carriedRequest.disburse_journal_id) {
            throw new PettyCashVoidBlockedByRefillError(settlement.carried_to_id)
          }
          // Block if carried request has any expenses
          const expenseCount = await pettyCashRepository.countExpensesByRequestId(settlement.carried_to_id, client)
          if (expenseCount > 0) {
            throw new PettyCashVoidBlockedByExpenseError(settlement.carried_to_id, expenseCount)
          }
        }
      }

      // ── STEP 2 — Stock movements: NO reversal needed ──────────────────────
      // With Option B, stock movements are created per-expense at input time.
      // After void, request returns to DISBURSED — expenses (and their stock) remain active.
      // Stock only gets reversed if user explicitly deletes an expense.

      // ── STEP 3 — Reverse settlement journal ───────────────────────────────
      if (settlement.journal_id) {
        await journalHeadersService.reverseAsUser(
          settlement.journal_id,
          `Void settlement: ${dto.reason}`,
          userId,
          client,
        )
      }

      // ── STEP 4 — Hard delete carried_to request (if exists and passed guard)
      if (settlement.carried_to_id) {
        await pettyCashRepository.hardDeleteRequest(client, settlement.carried_to_id)
      }

      // ── STEP 5 — Reset expenses: settlement_id = NULL ─────────────────────
      await pettyCashRepository.clearExpensesSettlementId(client, settlement.request_id)

      // ── STEP 6 — Hard delete settlement record ────────────────────────────
      await pettyCashRepository.hardDeleteSettlement(client, settlementId)

      // ── STEP 7 — Revert request → DISBURSED ──────────────────────────────
      await pettyCashRepository.revertRequestToDisbursed(client, settlement.request_id, userId)
    })

    // Audit — outside transaction
    await AuditService.log('DELETE', 'petty_cash_settlements', settlementId, userId, {
      request_id: settlement.request_id,
      total_expenses: settlement.total_expenses,
      reason: dto.reason,
    })
    logInfo('Petty cash settlement voided', { id: settlementId, request_id: settlement.request_id, reason: dto.reason })
  }

  // ─── RECEIPT UPLOAD ─────────────────────────────────────────────────────────

  async uploadReceipt(
    expenseId: string,
    file: Express.Multer.File,
    branchIds: string[],
    userId: string,
  ): Promise<{ receipt_url: string }> {
    // Validate file extension
    const ext = resolveDocumentUploadExtension(file)
    if (!ext) {
      throw new AppError(
        `Tipe file tidak didukung. Gunakan: ${DOCUMENT_UPLOAD_EXTENSIONS.join(', ')}`,
        400,
        'INVALID_FILE_TYPE',
      )
    }

    // Validate expense exists and user has access
    const expense = await pettyCashRepository.findExpenseById(expenseId)
    if (!expense) throw new PettyCashExpenseNotFoundError(expenseId)

    const request = await pettyCashRepository.findById(expense.request_id)
    if (!request) throw new PettyCashRequestNotFoundError(expense.request_id)
    requireBranchAccess(request.branch_id, branchIds)

    // Block upload if request is not DISBURSED (expense already settled or request rejected)
    if (request.status !== 'DISBURSED') {
      throw new PettyCashInvalidStatusError(request.status, 'DISBURSED')
    }

    // Upload to R2
    const fileName = `${expenseId}-${Date.now()}.${ext}`
    const now = new Date()
    const storagePath = `${request.company_id}/petty-cash-receipts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${fileName}`

    await storageService.uploadToPath(file.buffer, storagePath, file.mimetype, 'buktisetoran')
    await pettyCashRepository.updateReceiptUrl(expenseId, storagePath, userId)

    return { receipt_url: storagePath }
  }
}

export const pettyCashService = new PettyCashService()
