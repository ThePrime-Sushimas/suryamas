
import { BankStatementImportService } from '../bank-statement-import.service';
import * as fs from 'fs/promises';

// Simple mock using type assertion
const mockRepository = {} as any;

async function runTest() {
  const service = new BankStatementImportService(mockRepository);

  // Simulating Tab-Separated Values (TSV) from copy-paste
  const bcaV2Content = `No\tTanggal\tKeterangan\tDebit\tKredit\tSaldo
94\t05/01/2026\tTRSF E-BANKING CR 0501/FTSCY/WS95051 806300.00 4980365901 261505OS02940218 VISIONET INTERNASI\t-\tRp 806.300\t-
95\t05/01/2026\tTRSF E-BANKING CR 0501/FTSCY/WS95051 93500.00 4980365901 261506RT02947722 VISIONET INTERNASI\t-\tRp 93.500\t-
98\t05/01/2026\tKR OTOMATIS MID : 885001834534 SUSHI MAS-HO TGH: 731500.00 DDR: 2527.80\t-\tRp 728.972\t-
104\t05/01/2026\tTRSF E-BANKING CR 0501/FTSCY/WS95051 401155.00 SF 2293 90025 05_4 249481509552445240 AIRPAY INTERNATION\t-\tRp 401.155\t-
`;

  try {
    console.log('--- Testing BCA Business V2 (TSV) ---');
    await fs.writeFile('/tmp/bca_v2.tsv', bcaV2Content);
    
    // Note: The service expects file path. It usually reads content.
    // If we want to test delimiter detection, we rely on detectCSVFormat.
    
    const result = await (service as any).parseCSVFile('/tmp/bca_v2.tsv');
    console.log('Format Detected:', result.formatDetection.format);
    console.log('Rows Parsed:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('Sample Row 1:', JSON.stringify(result.rows[0], null, 2));
    } else {
        console.log('No rows parsed.');
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.stack) console.error(error.stack);
  }
}

runTest();
