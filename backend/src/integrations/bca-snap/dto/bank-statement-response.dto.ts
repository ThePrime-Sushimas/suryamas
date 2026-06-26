export interface BcaAmountDto {
  value: string
  currency: string
  dateTime?: string
}

export interface BcaBalanceEntryDto {
  amount: BcaAmountDto
  startingBalance: BcaAmountDto
  endingBalance: BcaAmountDto
}

export interface BcaEntrySummaryDto {
  numberOfEntries: string
  amount: Omit<BcaAmountDto, 'dateTime'>
}

export interface BcaStatementDetailDto {
  amount: Omit<BcaAmountDto, 'dateTime'>
  transactionDate: string
  remark: string
  type: 'DEBIT' | 'CREDIT' | string
}

export interface BankStatementResponseDto {
  responseCode: string
  responseMessage: string
  referenceNo: string
  partnerReferenceNo: string
  balance?: BcaBalanceEntryDto[]
  totalCreditEntries?: BcaEntrySummaryDto
  totalDebitEntries?: BcaEntrySummaryDto
  detailData?: BcaStatementDetailDto[]
}
