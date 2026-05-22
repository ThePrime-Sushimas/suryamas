/** V2 session payload item — carries bank account assignment alongside invoice ID */
export interface SessionPayloadItem {
  invoiceId: string
  bankAccountId: number | null
}

/** State for proof file uploads on the Bulk Create page */
export interface ProofFileState {
  individualFiles: Map<number, File> // groupIndex → File
  batchFile: File | null
}

/** Resolved proof file for submission (individual overrides batch) */
export interface ResolvedProof {
  groupIndex: number
  file: File
  source: 'individual' | 'batch'
}
