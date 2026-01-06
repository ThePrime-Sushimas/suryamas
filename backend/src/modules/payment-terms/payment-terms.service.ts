// backend/src/modules/payment-terms/payment-terms.service.ts

import { PaymentTermsRepository, paymentTermsRepository } from './payment-terms.repository'
import { PaymentTerm, CreatePaymentTermDto, UpdatePaymentTermDto, CalculationType } from './payment-terms.types'
import { AuditService } from '../../services/audit.service'
import { logInfo } from '../../config/logger'
import {
  PaymentTermNotFoundError,
  DuplicateTermCodeError,
  InvalidCalculationTypeError,
  TermCodeUpdateError,
} from './payment-terms.errors'
import { VALID_CALCULATION_TYPES, PAYMENT_TERM_DEFAULTS } from './payment-terms.constants'
import { calculatePagination, calculateOffset } from '../../utils/pagination.util'

export class PaymentTermsService {
  constructor(
    private repository: PaymentTermsRepository = paymentTermsRepository,
    private auditService: typeof AuditService = AuditService
  ) {}

  async list(
    pagination: { page: number; limit: number },
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: { is_active?: boolean; calculation_type?: CalculationType },
    includeDeleted = false
  ) {
    const offset = calculateOffset(pagination.page, pagination.limit)
    const { data, total } = await this.repository.findAll(
      { limit: pagination.limit, offset },
      sort,
      filter,
      includeDeleted
    )

    return {
      data,
      pagination: calculatePagination(pagination, total),
    }
  }

  async create(dto: CreatePaymentTermDto, userId?: string): Promise<PaymentTerm> {
    if (dto.calculation_type && !VALID_CALCULATION_TYPES.includes(dto.calculation_type)) {
      throw new InvalidCalculationTypeError(dto.calculation_type, VALID_CALCULATION_TYPES)
    }

    const existing = await this.repository.findByTermCode(dto.term_code)
    if (existing) {
      throw new DuplicateTermCodeError(dto.term_code)
    }

    const data = {
      ...dto,
      calculation_type: dto.calculation_type || PAYMENT_TERM_DEFAULTS.CALCULATION_TYPE,
      days: dto.days ?? PAYMENT_TERM_DEFAULTS.DAYS,
      early_payment_discount: dto.early_payment_discount ?? PAYMENT_TERM_DEFAULTS.EARLY_PAYMENT_DISCOUNT,
      early_payment_days: dto.early_payment_days ?? PAYMENT_TERM_DEFAULTS.EARLY_PAYMENT_DAYS,
      late_payment_penalty: dto.late_payment_penalty ?? PAYMENT_TERM_DEFAULTS.LATE_PAYMENT_PENALTY,
      grace_period_days: dto.grace_period_days ?? PAYMENT_TERM_DEFAULTS.GRACE_PERIOD_DAYS,
      minimum_order_amount: dto.minimum_order_amount ?? PAYMENT_TERM_DEFAULTS.MINIMUM_ORDER_AMOUNT,
      requires_guarantee: dto.requires_guarantee ?? PAYMENT_TERM_DEFAULTS.REQUIRES_GUARANTEE,
      is_active: dto.is_active ?? PAYMENT_TERM_DEFAULTS.IS_ACTIVE,
      created_by: userId,
    }

    const term = await this.repository.create(data)

    if (userId) {
      await this.auditService.log('CREATE', 'payment_term', term.id.toString(), userId, undefined, term)
    }

    logInfo('Payment term created', { id: term.id, code: term.term_code, userId })
    return term
  }

  async update(id: number, dto: UpdatePaymentTermDto, userId?: string): Promise<PaymentTerm> {
    if ('term_code' in dto) {
      throw new TermCodeUpdateError()
    }

    if (dto.calculation_type && !VALID_CALCULATION_TYPES.includes(dto.calculation_type)) {
      throw new InvalidCalculationTypeError(dto.calculation_type, VALID_CALCULATION_TYPES)
    }

    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new PaymentTermNotFoundError(id.toString())
    }

    const term = await this.repository.updateById(id, dto)

    if (term && userId) {
      await this.auditService.log('UPDATE', 'payment_term', id.toString(), userId, existing, dto)
    }

    logInfo('Payment term updated', { id, userId })
    return term!
  }

  async findById(id: number, includeDeleted = false): Promise<PaymentTerm> {
    const term = await this.repository.findById(id, includeDeleted)
    if (!term) {
      throw new PaymentTermNotFoundError(id.toString())
    }
    return term
  }

  async delete(id: number, userId?: string): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new PaymentTermNotFoundError(id.toString())
    }

    await this.repository.delete(id, userId)

    if (userId) {
      await this.auditService.log('DELETE', 'payment_term', id.toString(), userId, existing)
    }

    logInfo('Payment term deleted', { id, userId })
  }

  async restore(id: number, userId?: string): Promise<PaymentTerm> {
    const existing = await this.repository.findById(id, true)
    if (!existing) {
      throw new PaymentTermNotFoundError(id.toString())
    }

    await this.repository.restore(id)

    if (userId) {
      await this.auditService.log('RESTORE', 'payment_term', id.toString(), userId, existing)
    }

    logInfo('Payment term restored', { id, userId })
    const restored = await this.repository.findById(id)
    return restored!
  }

  async minimalActive(): Promise<{ id: number; term_name: string }[]> {
    return this.repository.minimalActive()
  }
}

export const paymentTermsService = new PaymentTermsService()
