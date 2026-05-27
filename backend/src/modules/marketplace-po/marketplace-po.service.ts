  import { randomUUID } from 'crypto'
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
    CreateOwnerCreditCardDto,
    OwnerCreditCardWithSettlement,
    UpdateOwnerCreditCardDto,
  } from './marketplace-po.types'

  export class MarketplacePoService {
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
    ): Promise<{ id: string }> {
      const journalHeader = await journalHeadersService.create(journalCreateDto, authUserId)
      await journalHeadersService.submitAsUser(journalHeader.id, authUserId)
      await journalHeadersService.approveAsUser(journalHeader.id, authUserId)
      await journalHeadersService.postAsUser(journalHeader.id, authUserId)
      return { id: journalHeader.id }
    }
    async list(companyIds: string[], filter: any, pagination: { page: number; limit: number }) {
      const offset = (pagination.page - 1) * pagination.limit
      return marketplacePoRepository.listSessions(companyIds, filter, { limit: pagination.limit, offset })
    }

    async getSessionDetail(id: string, companyId: string) {
      const detail = await marketplacePoRepository.findSessionDetail(id, companyId)
      return detail
    }

    async listOwnerCreditCards(
      companyId: string,
      filter: { is_active?: boolean } = {},
    ): Promise<OwnerCreditCardWithSettlement[]> {
      return marketplacePoRepository.listOwnerCreditCards(companyId, filter)
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
      userId: string,
      dto: CreateOwnerCreditCardDto,
    ): Promise<OwnerCreditCardWithSettlement> {
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
      userId: string,
      id: string,
      dto: UpdateOwnerCreditCardDto,
    ): Promise<OwnerCreditCardWithSettlement> {
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

    async deleteOwnerCreditCard(companyId: string, userId: string, id: string) {
      return marketplacePoRepository.withTransaction(async (client) => {
        const deleted = await marketplacePoRepository.softDeleteOwnerCreditCard(client, id, companyId, userId)
        if (!deleted) throw new BusinessRuleError('Owner credit card not found')
        return deleted
      })
    }

    async createSession(companyId: string, userId: string, dto: any) {
      const session = await marketplacePoRepository.withTransaction(async (client) => {
        const sessionNumber = await marketplacePoRepository.generateSessionNumber(client, companyId, dto.platform)
        if (!sessionNumber) throw new BusinessRuleError('Failed to generate session number')

        const lines = dto.lines
        if (!Array.isArray(lines) || lines.length === 0) throw new BusinessRuleError('At least 1 line is required')

        const totalAmount = lines.reduce((sum: number, l: any) => sum + Number(l.unit_price_netto) * Number(l.qty), 0)

        return marketplacePoRepository.createSessionAndLines(client, companyId, userId, {
          session_number: sessionNumber,
          platform: dto.platform,
          cc_id: dto.cc_id,
          checkout_date: dto.checkout_date ?? new Date().toISOString().slice(0, 10),
          notes: dto.notes ?? null,
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

      const fullDetail = await marketplacePoRepository.findSessionDetail(session.id, companyId)
      await AuditService.log('CREATE', 'marketplace_checkout_session', session.id, userId, undefined, fullDetail ?? session)
      return session
    }

    async updateSessionHeader(companyId: string, userId: string, id: string, dto: any) {
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

    async cancelSession(companyId: string, userId: string, id: string) {
      return marketplacePoRepository.withTransaction(async (client) => {
        const cancelled = await marketplacePoRepository.cancelSession(client, id, companyId, userId)
        if (!cancelled) throw new BusinessRuleError('Session not found or not in DRAFT')
        return cancelled
      })
    }

    async orderSession(companyId: string, userId: string, id: string, dto: any) {
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

      const coa110598 = await chartOfAccountsRepository.findByCode(companyId, '110598')
      if (!coa110598) throw new BusinessRuleError('COA 110598 not found')

      const coaCc = await chartOfAccountsRepository.findByCode(companyId, ccCoaCode)
      if (!coaCc) throw new BusinessRuleError('COA for CC not found')

      const journal_date = dto?.journal_date ?? new Date().toISOString().slice(0, 10)
      const total = Number(session.total_amount)

      const journalCreateDto = {
        company_id: companyId,
        branch_id: session.branch_id ?? null,
        journal_date,
        journal_type: 'INVENTORY',
        description: `Checkout Marketplace ${session.platform} - ${session.session_number}`,
        currency: 'IDR',
        exchange_rate: 1,
        reference_type: 'marketplace_checkout_session',
        reference_id: id,
        reference_number: session.session_number,
        source_module: 'marketplace_po',
        tags: { platform: session.platform, session_number: session.session_number },
        lines: [
          {
            line_number: 1,
            account_id: coa110598.id,
            description: `Checkout Marketplace ${session.platform} - ${session.session_number}`,
            debit_amount: total,
            credit_amount: 0,
          },
          {
            line_number: 2,
            account_id: coaCc.id,
            description: `Checkout Marketplace ${session.platform} - ${session.session_number}`,
            debit_amount: 0,
            credit_amount: total,
          },
        ],
      }

      let journalId: string | null = null
      try {
        const posted = await this.postJournalWorkflow(journalCreateDto, userId, companyId)
        journalId = posted.id

        await marketplacePoRepository.withTransaction(async (client) => {
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
        await this.cleanupPostedJournalsAfterFailure(
          journalId ? [journalId] : [],
          'orderSession',
          userId,
          companyId,
          { sessionId: id },
        )
        throw e
      }

      return marketplacePoRepository.findSessionDetail(id, companyId)
    }

    async shipSession(companyId: string, userId: string, id: string, dto: any) {
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

      return marketplacePoRepository.findSessionDetail(id, companyId)
    }

    async cancelOrderedSession(
      companyId: string,
      userId: string,
      id: string,
      dto: CancelSessionDto,
    ) {
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
      return marketplacePoRepository.findSessionDetail(id, companyId)
    }
    
    async cancelShippedSession(
      companyId: string,
      userId: string,
      id: string,
      dto: CancelSessionDto,
    ) {
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
      return marketplacePoRepository.findSessionDetail(id, companyId)
    }

    async postReceiveJournal(
      companyId: string,
      userId: string,
      id: string,
      dto: { journal_date?: string },
    ) {
      const detail = await marketplacePoRepository.findSessionDetail(id, companyId)
      if (!detail?.header) throw new BusinessRuleError('Marketplace session not found')
      const session = detail.header
      if (session.status !== 'RECEIVED') throw new BusinessRuleError('Session harus RECEIVED untuk post journal')
      if (session.journal_received_id) throw new BusinessRuleError('Journal receive sudah pernah di-post')

      const coaDebit = await chartOfAccountsRepository.findByCode(companyId, '110501')
      if (!coaDebit) throw new BusinessRuleError('COA 110501 tidak ditemukan')

      const coaCredit = await chartOfAccountsRepository.findByCode(companyId, '110598')
      if (!coaCredit) throw new BusinessRuleError('COA 110598 tidak ditemukan')

      const total = Number(session.total_amount)
      const journal_date = dto?.journal_date ?? new Date().toISOString().slice(0, 10)
      const journalDesc = `Barang Masuk Marketplace - ${session.session_number}`

      const journalCreateDto = {
        company_id: companyId,
        journal_date,
        journal_type: 'INVENTORY',
        description: journalDesc,
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
            description: journalDesc,
            debit_amount: total,
            credit_amount: 0,
          },
          {
            line_number: 2,
            account_id: coaCredit.id,
            description: journalDesc,
            debit_amount: 0,
            credit_amount: total,
          },
        ],
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
      return marketplacePoRepository.findSessionDetail(id, companyId)
    }

    async uploadAttachment(
      companyId: string,
      userId: string,
      sessionId: string,
      file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
      fileType: string,
    ) {
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

    async deleteAttachment(companyId: string, sessionId: string, attachmentId: string) {
      const attachment = await marketplacePoRepository.findAttachment(sessionId, attachmentId)
      if (!attachment || attachment.company_id !== companyId) {
        throw new BusinessRuleError('Attachment not found')
      }
      if (!['DRAFT', 'ORDERED'].includes(attachment.session_status)) {
        throw new BusinessRuleError('Attachment can only be deleted for DRAFT or ORDERED sessions')
      }

      const deleted = await marketplacePoRepository.deleteAttachment(attachmentId, sessionId)
      if (!deleted) throw new BusinessRuleError('Attachment not found')
    }

    async settleSession(companyId: string, userId: string, id: string, dto: any) {
      const detail = await marketplacePoRepository.findSessionDetail(id, companyId)
      if (!detail?.header) throw new BusinessRuleError('Marketplace session not found')
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
        journal_date,
        journal_type: 'FINANCING',
        description: `Pelunasan CC Owner - ${session.session_number}`,
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
            description: `Pelunasan CC Owner - ${session.session_number}`,
            debit_amount: amount,
            credit_amount: 0,
          },
          {
            line_number: 2,
            account_id: coaCredit.id,
            description: `Pelunasan CC Owner - ${session.session_number}`,
            debit_amount: 0,
            credit_amount: amount,
          },
        ],
      }

      let journalId: string | null = null
      try {
        const posted = await this.postJournalWorkflow(journalCreateDto, userId, companyId)
        journalId = posted.id

        await marketplacePoRepository.withTransaction(async (client) => {
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
        await this.cleanupPostedJournalsAfterFailure(
          journalId ? [journalId] : [],
          'settleSession',
          userId,
          companyId,
          { sessionId: id },
        )
        throw e
      }

      return marketplacePoRepository.findSessionDetail(id, companyId)
    }

    async getSettlementSummary(companyId: string) {
      return marketplacePoRepository.findSettlementSummary(companyId)
    }

    async listUnreconciledStatements(
      companyId: string,
      bankAccountId: number,
      filter: { date_from?: string; date_to?: string } = {},
    ) {
      return marketplacePoRepository.listUnreconciledBankStatements(companyId, bankAccountId, filter)
    }

    async createBulkSettlement(
      companyId: string,
      userId: string,
      dto: any,
    ): Promise<{ settled_count: number; journal_ids: string[] }> {
      const bulkId = randomUUID()
      const sessions = await marketplacePoRepository.findReceivedSessionsForBulkSettlement(
        companyId,
        dto.session_ids,
      )
      if (sessions.length !== dto.session_ids.length) {
        throw new BusinessRuleError('Beberapa sesi tidak ditemukan atau statusnya bukan RECEIVED')
      }

      const bankCoaCode = await marketplacePoRepository.findBankAccountCoaCodeForBulk(
        dto.bank_account_id,
        companyId,
      )
      if (!bankCoaCode) throw new BusinessRuleError('COA untuk bank account tidak ditemukan')

      const coaCredit = await chartOfAccountsRepository.findByCode(companyId, bankCoaCode)
      if (!coaCredit) throw new BusinessRuleError('COA bank tidak ditemukan di chart of accounts')

      const byCc = sessions.reduce((acc: Record<string, typeof sessions>, s: (typeof sessions)[0]) => {
        const key = s.cc_coa_code as string
        if (!acc[key]) acc[key] = []
        acc[key].push(s)
        return acc
      }, {})

      const journalIdByCc = new Map<string, string>()
      const journalIds: string[] = []

      try {
        for (const [ccCoaCode, ccSessions] of Object.entries(byCc)) {
          const coaDebit = await chartOfAccountsRepository.findByCode(companyId, ccCoaCode)
          if (!coaDebit) throw new BusinessRuleError(`COA CC ${ccCoaCode} tidak ditemukan`)

          const ccTotal = (ccSessions as typeof sessions).reduce(
            (sum, s) => sum + Number(s.total_amount),
            0,
          )

          const journalCreateDto = {
            company_id: companyId,
            journal_date: dto.settled_date,
            journal_type: 'FINANCING',
            description: `Pelunasan Bulk CC Owner - ${dto.reference_number}`,
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
                description: `Pelunasan Bulk CC Owner - ${dto.reference_number}`,
                debit_amount: ccTotal,
                credit_amount: 0,
              },
              {
                line_number: 2,
                account_id: coaCredit.id,
                description: `Pelunasan Bulk CC Owner - ${dto.reference_number}`,
                debit_amount: 0,
                credit_amount: ccTotal,
              },
            ],
          }

          const posted = await this.postJournalWorkflow(journalCreateDto, userId, companyId)
          journalIdByCc.set(ccCoaCode, posted.id)
          journalIds.push(posted.id)
        }

        await marketplacePoRepository.withTransaction(async (client) => {
          const locked = await marketplacePoRepository.findReceivedSessionsForBulkSettlement(
            companyId,
            dto.session_ids,
            client,
          )
          if (locked.length !== dto.session_ids.length) {
            throw new BusinessRuleError('Beberapa sesi tidak ditemukan atau statusnya bukan RECEIVED')
          }

          const lockedByCc = locked.reduce((acc: Record<string, typeof locked>, s: (typeof locked)[0]) => {
            const key = s.cc_coa_code as string
            if (!acc[key]) acc[key] = []
            acc[key].push(s)
            return acc
          }, {})

          for (const [ccCoaCode, ccSessions] of Object.entries(lockedByCc)) {
            const journalHeaderId = journalIdByCc.get(ccCoaCode)
            if (!journalHeaderId) throw new BusinessRuleError(`Journal untuk CC ${ccCoaCode} tidak ditemukan`)

            for (const session of ccSessions) {
              await marketplacePoRepository.markSessionSettledInBulk(
                client,
                session.id,
                companyId,
                userId,
                journalHeaderId,
              )
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

          if (dto.bank_statement_id) {
            const stmtOk = await marketplacePoRepository.findUnreconciledBankStatementForLink(
              client,
              dto.bank_statement_id,
              companyId,
              dto.bank_account_id,
            )
            if (!stmtOk) {
              throw new BusinessRuleError(
                'Bank statement tidak ditemukan, tidak sesuai bank account, atau sudah ter-rekonsiliasi',
              )
            }
            await marketplacePoRepository.linkBankStatementToJournal(
              client,
              dto.bank_statement_id,
              journalIds[0],
            )
          }
        })

        return { settled_count: dto.session_ids.length, journal_ids: journalIds }
      } catch (e) {
        await this.cleanupPostedJournalsAfterFailure(
          journalIds,
          'createBulkSettlement',
          userId,
          companyId,
          { bulkId, sessionIds: dto.session_ids },
        )
        throw e
      }
    }
  }

  export const marketplacePoService = new MarketplacePoService()