import { expenseCategorizationRepository } from './expense-categorization.repository'
import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
import { AuditService } from '../monitoring/monitoring.service'
import { RuleNotFoundError, RuleDuplicateError, NoEligibleStatementsError, MissingCoaMappingError } from './expense-categorization.errors'
import { isPostgresError } from '../../utils/postgres-error.util'
import type { ExpenseAutoRule, CreateRuleDto, UpdateRuleDto, CategorizeResult } from './expense-categorization.types'

export class ExpenseCategorizationService {

  // ── Rules CRUD ──

  async listRules(companyId: string): Promise<ExpenseAutoRule[]> {
    return expenseCategorizationRepository.listRules(companyId)
  }

  async createRule(companyId: string, dto: CreateRuleDto, userId: string): Promise<ExpenseAutoRule> {
    try {
      const rule = await expenseCategorizationRepository.createRule(companyId, {
        purpose_id: dto.purpose_id,
        pattern: dto.pattern,
        match_type: dto.match_type || 'CONTAINS',
        priority: dto.priority || 100,
      }, userId)
      await AuditService.log('CREATE', 'expense_auto_rule', rule.id, userId, undefined, rule)
      return rule
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new RuleDuplicateError(dto.pattern)
      throw err
    }
  }

  async updateRule(id: string, companyId: string, dto: UpdateRuleDto, userId: string): Promise<ExpenseAutoRule> {
    const existing = await expenseCategorizationRepository.findRuleById(id, companyId)
    if (!existing) throw new RuleNotFoundError(id)

    const allowed: Record<string, unknown> = {}
    if (dto.purpose_id !== undefined) allowed.purpose_id = dto.purpose_id
    if (dto.pattern !== undefined) allowed.pattern = dto.pattern
    if (dto.match_type !== undefined) allowed.match_type = dto.match_type
    if (dto.priority !== undefined) allowed.priority = dto.priority
    if (dto.is_active !== undefined) allowed.is_active = dto.is_active

    try {
      const rule = await expenseCategorizationRepository.updateRule(id, companyId, allowed, userId)
      await AuditService.log('UPDATE', 'expense_auto_rule', id, userId, existing, rule)
      return rule
    } catch (err: unknown) {
      if (isPostgresError(err, '23505')) throw new RuleDuplicateError(dto.pattern || existing.pattern)
      throw err
    }
  }

  async deleteRule(id: string, companyId: string, userId: string): Promise<void> {
    const existing = await expenseCategorizationRepository.findRuleById(id, companyId)
    if (!existing) throw new RuleNotFoundError(id)

    await expenseCategorizationRepository.deleteRule(id, companyId)
    await AuditService.log('DELETE', 'expense_auto_rule', id, userId, existing)
  }

  // ── Auto-categorize engine ──

  async autoCategorize(companyId: string, userId: string, filters?: { bank_account_id?: number; date_from?: string; date_to?: string; dry_run?: boolean }): Promise<CategorizeResult> {
    const rules = await expenseCategorizationRepository.getActiveRules(companyId)
    if (rules.length === 0) return { categorized: 0, skipped: 0, details: [] }

    const statements = await expenseCategorizationRepository.getUncategorizedForAutoMatch(companyId, filters)
    if (statements.length === 0) return { categorized: 0, skipped: 0, details: [] }

    const matches = new Map<number, { purpose_id: string; purpose_name: string }>()

    for (const stmt of statements) {
      const desc = stmt.description.toUpperCase()
      for (const rule of rules) {
        const pattern = rule.pattern.toUpperCase()
        let matched = false

        switch (rule.match_type) {
          case 'CONTAINS': matched = desc.includes(pattern); break
          case 'STARTS_WITH': matched = desc.startsWith(pattern); break
          case 'EXACT': matched = desc === pattern; break
          case 'REGEX':
            try { matched = new RegExp(rule.pattern, 'i').test(stmt.description) }
            catch { matched = false }
            break
        }

        if (matched) {
          matches.set(stmt.id, { purpose_id: rule.purpose_id, purpose_name: rule.purpose_name })
          break // first match wins (sorted by priority)
        }
      }
    }

    if (filters?.dry_run || matches.size === 0) {
      return {
        categorized: matches.size,
        skipped: statements.length - matches.size,
        details: [...matches.entries()].map(([id, m]) => ({ statement_id: String(id), ...m })),
      }
    }

    // Group by purpose_id for batch updates
    const byPurpose = new Map<string, number[]>()
    for (const [stmtId, { purpose_id }] of matches) {
      if (!byPurpose.has(purpose_id)) byPurpose.set(purpose_id, [])
      byPurpose.get(purpose_id)!.push(stmtId)
    }

    let totalCategorized = 0
    for (const [purposeId, ids] of byPurpose) {
      totalCategorized += await expenseCategorizationRepository.setCategoryBulk(ids, purposeId, companyId)
    }

    await AuditService.log('CREATE', 'expense_auto_categorize', 'bulk', userId, undefined, {
      categorized: totalCategorized,
      rules_used: rules.length,
      statements_checked: statements.length,
    })

    return {
      categorized: totalCategorized,
      skipped: statements.length - totalCategorized,
      details: [...matches.entries()].map(([id, m]) => ({ statement_id: String(id), ...m })),
    }
  }

