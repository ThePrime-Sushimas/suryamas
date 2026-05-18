  import { pool } from '../../config/db'
  import type { PoolClient } from 'pg'
  import { BusinessRuleError } from '../../utils/errors.base'
  import { AuditService } from '../monitoring/monitoring.service'
  import { marketplacePoRepository } from './marketplace-po.repository'
  import { chartOfAccountsRepository } from '../accounting/chart-of-accounts/chart-of-accounts.repository'
  import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
  import { goodsReceiptsRepository } from '../goods-receipts/goods-receipts.repository'
  import { goodsProcessingRepository } from '../goods-processing/goods-processing.repository'
  import { purchaseInvoicesService } from '../purchase-invoices/purchase-invoices.service'
  import { storageService } from '../../services/storage.service'
  import type { VarianceStatus } from '../goods-receipts/goods-receipts.types'
  import type {
    CreateOwnerCreditCardDto,
    OwnerCreditCardWithSettlement,
    UpdateOwnerCreditCardDto,
  } from './marketplace-po.types'

  export class MarketplacePoService {
    async list(companyId: string, filter: any, pagination: { page: number; limit: number }) {
      const offset = (pagination.page - 1) * pagination.limit
      return marketplacePoRepository.listSessions(companyId, filter, { limit: pagination.limit, offset })
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
      const { rows } = await pool.query(
        `SELECT id FROM bank_accounts
         WHERE id = $1
           AND owner_type = 'company'
           AND owner_id = $2
           AND is_active = true
           AND deleted_at IS NULL`,
        [bankAccountId, companyId],
      )
      if (!rows[0]) {
        throw new BusinessRuleError('Rekening bank pelunasan tidak ditemukan atau tidak aktif')
      }
    }

    async listPendingPoLines(companyId: string, filter: { platform?: string; branch_id?: string }) {
      return marketplacePoRepository.findPendingPoLines(companyId, filter)
    }

    async createOwnerCreditCard(
      companyId: string,
      userId: string,
      dto: CreateOwnerCreditCardDto,
    ): Promise<OwnerCreditCardWithSettlement> {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
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
        await client.query('COMMIT')
        return created
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    async updateOwnerCreditCard(
      companyId: string,
      userId: string,
      id: string,
      dto: UpdateOwnerCreditCardDto,
    ): Promise<OwnerCreditCardWithSettlement> {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
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
        await client.query('COMMIT')
        return updated
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    async deleteOwnerCreditCard(companyId: string, userId: string, id: string) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const deleted = await marketplacePoRepository.softDeleteOwnerCreditCard(client, id, companyId, userId)
        if (!deleted) throw new BusinessRuleError('Owner credit card not found')
        await client.query('COMMIT')
        return deleted
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    async createSession(companyId: string, userId: string, dto: any) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        const { rows: seqRows } = await client.query(
          'SELECT generate_marketplace_session_number($1::uuid, $2::varchar) AS session_number',
          [companyId, dto.platform],
        )
        const sessionNumber = seqRows[0]?.session_number
        if (!sessionNumber) throw new BusinessRuleError('Failed to generate session number')

        const lines = dto.lines
        if (!Array.isArray(lines) || lines.length === 0) throw new BusinessRuleError('At least 1 line is required')

        const totalAmount = lines.reduce((sum: number, l: any) => sum + Number(l.unit_price_netto) * Number(l.qty), 0)

        const session = await marketplacePoRepository.createSessionAndLines(client, companyId, userId, {
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

        await client.query('COMMIT')
        await AuditService.log('CREATE', 'marketplace_checkout_session', session.id, userId, undefined, session)
        return session
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    async updateSessionHeader(companyId: string, userId: string, id: string, dto: any) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const updated = await marketplacePoRepository.updateSessionHeader(client, id, companyId, userId, {
          platform: dto.platform,
          cc_id: dto.cc_id,
          checkout_date: dto.checkout_date,
          notes: dto.notes,
        })
        if (!updated) throw new BusinessRuleError('Session not found or not in DRAFT')
        await client.query('COMMIT')
        return updated
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    async cancelSession(companyId: string, userId: string, id: string) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const cancelled = await marketplacePoRepository.cancelSession(client, id, companyId, userId)
        if (!cancelled) throw new BusinessRuleError('Session not found or not in DRAFT')
        await client.query('COMMIT')
        return cancelled
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    async orderSession(companyId: string, userId: string, employeeId: string, id: string, dto: any) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        if (!employeeId) throw new BusinessRuleError('Employee context not found')

        const session = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
        if (!session) throw new BusinessRuleError('Marketplace session not found')
        if (session.status !== 'DRAFT') throw new BusinessRuleError('Session must be DRAFT')

        const hasBuktip = await marketplacePoRepository.hasBuktipBayarAttachment(client, id)
        if (!hasBuktip) throw new BusinessRuleError('Attachment BUKTI_BAYAR is required before ORDERED')

        const { rows: ccRows } = await client.query(
          `SELECT coa_code FROM owner_credit_cards WHERE id = $1 AND company_id = $2 AND is_active = true`,
          [session.cc_id, companyId],
        )
        const ccCoaCode = ccRows[0]?.coa_code
        if (!ccCoaCode) throw new BusinessRuleError('COA for CC not found')

        const coa110598 = await chartOfAccountsRepository.findByCode(companyId, '110598')
        if (!coa110598) throw new BusinessRuleError('COA 110598 not found')

        const coaCc = await chartOfAccountsRepository.findByCode(companyId, ccCoaCode)
        if (!coaCc) throw new BusinessRuleError('COA for CC not found')

        const journal_date = dto?.journal_date ?? new Date().toISOString().slice(0, 10)
        const total = Number(session.total_amount)

        const journalCreateDto: any = {
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

        const journalHeader = await (journalHeadersService as any).create(journalCreateDto, employeeId)
        await (journalHeadersService as any).submit(journalHeader.id, employeeId, companyId)
        await (journalHeadersService as any).approve(journalHeader.id, employeeId, companyId)
        await (journalHeadersService as any).post(journalHeader.id, employeeId, companyId)

        await marketplacePoRepository.updateOrderData(client, id, companyId, userId, {
          platform_order_ids: dto?.platform_order_ids ?? null,
          platform_receipt_url: dto?.platform_receipt_url ?? null,
          journal_ordered_id: journalHeader.id,
          status: 'ORDERED',
        })

        await client.query('COMMIT')
        return await marketplacePoRepository.findSessionDetail(id, companyId)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    async shipSession(companyId: string, userId: string, id: string, dto: any) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const session = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
        if (!session) throw new BusinessRuleError('Marketplace session not found')
        if (session.status !== 'ORDERED') throw new BusinessRuleError('Session must be ORDERED to SHIPPED')

        if (!dto?.shipments || dto.shipments.length === 0) throw new BusinessRuleError('At least 1 shipment/resi is required')

        await marketplacePoRepository.updateOrInsertShipments(client, id, userId, dto.shipments)

        await client.query(
          `UPDATE marketplace_checkout_sessions SET status='SHIPPED', updated_by=$1, updated_at=now() WHERE id=$2 AND company_id=$3`,
          [userId, id, companyId],
        )

        await client.query('COMMIT')
        return await marketplacePoRepository.findSessionDetail(id, companyId)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    async receiveSession(companyId: string, userId: string, employeeId: string, id: string, dto: any) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        if (!employeeId) throw new BusinessRuleError('Employee context not found')
        const session = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
        if (!session) throw new BusinessRuleError('Marketplace session not found')
        if (session.status !== 'SHIPPED') throw new BusinessRuleError('Session must be SHIPPED to RECEIVED')

            // ✅ GUARD DULU sebelum jurnal dibuat
            const lines = await marketplacePoRepository.findSessionLinesForReceive(client, id)
            if (lines.length === 0) throw new BusinessRuleError('Sesi tidak memiliki line barang')
      
            const allPoLineIds = lines.map((l: any) => l.po_line_id as string)
            const fullyReceivedIds = await marketplacePoRepository.findFullyReceivedPoLines(client, allPoLineIds)
            if (fullyReceivedIds.length > 0) {
              throw new BusinessRuleError(
                `${fullyReceivedIds.length} PO line sudah pernah diterima penuh. ` +
                `Periksa GR yang sudah ada sebelum melanjutkan.`,
              )
            }
      
            const uniquePoIds = [...new Set(lines.map((l: any) => l.po_id as string))]
            for (const poId of uniquePoIds) {
              const existingGr = await marketplacePoRepository.findExistingMarketplaceGr(client, poId, companyId)
              if (existingGr) {
                throw new BusinessRuleError(
                  `PO ini sudah memiliki GR marketplace (${existingGr.gr_number}). ` +
                  `Double receive tidak diizinkan.`,
                )
              }
            }
            // ✅ END GUARD — aman lanjut ke jurnal
      
        const journal_date = dto?.journal_date ?? new Date().toISOString().slice(0, 10)

        const coaDebit = await chartOfAccountsRepository.findByCode(companyId, '110501')
        if (!coaDebit) throw new BusinessRuleError('COA 110501 not found')

        const coaCredit = await chartOfAccountsRepository.findByCode(companyId, '110598')
        if (!coaCredit) throw new BusinessRuleError('COA 110598 not found')

        const total = Number(session.total_amount)
        const journalDesc = `Barang Masuk Marketplace - ${session.session_number}`

        const journalCreateDto: any = {
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

        const journalHeader = await (journalHeadersService as any).create(journalCreateDto, employeeId)
        await (journalHeadersService as any).submit(journalHeader.id, employeeId, companyId)
        await (journalHeadersService as any).approve(journalHeader.id, employeeId, companyId)
        await (journalHeadersService as any).post(journalHeader.id, employeeId, companyId)
        

        const linesByPo = lines.reduce((acc: Record<string, typeof lines>, l: (typeof lines)[0]) => {
          if (!acc[l.po_id]) acc[l.po_id] = []
          acc[l.po_id].push(l)
          return acc
        }, {})

        let firstGrId: string | null = null

        for (const [poId, poLines] of Object.entries(linesByPo)) {
          const gr = await this.createMarketplaceGr(
            client,
            companyId,
            userId,
            poId,
            poLines,
            session.session_number,
            journal_date,
          )
          if (!firstGrId) firstGrId = gr.grId
        }

        await client.query(
          `UPDATE marketplace_checkout_sessions
          SET status = 'RECEIVED',
              journal_received_id = $1,
              goods_receipt_id = $2,
              updated_by = $3,
              updated_at = now()
          WHERE id = $4 AND company_id = $5`,
          [journalHeader.id, firstGrId, userId, id, companyId],
        )

        await client.query('COMMIT')
        return await marketplacePoRepository.findSessionDetail(id, companyId)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    private async createMarketplaceGr(
      client: PoolClient,
      companyId: string,
      userId: string,
      poId: string,
      poLines: Array<{
        po_line_id: string
        product_id: string
        qty: number | string
        unit_price_netto: number | string
        unit_price_po?: number | string
        uom: string
        requires_processing?: boolean
      }>,
      sessionNumber: string,
      receivedDate: string,
    ): Promise<{ grId: string; grNumber: string }> {
      const { rows: poRows } = await client.query(
        `SELECT po.branch_id, b.branch_code
        FROM purchase_orders po
        JOIN branches b ON b.id = po.branch_id
        WHERE po.id = $1 AND po.company_id = $2 AND po.deleted_at IS NULL`,
        [poId, companyId],
      )
      const po = poRows[0]
      if (!po) throw new BusinessRuleError(`Purchase order ${poId} not found`)

      const { rows: whRows } = await client.query(
        `SELECT id FROM warehouses
        WHERE branch_id = $1 AND company_id = $2 AND warehouse_type = 'MAIN' AND deleted_at IS NULL
        LIMIT 1`,
        [po.branch_id, companyId],
      )
      const warehouseId = whRows[0]?.id
      if (!warehouseId) {
        throw new BusinessRuleError(`Warehouse tidak ditemukan untuk cabang ${po.branch_id}`)
      }

      const branchCode = po.branch_code ?? 'XXX'
      const grNumber = await goodsReceiptsRepository.generateGrNumber(client, companyId, branchCode)
      const gr = await goodsReceiptsRepository.create(client, companyId, {
        branch_id: po.branch_id,
        po_id: poId,
        warehouse_id: warehouseId,
        gr_number: grNumber,
        received_date: receivedDate,
        invoice_number: sessionNumber,
        created_by: userId,
        source: 'MARKETPLACE',
        status: 'CONFIRMED',
      })

      const processedLines = poLines.map((line) => {
        const qtyPoUom = Number(line.qty)
        const qtyAccepted = qtyPoUom
        const unitPricePo = Number(line.unit_price_po ?? 0)
        const unitPriceInvoice = Number(line.unit_price_netto)
        const poTotal = qtyAccepted * unitPricePo
        const invoiceTotal = qtyAccepted * unitPriceInvoice
        const variance = invoiceTotal - poTotal
        const variancePct = poTotal > 0 ? Math.abs(variance / poTotal) * 100 : 0
        const varianceStatus: VarianceStatus = variancePct <= 0.01 ? 'OK' : variancePct <= 15 ? 'NOTICE' : 'DISPUTED'

        return {
          po_line_id: line.po_line_id,
          product_id: line.product_id,
          qty_po_uom: qtyPoUom,
          uom_po: line.uom,
          qty_received: qtyPoUom,
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

      for (const line of processedLines) {
        const qtyAccepted = line.qty_po_uom - (line.qty_rejected ?? 0)
        await goodsReceiptsRepository.incrementPoLineQtyReceived(client, line.po_line_id, qtyAccepted)
      }

      const newPoStatus = await goodsReceiptsRepository.resolvePoStatus(client, poId)
      await goodsReceiptsRepository.updatePoStatus(client, poId, newPoStatus, userId)

      const gpNumber = await goodsProcessingRepository.generateGpNumber(client, companyId, branchCode)
      const hasDisassembly = poLines.some((l) => l.requires_processing)
      const processingType = hasDisassembly ? 'DISASSEMBLY' : 'PASS_THROUGH'

      const { rows: gpRows } = await client.query(
        `INSERT INTO goods_processing (company_id, branch_id, warehouse_id, goods_receipt_id, processing_number, processing_date, processing_type, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', $8) RETURNING id`,
        [companyId, po.branch_id, warehouseId, gr.id, gpNumber, receivedDate, processingType, userId],
      )
      const gpId = gpRows[0].id

      const { rows: grLineRows } = await client.query(
        `SELECT id, product_id, qty_received, uom_received, uom_po
        FROM goods_receipt_lines WHERE gr_id = $1`,
        [gr.id],
      )

      for (const line of grLineRows) {
        const { rows: inputRows } = await client.query(
          `INSERT INTO goods_processing_inputs (goods_processing_id, gr_line_id, product_id, qty_input, uom, sort_order)
          VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
          [gpId, line.id, line.product_id, line.qty_received, line.uom_received ?? line.uom_po ?? 'kg'],
        )
        await client.query(
          `INSERT INTO goods_processing_outputs (goods_processing_id, input_id, product_id, qty_output, uom, is_waste, sort_order)
          VALUES ($1, $2, $3, $4, $5, false, 0)`,
          [gpId, inputRows[0].id, line.product_id, line.qty_received, line.uom_received ?? line.uom_po ?? 'kg'],
        )
      }

      await purchaseInvoicesService.createDraftFromGr(client, companyId, gr.id, userId)

      return { grId: gr.id, grNumber }
    }

    async uploadAttachment(
      companyId: string,
      userId: string,
      sessionId: string,
      file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
      fileType: string,
    ) {
      const session = await marketplacePoRepository.getSessionStatus(pool, sessionId, companyId)
      if (!session) throw new BusinessRuleError('Marketplace session not found')
      if (!['DRAFT', 'ORDERED'].includes(session.status)) {
        throw new BusinessRuleError('Attachment can only be uploaded for DRAFT or ORDERED sessions')
      }

      const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf']
      const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new BusinessRuleError(`File type .${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new BusinessRuleError('File too large. Maximum 10MB.')
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const path = `${companyId}/marketplace/${sessionId}/${fileName}`

      await storageService.uploadToPath(file.buffer, path, file.mimetype, 'invoices')

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const attachment = await marketplacePoRepository.insertAttachment(client, sessionId, {
          file_type: fileType,
          file_path: path,
          file_name: file.originalname,
          file_size: file.size,
          uploaded_by: userId,
        })
        await client.query('COMMIT')
        return attachment
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
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

    async settleSession(companyId: string, userId: string, employeeId: string, id: string, dto: any) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        if (!employeeId) throw new BusinessRuleError('Employee context not found')
        const session = await marketplacePoRepository.getSessionForTransition(client, id, companyId)
        if (!session) throw new BusinessRuleError('Marketplace session not found')
        if (session.status !== 'RECEIVED') throw new BusinessRuleError('Session must be RECEIVED to SETTLED')

        const amount = dto?.amount ?? Number(session.total_amount)
        const bankAccountId = dto.bank_account_id

        const { rows: ccRows } = await client.query(
          `SELECT coa_code FROM owner_credit_cards WHERE id=$1 AND company_id=$2 AND is_active=true`,
          [session.cc_id, companyId],
        )
        const ccCoaCode = ccRows[0]?.coa_code
        if (!ccCoaCode) throw new BusinessRuleError('COA for CC not found')

        const coaDebit = await chartOfAccountsRepository.findByCode(companyId, ccCoaCode)
        if (!coaDebit) throw new BusinessRuleError('COA for CC not found')

        const { rows: bankRows } = await client.query(
          `SELECT coa_code FROM bank_accounts WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL`,
          [bankAccountId, companyId],
        )
        const bankCoaCode = bankRows[0]?.coa_code
        if (!bankCoaCode) throw new BusinessRuleError('COA for bank account not found')

        const coaCredit = await chartOfAccountsRepository.findByCode(companyId, bankCoaCode)
        if (!coaCredit) throw new BusinessRuleError('COA for bank account not found')

        const journal_date = dto?.settled_date ?? new Date().toISOString().slice(0, 10)

        const journalCreateDto: any = {
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

        const journalHeader = await (journalHeadersService as any).create(journalCreateDto, employeeId)
        await (journalHeadersService as any).submit(journalHeader.id, employeeId, companyId)
        await (journalHeadersService as any).approve(journalHeader.id, employeeId, companyId)
        await (journalHeadersService as any).post(journalHeader.id, employeeId, companyId)

        await client.query(
          `UPDATE marketplace_checkout_sessions SET status='SETTLED', journal_settled_id=$1, updated_by=$2, updated_at=now() WHERE id=$3 AND company_id=$4`,
          [journalHeader.id, userId, id, companyId],
        )

        await client.query(
          `INSERT INTO marketplace_settlements (session_id, settled_date, bank_account_id, amount, reference_number, notes, journal_id, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            id,
            dto.settled_date ?? new Date().toISOString().slice(0, 10),
            bankAccountId,
            amount,
            dto.reference_number,
            dto.notes ?? null,
            journalHeader.id,
            userId,
          ],
        )

        await client.query('COMMIT')
        return await marketplacePoRepository.findSessionDetail(id, companyId)
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    // ── CC Owner Bulk Settlement ──
    async getSettlementSummary(companyId: string) {
      const { rows: pendingRows } = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total
         FROM marketplace_checkout_sessions
         WHERE company_id = $1 AND status = 'RECEIVED' AND deleted_at IS NULL`,
        [companyId],
      )
      const totalPending = Number(pendingRows[0]?.total ?? 0)

      const firstDayOfMonth = new Date()
      firstDayOfMonth.setDate(1)
      firstDayOfMonth.setHours(0, 0, 0, 0)

      const { rows: thisMonthRows } = await pool.query(
        `SELECT COALESCE(SUM(ms.amount), 0)::numeric AS total
         FROM marketplace_settlements ms
         JOIN marketplace_checkout_sessions mcs ON mcs.id = ms.session_id
         WHERE mcs.company_id = $1
           AND ms.settled_date >= $2::date`,
        [companyId, firstDayOfMonth.toISOString().slice(0, 10)],
      )
      const totalThisMonth = Number(thisMonthRows[0]?.total ?? 0)

      const { rows: historyRows } = await pool.query(
        `SELECT ms.*, ba.account_name AS bank_name
         FROM marketplace_settlements ms
         JOIN marketplace_checkout_sessions mcs ON mcs.id = ms.session_id
         JOIN bank_accounts ba ON ba.id = ms.bank_account_id
         WHERE mcs.company_id = $1
         ORDER BY ms.settled_date DESC
         LIMIT 100`,
        [companyId],
      )

      return {
        total_pending: totalPending,
        total_this_month: totalThisMonth,
        history: historyRows,
      }
    }

    async createBulkSettlement(companyId: string, userId: string, employeeId: string, dto: any) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        if (!employeeId) throw new BusinessRuleError('Employee context tidak ditemukan')

        const { rows: sessions } = await client.query(
          `SELECT mcs.*, occ.coa_code AS cc_coa_code
           FROM marketplace_checkout_sessions mcs
           JOIN owner_credit_cards occ ON occ.id = mcs.cc_id
           WHERE mcs.id = ANY($1::uuid[])
             AND mcs.company_id = $2
             AND mcs.status = 'RECEIVED'
             AND mcs.deleted_at IS NULL`,
          [dto.session_ids, companyId],
        )
        if (sessions.length !== dto.session_ids.length) {
          throw new BusinessRuleError('Beberapa sesi tidak ditemukan atau statusnya bukan RECEIVED')
        }

        const { rows: bankRows } = await client.query(
          `SELECT coa.account_code FROM bank_accounts ba
           JOIN chart_of_accounts coa ON coa.id = ba.coa_account_id
           WHERE ba.id = $1 AND ba.owner_id = $2 AND ba.deleted_at IS NULL`,
          [dto.bank_account_id, companyId],
        )
        const bankCoaCode = bankRows[0]?.account_code
        if (!bankCoaCode) throw new BusinessRuleError('COA untuk bank account tidak ditemukan')

        const coaCredit = await chartOfAccountsRepository.findByCode(companyId, bankCoaCode)
        if (!coaCredit) throw new BusinessRuleError('COA bank tidak ditemukan di chart of accounts')

        const byCc = sessions.reduce((acc: Record<string, typeof sessions>, s: (typeof sessions)[0]) => {
          const key = s.cc_coa_code
          if (!acc[key]) acc[key] = []
          acc[key].push(s)
          return acc
        }, {})

        const journalIds: string[] = []

        for (const [ccCoaCode, ccSessions] of Object.entries(byCc)) {
          const coaDebit = await chartOfAccountsRepository.findByCode(companyId, ccCoaCode)
          if (!coaDebit) throw new BusinessRuleError(`COA CC ${ccCoaCode} tidak ditemukan`)

          const ccTotal = (ccSessions as typeof sessions).reduce(
            (sum, s) => sum + Number(s.total_amount),
            0,
          )

          const journalCreateDto: any = {
            company_id: companyId,
            journal_date: dto.settled_date,
            journal_type: 'FINANCING',
            description: `Pelunasan Bulk CC Owner - ${dto.reference_number}`,
            currency: 'IDR',
            exchange_rate: 1,
            reference_type: 'marketplace_bulk_settlement',
            reference_number: dto.reference_number,
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

          const journalHeader = await (journalHeadersService as any).create(journalCreateDto, employeeId)
          await (journalHeadersService as any).submit(journalHeader.id, employeeId, companyId)
          await (journalHeadersService as any).approve(journalHeader.id, employeeId, companyId)
          await (journalHeadersService as any).post(journalHeader.id, employeeId, companyId)
          journalIds.push(journalHeader.id)

          for (const session of ccSessions as typeof sessions) {
            await client.query(
              `UPDATE marketplace_checkout_sessions
               SET status = 'SETTLED',
                   journal_settled_id = $1,
                   updated_by = $2,
                   updated_at = now()
               WHERE id = $3 AND company_id = $4`,
              [journalHeader.id, userId, session.id, companyId],
            )

            await client.query(
              `INSERT INTO marketplace_settlements
                 (session_id, settled_date, bank_account_id, amount, reference_number, notes, journal_id, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                session.id,
                dto.settled_date,
                dto.bank_account_id,
                Number(session.total_amount),
                dto.reference_number,
                dto.notes ?? null,
                journalHeader.id,
                userId,
              ],
            )
          }
        }

        await client.query('COMMIT')
        return { settled_count: sessions.length, journal_ids: journalIds }
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }
  }

  export const marketplacePoService = new MarketplacePoService()