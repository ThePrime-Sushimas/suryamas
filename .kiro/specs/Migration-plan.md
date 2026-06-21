# Migration Plan: Company = Brand, Branch-Level Reporting

## Konteks

Keputusan arsitektur: `company` di-flatten jadi representasi **brand**, bukan
isolasi data. Semua cabang tetap berada di 1 `company_id`. Pemisahan data
per cabang dilakukan lewat `branch_id` di level transaksi/journal, bukan
lewat company terpisah.

Yang **tidak berubah**:
- Schema transaksi (tetap punya `company_id` + `branch_id`)
- Chart of Accounts (COA) — shared, karena 1 company
- FK constraint
- Auth/permission flow

Yang **berubah**:
- Semua report yang scope-nya `company_id` saja, perlu tambahan filter
  `branch_id` (multi-select)
- UI report page perlu multi-select branch
- Mindset: company = label brand, bukan boundary data

Goal dari plan ini: pastikan **tidak ada module/report/query yang kelewat**
saat menerapkan filter `branch_id`, dengan cara scan dulu sebelum eksekusi.

---

## Aturan Eksekusi untuk Kiro

1. **Jangan ubah kode di Tahap 1.** Tahap 1 murni inventory/audit. Tidak ada
   commit, tidak ada file yang ditulis ulang.
2. **Eksekusi dilakukan per kategori**, bukan sekaligus semua file. Tunggu
   review/approval di antara kategori.
3. **Tunjukkan diff sebelum apply**, jangan langsung overwrite file.
4. **Jangan menebak struktur folder.** Kalau path yang disebut di bawah tidak
   sesuai dengan struktur project yang sebenarnya, sesuaikan dan sebutkan
   penyesuaiannya secara eksplisit sebelum lanjut.
5. Kalau menemukan kasus ambigu (misal: raw SQL string yang sulit di-parse,
   atau report yang sengaja global tanpa branch context), masukkan ke daftar
   **"Perlu Ditinjau Manual"** — jangan diputuskan sepihak.

---

## TAHAP 1 — Inventory (Audit Only, No Code Changes)

Scan seluruh codebase dan hasilkan inventory terstruktur, dikelompokkan
dalam 4 kategori di bawah. Output: list berisi `file path : line number :
deskripsi singkat masalah`, dikelompokkan per kategori.

### Kategori A — Query/Insert ke tabel dengan `company_id`/`branch_id`
Cari semua file yang melakukan query (SELECT/INSERT/UPDATE/DELETE) ke tabel
yang memiliki kolom `company_id` dan/atau `branch_id`. Termasuk:
- Transaksi, journal entries
- Invoice, payment
- COA (chart of accounts) — catat meski tidak perlu filter branch (shared)

### Kategori B — Report/endpoint dengan filter company_id tapi belum branch_id
Cari semua endpoint atau fungsi report yang:
- Filter `WHERE company_id = ...`
- **Tidak** ada filter `branch_id` sama sekali

Ini kategori paling kritis — inilah yang harus ditambah multi-select branch.

### Kategori C — UI yang select company tapi belum select branch
Cari semua komponen UI (form, dropdown, filter bar) yang:
- Ada selector/dropdown company
- Belum ada selector branch (single atau multi-select)

### Kategori D — Query yang assume company = isolasi data penuh
Cari pattern di mana logic mengasumsikan bahwa 1 `company_id` = 1 entitas
data yang lengkap dan terisolasi (misalnya dashboard summary, agregasi
total, cache key yang hanya berdasarkan `company_id`). Ini beda dari
kategori B karena biasanya bukan report biasa, tapi logic bisnis/agregat
yang implicit assume "company = scope penuh".

### Verifikasi Cakupan (wajib, di akhir Tahap 1)
Setelah inventory A–D selesai:
1. Jalankan pencarian ulang untuk semua occurrence string `company_id` di
   seluruh repo (exclude: file migration lama, seed data, test fixtures).
2. Cocokkan setiap hasil pencarian apakah sudah masuk ke salah satu kategori
   A–D di atas.
3. Apapun yang belum masuk kategori manapun → masukkan ke daftar baru:
   **"Perlu Ditinjau Manual"**, sertakan alasan kenapa belum jelas
   kategorinya.