  // ── Manual categorize ──

  async categorizeManual(companyId: string, statementIds: number[], purposeId: string, userId: string): Promise<number> {
    const count = await expenseCategorizationRepository.setCategoryBulk(statementIds, purposeId, companyId)
    await AuditService.log('UPDATE', 'expense_categorize_manual', 'bulk', userId, undefined, {
      statement_ids: statementIds,
      purpose_id: purposeId,
      count,
    })
    return count
  }

  async uncategorize(companyId: string, statementIds: number[], userId: string): Promise<number> {
    const count = await expenseCategorizationRepository.clearCategoryBulk(statementIds, companyId)
    await AuditService.log('UPDATE', 'expense_uncategorize', 'bulk', userId, undefined, {
      statement_ids: statementIds,
      count,
    })
    return count
  }

  // ── List uncategorized ──

  async listUncategorized(
    companyId: string,
    filters: { bank_account_id?: number; purpose_id?: string; categorized?: string; search?: string; date_from?: string; date_to?: string },
    page: number, limit: number
  ) {
    return expenseCategorizationRepository.listUncategorized(companyId, filters, page, limit)
  }

  // ── Generate Journal ──

  async generateJournal(
    companyId: string,
    statementIds: number[],
    userId: string,
    options?: { journal_date?: string; description?: string }
  ): Promise<{ journal_id: string; journal_number: string; lines_count: number; total_amount: number }> {
    const stmts = await expenseCategorizationRepository.getStatementsForJournal(statementIds, companyId)
    if (stmts.length === 0) throw new NoEligibleStatementsError()

    const incomplete = stmts.filter(s => s.debit_accounts.length === 0 || s.credit_accounts.length === 0)
    if (incomplete.length > 0) {
      const codes = incomplete.map(s => s.purpose_code).join(', ')
      throw new MissingCoaMappingError(codes)
    }

    // Use provided date, or latest transaction date from selected statements
    const latestDate = stmts.reduce((max, s) => s.transaction_date > max ? s.transaction_date : max, stmts[0].transaction_date)
    const journalDate = options?.journal_date || latestDate
    const lines: Array<{ line_number: number; account_id: string; description: string; debit_amount: number; credit_amount: number }> = []
    let lineNum = 0
    let totalAmount = 0

    for (const stmt of stmts) {
      // Note: uses first account per side (priority=1). Multi-account per side is a known limitation.
      const debitAccount = stmt.debit_accounts[0]
      const creditAccount = stmt.credit_accounts[0]
      const desc = `${stmt.purpose_name} — ${stmt.description.substring(0, 100)}`

      lineNum++
      lines.push({ line_number: lineNum, account_id: debitAccount.account_id, description: desc, debit_amount: stmt.debit_amount, credit_amount: 0 })
      lineNum++
      lines.push({ line_number: lineNum, account_id: creditAccount.account_id, description: desc, debit_amount: 0, credit_amount: stmt.debit_amount })
      totalAmount += stmt.debit_amount
    }

    const journal = await journalHeadersService.create({
      company_id: companyId,
      journal_date: journalDate,
      journal_type: 'GENERAL',
      description: options?.description || `Expense Journal — ${stmts.length} transaksi`,
      source_module: 'expense_categorization',
      reference_type: 'bank_statement',
      lines,
    }, userId)

    try {
      await expenseCategorizationRepository.linkJournalToStatements(
        stmts.map(s => s.id), journal.id, companyId
      )
    } catch (linkErr) {
      await journalHeadersService.forceDelete(journal.id, userId, companyId).catch(() => {})
      throw linkErr
    }

    await AuditService.log('CREATE', 'expense_journal', journal.id, userId, undefined, {
      statement_ids: stmts.map(s => s.id),
      journal_number: journal.journal_number,
      total_amount: totalAmount,
    })

    return {
      journal_id: journal.id,
      journal_number: journal.journal_number,
      lines_count: lines.length,
      total_amount: totalAmount,
    }
  }
}

export const expenseCategorizationService = new ExpenseCategorizationService()
