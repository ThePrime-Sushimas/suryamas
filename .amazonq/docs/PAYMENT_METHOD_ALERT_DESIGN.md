# Payment Method Threshold Alert — Design Document

## Tujuan
Kirim notifikasi Telegram otomatis ketika total penjualan harian suatu payment method mencapai/melewati threshold yang di-setting user. Alert dikirim setiap kali ada transaksi baru yang melewati threshold (bukan hanya 1x per hari), dengan info cabang mana yang trigger.

---

## Data Flow

```
POS Sync masuk (POST /pos-sync/sales)
  → aggregateService.recalculateByDate(salesDate)
    → syncPosSyncToAggregated(salesDate)
      → ✅ HOOK: checkPaymentMethodAlerts(salesDate)
        → Query total hari ini per payment_method + branch
        → Compare vs threshold dari tabel `payment_method_alerts`
        → Kalau melewati → kirim Telegram via webhook-notifier.service.ts
        → Update `last_triggered_amount` supaya next alert hanya kirim kalau naik lagi
```

---

## Database

### Tabel Baru: `payment_method_alerts`

```sql
CREATE TABLE payment_method_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  payment_method_id INT NOT NULL REFERENCES payment_methods(id),
  threshold_amount NUMERIC(15,2) NOT NULL,
  telegram_chat_id VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_date DATE,
  last_triggered_amount NUMERIC(15,2) DEFAULT 0,
  created_by UUID REFERENCES employees(id),
  updated_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_pma_company_active ON payment_method_alerts(company_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_pma_payment_method ON payment_method_alerts(payment_method_id);
```

### Kolom Penjelasan
| Kolom | Fungsi |
|-------|--------|
| `payment_method_id` | Payment method yang di-monitor (misal: QRIS BCA - M) |
| `threshold_amount` | Angka trigger (misal: 12.000.000) |
| `telegram_chat_id` | Chat ID tujuan notif (bisa group atau personal) |
| `is_active` | On/off toggle |
| `last_triggered_date` | Tanggal terakhir alert dikirim |
| `last_triggered_amount` | Amount terakhir saat alert dikirim — supaya alert berikutnya hanya kirim kalau total naik melewati threshold berikutnya |

---

## Alert Logic (Detail)

```typescript
async function checkPaymentMethodAlerts(salesDate: string, companyId: string): Promise<void> {
  // 1. Get active alerts for this company
  const alerts = await getActiveAlerts(companyId)
  if (alerts.length === 0) return

  // 2. Get current daily totals per payment_method + branch
  const totals = await getDailyTotalsByPaymentMethod(companyId, salesDate)
  // Result: [{ payment_method_id, branch_name, daily_total }]

  // 3. Aggregate per payment_method (all branches combined)
  const pmTotals = aggregateByPaymentMethod(totals)
  // Result: Map<payment_method_id, { total, branches: [{name, amount}] }>

  // 4. Check each alert
  for (const alert of alerts) {
    const pmData = pmTotals.get(alert.payment_method_id)
    if (!pmData) continue

    const currentTotal = pmData.total

    // Skip if below threshold
    if (currentTotal < alert.threshold_amount) continue

    // Skip if already alerted for this amount level today
    // (only re-alert if total increased past another threshold increment)
    if (alert.last_triggered_date === salesDate && currentTotal <= alert.last_triggered_amount) continue

    // 5. Send Telegram
    await sendThresholdAlert({
      paymentMethodName: pmData.name,
      currentTotal,
      threshold: alert.threshold_amount,
      branches: pmData.branches, // info per cabang
      chatId: alert.telegram_chat_id,
    })

    // 6. Update last triggered
    await updateLastTriggered(alert.id, salesDate, currentTotal)
  }
}
```

### Re-alert Logic
- Alert pertama: total >= threshold (misal 12jt)
- Alert kedua: total naik lagi (misal jadi 15jt) — karena `last_triggered_amount = 12jt` dan `15jt > 12jt`
- Tidak alert: total masih 12jt (tidak naik) — karena `15jt <= 12jt` false, tapi `12jt <= 12jt` true → skip

---

## Telegram Message Format

```
🔔 *ALERT: QRIS BCA - M*

Total hari ini: *Rp 12.450.000*
Threshold: Rp 12.000.000

📍 Breakdown per cabang:
• SUSHIMAS GRAND GALAXY: Rp 4.200.000
• SUSHIMAS CIBINONG: Rp 3.100.000
• SUSHIMAS DEPOK: Rp 2.800.000
• SUSHIMAS CONDET: Rp 2.350.000

📅 2026-05-05
```

---

## Backend Module Structure

```
src/modules/payment-method-alerts/
├── payment-method-alerts.routes.ts
├── payment-method-alerts.controller.ts
├── payment-method-alerts.service.ts
├── payment-method-alerts.repository.ts
├── payment-method-alerts.schema.ts
├── payment-method-alerts.errors.ts
├── payment-method-alerts.types.ts
└── alert-checker.service.ts      ← logic check + send telegram
```

### Endpoints (CRUD)
| Method | Path | Permission | Fungsi |
|--------|------|-----------|--------|
| GET | `/payment-method-alerts` | `canView('payment_method_alerts')` | List alerts |
| POST | `/payment-method-alerts` | `canInsert('payment_method_alerts')` | Create alert |
| PUT | `/payment-method-alerts/:id` | `canUpdate('payment_method_alerts')` | Update alert |
| DELETE | `/payment-method-alerts/:id` | `canDelete('payment_method_alerts')` | Soft delete |
| POST | `/payment-method-alerts/test/:id` | `canUpdate('payment_method_alerts')` | Test send (kirim sample ke Telegram) |

