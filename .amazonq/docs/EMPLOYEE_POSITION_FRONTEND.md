# Employee Position Management - Frontend Implementation

## 📋 Overview

Frontend untuk Department & Position Management sudah **LENGKAP** dan terintegrasi dengan backend.

---

## ✅ Fitur yang Sudah Ada

### 1. **Settings Pages** (`/settings/*`)

#### Departments Page (`/settings/departments`)
- ✅ List departments dengan position count
- ✅ Create department (code, name, sort_order)
- ✅ Update department (name, sort_order, is_active)
- ✅ Delete department (dengan validasi hasChildren)
- ✅ Inline form untuk create/edit

**File**: `frontend/src/features/settings/pages/DepartmentsPage.tsx`

#### Positions Page (`/settings/positions`)
- ✅ List positions dengan filter by department
- ✅ Create position (department, code, name, can_access_all_wip, sort_order)
- ✅ Update position (department, name, bypass flag, sort_order, is_active)
- ✅ Delete position (dengan validasi hasChildren)
- ✅ Badge untuk `can_access_all_wip` (Shield icon)
- ✅ Inline form untuk create/edit

**File**: `frontend/src/features/settings/pages/PositionsPage.tsx`

---

### 2. **Employee Create Flow** (`/employees/create`)

#### Perubahan:
- ✅ Field `job_position` (text input) **DIGANTI** dengan dropdown `position_id` (required)
- ✅ Dropdown menampilkan: `{position_name} ({department_name})`
- ✅ Backend auto-insert ke `employee_positions` dengan `is_primary = true`

**File**: 
- `frontend/src/features/employees/components/EmployeeForm.tsx`
- `frontend/src/features/employees/pages/CreateEmployeePage.tsx`

**Props baru**:
```tsx
<EmployeeForm mode="create" ... />
```

---

### 3. **Employee Edit Flow** (`/employees/edit/:id`)

#### Perubahan:
- ✅ Tambah **Tab Navigation**: "Informasi Dasar" | "Posisi"
- ✅ Tab "Informasi Dasar": form employee (field `job_position` tetap ada untuk backward compat, tapi di-hide dari UI saat mode edit)
- ✅ Tab "Posisi": `EmployeePositionsTab` component

**File**: `frontend/src/features/employees/pages/EditEmployeePage.tsx`

---

### 4. **Employee Positions Tab** (Manage Positions)

Komponen untuk assign/remove/set primary position di halaman edit employee.

**Fitur**:
- ✅ List positions yang di-assign (badge primary, department name)
- ✅ Tambah position (dropdown positions yang belum di-assign)
- ✅ Set primary position (button per position)
- ✅ Hapus position (dengan confirm modal)
- ✅ Validasi: minimal 1 primary position wajib

**File**: `frontend/src/features/employees/components/EmployeePositionsTab.tsx`

**Lokasi**:
- `/employees/edit/:id` → Tab "Posisi"
- `/employees/:id` (detail page) → Tab "Positions"

---

### 5. **Employee Detail Page** (`/employees/:id`)

- ✅ Tab "Positions" sudah ada (menggunakan `EmployeePositionsTab`)
- ✅ Menampilkan semua positions yang di-assign
- ✅ Bisa manage positions langsung dari detail page

**File**: `frontend/src/features/employees/pages/EmployeeDetailPage.tsx`

---

## 🔧 API Hooks

**File**: `frontend/src/features/settings/api/settings.api.ts`

### Departments
```ts
useDepartments()
useCreateDepartment()
useUpdateDepartment()
useDeleteDepartment()
```

### Positions
```ts
usePositions(departmentId?: string)
useCreatePosition()
useUpdatePosition()
useDeletePosition()
```

### Employee Positions
```ts
useEmployeePositions(employeeId: string)
useAssignPosition()
useRemovePosition()
useSetPrimaryPosition()
```

---

## 🎨 UI/UX

### Design Patterns
- **Inline Form**: Create/edit form muncul di atas table (tidak redirect ke halaman baru)
- **Dropdown Filter**: Filter positions by department
- **Badge**: Primary position (amber), WIP bypass (shield icon)
- **Confirm Modal**: Sebelum delete department/position/employee position
- **Toast Notification**: Success/error feedback

### Color Scheme
- **Departments**: Blue (`bg-blue-600`)
- **Positions**: Purple (`bg-purple-600`)
- **Primary Badge**: Amber (`bg-amber-100 text-amber-700`)
- **WIP Bypass**: Emerald (`text-emerald-500`)

---

## 📡 Backend Integration

### Schema Changes

#### `employees.schema.ts`
```ts
CreateEmployeeSchema = z.object({
  body: z.object({
    ...
    position_id: uuidSchema.optional(), // NEW
    ...
  })
})
```

#### `employees.types.ts`
```ts
export interface EmployeeCreatePayload {
  ...
  position_id?: string // NEW
  ...
}
```

### Service Changes

#### `employees.service.ts`
```ts
async create(payload: EmployeeCreatePayload, ...) {
  const { position_id, ...employeeData } = payload
  
  const employee = await employeesRepository.create(employeeData)
  
  // Auto-assign position if provided
  if (position_id) {
    await employeePositionsRepository.assign(
      employee.id, 
      position_id, 
      true, // is_primary
      userId
    )
  }
  
  return employee
}
```

---

## 🚀 Flow Lengkap

### Create Employee
1. User buka `/employees/create`
2. Form tampil dengan dropdown "Position" (required)
3. User pilih position dari dropdown
4. Submit → backend create employee + auto-assign position dengan `is_primary = true`
5. Redirect ke `/employees`

### Edit Employee - Manage Positions
1. User buka `/employees/edit/:id`
2. Klik tab "Posisi"
3. List positions yang sudah di-assign tampil
4. User bisa:
   - Tambah position baru (dropdown)
   - Set primary position (button)
   - Hapus position (button + confirm)
5. Setiap action langsung update via API

### View Employee Detail
1. User buka `/employees/:id`
2. Klik tab "Positions"
3. Sama seperti edit, tapi dalam context detail page

---

## 🔐 Permission

Menu departments & positions sudah terdaftar di sidebar dengan module permission:
- `departments` → `/settings/departments`
- `positions` → `/settings/positions`

---

## 📝 Notes

1. **Backward Compatibility**: Field `job_position` tetap ada di database dan form edit (mode edit), tapi di-hide dari UI create form karena sudah diganti dengan dropdown position.

2. **Validation**: 
   - Create employee: `position_id` optional di schema (untuk backward compat), tapi di UI dropdown required
   - Employee tidak boleh tanpa position (minimal 1 primary)

3. **Primary Position Logic**:
   - Saat assign position pertama → otomatis `is_primary = true`
   - Saat set primary → position lain otomatis jadi non-primary
   - Tidak bisa hapus primary position terakhir

4. **WIP Access**: Position dengan `can_access_all_wip = true` akan bypass filter WIP di production order form (implementasi di modul food-production).

---

## 🎯 Next Steps (Optional)

1. **Migration**: Setelah semua verified, bisa drop kolom `employees.job_position` dari database
2. **WIP Filter**: Implementasi filter WIP by position di production order form
3. **Reporting**: Tambah report employee by position/department

---

## 📚 Related Docs

- Backend Design: `.amazonq/docs/DEPARTMENT_POSITION_DESIGN.md`
- Infrastructure: `.amazonq/docs/INFRASTRUCTURE.md`
- Dev Status: `.amazonq/docs/DEV_STATUS.md`
