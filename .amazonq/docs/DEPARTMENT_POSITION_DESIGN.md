# Department & Position System — Design Document

## Tujuan

Mengganti `employees.job_position` (free text) dengan master table yang proper, sehingga:
1. Position bisa di-manage dari UI (CRUD)
2. Position bisa di-assign ke WIP (access control: siapa boleh produksi WIP apa)
3. Employee bisa punya multi-position (cover teman yang berhalangan)
4. Position dikelompokkan per department untuk organisasi yang jelas

---

## Current State

```
employees.job_position = VARCHAR (free text)
Values: SERVER(27), SUSHIMAN(22), COOK(7), BARISTA(5), DISHWASHER(5),
        Stock Keeper(2), SEKRETARIS(2), MANAGER(1), Finance(1), HELPER(1),
        Super Admin(1), Admin(1)
```

Masalah:
- Tidak bisa di-reference sebagai FK
- Tidak bisa di-assign ke WIP untuk access control
- Typo/inkonsistensi (CAPS vs Title Case)
- Tidak ada grouping (department)

---

## Target State

```
departments (master)
  └── positions (master, FK → department)
        └── employee_positions (mapping table, 1 employee bisa multi-position)

wip_items → wip_position_access (mapping table) → positions
```

---

## Database Tables

### 1. `departments`

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  department_code VARCHAR(20) NOT NULL,
  department_name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(company_id, department_code)
);

CREATE INDEX idx_departments_company ON departments(company_id) WHERE is_deleted = false;
```

**Seed data:**

| Code | Name | Positions |
|------|------|-----------|
| KITCHEN | Dapur | SUSHIMAN, COOK, HELPER, CDP |
| BAR | Bar | BARISTA |
| SERVICE | Service | SERVER, CASHIER |
| BOH | Back of House | DISHWASHER, Stock Keeper |
| OFFICE | Kantor | MANAGER, Admin, Finance, SEKRETARIS, Super Admin |

### 2. `positions`

```sql
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  position_code VARCHAR(30) NOT NULL,
  position_name VARCHAR(100) NOT NULL,
  can_access_all_wip BOOLEAN NOT NULL DEFAULT false,  -- bypass WIP position filter
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(company_id, position_code)
);

CREATE INDEX idx_positions_company ON positions(company_id) WHERE is_deleted = false;
CREATE INDEX idx_positions_department ON positions(department_id) WHERE is_deleted = false;
```

**`can_access_all_wip`**: Jika `true`, user dengan position ini bisa akses semua WIP tanpa perlu di-assign per WIP. Dipakai untuk MANAGER, Super Admin, dll.

### 3. `employee_positions` (mapping — multi-position)

```sql
CREATE TABLE employee_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  position_id UUID NOT NULL REFERENCES positions(id),
  is_primary BOOLEAN NOT NULL DEFAULT false,  -- posisi utama
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  UNIQUE(employee_id, position_id)
);

-- DB-level enforcement: hanya 1 primary position per employee
CREATE UNIQUE INDEX uq_employee_primary_position
  ON employee_positions(employee_id)
  WHERE is_primary = true AND is_deleted = false;

CREATE INDEX idx_emp_positions_employee ON employee_positions(employee_id) WHERE is_deleted = false;
CREATE INDEX idx_emp_positions_position ON employee_positions(position_id) WHERE is_deleted = false;
```

**Rules:**
- 1 employee WAJIB punya minimal 1 position dengan `is_primary = true`
- Bisa punya banyak position tambahan (cover)
- `is_primary = true` hanya boleh 1 per employee — enforced by partial unique index
- Tidak perlu `employees.position_id` shortcut — query dari `employee_positions WHERE is_primary = true`

### 4. `wip_position_access` (WIP → siapa boleh akses)

```sql
CREATE TABLE wip_position_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_id UUID NOT NULL REFERENCES wip_items(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES positions(id),
  UNIQUE(wip_id, position_id)
);

CREATE INDEX idx_wip_pos_access_wip ON wip_position_access(wip_id);
CREATE INDEX idx_wip_pos_access_position ON wip_position_access(position_id);
```

**Rules:**
- Jika WIP tidak punya record di `wip_position_access` → semua position boleh akses (backward compatible)
- Jika WIP punya record → hanya position yang terdaftar yang boleh
- Position dengan `can_access_all_wip = true` → bypass filter, selalu boleh

---

## WIP Access Query (Final)

```sql
-- Get WIP items accessible by user
SELECT w.* FROM wip_items w
WHERE w.company_id = $1 AND w.deleted_at IS NULL
  AND (
    -- Kondisi 1: WIP tanpa restriction → semua boleh
    NOT EXISTS (SELECT 1 FROM wip_position_access WHERE wip_id = w.id)
    -- Kondisi 2: User punya position yang di-assign ke WIP ini
    OR EXISTS (
      SELECT 1 FROM wip_position_access wpa
      WHERE wpa.wip_id = w.id AND wpa.position_id = ANY($2::uuid[])
    )
    -- Kondisi 3: User punya position dengan can_access_all_wip = true
    OR $3 = true
  )
