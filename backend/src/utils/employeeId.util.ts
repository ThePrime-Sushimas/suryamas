/**
 * Generate Employee ID based on Notion formula:
 * S + [Lokasi 2 huruf] + [Bulan] + [2 digit tahun] + [Posisi 2 huruf] + [NO 4 digit]
 * 
 * Example: SJA124MA0005
 * - S = prefix
 * - JA = Jakarta (2 huruf)
 * - 1 = Januari (bulan)
 * - 24 = 2024 (2 digit tahun)
 * - MA = Manager (2 huruf)
 * - 0005 = nomor urut (4 digit dengan padding)
 */

export function generateEmployeeId(
  branchName: string,
  joinDate: string,
  jobPosition: string,
  sequenceNumber: number
): string {
  const date = new Date(joinDate)
  
  // 2 huruf pertama dari branch (uppercase)
  const branchCode = branchName.substring(0, 2).toUpperCase()
  
  // Bulan (1-12)
  const month = date.getMonth() + 1
  
  // 2 digit tahun terakhir
  const year = date.getFullYear().toString().substring(2, 4)
  
  // 2 huruf pertama dari posisi (uppercase)
  const positionCode = jobPosition.substring(0, 2).toUpperCase()
  
  // Nomor urut dengan padding 4 digit
  const paddedNumber = sequenceNumber.toString().padStart(4, '0')
  
  return `S${branchCode}${month}${year}${positionCode}${paddedNumber}`
}

/**
 * Extract sequence number from employee ID
 * Example: SJA124MA0005 -> 5
 */
export function extractSequenceNumber(employeeId: string): number {
  // Ambil 4 digit terakhir
  const lastFourDigits = employeeId.slice(-4)
  return parseInt(lastFourDigits, 10)
}

/**
 * Get next sequence number for employee ID generation
 */
export function getNextSequenceNumber(lastEmployeeId: string | null): number {
  if (!lastEmployeeId) {
    return 1
  }
  
  const lastNumber = extractSequenceNumber(lastEmployeeId)
  return lastNumber + 1
}
