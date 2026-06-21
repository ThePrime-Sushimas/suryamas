# Transaction Atomicity Rules

## Golden Rule

**Setiap operasi bisnis yang melibatkan lebih dari satu write statement (INSERT/UPDATE/DELETE) ke database WAJIB dibungkus dalam satu database transaction.** Dua `pool.query()` berurutan tanpa transaction = dua koneksi terpisah = bukan atomic.

## Kapan Transaction WAJIB

1. **Service method yang memanggil >1 repository write** — bungkus dalam `repository.withTransaction()`
2. **Repository method yang punya >1 SQL write statement** — self-manage `BEGIN/COMMIT/ROLLBACK` jika dipanggil standalone, atau terima `client` dari caller jika dipanggil dalam konteks transaction lebih besar
3. **Operasi yang melibatkan read-check-write** pada data yang bisa berubah concurrent (saldo, stock, sequence) — gunakan `SELECT ... FOR UPDATE` di dalam transaction

## Kapan Transaction TIDAK Perlu

- Single write statement (INSERT/UPDATE/DELETE satu baris/tabel) — sudah atomic by default di Postgres
- Multiple SELECT tanpa write
- Side effects yang sengaja independent (audit log, notification dispatch) — boleh di luar transaction

## Pattern yang Benar

### Repository: `withTransaction` Helper

Setiap repository yang memiliki multi-write operations WAJIB punya helper ini:

```typescript
async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
```

### Repository: Method yang Composable (terima `client` dari luar)

```typescript
// Multi-statement: self-manage jika standalone, ikut caller jika client diberikan
async delete(id: string, userId: string, client?: PoolClient): Promise<void> {
  if (client) {
    await client.query('DELETE FROM child_table WHERE parent_id = $1', [id])
    await client.query('DELETE FROM parent_table WHERE id = $1', [id])
    return
  }
  // Standalone: self-managed transaction
  await this.withTransaction(async (ownClient) => {
    await ownClient.query('DELETE FROM child_table WHERE parent_id = $1', [id])
    await ownClient.query('DELETE FROM parent_table WHERE id = $1', [id])
  })
}

// Single-statement: cukup pakai db = client ?? pool
async updateStatus(id: string, status: string, client?: PoolClient): Promise<void> {
  const db = client ?? pool
  await db.query('UPDATE parent_table SET status = $1 WHERE id = $2', [status, id])
}
```

### Service: Orchestration Transaction

```typescript
// Service method yang memanggil >1 repository write — WAJIB atomic
async cancelOrder(id: string, userId: string): Promise<void> {
  await ordersRepository.withTransaction(async (client) => {
    await ordersRepository.updateStatus(client, id, 'CANCELLED', userId)
    await orderLinesRepository.softDeleteByOrderId(client, id, userId)
    await stockRepository.reverseReservations(client, id)
  })
  // Side effects di luar transaction (best-effort)
  await AuditService.log(...)
  await notificationDispatcher.dispatch(...)
}
```

## Anti-Patterns yang DILARANG

### 1. Multiple pool.query() tanpa transaction

```typescript
// ❌ SALAH: dua koneksi terpisah, bisa partial
await pool.query('DELETE FROM journal_lines WHERE journal_header_id = $1', [id])
await pool.query('DELETE FROM journal_headers WHERE id = $1', [id])
```

### 2. Promise.all dengan pool.query() untuk write operations

```typescript
// ❌ SALAH: paralel tanpa koordinasi, race-prone kalau satu gagal
await Promise.all([
  pool.query('UPDATE table_a SET x = NULL WHERE ref = $1', [id]),
  pool.query('UPDATE table_b SET x = NULL WHERE ref = $1', [id]),
  pool.query('DELETE FROM table_c WHERE ref = $1', [id]),
])
```

Gunakan sequential writes dalam satu client:

```typescript
// ✅ BENAR: sequential dalam satu transaction
await repository.withTransaction(async (client) => {
  await client.query('UPDATE table_a SET x = NULL WHERE ref = $1', [id])
  await client.query('UPDATE table_b SET x = NULL WHERE ref = $1', [id])
  await client.query('DELETE FROM table_c WHERE ref = $1', [id])
})
```

### 3. Service import pool langsung

```typescript
// ❌ SALAH: service TIDAK boleh import pool
import { pool } from '../../config/db'
const client = await pool.connect()
```

Gunakan `repository.withTransaction()` dari service layer.

### 4. Transaction di repository tapi orchestration di service tanpa wrapper

```typescript
// ❌ SALAH: tiap repo method atomic sendiri, tapi gabungannya tidak atomic
async rejectJournal(id, reason, userId) {
  await journalRepo.updateStatus(id, 'REJECTED', userId)     // tx 1
  await journalRepo.clearJournalReferences(id)                // tx 2 (terpisah!)
}

// ✅ BENAR: service-level orchestration dibungkus transaction
async rejectJournal(id, reason, userId) {
  await journalRepo.withTransaction(async (client) => {
    await journalRepo.updateStatus(id, 'REJECTED', userId, client)
    await journalRepo.clearJournalReferences(id, client)
  })
}
```

## Locking Pattern: `FOR UPDATE`

Gunakan `SELECT ... FOR UPDATE` ketika:
- Membaca data yang akan di-mutate dalam transaction yang sama
- Mencegah concurrent modification (contoh: dua request reverse journal bersamaan)

```typescript
// Di repository — method khusus, client WAJIB (locking hanya masuk akal dalam transaction)
async findByIdForUpdate(id: string, client: PoolClient): Promise<Record | null> {
  const { rows } = await client.query(
    'SELECT * FROM table WHERE id = $1 FOR UPDATE',
    [id]
  )
  return rows[0] ?? null
}
```

## Sequence/Counter

Postgres sequences (`nextval()`) bersifat non-transactional — sekali di-increment, tidak rollback meskipun transaction dibatalkan. Gap di nomor urut (journal number, GR number, dll) adalah perilaku normal dan expected.

## Side Effects (Audit, Notification)

- `AuditService.log()` dan `notificationDispatcher.dispatch()` — panggil di LUAR transaction
- Alasan: side effects ini best-effort, tidak boleh membatalkan transaksi utama jika gagal
- Kalau transaction ROLLBACK, audit/notification yang sudah terkirim menjadi orphan — ini accepted trade-off

## Checklist untuk Code Review

Saat review kode yang melibatkan database write:

- [ ] Apakah method ini melakukan >1 write? Jika ya, ada transaction wrapper?
- [ ] Apakah service method memanggil >1 repository write? Jika ya, dibungkus `withTransaction`?
- [ ] Apakah ada `pool.query()` berurutan tanpa `BEGIN`? (Red flag)
- [ ] Apakah ada `Promise.all` dengan write operations? (Red flag)
- [ ] Apakah ada read-then-write tanpa `FOR UPDATE` pada data yang bisa race? (Potential issue)
- [ ] Apakah `pool` di-import di service layer? (Violation)