```

Backend resolve `$2` (position IDs) dan `$3` (has bypass) sebelum query:

```typescript
async function resolveUserWipAccess(userId: string): Promise<{ positionIds: string[]; canAccessAll: boolean }> {
  const { rows } = await pool.query(`
    SELECT ep.position_id, p.can_access_all_wip
    FROM employee_positions ep
    JOIN employees e ON e.id = ep.employee_id
    JOIN positions p ON p.id = ep.position_id
    WHERE e.user_id = $1 AND ep.is_deleted = false AND p.is_deleted = false
  `, [userId])

  return {
    positionIds: rows.map(r => r.position_id),
    canAccessAll: rows.some(r => r.can_access_all_wip),
  }
}
```

---

## Migration Strategy

### Step 1: Create tables + seed departments & positions

```sql
-- Seed departments
INSERT INTO departments (company_id, department_code, department_name, sort_order) VALUES
('3576839e-d83a-4061-8551-fe9b5d971111', 'KITCHEN', 'Dapur', 1),
('3576839e-d83a-4061-8551-fe9b5d971111', 'BAR', 'Bar', 2),
('3576839e-d83a-4061-8551-fe9b5d971111', 'SERVICE', 'Service', 3),
('3576839e-d83a-4061-8551-fe9b5d971111', 'BOH', 'Back of House', 4),
('3576839e-d83a-4061-8551-fe9b5d971111', 'OFFICE', 'Kantor', 5);

-- Seed positions (mapped from existing job_position values)
INSERT INTO positions (company_id, department_id, position_code, position_name, can_access_all_wip, sort_order)
SELECT '3576839e-d83a-4061-8551-fe9b5d971111', d.id, p.code, p.name, p.bypass, p.sort
FROM (VALUES
  ('KITCHEN', 'SUSHIMAN', 'Sushiman', false, 1),
  ('KITCHEN', 'COOK', 'Cook', false, 2),
  ('KITCHEN', 'HELPER', 'Helper', false, 3),
  ('BAR', 'BARISTA', 'Barista', false, 1),
  ('SERVICE', 'SERVER', 'Server', false, 1),
  ('BOH', 'DISHWASHER', 'Dishwasher', false, 1),
  ('BOH', 'STOCK_KEEPER', 'Stock Keeper', false, 2),
  ('OFFICE', 'MANAGER', 'Manager', true, 1),
  ('OFFICE', 'ADMIN', 'Admin', true, 2),
  ('OFFICE', 'FINANCE', 'Finance', false, 3),
  ('OFFICE', 'SEKRETARIS', 'Sekretaris', false, 4),
  ('OFFICE', 'SUPER_ADMIN', 'Super Admin', true, 5)
) AS p(dept_code, code, name, bypass, sort)
JOIN departments d ON d.department_code = p.dept_code AND d.company_id = '3576839e-d83a-4061-8551-fe9b5d971111';
```

### Step 2: Migrate employee_positions dari existing data

```sql
-- Validasi dulu: pastikan semua job_position ter-cover
SELECT DISTINCT job_position FROM employees
WHERE deleted_at IS NULL
AND UPPER(REPLACE(job_position, ' ', '_')) NOT IN (
  'SUSHIMAN','COOK','HELPER','BARISTA','SERVER',
  'DISHWASHER','STOCK_KEEPER','MANAGER','ADMIN',
  'FINANCE','SEKRETARIS','SUPER_ADMIN'
);
-- Harus return 0 rows. Kalau ada yang tidak match, seed position-nya dulu.

