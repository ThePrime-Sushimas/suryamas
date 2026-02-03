# Progress Perbaikan Reset Password

## Masalah
Error "Auth session missing!" pada endpoint `/reset-password`

## Penyebab
Method `resetPassword` di backend mencoba menggunakan recovery token dengan cara yang salah:
1. `supabase.auth.admin.updateUserById()` - recoveryToken bukan user ID
2. `supabase.auth.verifyOTP()` - recovery token bukan token_hash OTP
3. `supabase.auth.updateUser()` dengan header Authorization - memerlukan session aktif

## Solusi yang Diterapkan

### Backend auth.controller.ts
- [x] Baca recovery token dari header `x-supabase-recovery-token` atau body
- [x] Gunakan `supabase.auth.exchangeCodeForSession()` untuk mendapatkan session dari recovery token
- [x] Jika gagal, fallback ke `supabase.auth.setSession()` dengan access_token
- [x] Update password dengan `supabase.auth.updateUser()` setelah session aktif

## Perubahan Kode
```typescript
// Sebelum (SALAH):
const { error } = await supabase.auth.admin.updateUserById(recoveryToken, { password })
const { data: sessionData, error: sessionError } = await supabase.auth.verifyOTP({...})

// Sesudah (BENAR):
const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(recoveryToken)
if (sessionError) {
  // Fallback ke setSession
  const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
    access_token: recoveryToken,
    refresh_token: ''
  })
}
// Update password dengan session aktif
const { error: updateError } = await supabase.auth.updateUser({ password })
```

## Status
- [x] Perbaikan backend auth.controller.ts selesai
- [x] TypeScript compilation check passed (tidak ada error di auth.controller.ts)

