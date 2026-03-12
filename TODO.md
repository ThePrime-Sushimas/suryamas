# TODO: Fix Journal Sequence Error

## Status: Migration SQL ✅

### Step 1: [✅] Jalankan Migration SQL
- Buka Supabase Dashboard → SQL Editor
- Copy-paste isi file `backend/migrations/001_fix_journal_sequence.sql`
- Execute semua query (DROP + CREATE FUNCTION + GRANT)
- Test fungsi: `SELECT get_next_journal_sequence('3576839e-d83a-4061-8551-fe9b5d971111'::uuid, '2026-03', 'GENERAL'::journal_type_enum);`

### Step 2: [ ] Verifikasi - Test fungsi SQL ✅ (return 1)
- Coba create journal lagi via frontend/API
- Check tidak ada error sequence lagi
- Restart backend jika perlu (`npm run dev` di backend)

### Step 3: [ ] Done
- Update checklist di sini
- Hapus TODO.md jika selesai

