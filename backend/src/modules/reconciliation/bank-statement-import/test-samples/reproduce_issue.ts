
import { BankStatementImportService } from '../bank-statement-import.service';
import * as fs from 'fs/promises';

// Simple mock using type assertion
const mockRepository = {} as any;

async function runTest() {
  const service = new BankStatementImportService(mockRepository);

  const bcaBusinessContent = `contoh  rekening BCA BISNIS bentuk csv
HEADER
Tanggal Transaksi,"Keterangan","Cabang","Jumlah"

TRANSAKSI DEBIT
01/01/2026,"TRSF E-BANKING DB 0101/FTFVA/WS95051 14313/MAJOO INDONE  - -  1208200008500 ","0000","287,490.00 DB","120,604,675.40"

TRANSAKSI CREDIT
01/01/2026,"TRSF E-BANKING CR 0101/FTSCY/WS95051 799700.00  4980365901 261105ZN02870038  VISIONET INTERNASI ","0000","799,700.00 CR"`;

  const bcaPersonalContent = `contoh rek BCA PRIBADI, bentuk csv
HEADER
Date,Description,Branch,Amount,,Balance

TRANSAKSI DEBIT
'02/01/2026,TRSF E-BANKING DB 0201/FTSCY/WS95271       72100000.00MICHAEL MULYADI,'0000,72100000.00,DB,20826599.94

TRANSAKSI CREDIT
'01/01/2026,TRSF E-BANKING CR 0101/FTSCY/WS95051         807400.00SF 0308 32062 01_1068239606967071819AIRPAY INTERNATION,'0000,807400.00,CR,4637271.73`;

  const mandiriContent = `contoh rek MANDIRI CV, bentuk csv
Account No,Date,Val. Date,Transaction Code,Description,Description,Reference No.,Debit,Credit

TRANSAKSI DEBIT
0060003911777,01/01/26,01/01/26,6902,"DR 0000029511812 KR 0060003911777 ","71831136319/SUSHIMAS HARAPAN/BKS        ",,".00","453,684.00"

TRANSAKSI CREDIT
0060003911777,22/01/26,22/01/26,7820,"MCM InhouseTrf  DARI DOMPET ANAK BANGSA Transfer Fee            4021533983470679","G075070944 2201       WLST1e621e894f708e", WLST1e621e894f708e,".00","41,300.00"`;

  const bcaBusinessV2Content = `Pratinjau Data
No	Tanggal	Keterangan	Debit	Kredit	Saldo
1	02/01/2026	TRANSFER E-BANKING	Rp 100.000,00	-	Rp 900.000,00
2	03/01/2026	BUNGA	-	Rp 5.000,00	Rp 905.000,00`;

  try {
    console.log('--- Testing BCA Business ---');
    await fs.writeFile('/tmp/bca_business.csv', bcaBusinessContent);
    const resultBcaBiz = await (service as any).parseCSVFile('/tmp/bca_business.csv');
    console.log('Format Detected:', resultBcaBiz.formatDetection.format);
    console.log('Rows Parsed:', resultBcaBiz.rows.length);
    console.log('Sample Row 1:', JSON.stringify(resultBcaBiz.rows[0], null, 2));

    console.log('\n--- Testing BCA Personal ---');
    await fs.writeFile('/tmp/bca_personal.csv', bcaPersonalContent);
    const resultBcaPers = await (service as any).parseCSVFile('/tmp/bca_personal.csv');
    console.log('Format Detected:', resultBcaPers.formatDetection.format);
    console.log('Rows Parsed:', resultBcaPers.rows.length);
    console.log('Sample Row 1:', JSON.stringify(resultBcaPers.rows[0], null, 2));

    console.log('\n--- Testing Mandiri ---');
    await fs.writeFile('/tmp/mandiri.csv', mandiriContent);
    const resultMandiri = await (service as any).parseCSVFile('/tmp/mandiri.csv');
    console.log('Format Detected:', resultMandiri.formatDetection.format);
    console.log('Rows Parsed:', resultMandiri.rows.length);
    console.log('Sample Row 1:', JSON.stringify(resultMandiri.rows[0], null, 2));

    console.log('\n--- Testing BCA Business V2 (Pratinjau) ---');
    await fs.writeFile('/tmp/bca_business_v2.csv', bcaBusinessV2Content);
    const resultBcaBizV2 = await (service as any).parseCSVFile('/tmp/bca_business_v2.csv');
    console.log('Format Detected:', resultBcaBizV2.formatDetection.format);
    console.log('Rows Parsed:', resultBcaBizV2.rows.length);
    console.log('Sample Row 1:', JSON.stringify(resultBcaBizV2.rows[0], null, 2));

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.stack) console.error(error.stack);
  }
}

runTest();
