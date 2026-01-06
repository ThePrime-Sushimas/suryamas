import { banksRepository } from './banks.repository'
import { Bank, CreateBankDto, UpdateBankDto, BankListQuery, BankOption } from './banks.types'
import { BankNotFoundError, BankCodeAlreadyExistsError, BankInUseError } from './banks.errors'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'
import { cache } from '../../utils/cache.util'

export class BanksService {
  async createBank(data: CreateBankDto): Promise<Bank> {
    const existingBank = await banksRepository.findByCode(data.bank_code)
    if (existingBank) {
      throw new BankCodeAlreadyExistsError(data.bank_code)
    }

    const bank = await banksRepository.create(data)
    
    // Clear cache when bank is created
    await cache.clear('bank_options')
    
    return bank
  }

  async updateBank(id: number, data: UpdateBankDto): Promise<Bank> {
    const existingBank = await banksRepository.findById(id)
    if (!existingBank) {
      throw new BankNotFoundError(id.toString())
    }

    const updatedBank = await banksRepository.updateById(id, data)
    if (!updatedBank) {
      throw new BankNotFoundError(id.toString())
    }

    // Clear cache when bank is updated
    await cache.clear('bank_options')

    return updatedBank
  }

  async deleteBank(id: number): Promise<void> {
    const bank = await banksRepository.findById(id)
    if (!bank) {
      throw new BankNotFoundError(id.toString())
    }

    const isUsed = await banksRepository.isUsedInBankAccounts(id)
    if (isUsed) {
      throw new BankInUseError(id.toString())
    }

    await banksRepository.deleteById(id)
    
    // Clear cache when bank is deleted
    await cache.clear('bank_options')
  }

  async getBankById(id: number): Promise<Bank> {
    const bank = await banksRepository.findById(id)
    if (!bank) {
      throw new BankNotFoundError(id.toString())
    }
    return bank
  }

  async getBanks(query: BankListQuery) {
    const { page, limit, offset } = getPaginationParams(query as any)
    const { data, total } = await banksRepository.findAll({ limit, offset }, query)
    
    return createPaginatedResponse(data, total, page, limit)
  }

  // FIX #11: Add caching for bank options
  async getBankOptions(): Promise<BankOption[]> {
    const cached = await cache.get<BankOption[]>('bank_options')
    if (cached) return cached
    
    const options = await banksRepository.getActiveOptions()
    await cache.set('bank_options', options, 3600) // 1 hour
    return options
  }
}

export const banksService = new BanksService()