### Permission Module
Register di `perm_modules`:
```sql
INSERT INTO perm_modules (id, name, description) VALUES (gen_random_uuid(), 'payment_method_alerts', 'Payment Method Threshold Alerts');
```

---

## Hook Point (Trigger)

Di `pos-sync.service.ts` → `aggregateService.recalculateByDate()`:

```typescript
export const aggregateService = {
  recalculateByDate: async (salesDate: string): Promise<PosSyncAggregateResult> => {
    const salesNums = await aggregateRepository.getSalesNumsByDate(salesDate)
    const result = await processPosSyncAggregates(salesNums)

    await syncPosSyncToAggregated(salesDate).catch(err =>
      logError('syncPosSyncToAggregated failed', { err, salesDate })
    )

    // ✅ NEW: Check threshold alerts (fire-and-forget, non-blocking)
    checkPaymentMethodAlerts(salesDate).catch(err =>
      logError('checkPaymentMethodAlerts failed', { err, salesDate })
    )

    return result
  },
}
```

**Non-blocking**: `.catch()` supaya alert failure tidak break POS sync flow.

---

## SQL Query: Daily Total per Payment Method + Branch

```sql
SELECT
  at.payment_method_id,
  pm.name AS payment_method_name,
  at.branch_name,
  SUM(at.nett_amount)::numeric AS daily_total
FROM aggregated_transactions at
JOIN payment_methods pm ON pm.id = at.payment_method_id
WHERE at.transaction_date = $1  -- salesDate
  AND at.company_id = $2
  AND at.deleted_at IS NULL
  AND at.superseded_by IS NULL
  AND at.status != 'FAILED'
GROUP BY at.payment_method_id, pm.name, at.branch_name
ORDER BY at.payment_method_id, daily_total DESC
```

---

## Frontend

### Halaman: `/settings/alerts`

**Layout:**
```
┌─ Pengaturan Alert ──────────────────────────────────────────┐
│  Notifikasi Telegram saat payment method mencapai threshold  │
├─────────────────────────────────────────────────────────────┤
│ [+ Tambah Alert]                                             │
│                                                              │
│ ┌─ QRIS BCA - M ─────────── Rp 12.000.000 ── ✅ Aktif ──┐ │
│ │  Chat: -5202987932 (Sushimas Monitoring)                 │ │
│ │  Last triggered: 05 Mei 2026, Rp 14.200.000             │ │
│ │  [Edit] [Test] [Hapus]                                   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ DEBIT BCA - PT ───────── Rp 5.000.000 ── ⏸ Nonaktif ─┐ │
│ │  Chat: -5202987932                                       │ │
│ │  [Edit] [Aktifkan] [Hapus]                               │ │
│ └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Form Create/Edit (Modal):**
- Dropdown: Payment Method (dari payment_methods aktif)
- Input: Threshold Amount (Rp)
- Input: Telegram Chat ID (default: dari env TELEGRAM_CHAT_ID)
- Toggle: Aktif/Nonaktif

### Sidebar Menu
Di bawah section "Settings":
```
⚙️ Settings
  └── 🔔 Alert Threshold
```

---

## Telegram Bot

Pakai bot yang sudah ada:
- **Bot**: @SIS_Emergency_Bot
- **Token**: `process.env.TELEGRAM_BOT_TOKEN`
- **Default Chat ID**: `process.env.TELEGRAM_CHAT_ID` (-5202987932)
- **Service**: `webhook-notifier.service.ts` → extend dengan fungsi `sendAlertToChat(chatId, message)`

### Extend webhook-notifier.service.ts

```typescript
export async function sendAlertToChat(chatId: string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}
```

---

## Migration Script

```sql
-- File: migrations/20260505_create_payment_method_alerts.sql

CREATE TABLE IF NOT EXISTS payment_method_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  payment_method_id INT NOT NULL REFERENCES payment_methods(id),
  threshold_amount NUMERIC(15,2) NOT NULL CHECK (threshold_amount > 0),
  telegram_chat_id VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_date DATE,
  last_triggered_amount NUMERIC(15,2) DEFAULT 0,
  created_by UUID REFERENCES employees(id),
  updated_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_pma_company_active ON payment_method_alerts(company_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_pma_payment_method ON payment_method_alerts(payment_method_id);

-- Register permission module
INSERT INTO perm_modules (id, name, description, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'payment_method_alerts', 'Payment Method Threshold Alerts', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
```

---

## Audit Log

| Action | Trigger |
|--------|---------|
| CREATE | User buat alert baru |
| UPDATE | User edit threshold/toggle active |
| DELETE | User hapus alert |
| ALERT_SENT | System kirim Telegram (log di `last_triggered_*`) |

---

## Edge Cases

1. **POS sync masuk batch besar** → total langsung loncat dari 5jt ke 15jt → alert tetap kirim 1x (karena cek `currentTotal > last_triggered_amount`)
2. **Multiple alerts untuk PM yang sama** → masing-masing punya threshold berbeda, semua di-check independently
3. **Telegram gagal kirim** → log error, tidak retry (fire-and-forget), tidak block POS sync
4. **Payment method di-delete** → alert otomatis tidak trigger (JOIN ke payment_methods gagal)
5. **Hari berganti** → `last_triggered_date` reset natural (tanggal baru ≠ last_triggered_date → alert bisa kirim lagi)

---

## Estimasi Effort

| Task | Effort |
|------|--------|
| Migration SQL | 10 min |
| Backend module (CRUD) | 45 min |
| alert-checker.service.ts | 30 min |
| Hook di pos-sync.service.ts | 5 min |
| Extend webhook-notifier | 10 min |
| Frontend settings page | 45 min |
| Sidebar menu + route | 10 min |
| Testing | 20 min |
| **Total** | **~3 jam** |
