import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';

interface ExportSession {
  token: string;
  userId: string;
  timestamp: number;
}

const activeSessions = new Map<string, ExportSession>();

export class ExportService {
  static generateToken(userId: string): string {
    const token = uuidv4();
    activeSessions.set(token, { token, userId, timestamp: Date.now() });
    setTimeout(() => activeSessions.delete(token), 300000); // 5 min expiry
    return token;
  }

  static validateToken(token: string, userId: string): boolean {
    const session = activeSessions.get(token);
    if (!session || session.userId !== userId) return false;
    activeSessions.delete(token);
    return true;
  }

  static async generateExcel(data: any[], columns: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');

    // Header styling
    worksheet.columns = columns.map((col: any) => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
    }));

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data in chunks
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      worksheet.addRows(chunk);
    }

    return await workbook.xlsx.writeBuffer() as Buffer;
  }
}