-- Map existing job_position → position_id, insert ke employee_positions
INSERT INTO employee_positions (employee_id, position_id, is_primary)
SELECT e.id, p.id, true
FROM employees e
JOIN positions p ON UPPER(p.position_code) = UPPER(
  CASE e.job_position
    WHEN 'Stock Keeper' THEN 'STOCK_KEEPER'
    WHEN 'Super Admin' THEN 'SUPER_ADMIN'
    ELSE UPPER(e.job_position)
  END
)
WHERE e.deleted_at IS NULL;
```

### Step 3: (Later) Drop `employees.job_position`

Setelah semua code sudah migrasi dan verified, drop kolom lama:
```sql
ALTER TABLE employees DROP COLUMN job_position;
```

---

## Endpoint Changes

### Existing endpoint — tambah filter

```
GET /wip-items?filter_by_position=true
```

Jika `filter_by_position=true`:
- Backend resolve user's positions dari `employee_positions`
- Filter WIP berdasarkan `wip_position_access` + `can_access_all_wip` bypass
- Return hanya WIP yang user boleh akses

Jika param tidak ada atau `false` → return semua (backward compatible, untuk admin/reporting).

### New endpoints

| Method | Path | Fungsi |
|--------|------|--------|
| GET | `/api/v1/departments` | List departments |
| POST | `/api/v1/departments` | Create department |
| PUT | `/api/v1/departments/:id` | Update department |
| DELETE | `/api/v1/departments/:id` | Soft delete (hasChildren check) |
| GET | `/api/v1/positions` | List positions (filter by department) |
| POST | `/api/v1/positions` | Create position |
| PUT | `/api/v1/positions/:id` | Update position |
| DELETE | `/api/v1/positions/:id` | Soft delete (hasChildren check) |
| GET | `/api/v1/employees/:id/positions` | Get employee's positions |
| POST | `/api/v1/employees/:id/positions` | Assign position to employee |
| DELETE | `/api/v1/employees/:id/positions/:positionId` | Remove position |
| PUT | `/api/v1/employees/:id/positions/:positionId/primary` | Set as primary |
| GET | `/api/v1/wip-items/:id/position-access` | Get WIP's allowed positions |
| PUT | `/api/v1/wip-items/:id/position-access` | Set WIP's allowed positions (replace all) |

---

## Impact ke Existing Code

| Module | Perubahan |
|--------|-----------|
| `wip_items` | Tambah `filter_by_position` query param di existing list endpoint |
| `production-orders` | WIP dropdown pakai `filter_by_position=true` |
| Frontend employees page | Ganti free text input → multi-select positions |
| Frontend WIP detail | Tambah "Akses Position" section |
| Frontend production order form | WIP dropdown di-filter by position |

---

## Frontend Pages (Baru)

| Path | Page | Fungsi |
|------|------|--------|
| `/settings/departments` | DepartmentsPage | CRUD departments |
| `/settings/positions` | PositionsPage | CRUD positions (filter by department) |

Di halaman Employee edit → ganti input text `job_position` dengan multi-select positions.
Di halaman WIP detail → tambah section "Akses Position" (multi-select positions).

---

## Urutan Implementasi

| Step | Apa | Priority |
|------|-----|----------|
| 1 | SQL: create tables + seed + migrate | ✅ Done |
| 2 | Backend: departments CRUD module | Must |
| 3 | Backend: positions CRUD module | Must |
| 4 | Backend: employee_positions CRUD | Must |
| 5+6 | Backend: wip_position_access CRUD + filter WIP by position (DEPLOY BERSAMAAN) | Must |
| 7 | Frontend: Departments & Positions pages | Must |
| 8 | Frontend: Employee create/edit → position assignment | Must |
| 9 | Frontend: WIP detail → position access + Production Order form filter | Must |
| 10 | Drop `employees.job_position` column | Later (setelah verified) |

> **PENTING**: Step 5 dan 6 WAJIB deploy bersamaan. Jika wip_position_access sudah bisa di-set tapi production order form belum filter → user bisa bypass restriction.

---

## Employee Create/Edit Flow (Baru)

### Saat Create Employee
- Form tetap seperti sekarang + tambah field "Position" (dropdown, required)
- Setelah employee di-insert, otomatis insert ke `employee_positions` dengan `is_primary = true`
- `job_position` tetap di-isi (backward compat) sampai kolom di-drop

### Saat Edit Employee
- Section "Positions" di halaman edit:
  - List positions yang di-assign (badge per position, primary ditandai)
  - Tombol "Tambah Position" → dropdown positions yang belum di-assign
  - Tombol "Set Primary" per position
  - Tombol "Hapus" per position (kecuali primary terakhir)
- `job_position` field di-hide dari UI tapi tetap di-sync dari primary position

### Backend Service
- `createEmployee()` → wajib terima `position_id`, auto-insert ke `employee_positions`
- `updateEmployee()` → position management via endpoint terpisah (`/employees/:id/positions`)
- Validasi: employee tidak boleh tanpa position (minimal 1 primary)

---

## Edge Cases

| Case | Handling |
|------|----------|
| Employee tanpa position | Block — minimal 1 primary position wajib |
| WIP tanpa position access | Semua boleh akses (backward compatible) |
| Position dihapus tapi masih di-assign ke employee | Soft delete, tetap tampil di history |
| Department dihapus tapi masih punya positions | Block delete — hasChildren check |
| User punya multi-position, WIP restrict ke salah satu | Boleh akses — OR logic |
| Manager/Admin mau lihat semua WIP | `can_access_all_wip = true` di position → bypass filter |
| WIP baru dibuat, belum di-assign position | Semua boleh akses (no record = no restriction) |
| Employee pindah position | Remove old, assign new. History tetap di employee_positions (soft delete) |
| 2 request set is_primary bersamaan | Partial unique index enforce 1 primary — second request fail, retry |
