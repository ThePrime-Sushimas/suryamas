# 🧠 FINAL ERD & DDL — POS → Accounting (Enterprise Grade)

Dokumen ini adalah **FINAL SOURCE OF TRUTH** untuk arsitektur:
> POS Import → Aggregation → Purpose → Journal Template → Auto‑Draft → Guarded Edit → Posting 🔒

---

## 🗺️ ERD FINAL (LOGICAL)

```
┌──────────────────────┐
│ pos_import_rows      │  (raw, accounting-blind)
│----------------------│
│ id                   │
│ bill_number          │
│ sales_date           │
│ payment_method_code  │
│ gross_amount         │
│ tax_amount           │
│ discount             │
│ total_amount         │
│ journal_id (nullable)│◄──────────────┐
└─────────┬────────────┘               │
          │                              │
          ▼                              │
┌──────────────────────────────┐         │
│ aggregated_transactions      │         │
│------------------------------│         │
│ id                            │         │
│ bill_number (unique)          │         │
│ payment_method_code           │         │
│ payment_coa_id                │         │
│ gross_sales                   │         │
│ tax_amount                    │         │
│ discount                      │         │
│ service_charge                │         │
│ total_amount                  │         │
│ journal_id                    │─────────┘
│ status (READY/JOURNALED)      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ accounting_purposes           │
│------------------------------│
│ id                            │
│ purpose_code                  │◄──────────────┐
│ applied_to                    │               │
└──────────────┬───────────────┘               │
               │                               │
               ▼                               │
┌────────────────────────────────────────┐     │
│ accounting_purpose_accounts             │     │
│----------------------------------------│     │
│ purpose_id                              │─────┘
│ account_id                              │
│ side (DEBIT/CREDIT)                     │
│ priority                                │
│ is_required                             │
└────────────────────────────────────────┘

┌──────────────────────────────┐
│ journal_headers               │
│------------------------------│
│ id                            │
│ source = POS                  │
│ source_ref_type = BILL        │
│ source_ref_id                 │
│ purpose_code                  │
│ status (DRAFT/POSTED/VOID)    │
│ is_auto                       │
│ is_overridden                 │
│ locked_at                     │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ journal_lines                  │
│------------------------------│
│ journal_id                     │
│ account_id                     │
│ side                           │
│ amount                         │
│ sequence                       │
└──────────────────────────────┘
```

---

## 🗄️ DDL FINAL (POSTGRESQL)

> Catatan: **NO CASCADE DELETE** untuk journal & accounting data.

---

### 1️⃣ pos_import_rows (RAW)

```sql
CREATE TABLE pos_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  bill_number VARCHAR NOT NULL,
  sales_date DATE NOT NULL,
  payment_method_code VARCHAR NOT NULL,
  gross_amount NUMERIC(18,2) NOT NULL,
  tax_amount NUMERIC(18,2) NOT NULL,
  discount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL,
  journal_id UUID,
  created_at TIMESTAMP DEFAULT now()
);
```

---

### 2️⃣ aggregated_transactions

```sql
CREATE TABLE aggregated_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  bill_number VARCHAR NOT NULL UNIQUE,
  sales_date DATE NOT NULL,
  payment_method_code VARCHAR NOT NULL,
  payment_coa_id UUID NOT NULL,
  gross_sales NUMERIC(18,2) NOT NULL,
  tax_amount NUMERIC(18,2) NOT NULL,
  discount NUMERIC(18,2) NOT NULL DEFAULT 0,
  service_charge NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('READY','JOURNALED')),
  journal_id UUID,
  created_at TIMESTAMP DEFAULT now()
);
```

---

### 3️⃣ accounting_purposes

```sql
CREATE TABLE accounting_purposes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  purpose_code VARCHAR NOT NULL UNIQUE,
  purpose_name VARCHAR NOT NULL,
  applied_to VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

---

### 4️⃣ accounting_purpose_accounts (TEMPLATE CORE)

```sql
CREATE TABLE accounting_purpose_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose_id UUID NOT NULL REFERENCES accounting_purposes(id),
  account_id UUID NOT NULL,
  side VARCHAR NOT NULL CHECK (side IN ('DEBIT','CREDIT')),
  priority INT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  is_auto BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true
);
```

---

### 5️⃣ journal_headers

```sql
CREATE TABLE journal_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  source VARCHAR NOT NULL,
  source_ref_type VARCHAR NOT NULL,
  source_ref_id VARCHAR NOT NULL,
  purpose_code VARCHAR NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('DRAFT','REVIEWED','POSTED','VOID')),
  is_auto BOOLEAN DEFAULT false,
  is_overridden BOOLEAN DEFAULT false,
  override_reason TEXT,
  locked_at TIMESTAMP,
  locked_by UUID,
  created_at TIMESTAMP DEFAULT now()
);
```

---

### 6️⃣ journal_lines

```sql
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_headers(id),
  account_id UUID NOT NULL,
  side VARCHAR NOT NULL CHECK (side IN ('DEBIT','CREDIT')),
  amount NUMERIC(18,2) NOT NULL,
  sequence INT NOT NULL
);
```

---

## 🔒 INVARIANTS (WAJIB DIPATUHI CODE)

- journal_headers.status = POSTED → **NO UPDATE**
- journal_lines.total(DEBIT) = total(CREDIT)
- aggregated_transactions.bill_number → **1 journal only**
- accounting_purpose_accounts → **IMMUTABLE (version if change)**

---

## 🧠 PENUTUP

Dengan ERD + DDL ini:

✔ POS tetap bodoh
✔ Accounting deterministik
✔ Bisa regenerate
✔ Aman audit
✔ Siap scale ERP

Ini **arsitektur final**, bukan draft.
