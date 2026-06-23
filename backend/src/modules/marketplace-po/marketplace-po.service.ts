  import { randomUUID } from 'crypto'
  import type { PoolClient } from 'pg'
  import { logError } from '../../config/logger'
  import { BusinessRuleError } from '../../utils/errors.base'
  import { AuditService } from '../monitoring/monitoring.service'
  import { marketplacePoRepository } from './marketplace-po.repository'
  import { chartOfAccountsRepository } from '../accounting/chart-of-accounts/chart-of-accounts.repository'
  import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
  import { goodsReceiptsRepository } from '../goods-receipts/goods-receipts.repository'
  import { storageService } from '../../services/storage.service'
  import { DOCUMENT_UPLOAD_EXTENSIONS, resolveDocumentUploadExtension } from '../../utils/document-upload.util'
  import type {
    CancelSessionDto,
    CancelSessionLineDto,
    CreateOwnerCreditCardDto,
    OwnerCreditCardWithSettlement,
    UpdateOwnerCreditCardDto,
  } from './marketplace-po.types'
  import { requireBranchAccess, requireCompanyAccess, getCompanyIdForBranch } from '../../utils/branch-access.util'

  export class MarketplacePoService {
    private async requireSessionDetail(id: string, companyIds: string[], branchIds: string[]) {
      const detail = await marketplacePoRepository.findSessionDetail(id, companyIds)
      if (!detail) throw new BusinessRuleError('Marketplace session not found')
      for (const line of detail.lines ?? []) {
        if (line.branch_id) requireBranchAccess(line.branch_id, branchIds)
      }
      return detail
    }
    /** After session cancel COMMIT — journal cleanup is best-effort (see log on failure). */
    private async cleanupOrderedJournalAfterCancel(
      sessionId: string,
      journalOrderedId: string | null,
      userId: string,
      companyId: string,
    ): Promise<void> {
      await this.cleanupPostedJournalsAfterFailure(
        journalOrderedId ? [journalOrderedId] : [],
        'cancelSession',
        userId,
        companyId,
        { sessionId },
      )
    }

    /**
     * Journal service commits each step on its own connection. If linking the marketplace
     * session fails afterward, remove posted journal(s) so we do not leave orphans.
     */
    private async cleanupPostedJournalsAfterFailure(
      journalIds: string[],
      context: string,
      userId: string,
      companyId: string,
      extra?: Record<string, unknown>,
    ): Promise<void> {
      for (const journalId of journalIds) {
        if (!journalId) continue
        try {
          await journalHeadersService.forceDeleteAsUser(journalId, userId)
        } catch (journalErr) {
          logError('forceDelete journal gagal setelah kegagalan link session', {
            context,
            journalId,
            ...extra,
            error: journalErr instanceof Error ? journalErr.message : String(journalErr),
          })
        }
      }
    }

    private async postJournalWorkflow(
      journalCreateDto: any,
      authUserId: string,
      companyId: string,
      client?: PoolClient,
    ): Promise<{ id: string }> {
      const journalHeader = await journalHeadersService.create(journalCreateDto, authUserId, client)
      await journalHeadersService.submitAsUser(journalHeader.id, authUserId, client)
      await journalHeadersService.approveAsUser(journalHeader.id, authUserId, client)
      await journalHeadersService.postAsUser(journalHeader.id, authUserId, client)
      return { id: journalHeader.id }
    }
    async list(companyIds: string[], filter: any, pagination: { page: number; limit: number }) {
      const isPaged = pagination.limit > 0
      const offset = isPaged ? (pagination.page - 1) * pagination.limit : 0
      return marketplacePoRepository.listSessions(companyIds, filter, { limit: pagination.limit, offset })
    }

    async getSessionDetail(id: string, companyIds: string[], branchIds: string[]) {
      return this.requireSessionDetail(id, companyIds, branchIds)
    }

    async listOwnerCreditCards(
      companyIds: string[],
      filter: { is_active?: boolean } = {},
    ): Promise<OwnerCreditCardWithSettlement[]> {
      return marketplacePoRepository.listOwnerCreditCards(companyIds, filter)
    }

    private async assertSettlementBankAccount(
      companyId: string,
      bankAccountId: number | null | undefined,
    ): Promise<void> {
      if (bankAccountId == null) return
      const exists = await marketplacePoRepository.findCompanySettlementBankAccount(companyId, bankAccountId)
      if (!exists) {
        throw new BusinessRuleError('Rekening bank pelunasan tidak ditemukan atau tidak aktif')
      }
    }

    async listPendingPoLines(branchIds: string[], filter: { platform?: string; branch_id?: string }) {
      return marketplacePoRepository.findPendingPoLines(branchIds, filter)
    }

    async createOwnerCreditCard(
      companyId: string,
      companyIds: string[],
      userId: string,
      dto: CreateOwnerCreditCardDto,
    ): Promise<OwnerCreditCardWithSettlement> {
      requireCompanyAccess(companyId, companyIds)
      return marketplacePoRepository.withTransaction(async (client) => {
        if (dto.coa_code) {
          const coa = await chartOfAccountsRepository.findByCode(companyId, dto.coa_code)
          if (!coa) throw new BusinessRuleError('COA for owner credit card not found')
        }
        const settlementBankAccountId = dto.settlement_bank_account_id ?? null
        await this.assertSettlementBankAccount(companyId, settlementBankAccountId)
        const created = await marketplacePoRepository.createOwnerCreditCard(client, companyId, userId, {
          card_label: dto.card_label,
          bank_name: dto.bank_name,
          last4: dto.last4 ?? null,
          coa_code: dto.coa_code,
          is_active: dto.is_active ?? true,
          sort_order: dto.sort_order ?? 0,
          settlement_bank_account_id: settlementBankAccountId,
        })
        if (!created) throw new BusinessRuleError('Owner credit card not created')
        return created
      })
    }

    async updateOwnerCreditCard(
      companyId: string,
      companyIds: string[],
      userId: string,
      id: string,
      dto: UpdateOwnerCreditCardDto,
    ): Promise<OwnerCreditCardWithSettlement> {
      requireCompanyAccess(companyId, companyIds)
      return marketplacePoRepository.withTransaction(async (client) => {
        if (dto.coa_code) {
          const coa = await chartOfAccountsRepository.findByCode(companyId, dto.coa_code)
          if (!coa) throw new BusinessRuleError('COA for owner credit card not found')
        }
        if (dto.settlement_bank_account_id !== undefined) {
          await this.assertSettlementBankAccount(companyId, dto.settlement_bank_account_id)
        }
        const updated = await marketplacePoRepository.updateOwnerCreditCard(client, id, companyId, userId, {
          card_label: dto.card_label,
          bank_name: dto.bank_name,
          last4: dto.last4,
          coa_code: dto.coa_code,
          is_active: dto.is_active,
          sort_order: dto.sort_order,
          settlement_bank_account_id: dto.settlement_bank_account_id,
        })
        if (!updated) throw new BusinessRuleError('Owner credit card not found')
        return updated
      })
    }

    async deleteOwnerCreditCard(companyId: string, companyIds: string[], userId: string, id: string) {
      requireCompanyAccess(companyId, companyIds)
      return marketplacePoRepository.withTransaction(async (client) => {
        const deleted = await marketplacePoRepository.softDeleteOwnerCreditCard(client, id, companyId, userId)
        if (!deleted) throw new BusinessRuleError('Owner credit card not found')
        return deleted
      })
    }

    async createSession(companyIds: string[], branchIds: string[], userId: string, dto: any) {
      const lines = dto.lines
      if (!Array.isArray(lines) || lines.length === 0) throw new BusinessRuleError('At least 1 line is required')
      for (const l of lines) {
        requireBranchAccess(l.branch_id, branchIds)
      }

      // Validate all lines are from the same branch (single-branch per session)
      const sessionBranchId = lines[0].branch_id
      if (!sessionBranchId) throw new BusinessRuleError('branch_id is required on each line')
      const mixedBranch = lines.find((l: any) => l.branch_id !== sessionBranchId)
      if (mixedBranch) throw new BusinessRuleError('Semua item dalam satu session harus dari cabang yang sama')

      const companyId = await getCompanyIdForBranch(sessionBranchId)
      if (!companyId) throw new BusinessRuleError('Branch not found')
      requireCompanyAccess(companyId, companyIds)

      const session = await marketplacePoRepository.withTransaction(async (client) => {
        const sessionNumber = await marketplacePoRepository.generateSessionNumber(client, companyId, dto.platform)
        if (!sessionNumber) throw new BusinessRuleError('Failed to generate session number')

        const totalAmount = lines.reduce((sum: number, l: any) => sum + Number(l.unit_price_netto) * Number(l.qty), 0)

        return marketplacePoRepository.createSessionAndLines(client, companyId, userId, {
          session_number: sessionNumber,
          platform: dto.platform,
          cc_id: dto.cc_id,
          checkout_date: dto.checkout_date ?? new Date().toISOString().slice(0, 10),
          notes: dto.notes ?? null,
          branch_id: sessionBranchId,
          lines: lines.map((l: any) => ({
            po_id: l.po_id,
            po_line_id: l.po_line_id,
            branch_id: l.branch_id,
            product_id: l.product_id,
            qty: l.qty,
            unit_price_netto: l.unit_price_netto,
            total_netto: Number(l.unit_price_netto) * Number(l.qty),
            platform_order_id: l.platform_order_id ?? null,
            platform_item_id: l.platform_item_id ?? null,
            notes: l.notes ?? null,
          })),
          total_amount: totalAmount,
        })
      })

      const fullDetail = await marketplacePoRepository.findSessionDetail(session.id, companyIds)
      await AuditService.log('CREATE', 'marketplace_checkout_session', session.id, userId, undefined, fullDetail ?? session)
      return session
    }

    async updateSessionHeader(companyIds: string[], branchIds: string[], userId: string, id: string, dto: any) {
      const { header } = await this.requireSessionDetail(id, companyIds, branchIds)
      const companyId = header.company_id as string
      return marketplacePoRepository.withTransaction(async (client) => {
        const updated = await marketplacePoRepository.updateSessionHeader(client, id, companyId, userId, {
          platform: dto.platform,
          cc_id: dto.cc_id,
          checkout_date: dto.checkout_date,
          notes: dto.notes,
        })
        if (!updated) throw new BusinessRuleError('Session not found or not in DRAFT')
        return updated
      })
    }

    async removeLineFromDraftSession(
      companyIds: string[],
      branchIds: string[],
      userId: string,
      sessionId: string,
      lineId: string,
    ): Promise<unknown> {
      const { header } = await this.requireSessionDetail(sessionId, companyIds, branchIds)
      const companyId = header.company_id as string

      if (header.status !== 'DRAFT') {
        throw new BusinessRuleError('Hanya session DRAFT yang bisa dihapus itemnya')
      }

      await marketplacePoRepository.withTransaction(async (client) => {
        const locked = await marketplacePoRepository.getSessionForTransition(client, sessionId, companyId)
        if (!locked || locked.status !== 'DRAFT') {
          throw new BusinessRuleError('Session tidak ditemukan atau bukan DRAFT')
        }

        const line = await marketplacePoRepository.findActiveLineById(client, sessionId, lineId)
        if (!line) throw new BusinessRuleError('Line tidak ditemukan atau sudah dihapus')

        const activeCount = await marketplacePoRepository.countActiveLines(client, sessionId)
        if (activeCount <= 1) {
          throw new BusinessRuleError(
            'Tidak bisa menghapus semua item. Batalkan session jika ingin membatalkan seluruhnya.',
          )
        }

        await marketplacePoRepository.removeLineFromSession(client, lineId, sessionId)
        await marketplacePoRepository.updateSessionTotalAmount(client, sessionId, companyId, userId)
      })

      await AuditService.log('REMOVE_LINE', 'marketplace_checkout_session', sessionId, userId, {
        line_id: lineId,
      })

      return marketplacePoRepository.findSessionDetail(sessionId, companyIds)
    }

    async cancelSession(companyIds: string[], branchIds: string[], userId: string, id: string) {
      const { header } = await this.requireSessionDetail(id, companyIds, branchIds)
      const companyId = header.company_id as string
      return marketplacePoRepository.withTransaction(async (client) => {
        const cancelled = await marketplacePoRepository.cancelSession(client, id, companyId, userId)
        if (!cancelled) throw new BusinessRuleError('Session not found or not in DRAFT')
        return cancelled
      })
    }

    async orderSession(companyIds: string[], branchIds: string[], userId: string, id: string, dto: any) {
      const { header } = await this.requireSessionDetail(id, companyIds, branchIds)
      const companyId = header.company_id as string
      const { session, ccCoaCode } = await marketplacePoRepository.withTransaction(async (client) => {
        const locked = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
        if (!locked) throw new BusinessRuleError('Marketplace session not found')
        if (locked.status !== 'DRAFT') throw new BusinessRuleError('Session must be DRAFT')

        const hasBuktip = await marketplacePoRepository.hasBuktipBayarAttachment(client, id)
        if (!hasBuktip) throw new BusinessRuleError('Attachment BUKTI_BAYAR is required before ORDERED')

        const code = await marketplacePoRepository.findOwnerCreditCardCoaCode(client, locked.cc_id, companyId)
        if (!code) throw new BusinessRuleError('COA for CC not found')

        return { session: locked, ccCoaCode: code }
      })

      const coaCc = await chartOfAccountsRepository.findByCode(companyId, ccCoaCode)
      if (!coaCc) throw new BusinessRuleError('COA for CC not found')

      // Split amounts by product nature (inventory vs asset)
      const { inventory_total, asset_total } = await marketplacePoRepository.findSessionAmountsByNature(id)
      const total = Number(session.total_amount)

      // Guard: computed sum must match session total (catches rounding, cancelled lines not reflected in header, etc.)
      const computedTotal = inventory_total + asset_total
      if (Math.abs(computedTotal - total) > 0.01) {
        throw new BusinessRuleError(
          `Amount mismatch: session total_amount=${total} != sum active lines (inventory=${inventory_total} + asset=${asset_total} = ${computedTotal}). Pastikan total session sudah ter-update.`,
        )
      }

      const coa110598 = inventory_total > 0
        ? await chartOfAccountsRepository.findByCode(companyId, '110598')
        : null
      if (inventory_total > 0 && !coa110598) throw new BusinessRuleError('COA 110598 (Persediaan Dalam Perjalanan) not found')

      const coa120105 = asset_total > 0
        ? await chartOfAccountsRepository.findByCode(companyId, '120105')
        : null
      if (asset_total > 0 && !coa120105) throw new BusinessRuleError('COA 120105 (Aset Dalam Perjalanan) not found')

      const journal_date = dto?.journal_date ?? new Date().toISOString().slice(0, 10)
      const journalDesc = `Checkout Marketplace ${session.platform} - ${session.session_number}`

      // Build debit lines split by nature
      const debitLines: Array<{ line_number: number; account_id: string; description: string; debit_amount: number; credit_amount: number }> = []
      let lineNum = 1

      if (inventory_total > 0) {
        debitLines.push({
          line_number: lineNum++,
          account_id: coa110598!.id,
          description: `${journalDesc} - Persediaan`,
          debit_amount: inventory_total,
          credit_amount: 0,
        })
      }
      if (asset_total > 0) {
        debitLines.push({
          line_number: lineNum++,
          account_id: coa120105!.id,
          description: `${journalDesc} - Aset`,
          debit_amount: asset_total,
          credit_amount: 0,
        })
      }

      const journalCreateDto = {
        company_id: companyId,
        branch_id: session.branch_id ?? null,
        journal_date,
        journal_type: 'INVENTORY',
        description: journalDesc,
        currency: 'IDR',
        exchange_rate: 1,
        reference_type: 'marketplace_checkout_session',
        reference_id: id,
        reference_number: session.session_number,
        source_module: 'marketplace_po',
        tags: { platform: session.platform, session_number: session.session_number },
        lines: [
          ...debitLines,
          {
            line_number: lineNum,
            account_id: coaCc.id,
            description: journalDesc,
            debit_amount: 0,
            credit_amount: total,
          },
        ],
      }

      let journalId: string | null = null
      try {
        // Single transaction: journal creation + session status update — truly atomic
        await marketplacePoRepository.withTransaction(async (client) => {
          const posted = await this.postJournalWorkflow(journalCreateDto, userId, companyId, client)
          journalId = posted.id

          const locked = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
          if (!locked) throw new BusinessRuleError('Marketplace session not found')
          if (locked.status !== 'DRAFT') throw new BusinessRuleError('Session must be DRAFT')

          const updated = await marketplacePoRepository.updateOrderData(client, id, companyId, userId, {
            platform_order_ids: dto?.platform_order_ids ?? null,
            platform_receipt_url: dto?.platform_receipt_url ?? null,
            journal_ordered_id: journalId!,
            status: 'ORDERED',
          })
          if (!updated) throw new BusinessRuleError('Session not found or not in DRAFT')
        })
      } catch (e) {
        // No compensation needed — if transaction rolled back, journal was never committed
        throw e
      }

      return marketplacePoRepository.findSessionDetail(id, companyIds)
    }

    async shipSession(companyIds: string[], branchIds: string[], userId: string, id: string, dto: any) {
      const { header } = await this.requireSessionDetail(id, companyIds, branchIds)
      const companyId = header.company_id as string
      await marketplacePoRepository.withTransaction(async (client) => {
        const session = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
        if (!session) throw new BusinessRuleError('Marketplace session not found')
        if (session.status !== 'ORDERED') throw new BusinessRuleError('Session must be ORDERED to SHIPPED')
        if (!dto?.shipments || dto.shipments.length === 0) throw new BusinessRuleError('At least 1 shipment/resi is required')

        const grExists = await marketplacePoRepository.existsMarketplaceGrForSession(client, session.session_number)
        if (grExists) {
          throw new BusinessRuleError('GR sudah pernah dibuat untuk session ini')
        }
    
        await marketplacePoRepository.updateOrInsertShipments(client, id, userId, dto.shipments)
    
        // ── Buat GR DRAFT per PO ──
        const lines = await marketplacePoRepository.findSessionLinesForReceive(client, id)
        if (lines.length === 0) throw new BusinessRuleError('Session tidak memiliki line barang')
    
        const linesByPo = lines.reduce((acc: Record<string, typeof lines>, l: (typeof lines)[0]) => {
          if (!acc[l.po_id]) acc[l.po_id] = []
          acc[l.po_id].push(l)
          return acc
        }, {})
    
        let firstGrId: string | null = null
    
        for (const [poId, poLines] of Object.entries(linesByPo)) {
          const po = await marketplacePoRepository.findPoBranchForMarketplaceGr(client, poId, companyId)
          if (!po) throw new BusinessRuleError(`Purchase order ${poId} not found`)

          const warehouseId = await marketplacePoRepository.findMainWarehouseId(client, po.branch_id, companyId)
          if (!warehouseId) throw new BusinessRuleError(`Warehouse tidak ditemukan untuk cabang ${po.branch_id}`)
    
          const branchCode = po.branch_code ?? 'XXX'
          const grNumber = await goodsReceiptsRepository.generateGrNumber(client, companyId, branchCode)
    
          const gr = await goodsReceiptsRepository.create(client, companyId, {
            branch_id: po.branch_id,
            po_id: poId,
            warehouse_id: warehouseId,
            gr_number: grNumber,
            received_date: new Date().toISOString().slice(0, 10),
            invoice_number: session.session_number,
            created_by: userId,
            source: 'MARKETPLACE',
            status: 'DRAFT', // ← DRAFT, tim lapangan yang confirm
          })
    
          if (!firstGrId) firstGrId = gr.id
    
          // Insert lines pakai qty pesanan
          const processedLines = (poLines as typeof lines).map((line) => {
            const qtyPoUom = Number(line.qty)
            const unitPricePo = Number(line.unit_price_po ?? 0)
            const unitPriceInvoice = Number(line.unit_price_netto)
            const variance = unitPriceInvoice - unitPricePo
            const variancePct = unitPricePo > 0 ? Math.abs(variance / unitPricePo) * 100 : 0
            const varianceStatus = variancePct <= 0.01 ? 'OK' : variancePct <= 15 ? 'NOTICE' : 'DISPUTED'
    
            return {
              po_line_id: line.po_line_id,
              product_id: line.product_id,
              qty_po_uom: qtyPoUom,
              uom_po: line.uom,
              qty_received: qtyPoUom, // asumsi semua datang, GP verifikasi qty real
              uom_received: line.uom,
              conversion_factor: 1,
              unit_price_invoice: unitPriceInvoice,
              unit_price_po: unitPricePo,
              price_variance: variance,
              price_variance_pct: variancePct,
              variance_status: varianceStatus,
              qty_rejected: 0,
              reject_reason: null,
              notes: null,
            }
          })
    
          await goodsReceiptsRepository.insertLines(client, gr.id, processedLines)
        }
    
        await marketplacePoRepository.markSessionShipped(client, id, companyId, userId, firstGrId)
      })

      return marketplacePoRepository.findSessionDetail(id, companyIds)
    }

    async cancelOrderedSession(
      companyIds: string[],
      branchIds: string[],
      userId: string,
      id: string,
      dto: CancelSessionDto,
    ) {
      const { header } = await this.requireSessionDetail(id, companyIds, branchIds)
      const companyId = header.company_id as string
      const journalOrderedId = await marketplacePoRepository.withTransaction(async (client) => {
        const session = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
        if (!session) throw new BusinessRuleError('Marketplace session not found')
        if (session.status !== 'ORDERED') throw new BusinessRuleError('Session harus ORDERED untuk dibatalkan')

        const cancelled = await marketplacePoRepository.cancelOrderedOrShippedSession(
          client, id, companyId, userId, ['ORDERED'],
          { cancel_reason: dto.cancel_reason, platform_cancel_ref: dto.platform_cancel_ref ?? null },
        )
        if (!cancelled) throw new BusinessRuleError('Gagal membatalkan session')

        return session.journal_ordered_id as string | null
      })

      await this.cleanupOrderedJournalAfterCancel(id, journalOrderedId, userId, companyId)
      await AuditService.log('CANCEL_ORDERED', 'marketplace_checkout_session', id, userId,
        { status: 'ORDERED', journal_ordered_id: journalOrderedId },
        { status: 'CANCELLED', cancel_reason: dto.cancel_reason },
      )
      return marketplacePoRepository.findSessionDetail(id, companyIds)
    }
    
    async cancelShippedSession(
      companyIds: string[],
      branchIds: string[],
      userId: string,
      id: string,
      dto: CancelSessionDto,
    ) {
      const { header } = await this.requireSessionDetail(id, companyIds, branchIds)
      const companyId = header.company_id as string
      const journalOrderedId = await marketplacePoRepository.withTransaction(async (client) => {
        const session = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
        if (!session) throw new BusinessRuleError('Marketplace session not found')
        if (session.status !== 'SHIPPED') throw new BusinessRuleError('Session harus SHIPPED untuk dibatalkan')

        const cancelled = await marketplacePoRepository.cancelOrderedOrShippedSession(
          client, id, companyId, userId, ['SHIPPED'],
          { cancel_reason: dto.cancel_reason, platform_cancel_ref: dto.platform_cancel_ref ?? null },
        )
        if (!cancelled) throw new BusinessRuleError('Gagal membatalkan session')

        return session.journal_ordered_id as string | null
      })

      await this.cleanupOrderedJournalAfterCancel(id, journalOrderedId, userId, companyId)
      await AuditService.log('CANCEL_SHIPPED', 'marketplace_checkout_session', id, userId,
        { status: 'SHIPPED', journal_ordered_id: journalOrderedId },
        { status: 'CANCELLED', cancel_reason: dto.cancel_reason },
      )
      return marketplacePoRepository.findSessionDetail(id, companyIds)
    }

    async cancelLineFromShippedSession(
      companyIds: string[],
      branchIds: string[],
      userId: string,
      sessionId: string,
      lineId: string,
      dto: CancelSessionLineDto,
    ): Promise<unknown> {
      const detail = await this.requireSessionDetail(sessionId, companyIds, branchIds)
      const companyId = detail.header.company_id as string
      const session = detail.header

      if (session.status !== 'SHIPPED') {
        throw new BusinessRuleError('Hanya session SHIPPED yang bisa di-cancel per item')
      }

      const cancelledLineData = await marketplacePoRepository.withTransaction(async (client) => {
        const locked = await marketplacePoRepository.getSessionForTransition(client, sessionId, companyId)
        if (!locked || locked.status !== 'SHIPPED') {
          throw new BusinessRuleError('Session tidak ditemukan atau bukan SHIPPED')
        }

        const line = await marketplacePoRepository.findActiveLineById(client, sessionId, lineId)
        if (!line) throw new BusinessRuleError('Line tidak ditemukan atau sudah dibatalkan')

        const activeCount = await marketplacePoRepository.countActiveLines(client, sessionId)
        if (activeCount <= 1) {
          throw new BusinessRuleError(
            'Tidak bisa membatalkan semua item. Gunakan Cancel Session jika ingin membatalkan seluruhnya.',
          )
        }

        const ccCoaCode = await marketplacePoRepository.findOwnerCreditCardCoaCode(
          client, locked.cc_id, companyId,
        )
        if (!ccCoaCode) throw new BusinessRuleError('COA untuk CC tidak ditemukan')

        const lineData = {
          poLineId: line.po_line_id,
          totalNetto: Number(line.total_netto),
          ccCoaCode,
          sessionNumber: locked.session_number as string,
        }

        await marketplacePoRepository.cancelLine(
          client, lineId, sessionId, dto.cancel_reason,
        )

        await marketplacePoRepository.removeGrLineByPoLine(
          client,
          lineData.sessionNumber,
          lineData.poLineId,
          companyId,
        )

        await marketplacePoRepository.updateSessionTotalAmount(client, sessionId, companyId, userId)

        return lineData
      })

      const coaCc = await chartOfAccountsRepository.findByCode(companyId, cancelledLineData.ccCoaCode)
      if (!coaCc) throw new BusinessRuleError('COA CC tidak ditemukan')

      const coa110598 = await chartOfAccountsRepository.findByCode(companyId, '110598')
      if (!coa110598) throw new BusinessRuleError('COA 110598 tidak ditemukan')

      const correctionAmount = cancelledLineData.totalNetto
      const journalDesc = `Koreksi Cancel Item Marketplace - ${cancelledLineData.sessionNumber}`

      const journalCreateDto = {
        company_id: companyId,
        branch_id: session.branch_id ?? null,
        journal_date: new Date().toISOString().slice(0, 10),
        journal_type: 'INVENTORY',
        description: journalDesc,
        currency: 'IDR',
        exchange_rate: 1,
        reference_type: 'marketplace_checkout_session',
        reference_id: sessionId,
        reference_number: cancelledLineData.sessionNumber,
        source_module: 'marketplace_po',
        tags: {
          platform: session.platform,
          session_number: cancelledLineData.sessionNumber,
          correction_for_line_id: lineId,
          correction_for_po_line_id: cancelledLineData.poLineId,
          correction_amount: correctionAmount,
        },
        lines: [
          {
            line_number: 1,
            account_id: coaCc.id,
            description: journalDesc,
            debit_amount: correctionAmount,
            credit_amount: 0,
          },
          {
            line_number: 2,
            account_id: coa110598.id,
            description: journalDesc,
            debit_amount: 0,
            credit_amount: correctionAmount,
          },
        ],
      }

      let correctionJournalId: string | null = null
      try {
        const posted = await this.postJournalWorkflow(journalCreateDto, userId, companyId)
        correctionJournalId = posted.id

        await marketplacePoRepository.withTransaction(async (client) => {
          await marketplacePoRepository.saveCorrectionJournalToLine(
            client, lineId, sessionId, correctionJournalId!,
          )
        })
      } catch (e) {
        await this.cleanupPostedJournalsAfterFailure(
          correctionJournalId ? [correctionJournalId] : [],
          'cancelLineFromShippedSession',
          userId,
          companyId,
          { sessionId, lineId },
        )
        throw e
      }

      await AuditService.log(
        'CANCEL_LINE_SHIPPED',
        'marketplace_checkout_session',
        sessionId,
        userId,
        { line_id: lineId, status: 'ACTIVE' },
        {
          line_id: lineId,
          status: 'CANCELLED',
          cancel_reason: dto.cancel_reason,
          correction_journal_id: correctionJournalId,
          correction_amount: correctionAmount,
        },
      )

      return marketplacePoRepository.findSessionDetail(sessionId, companyIds)
    }

    async postReceiveJournal(
      companyIds: string[],
      branchIds: string[],
      userId: string,
      id: string,
      dto: { journal_date?: string },
    ) {
      const detail = await this.requireSessionDetail(id, companyIds, branchIds)
      const companyId = detail.header.company_id as string
      const session = detail.header
      if (session.status !== 'RECEIVED') throw new BusinessRuleError('Session harus RECEIVED untuk post journal')
      if (session.journal_received_id) throw new BusinessRuleError('Journal receive sudah pernah di-post')

      const coaDebit = await chartOfAccountsRepository.findByCode(companyId, '110501')
      if (!coaDebit) throw new BusinessRuleError('COA 110501 tidak ditemukan')

      const coaCredit = await chartOfAccountsRepository.findByCode(companyId, '110598')
      if (!coaCredit) throw new BusinessRuleError('COA 110598 tidak ditemukan')

      // Only the inventory portion goes through 110501/110598 flow.
      // Asset portion is handled separately by capitalizeMarketplaceAssets (Dr Fixed Asset / Cr 120105).
      const { inventory_total } = await marketplacePoRepository.findSessionAmountsByNature(id)

      // Asset-only sessions don't need a receive journal — capitalization handles the accounting.
      // Mark as journal-posted (no-op) and return.
      if (inventory_total <= 0) {
        await AuditService.log('POST_RECEIVE_JOURNAL_SKIPPED', 'marketplace_checkout_session', id, userId,
          { reason: 'asset_only_session' },
          { journal_received_id: null },
        )
        return marketplacePoRepository.findSessionDetail(id, companyIds)
      }

      const journal_date = dto?.journal_date ?? new Date().toISOString().slice(0, 10)
      const journalDesc = `Barang Masuk Marketplace - ${session.session_number}`

      // Build journal lines — inventory portion only
      const lines: Array<{ line_number: number; account_id: string; description: string; debit_amount: number; credit_amount: number }> = [
        {
          line_number: 1,
          account_id: coaDebit.id,
          description: journalDesc,
          debit_amount: inventory_total,
          credit_amount: 0,
        },
        {
          line_number: 2,
          account_id: coaCredit.id,
          description: journalDesc,
          debit_amount: 0,
          credit_amount: inventory_total,
        },
      ]

      // Note: asset portion (Dr Fixed Asset / Cr 120105) is created by capitalizeMarketplaceAssets
      // during GR confirmation — no action needed here for asset lines.

      const journalCreateDto = {
        company_id: companyId,
        branch_id: session.branch_id ?? null,
        journal_date,
        journal_type: 'INVENTORY',
        description: journalDesc,
        currency: 'IDR',
        exchange_rate: 1,
        reference_type: 'marketplace_checkout_session',
        reference_id: id,
        reference_number: session.session_number,
        source_module: 'marketplace_po',
        lines,
      }

      let journalId: string | null = null
      try {
        const posted = await this.postJournalWorkflow(journalCreateDto, userId, companyId)
        journalId = posted.id

        await marketplacePoRepository.withTransaction(async (client) => {
          const locked = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
          if (!locked) throw new BusinessRuleError('Marketplace session not found')
          if (locked.status !== 'RECEIVED') throw new BusinessRuleError('Session harus RECEIVED untuk post journal')
          if (locked.journal_received_id) throw new BusinessRuleError('Journal receive sudah pernah di-post')

          await marketplacePoRepository.updateJournalReceivedId(client, id, companyId, userId, journalId!)
        })
      } catch (e) {
        await this.cleanupPostedJournalsAfterFailure(
          journalId ? [journalId] : [],
          'postReceiveJournal',
          userId,
          companyId,
          { sessionId: id },
        )
        throw e
      }

      await AuditService.log('POST_RECEIVE_JOURNAL', 'marketplace_checkout_session', id, userId,
        { journal_received_id: null },
        { journal_received_id: journalId },
      )
      return marketplacePoRepository.findSessionDetail(id, companyIds)
    }

    async uploadAttachment(
      companyIds: string[],
      branchIds: string[],
      userId: string,
      sessionId: string,
      file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
      fileType: string,
    ) {
      const { header } = await this.requireSessionDetail(sessionId, companyIds, branchIds)
      const companyId = header.company_id as string
      const session = await marketplacePoRepository.getSessionStatus(sessionId, companyId)
      if (!session) throw new BusinessRuleError('Marketplace session not found')
      if (!['DRAFT', 'ORDERED'].includes(session.status)) {
        throw new BusinessRuleError('Attachment can only be uploaded for DRAFT or ORDERED sessions')
      }

      const ext = resolveDocumentUploadExtension(file)
      if (!ext) {
        throw new BusinessRuleError(
          `File type not allowed. Allowed: ${DOCUMENT_UPLOAD_EXTENSIONS.join(', ')}`,
        )
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new BusinessRuleError('File too large. Maximum 10MB.')
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const path = `${companyId}/marketplace/${sessionId}/${fileName}`

      await storageService.uploadToPath(file.buffer, path, file.mimetype, 'invoices')

      return marketplacePoRepository.withTransaction(async (client) =>
        marketplacePoRepository.insertAttachment(client, sessionId, {
          file_type: fileType,
          file_path: path,
          file_name: file.originalname,
          file_size: file.size,
          uploaded_by: userId,
        }),
      )
    }

    async deleteAttachment(companyIds: string[], branchIds: string[], sessionId: string, attachmentId: string) {
      await this.requireSessionDetail(sessionId, companyIds, branchIds)
      const attachment = await marketplacePoRepository.findAttachment(sessionId, attachmentId)
      if (!attachment || !companyIds.includes(attachment.company_id)) {
        throw new BusinessRuleError('Attachment not found')
      }
      if (!['DRAFT', 'ORDERED'].includes(attachment.session_status)) {
        throw new BusinessRuleError('Attachment can only be deleted for DRAFT or ORDERED sessions')
      }

      const deleted = await marketplacePoRepository.deleteAttachment(attachmentId, sessionId)
      if (!deleted) throw new BusinessRuleError('Attachment not found')
    }

    async settleSession(companyIds: string[], branchIds: string[], userId: string, id: string, dto: any) {
      const detail = await this.requireSessionDetail(id, companyIds, branchIds)
      const companyId = detail.header.company_id as string
      const session = detail.header
      if (session.status !== 'RECEIVED') throw new BusinessRuleError('Session must be RECEIVED to SETTLED')
      if (session.journal_settled_id) throw new BusinessRuleError('Session sudah di-settle')

      const amount = dto?.amount ?? Number(session.total_amount)
      const bankAccountId = dto.bank_account_id

      const ccCoaCode = await marketplacePoRepository.withTransaction(async (client) => {
        const locked = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
        if (!locked) throw new BusinessRuleError('Marketplace session not found')
        if (locked.status !== 'RECEIVED') throw new BusinessRuleError('Session must be RECEIVED to SETTLED')
        if (locked.journal_settled_id) throw new BusinessRuleError('Session sudah di-settle')

        const code = await marketplacePoRepository.findOwnerCreditCardCoaCode(client, locked.cc_id, companyId)
        if (!code) throw new BusinessRuleError('COA for CC not found')
        return code
      })

      const coaDebit = await chartOfAccountsRepository.findByCode(companyId, ccCoaCode)
      if (!coaDebit) throw new BusinessRuleError('COA for CC not found')

      const bankCoaCode = await marketplacePoRepository.findBankAccountCoaCode(bankAccountId, companyId)
      if (!bankCoaCode) throw new BusinessRuleError('COA for bank account not found')

      const coaCredit = await chartOfAccountsRepository.findByCode(companyId, bankCoaCode)
      if (!coaCredit) throw new BusinessRuleError('COA for bank account not found')

      const journal_date = dto?.settled_date ?? new Date().toISOString().slice(0, 10)

      const journalCreateDto = {
        company_id: companyId,
        branch_id: session.branch_id ?? null,
        journal_date,
        journal_type: 'FINANCING',
        description: `Pelunasan Credit Card - ${session.session_number}`,
        currency: 'IDR',
        exchange_rate: 1,
        reference_type: 'marketplace_checkout_session',
        reference_id: id,
        reference_number: session.session_number,
        source_module: 'marketplace_po',
        lines: [
          {
            line_number: 1,
            account_id: coaDebit.id,
            description: `Pelunasan Credit Card - ${session.session_number}`,
            debit_amount: amount,
            credit_amount: 0,
          },
          {
            line_number: 2,
            account_id: coaCredit.id,
            description: `Pelunasan Credit Card - ${session.session_number}`,
            debit_amount: 0,
            credit_amount: amount,
          },
        ],
      }

      let journalId: string | null = null
      try {
        // Single transaction: journal creation + settlement finalization — truly atomic
        await marketplacePoRepository.withTransaction(async (client) => {
          const posted = await this.postJournalWorkflow(journalCreateDto, userId, companyId, client)
          journalId = posted.id

          const locked = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
          if (!locked) throw new BusinessRuleError('Marketplace session not found')
          if (locked.status !== 'RECEIVED') throw new BusinessRuleError('Session must be RECEIVED to SETTLED')
          if (locked.journal_settled_id) throw new BusinessRuleError('Session sudah di-settle')

          await marketplacePoRepository.completeSessionSettlement(client, {
            sessionId: id,
            companyId,
            userId,
            journalId: journalId!,
            settledDate: dto.settled_date ?? new Date().toISOString().slice(0, 10),
            bankAccountId,
            amount,
            referenceNumber: dto.reference_number ?? null,
            notes: dto.notes ?? null,
          })
        })
      } catch (e) {
        // No compensation needed — if transaction rolled back, journal was never committed
        throw e
      }

      return marketplacePoRepository.findSessionDetail(id, companyIds)
    }

    async getSettlementSummary(companyIds: string[]) {
      return marketplacePoRepository.findSettlementSummary(companyIds)
    }

    async getPendingCcOwnerGeneralInvoicePayments(companyIds: string[]) {
      return marketplacePoRepository.findPendingCcOwnerGeneralInvoicePayments(companyIds)
    }

    async listUnreconciledStatements(
      companyIds: string[],
      bankAccountId: number,
      filter: { date_from?: string; date_to?: string } = {},
    ) {
      const bankCompanyId = await marketplacePoRepository.getBankAccountCompanyId(bankAccountId)
      if (!bankCompanyId) throw new BusinessRuleError('Bank account not found')
      requireCompanyAccess(bankCompanyId, companyIds)
      return marketplacePoRepository.listUnreconciledBankStatements(companyIds, bankAccountId, filter)
    }

    async createBulkSettlement(
      companyIds: string[],
      branchIds: string[],
      userId: string,
      dto: any,
    ): Promise<{ settled_count: number; journal_ids: string[] }> {
      const sessionIds = (dto.session_ids ?? []) as string[]
      const giPaymentIds = (dto.general_invoice_payment_ids ?? []) as string[]

      // Validate marketplace sessions + determine companyId
      let companyId: string | undefined
      for (const sessionId of sessionIds) {
        const detail = await this.requireSessionDetail(sessionId, companyIds, branchIds)
        if (!companyId) companyId = detail.header.company_id as string
      }

      // Determine companyId from GI payment if no sessions
      if (!companyId && giPaymentIds.length > 0) {
        const giCompanyId = await marketplacePoRepository.findGiPaymentCompanyId(giPaymentIds[0])
        if (!giCompanyId) throw new BusinessRuleError('General invoice payment tidak ditemukan')
        companyId = giCompanyId
      }

      if (!companyId) {
        throw new BusinessRuleError('Pilih minimal 1 sesi atau 1 payment')
      }

      const settlementCompanyId = companyId
      const bulkId = randomUUID()

      // Pre-validate COA outside transaction (read-only, avoids holding locks while resolving COA)
      const bankCoaCode = await marketplacePoRepository.findBankAccountCoaCodeForBulk(dto.bank_account_id, settlementCompanyId)
      if (!bankCoaCode) throw new BusinessRuleError('COA untuk bank account tidak ditemukan')
      const coaCredit = await chartOfAccountsRepository.findByCode(settlementCompanyId, bankCoaCode)
      if (!coaCredit) throw new BusinessRuleError('COA bank tidak ditemukan di chart of accounts')

      // Single atomic transaction: lock sessions + create journals + finalize settlement
      const journalIds: string[] = []

      await marketplacePoRepository.withTransaction(async (client) => {
        // Lock + validate marketplace sessions
        let sessions: any[] = []
        if (sessionIds.length > 0) {
          sessions = await marketplacePoRepository.findReceivedSessionsForBulkSettlement(settlementCompanyId, sessionIds, client)
          if (sessions.length !== sessionIds.length) {
            throw new BusinessRuleError('Beberapa sesi tidak ditemukan atau statusnya bukan RECEIVED')
          }
        }

        // Lock + validate GI payments
        let giPayments: Array<{ id: string; total_amount: number; cc_coa_code: string; owner_credit_card_id: string }> = []
        if (giPaymentIds.length > 0) {
          const lockedIds = await marketplacePoRepository.lockGiPaymentsForSettlement(client, giPaymentIds)
          if (lockedIds.length !== giPaymentIds.length) {
            throw new BusinessRuleError('Beberapa general invoice payment sudah di-settle oleh request lain')
          }
          giPayments = await marketplacePoRepository.findGiPaymentsForBulkSettlement(giPaymentIds, settlementCompanyId)
          if (giPayments.length !== giPaymentIds.length) {
            throw new BusinessRuleError('Beberapa general invoice payment tidak ditemukan atau sudah di-settle')
          }
        }

        // Group ALL items by CC COA code + branch (sessions + GI payments)
        const byKey: Record<string, { sessions: typeof sessions; giPayments: typeof giPayments; branchId: string | null }> = {}

        for (const s of sessions) {
          const key = `${s.cc_coa_code}|${s.branch_id ?? ''}`
          if (!byKey[key]) byKey[key] = { sessions: [], giPayments: [], branchId: s.branch_id ?? null }
          byKey[key].sessions.push(s)
        }
        for (const p of giPayments) {
          const key = `${p.cc_coa_code}|`
          if (!byKey[key]) byKey[key] = { sessions: [], giPayments: [], branchId: null }
          byKey[key].giPayments.push(p)
        }

        const journalIdByKey = new Map<string, string>()

        // Create one journal per CC card + branch (within the same transaction)
        for (const [groupKey, group] of Object.entries(byKey)) {
          const ccCoaCode = groupKey.split('|')[0]
          const coaDebit = await chartOfAccountsRepository.findByCode(settlementCompanyId, ccCoaCode)
          if (!coaDebit) throw new BusinessRuleError(`COA CC ${ccCoaCode} tidak ditemukan`)

          const ccTotal =
            group.sessions.reduce((sum, s) => sum + Number(s.total_amount), 0) +
            group.giPayments.reduce((sum, p) => sum + p.total_amount, 0)

          const journalCreateDto = {
            company_id: settlementCompanyId,
            branch_id: group.branchId,
            journal_date: dto.settled_date,
            journal_type: 'FINANCING',
            description: `Pelunasan Bulk Credit Card - ${dto.reference_number}`,
            currency: 'IDR',
            exchange_rate: 1,
            reference_type: 'marketplace_bulk_settlement',
            reference_id: bulkId,
            reference_number: bulkId,
            source_module: 'marketplace_po',
            lines: [
              {
                line_number: 1,
                account_id: coaDebit.id,
                description: `Pelunasan Bulk Credit Card - ${dto.reference_number}`,
                debit_amount: ccTotal,
                credit_amount: 0,
              },
              {
                line_number: 2,
                account_id: coaCredit.id,
                description: `Pelunasan Bulk Credit Card - ${dto.reference_number}`,
                debit_amount: 0,
                credit_amount: ccTotal,
              },
            ],
          }

          const posted = await this.postJournalWorkflow(journalCreateDto, userId, settlementCompanyId, client)
          journalIdByKey.set(groupKey, posted.id)
          journalIds.push(posted.id)
        }

        // Finalize marketplace sessions
        if (sessionIds.length > 0) {
          for (const session of sessions) {
            const key = `${session.cc_coa_code}|${session.branch_id ?? ''}`
            const journalHeaderId = journalIdByKey.get(key)
            if (!journalHeaderId) throw new BusinessRuleError(`Journal untuk CC ${session.cc_coa_code} cabang ${session.branch_id ?? 'unknown'} tidak ditemukan`)

            await marketplacePoRepository.markSessionSettledInBulk(client, session.id, settlementCompanyId, userId, journalHeaderId)
            await marketplacePoRepository.insertMarketplaceSettlement(client, {
              sessionId: session.id,
              settledDate: dto.settled_date,
              bankAccountId: dto.bank_account_id,
              amount: Number(session.total_amount),
              referenceNumber: dto.reference_number ?? null,
              notes: dto.notes ?? null,
              journalId: journalHeaderId,
              userId,
            })
          }
        }

        // Finalize general invoice CC_OWNER payments
        for (const giPay of giPayments) {
          const key = `${giPay.cc_coa_code}|`
          const journalHeaderId = journalIdByKey.get(key)
          if (!journalHeaderId) throw new BusinessRuleError(`Journal untuk CC ${giPay.cc_coa_code} tidak ditemukan`)

          await marketplacePoRepository.settleGiPayment(client, {
            paymentId: giPay.id,
            settledDate: dto.settled_date,
            bankAccountId: dto.bank_account_id,
            amount: giPay.total_amount,
            referenceNumber: dto.reference_number ?? null,
            notes: dto.notes ?? null,
            journalId: journalHeaderId,
            userId,
          })
        }

        // Link bank statement if provided
        if (dto.bank_statement_id) {
          const stmtOk = await marketplacePoRepository.findUnreconciledBankStatementForLink(
            client, dto.bank_statement_id, settlementCompanyId, dto.bank_account_id,
          )
          if (!stmtOk) {
            throw new BusinessRuleError('Bank statement tidak ditemukan, tidak sesuai bank account, atau sudah ter-rekonsiliasi')
          }
          await marketplacePoRepository.linkBankStatementToJournal(client, dto.bank_statement_id, journalIds[0])
        }
      })

      return { settled_count: sessionIds.length + giPaymentIds.length, journal_ids: journalIds }
    }
  }

  export const marketplacePoService = new MarketplacePoService()