### Exclude dari scan
- File migration lama (`/migrations`, kecuali yang akan datang)
- Seed data / fixtures
- Test files (catat terpisah jika relevan, tapi jangan campur ke inventory utama)

### Output Tahap 1
Simpan hasil sebagai `INVENTORY.md` dengan struktur:
```markdown
## Kategori A — Query ke tabel company_id/branch_id
- [ ] path/to/file.ts:42 — deskripsi singkat

## Kategori B — Report belum ada filter branch_id
- [ ] path/to/report.ts:18 — deskripsi singkat

## Kategori C — UI belum ada selector branch
- [ ] path/to/ReportPage.tsx:55 — deskripsi singkat

## Kategori D — Query assume company = isolasi penuh
- [ ] path/to/dashboard.ts:101 — deskripsi singkat

## Perlu Ditinjau Manual
- [ ] path/to/weird-file.ts:7 — alasan ambigu
```

**STOP di sini. Tunggu review manusia sebelum lanjut ke Tahap 2.**

---

## TAHAP 2 — Eksekusi per Kategori

Jalankan **satu kategori per sesi**, jangan digabung. Urutan yang
disarankan: B → C → D → A (B paling kritis dan paling konkret untuk
divalidasi).

### 2.B — Fix Report Query (Kategori B)
Untuk setiap item di Kategori B:
- Tambahkan parameter `branch_ids: number[] | null` (optional)
- Kalau `branch_ids` kosong/null → tampilkan semua branch dalam company
  tersebut (behavior default, backward compatible)
- Kalau `branch_ids` diisi → tambahkan `WHERE branch_id = ANY($1)`
- **Pertahankan** filter `company_id` yang sudah ada — jangan dihapus
- Tunjukkan diff per file untuk di-review sebelum apply

### 2.C — Fix UI Report Page (Kategori C)
Untuk setiap item di Kategori C:
- Tambahkan komponen multi-select branch (ambil daftar branch dari
  `company_id` yang aktif)
- Default state: semua branch ter-select (supaya behavior lama tidak
  berubah kalau user tidak mengubah apa-apa)
- Pastikan value dari multi-select dikirim sebagai `branch_ids` ke
  endpoint hasil 2.B

### 2.D — Review Logic Agregat (Kategori D)
Untuk setiap item di Kategori D:
- Tentukan apakah agregat ini **harus** tetap company-level (misal: COA
  shared, jadi tidak relevan branch) atau **harus** pecah per branch
- Kalau harus pecah per branch, terapkan pola sama seperti 2.B
- Kalau memang by design tetap company-level, beri komentar di kode
  menjelaskan alasannya (supaya tidak dianggap "kelewat" di scan berikutnya)

### 2.A — Validasi Kategori A
Kategori A umumnya hanya untuk konfirmasi bahwa schema sudah benar
(`company_id` + `branch_id` ada di tabel transaksi). Tidak butuh perubahan
kode kecuali ditemukan tabel yang ternyata belum punya `branch_id` — kalau
ditemukan, laporkan dulu sebelum membuat migration baru.

---

## TAHAP 3 — Export Excel (ExcelJS)

Setelah filter branch di report query dan UI selesai (Tahap 2 B & C):
- Pastikan endpoint export Excel menerima `branch_ids` yang sama dengan
  endpoint report biasa
- Tambahkan kolom "Branch" di hasil export kalau `branch_ids` berisi lebih
  dari 1 branch (supaya hasil export tetap jelas sumber datanya per baris)
- Sheet/judul export sebaiknya menyebutkan nama branch yang di-filter, atau
  "All Branches" kalau tidak ada filter

---

## Checklist Akhir

- [ ] `INVENTORY.md` sudah dibuat dan direview manusia
- [ ] Semua item Kategori B sudah ada filter `branch_id`
- [ ] Semua item Kategori C sudah ada multi-select branch di UI
- [ ] Semua item Kategori D sudah diputuskan (pecah per branch / tetap
      company-level dengan komentar penjelas)
- [ ] Export Excel sudah ikut filter `branch_ids`
- [ ] Daftar "Perlu Ditinjau Manual" sudah kosong atau sudah diputuskan
      satu per satu
- [ ] Tidak ada perubahan pada schema, COA, FK, atau auth flow di luar
      yang disebutkan di atas