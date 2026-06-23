# SOP Setup Reimburse Karyawan — Panduan Finance

Dokumen ini menjelaskan langkah-langkah yang harus dilakukan **sekali** oleh tim Finance sebelum fitur reimburse karyawan bisa dipakai. Setelah setup selesai, proses input reimburse sehari-hari sama dengan input invoice vendor biasa.

---

## Prasyarat

- Akses ke menu **Akuntansi > Accounting Purposes** (modul `accounting_purposes`)
- Akses ke menu **Akuntansi > Accounting Purpose Accounts** (modul `accounting_purpose_accounts`)
- Akses ke menu **Akuntansi > Chart of Accounts** untuk buat COA baru jika belum ada

---

## Langkah 1: Buat COA Hutang Reimburse Karyawan

Jika belum ada akun hutang khusus reimburse, buat di **Chart of Accounts**:

| Field | Nilai |
|-------|-------|
| Account Code | Misal `210316` (sesuaikan dengan numbering perusahaan) |
| Account Name | `Hutang Reimburse Karyawan` |
| Account Type | `LIABILITY` |
| Normal Balance | `CREDIT` |
| Parent Account | `210300` (Cadangan Biaya Akrual) atau parent liability yang sesuai |
| Is Postable | `true` |
| Is Header | `false` |

> Catatan: Kode akun harus unik per company. Pilih nomor yang belum terpakai di bawah parent yang sama.

---

## Langkah 2: Buat Accounting Purpose `EMP_REIMBURSE_LIABILITY`

Buka menu **Akuntansi > Accounting Purposes**, klik **Tambah Baru**:

| Field | Nilai |
|-------|-------|
| Purpose Code | `EMP_REIMBURSE_LIABILITY` (harus **persis** seperti ini, case-sensitive) |
| Purpose Name | `Hutang Reimburse Karyawan` |
| Applied To | `EXPENSE` |
| Description | `Akun hutang untuk reimburse karyawan — dipakai saat invoice reimburse di-POST dan saat payment di-PAID` |
| Is System | `false` (biarkan default) |
| Is Active | `true` |

> PENTING: Purpose code **harus persis** `EMP_REIMBURSE_LIABILITY`. Sistem mengenali string ini secara hardcoded untuk invoice dengan vendor_type = EMPLOYEE. Gunakan underscore, bukan dash.

---

## Langkah 3: Map Purpose ke COA

Buka menu **Akuntansi > Accounting Purpose Accounts**, klik **Tambah Mapping**:

| Field | Nilai |
|-------|-------|
| Purpose | Pilih `EMP_REIMBURSE_LIABILITY` yang baru dibuat |
| Account | Pilih COA `210316 Hutang Reimburse Karyawan` (atau kode yang dibuat di Langkah 1) |
| Side | `CREDIT` |
| Priority | `1` |
| Is Required | `true` |
| Is Active | `true` |

---

## Langkah 4: Setup COA Beban untuk Kategori Reimburse

Pastikan COA beban (expense) untuk kategori reimburse sudah ada dan **hierarki parent-nya benar**. Ini penting karena laporan Laba Rugi mengelompokkan beban berdasarkan parent account.

Contoh struktur yang benar:

```
600100  Beban Transport          (parent, is_header = true)
├── 600101  Beban Toll            (child, is_postable = true)
├── 600102  Beban BBM             (child, is_postable = true)
└── 600103  Beban Parkir          (child, is_postable = true)

600200  Beban Operasional        (parent, is_header = true)
├── 600201  Beban Makan Bisnis    (child, is_postable = true)
├── 600202  Beban ATK             (child, is_postable = true)
└── 600203  Beban Lain-lain       (child, is_postable = true)
```

> PENTING: Ketika input invoice reimburse, Finance **harus pilih akun beban (child) yang benar** di setiap baris invoice. Sistem tidak punya "kategori reimburse" terpisah — pengelompokan di laporan 100% mengikuti hierarki COA.

> Contoh: Reimburse toll karyawan harus pakai akun `600101 Beban Toll`. Maka di laporan Laba Rugi, beban ini otomatis tergabung di group `600100 Beban Transport` — bersama beban transport lain dari sumber manapun.

---

## Langkah 5: Daftarkan Karyawan sebagai Vendor

Di halaman **General AP > Vendors**, klik tab **Reimburse**, lalu **Tambah Karyawan**:

| Field | Nilai |
|-------|-------|
| Kode Vendor | Isi dengan **NIK karyawan** (harus unik per company) |
| Nama Vendor | Nama lengkap karyawan |
| Tipe | Otomatis `EMPLOYEE` (jika pakai tab Reimburse) |
| PIC / Contact Person | Opsional — bisa diisi nama atasan/supervisor |
| Bank Account | Isi rekening karyawan untuk transfer reimburse |

---

## Proses Input Reimburse Sehari-hari (Setelah Setup)

1. **Buat Invoice** (menu General AP > Invoices):
   - Pilih vendor = nama karyawan (yang sudah didaftarkan di Langkah 5)
   - Isi tanggal invoice = tanggal pengumpulan struk
   - Tambah line per item reimburse:
     - Account = akun beban yang sesuai (misal `600101 Beban Toll`)
     - Amount = nominal struk
   - Notes = referensi struk (opsional)

2. **POST Invoice**:
   - Sistem otomatis buat jurnal:
     - DR Beban Toll (600101) — sesuai line
     - CR Hutang Reimburse Karyawan (210316) — dari purpose `EMP_REIMBURSE_LIABILITY`

3. **Buat Payment & Approve**:
   - Setelah invoice di-POST, buat payment seperti biasa
   - Pilih method (TRANSFER/CASH)
   - Upload bukti transfer (jika TRANSFER)
   - Approve → Mark as Paid

4. **PAID**:
   - Sistem otomatis buat jurnal:
     - DR Hutang Reimburse Karyawan (210316)
     - CR Bank (sesuai bank account yang dipilih)

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Error "COA belum di-setup" saat POST | Purpose `EMP-REIMBURSE-LIABILITY` belum dibuat atau belum di-map ke COA. Ulangi Langkah 2-3. |
| Reimburse toll tidak muncul di laporan "Beban Transport" | Cek apakah akun yang dipakai saat input (`600101`) memiliki `parent_account_id` yang benar (harus mengarah ke `600100 Beban Transport`). |
| NIK bentrok saat daftarkan karyawan | Kode vendor harus unik per company. Cek apakah sudah ada vendor lain dengan kode yang sama. |
| Karyawan tidak muncul di dropdown invoice | Pastikan vendor karyawan berstatus "Aktif" dan tipe = EMPLOYEE. |

---

## Catatan Teknis

- Purpose code `EMP-REIMBURSE-LIABILITY` di-hardcode di backend. Jangan ubah kode ini setelah dibuat.
- Laporan keuangan (Laba Rugi, Neraca Saldo) otomatis mencakup transaksi reimburse — tidak perlu konfigurasi tambahan karena semua berdasarkan COA.
- Jika ke depan perlu purpose baru untuk reimburse kategori tertentu (misal pisah hutang per cabang), bisa ditambah purpose baru + ubah logic di backend.
