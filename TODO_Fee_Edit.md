# TODO - Edit Transaksi Agregat: Tambah Kolom Fee di Form

## Plan
- [x] Tambahkan input Fee Percentage (%) di form
- [x] Tambahkan input Fixed Fee (Rp) di form
- [x] Tambahkan display Total Fee (read-only)
- [x] Update logika perhitungan nett_amount dengan fee

## Status
- [x] Analisis file dan plan disetujui user
- [x] Implement edit di PosAggregatesForm.tsx
- [ ] Testing (opsional)

## Catatan
- Fee sudah ada di types.ts dan table display
- Perlu menambahkan input fields di form untuk edit fee

## Perubahan yang sudah dilakukan:

### PosAggregatesForm.tsx
1. **Default values**: Ditambahkan `percentage_fee_amount`, `fixed_fee_amount`, `total_fee_amount`
2. **Watch fields**: Ditambahkan fee fields untuk calculations
3. **Perhitungan fee**:
   - `percentageFeeAmount` = gross_amount * (percentageFee / 100)
   - `totalFeeAmount` = percentageFeeAmount + fixedFee
4. **Perhitungan nett_amount**: Diupdate untuk mengurangi total fee
5. **Reset form**: Ditambahkan fee fields saat transaction di-load
6. **Fee Details Section**: Ditambahkan section baru dengan:
   - Input Fee Percentage (%) dengan validasi 0-100%
   - Input Fixed Fee (Rp)
   - Display Total Fee (read-only, auto-calculated)
   - Display Bill After Discount (referensi)

