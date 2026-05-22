/** V2 session payload item — carries bank account assignment alongside invoice ID */
export interface SessionPayloadItem {
  invoiceId: string
  bankAccountId: number | null
}

/** State for proof file uploads on the Bulk Create page */
export interface ProofFileState {
  individualFiles: Map<string, File> // stable key (supplierId or supplierId:bankAccountId) → File
  batchFile: File | null
}

/** Resolved proof file for submission (individual overrides batch) */
export interface ResolvedProof {
  groupKey: string
  file: File
  source: 'individual' | 'batch'
}
