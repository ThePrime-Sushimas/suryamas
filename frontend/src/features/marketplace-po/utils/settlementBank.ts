import type { BankAccountOption } from '../api/marketplacePo.api'
import type { OwnerCreditCard } from '../types/marketplacePo.types'

export function formatBankAccountOption(b: {
  bank_name?: string | null
  account_name: string
  account_number?: string | null
}) {
  const prefix = b.bank_name ? `${b.bank_name} — ` : ''
  const number = b.account_number?.trim() ? b.account_number : '—'
  return `${prefix}${b.account_name} · ${number}`
}

export function findOwnerCard(
  ownerCards: OwnerCreditCard[],
  ccId: string,
): OwnerCreditCard | undefined {
  return ownerCards.find((c) => c.id === ccId)
}

/** Default settlement bank for a single session's CC */
export function resolveSessionSettlementBank(
  ccId: string,
  ownerCards: OwnerCreditCard[],
  banks: BankAccountOption[],
): { bankAccountId: number | ''; orphanLabel: string | null } {
  const cc = findOwnerCard(ownerCards, ccId)
  const configuredId = cc?.settlement_bank_account_id
  if (configuredId == null) return { bankAccountId: '', orphanLabel: null }
  if (banks.some((b) => b.id === configuredId)) {
    return { bankAccountId: configuredId, orphanLabel: null }
  }
  if (cc && cc.settlement_bank_account_name) {
    return {
      bankAccountId: configuredId,
      orphanLabel: `${formatBankAccountOption({
        bank_name: cc.settlement_bank_name,
        account_name: cc.settlement_bank_account_name,
        account_number: cc.settlement_bank_account_number,
      })} (tidak tersedia)`,
    }
  }
  return {
    bankAccountId: configuredId,
    orphanLabel: `Rekening #${configuredId} (tidak tersedia / dihapus)`,
  }
}

/** Default when bulk-settling: only prefill if all selected sessions share one configured bank */
export function resolveBulkSettlementBank(
  sessionCcIds: string[],
  ownerCards: OwnerCreditCard[],
  banks: BankAccountOption[],
): { bankAccountId: number | ''; orphanLabel: string | null } {
  const uniqueCcIds = [...new Set(sessionCcIds)]
  if (uniqueCcIds.length === 0) return { bankAccountId: '', orphanLabel: null }

  const configuredIds = uniqueCcIds
    .map((ccId) => findOwnerCard(ownerCards, ccId)?.settlement_bank_account_id)
    .filter((id): id is number => id != null)

  const uniqueBankIds = [...new Set(configuredIds)]
  if (uniqueBankIds.length !== 1) return { bankAccountId: '', orphanLabel: null }

  return resolveSessionSettlementBank(uniqueCcIds[0], ownerCards, banks)
}
