import ExcelJS from 'exceljs';

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export class ImportService {
  static async parseExcel(buffer: Buffer): Promise<any[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(buffer));
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) throw new Error('No worksheet found');

    const rows: any[] = [];
    const headers: string[] = [];
    const headerMap: { [key: string]: string } = {
      'employee id': 'employee_id',
      'full name': 'full_name',
      'job position': 'job_position',
      'branch name': 'branch_name',
      'parent branch': 'parent_branch_name',
      'mobile phone': 'mobile_phone',
      'birth date': 'birth_date',
      'birth place': 'birth_place',
      'marital status': 'marital_status',
      'address': 'citizen_id_address',
      'join date': 'join_date',
      'resign date': 'resign_date',
      'sign date': 'sign_date',
      'end date': 'end_date',
      'status employee': 'status_employee',
      'ptkp status': 'ptkp_status',
      'bank name': 'bank_name',
      'bank account': 'bank_account',
      'bank account holder': 'bank_account_holder',
      'profile picture': 'profile_picture',
      'created at': 'created_at',
    };

    worksheet.getRow(1).eachCell((cell, colNumber) => {
      const rawHeader = cell.value?.toString().trim().toLowerCase() || '';
      headers[colNumber] = headerMap[rawHeader] || rawHeader.replace(/\s+/g, '_');
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        const key = headers[colNumber];
        if (key) rowData[key] = cell.value;
      });
      if (Object.keys(rowData).length > 0) {
        rows.push({ ...rowData, _rowNumber: rowNumber });
      }
    });

    return rows;
  }

  static validateRow(row: any, requiredFields: string[]): string | null {
    for (const field of requiredFields) {
      if (!row[field]) return `Missing required field: ${field}`;
    }
    return null;
  }

  static async processImport(
    rows: any[],
    requiredFields: string[],
    importFn: (row: any) => Promise<void>,
    skipDuplicates: boolean = false
  ): Promise<ImportResult> {
    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    for (const row of rows) {
      try {
        const error = this.validateRow(row, requiredFields);
        if (error) throw new Error(error);
        
        await importFn(row);
        result.success++;
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          row: row._rowNumber,
          error: err.message,
        });
        
        if (!skipDuplicates && err.message.includes('duplicate')) {
          throw new Error('Duplicate detected. Import cancelled.');
        }
      }
    }

    return result;
  }
}
