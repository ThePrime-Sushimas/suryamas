  // ⚠️ WARNING: DO NOT USE FOR DATABASE INSERT (NON-ATOMIC)
  // This utility is ONLY for:
  // - Preview/UI display
  // - Bulk import Excel (non-concurrent)
  // - Testing purposes
  //
  // For actual employee creation, use DB function: generate_employee_id()

  function safeCode(value: string, length = 2): string {
    return value
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .padEnd(length, 'X')
      .substring(0, length);
  }

  function parseDateOrThrow(dateStr: string): Date {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid join_date format');
    }
    return date;
  }

  export function generateEmployeeId(
    branchName: string,
    joinDate: string,
    jobPosition: string,
    sequenceNumber: number
  ): string {
    const date = parseDateOrThrow(joinDate);

    const branchCode = safeCode(branchName);
    const positionCode = safeCode(jobPosition);

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const running = String(sequenceNumber).padStart(4, '0');

    return `S${branchCode}${month}${year}${positionCode}${running}`;
  }
