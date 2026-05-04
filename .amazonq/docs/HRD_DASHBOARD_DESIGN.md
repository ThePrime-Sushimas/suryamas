# HRD Dashboard — Design Document

## 🎯 Tujuan

Redesign halaman `/dashboard/hrd` untuk menampilkan overview karyawan per cabang, breakdown per posisi/divisi, dan karyawan dengan akses multi-cabang.

---

## 📊 Data yang Tersedia

| Tabel | Field Relevan |
|-------|---------------|
| `employees` | `id`, `full_name`, `job_position`, `status_employee`, `join_date`, `resign_date`, `is_active` |
| `employee_branches` | `employee_id`, `branch_id`, `role_id`, `is_primary`, `status` |
| `branches` | `id`, `branch_name`, `status` |
| `perm_roles` | `id`, `name` |

### Job Positions (dari data)
`SUSHIMAN` (34), `SERVER` (36), `COOK` (9), `BARISTA` (8), `DISHWASHER` (10), `MANAGER` (2), `SEKRETARIS` (2), `HELPER` (1), `Stock Keeper` (1)

### Active Branches
5 cabang aktif: Cibinong (71), Condet (78), Depok (16), Grand Galaxy (81), Grand Wisata (2)

---

## 📊 Data Insights & Business Rules

### Primary Branch = Cabang Utama
- `is_primary = true` menunjukkan cabang tempat karyawan kerja sehari-hari
- **"Karyawan per Cabang"** dihitung berdasarkan `is_primary` saja
- Staff bisa rotasi/pindah cabang — multi-branch assignment valid

### Multi-Branch Categories
- **Admin Access**: role Super Admin/Owner — expected punya akses semua cabang, bukan rotasi
- **Staff Rotasi**: staff biasa dengan >1 active branch — ini yang informatif untuk HRD

### Data Quality Issues (existing)
- Bulk insert menyebabkan ~60 staff punya 4 branch assignment yang tidak akurat
- Test data: `full_name = 'test'`, `job_position = 'asd'`
- `job_position` free-text, perlu `UPPER()` normalize

---

## 🖥️ Layout Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ HRD Dashboard                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ Total    │ │ Aktif    │ │ Cabang   │ │ Multi-   │       │
│ │ Karyawan │ │          │ │ Aktif    │ │ Cabang   │       │
│ │ 105      │ │ 98       │ │ 5        │ │ 12       │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│ ┌─────────────────────────────┐ ┌─────────────────────────┐│
│ │ Karyawan per Cabang         │ │ Breakdown per Posisi    ││
│ │                             │ │                         ││
│ │ SUSHIMAS GRAND GALAXY  81  │ │ SERVER        36  ████  ││
│ │ SUSHIMAS CONDET        78  │ │ SUSHIMAN      34  ████  ││
│ │ SUSHIMAS CIBINONG      71  │ │ DISHWASHER    10  ██    ││
│ │ SUSHIMAS DEPOK         16  │ │ COOK           9  ██    ││
│ │ SUSHIMAS GRAND WISATA   2  │ │ BARISTA        8  ██    ││
│ │                             │ │ MANAGER        2  █     ││
│ │                             │ │ Lainnya        6  █     ││
│ └─────────────────────────────┘ └─────────────────────────┘│
│                                                             │
│ ┌───────────────────────────────────────────────────────────┐
│ │ Detail per Cabang (expandable)                            │
│ │                                                           │
│ │ ▼ SUSHIMAS GRAND GALAXY — 81 karyawan                    │
│ │   SUSHIMAN (25) · SERVER (20) · COOK (5) · BARISTA (4)   │
│ │   DISHWASHER (3) · MANAGER (1) · Lainnya (3)             │
│ │                                                           │
│ │ ▶ SUSHIMAS CONDET — 78 karyawan                          │
│ │ ▶ SUSHIMAS CIBINONG — 71 karyawan                        │
│ │ ▶ SUSHIMAS DEPOK — 16 karyawan                           │
│ │ ▶ SUSHIMAS GRAND WISATA — 2 karyawan                     │
│ └───────────────────────────────────────────────────────────┘
│                                                             │
│ ┌───────────────────────────────────────────────────────────┐
│ │ Staff Rotasi (multi-cabang, bukan admin)                  │
│ │                                                           │
│ │ Ade Hendi permana   SUSHIMAN  Cibinong, Condet, Galaxy   │
│ │ Adrian ramayanto    SUSHIMAN  Cibinong, Condet, Galaxy   │
│ │ ...                                                       │
│ │                                                           │
│ │ Admin Access (Super Admin)                                │
│ │ Bambang  Super Admin  7 cabang                            │
│ └───────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 API

### Opsi: 1 endpoint baru (dedicated dashboard)

**`GET /api/v1/dashboard/hrd-summary`**

Satu query yang return semua data sekaligus — lebih efisien daripada multiple API calls.

**Response:**
```json
{
  "summary": {
    "total_employees": 105,
    "active_employees": 98,
    "active_branches": 5,
    "multi_branch_count": 12
  },
  "branches": [
    {
      "branch_id": "uuid",
      "branch_name": "SUSHIMAS GRAND GALAXY",
      "employee_count": 81,
      "positions": [
        { "job_position": "SUSHIMAN", "count": 25 },
        { "job_position": "SERVER", "count": 20 }
      ]
    }
  ],
  "position_summary": [
    { "job_position": "SERVER", "count": 36 },
    { "job_position": "SUSHIMAN", "count": 34 }
  ],
  "multi_branch_employees": [
    {
      "employee_id": "uuid",
      "full_name": "Bambang",
      "job_position": "SUSHIMAN",
      "role_name": "Super Admin",
      "branch_count": 3,
      "branches": ["SUSHIMAS CIBINONG", "SUSHIMAS SERPONG", "SUSHIMAS GRAND GALAXY"]
    }
  ]
}
```

---

## 📁 File yang Terdampak

### Backend — New Files

| File | Keterangan |
|------|-----------|
| `backend/src/modules/dashboard/dashboard-hrd.controller.ts` | Handler untuk HRD summary |
| `backend/src/modules/dashboard/dashboard-hrd.repository.ts` | Query: employee per branch, position breakdown, multi-branch |
| `backend/src/modules/dashboard/dashboard-hrd.routes.ts` | `GET /dashboard/hrd-summary` |

Atau bisa ditambahkan ke existing dashboard module jika sudah ada.

### Frontend — Modified Files

| File | Perubahan |
|------|-----------|
| `frontend/src/features/dashboard/pages/DashboardHrdPage.tsx` | Rewrite — summary cards, branch breakdown, position chart, multi-branch table |
| `frontend/src/features/dashboard/api/useDashboardApi.ts` | Tambah `useHrdSummary()` hook |

### Frontend — No New Files
Reuse existing components (cards, tables, expandable sections).

---

## 🗄️ SQL Queries (Backend)

### 1. Summary counts
```sql
SELECT 
  (SELECT COUNT(DISTINCT e.id) FROM employees e
   JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active'
   JOIN branches b ON b.id = eb.branch_id AND b.company_id = $1
   WHERE e.deleted_at IS NULL) AS total_employees,
  (SELECT COUNT(DISTINCT e.id) FROM employees e
   JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active'
   JOIN branches b ON b.id = eb.branch_id AND b.status = 'active' AND b.company_id = $1
   WHERE e.deleted_at IS NULL AND e.is_active = true) AS active_employees,
  (SELECT COUNT(*) FROM branches WHERE status = 'active' AND company_id = $1) AS active_branches,
  (SELECT COUNT(*) FROM (
    SELECT eb.employee_id FROM employee_branches eb
    JOIN branches b ON b.id = eb.branch_id AND b.status = 'active' AND b.company_id = $1
    WHERE eb.status = 'active'
    GROUP BY eb.employee_id HAVING COUNT(DISTINCT eb.branch_id) > 1
  ) x) AS multi_branch_count;
```

### 2. Employees per branch (PRIMARY only) + position breakdown
```sql
SELECT b.id AS branch_id, b.branch_name, UPPER(e.job_position) AS job_position, COUNT(DISTINCT e.id) AS count
FROM employee_branches eb
JOIN employees e ON e.id = eb.employee_id AND e.deleted_at IS NULL
JOIN branches b ON b.id = eb.branch_id AND b.status = 'active'
WHERE eb.status = 'active' AND eb.is_primary = true AND b.company_id = $1
  AND e.full_name NOT IN ('test')
GROUP BY b.id, b.branch_name, UPPER(e.job_position)
ORDER BY b.branch_name, count DESC;
```

### 3. Position summary (company-wide, PRIMARY only)
```sql
SELECT UPPER(e.job_position) AS job_position, COUNT(DISTINCT e.id) AS count
FROM employees e
JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active' AND eb.is_primary = true
JOIN branches b ON b.id = eb.branch_id AND b.status = 'active' AND b.company_id = $1
WHERE e.deleted_at IS NULL AND e.job_position IS NOT NULL
  AND e.full_name NOT IN ('test')
GROUP BY UPPER(e.job_position)
ORDER BY count DESC;
```

### 4. Multi-branch staff (exclude admin roles)
```sql
SELECT e.id, e.full_name, UPPER(e.job_position) AS job_position,
  (SELECT r.name FROM perm_roles r
   JOIN employee_branches eb2 ON eb2.role_id = r.id
   WHERE eb2.employee_id = e.id AND eb2.is_primary = true LIMIT 1) AS role_name,
  COUNT(DISTINCT eb.branch_id) AS branch_count,
  ARRAY_AGG(DISTINCT b.branch_name ORDER BY b.branch_name) AS branches
FROM employees e
JOIN employee_branches eb ON eb.employee_id = e.id AND eb.status = 'active'
JOIN branches b ON b.id = eb.branch_id AND b.status = 'active' AND b.company_id = $1
WHERE e.deleted_at IS NULL AND e.full_name NOT IN ('test')
GROUP BY e.id, e.full_name, e.job_position
HAVING COUNT(DISTINCT eb.branch_id) > 1
ORDER BY branch_count DESC, e.full_name;
```

> Note: Frontend akan split result menjadi 2 group:
> - **Admin Access**: `role_name IN ('Super Admin')` — tampil terpisah
> - **Staff Rotasi**: sisanya — ini yang informatif untuk HRD

---

## ⚠️ Notes

1. **Tidak ada kolom `department`** di tabel employees — grouping pakai `UPPER(job_position)` sebagai pengganti divisi (free-text, perlu normalize case)
2. **Tidak ada `company_id` di employees** — harus join via `employee_branches` → `branches` untuk filter per company
3. **Employee bisa di multiple branches** — `employee_branches` adalah many-to-many
4. **Role bisa berbeda per cabang** — ambil role dari primary branch saja untuk display
5. **Hanya tampilkan active branches** — exclude closed/inactive
6. **Hanya tampilkan active assignments** — `eb.status = 'active'`
7. **Permission**: `canView('dashboard_hrd')` — sudah ada di `perm_modules`
8. **Caching**: React Query `staleTime: 10 * 60_000` (10 menit) — data HRD relatif statis

---

## 📊 Execution Order

| Phase | Task | Scope |
|-------|------|-------|
| 1 | Backend: repository (4 queries), controller, routes | Medium |
| 2 | Frontend: API hook + DashboardHrdPage rewrite | Medium |
| 3 | Testing | Kecil |
