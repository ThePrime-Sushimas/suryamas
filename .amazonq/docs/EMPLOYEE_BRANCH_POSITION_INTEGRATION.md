# Employee Branch & Position Integration (Opsi 2A)

## 📋 Overview

Implementasi **Opsi 2A**: Position per Branch dengan tetap support multi-position (cover).

**Konsep:**
- `employee_branches.position_id` → Posisi utama di cabang tersebut (Barista di Serpong, Server di Condet)
- `employee_positions` → Posisi tambahan yang bisa di-cover (global, berlaku di semua cabang)

**Tidak ada tabel yang tidak terpakai** — malah lebih powerful!

---

## ✅ Backend Changes (COMPLETED)

### 1. **Database Migration**
```sql
ALTER TABLE employee_branches 
ADD COLUMN position_id UUID REFERENCES positions(id);

CREATE INDEX idx_employee_branches_position 
ON employee_branches(position_id) 
WHERE position_id IS NOT NULL;
```

**Status**: ✅ Migration executed successfully

### 2. **Types Updated**
- `EmployeeBranchEntity` → tambah `position_id: string | null`
- `EmployeeBranchWithRelations` → tambah `position: { position_code, position_name, department_code, department_name } | null`
- `EmployeeBranchDto` → tambah `position_id`, `position_code`, `position_name`, `department_name`
- `CreateEmployeeBranchData` → tambah `position_id?: string | null`
- `UpdateEmployeeBranchData` → tambah `position_id?: string | null`
- `MyBranchDto` → tambah `position_id`, `position_name`, `department_name`

**File**: `backend/src/modules/employee_branches/employee_branches.types.ts`

### 3. **Schema Updated**
- `CreateEmployeeBranchSchema` → tambah `position_id: uuidSchema.optional().nullable()`
- `UpdateEmployeeBranchSchema` → tambah `position_id: uuidSchema.optional().nullable()`

**File**: `backend/src/modules/employee_branches/employee_branches.schema.ts`

### 4. **Repository Updated**
- `BASE_SELECT` → tambah `eb.position_id` dan position fields
- `BASE_FROM` → tambah `LEFT JOIN positions p ON p.id = eb.position_id` dan `LEFT JOIN departments d`
- `mapRow()` → tambah mapping untuk `positions` object
- `findByEmployeeAndBranch()` → include `position_id` di SELECT
- `update()` → include `position_id` di RETURNING

**File**: `backend/src/modules/employee_branches/employee_branches.repository.ts`

### 5. **Mapper Updated**
- `mapEmployeeBranch()` → tambah mapping `position` object dari row

**File**: `backend/src/modules/employee_branches/employee_branches.mapper.ts`

### 6. **Service Updated**
- `toDto()` → tambah `position_id`, `position_code`, `position_name`, `department_name`
- `getMyBranches()` → include position info di response
- `create()` → handle `position_id` dari input

**File**: `backend/src/modules/employee_branches/employee_branches.service.ts`

### 7. **Build Status**
✅ Backend compiled successfully (0 errors)

---

## 🎨 Frontend Changes (TODO)

### 1. **Update Types**
**File**: `frontend/src/features/employee_branches/api/types.ts`

```ts
export interface EmployeeBranch {
  id: string
  employee_id: string
  branch_id: string
  role_id: string
  position_id: string | null // NEW
  is_primary: boolean
  approval_limit: number
  status: 'active' | 'inactive' | 'suspended'
  employee_name: string
  branch_name: string
  branch_code: string
  role_name: string
  position_code: string | null // NEW
  position_name: string | null // NEW
  department_name: string | null // NEW
  created_at: string
}
```

### 2. **Update Form Component**
**File**: `frontend/src/features/employee_branches/components/BranchAssignmentModal.tsx`

Tambah dropdown **Position** di form:
```tsx
<div>
  <label>Position</label>
  <select name="position_id" value={formData.position_id || ''} onChange={handleChange}>
    <option value="">Tidak ada (Optional)</option>
    {positions.map(p => (
      <option key={p.id} value={p.id}>{p.position_name} ({p.department_name})</option>
    ))}
  </select>
</div>
```

### 3. **Update Display Component**
**File**: `frontend/src/features/employee_branches/components/EmployeeBranchDetailTable.tsx`

Tampilkan position info per branch:
```tsx
<div className="space-y-4">
  {branches.map(branch => (
    <div key={branch.id} className="border rounded-lg p-4">
      <h3>{branch.branch_name} {branch.is_primary && '(Primary)'}</h3>
      
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div>
          <p className="text-sm text-gray-500">Position</p>
          <p className="font-medium">
            {branch.position_name || '-'}
            {branch.department_name && ` (${branch.department_name})`}
          </p>
        </div>
        
        <div>
          <p className="text-sm text-gray-500">Role</p>
          <p className="font-medium">{branch.role_name}</p>
        </div>
      </div>
      
      <div className="mt-3 flex gap-2">
        <button onClick={() => handleEditPosition(branch)}>Ubah Posisi</button>
        <button onClick={() => handleEditRole(branch)}>Ubah Role</button>
      </div>
    </div>
  ))}
</div>
```

### 4. **Add Cover Positions Section**
**File**: `frontend/src/features/employee_branches/pages/EmployeeBranchDetailPage.tsx`

Tambah section untuk employee_positions (cover):
```tsx
<div className="mt-6 border-t pt-6">
  <h3>Posisi Tambahan (Cover)</h3>
  <p className="text-sm text-gray-500">
    Posisi yang dapat di-cover di semua cabang
  </p>
  
  <EmployeePositionsTab employeeId={employeeId} />
</div>
```

---

## 🚀 Use Cases

### Use Case 1: Employee dengan Position Berbeda per Cabang
```
Employee: John Doe
- Serpong: Barista (Primary) + Role Admin
- Condet: Server + Role User
- Cover: Cashier, Dishwasher (bisa cover di semua cabang)
```

**Data Structure:**
```
employee_branches:
- { employee_id: john, branch_id: serpong, position_id: barista, role_id: admin, is_primary: true }
- { employee_id: john, branch_id: condet, position_id: server, role_id: user, is_primary: false }

employee_positions:
- { employee_id: john, position_id: cashier, is_primary: false }
- { employee_id: john, position_id: dishwasher, is_primary: false }
```

### Use Case 2: WIP Access Control
```
WIP "Nasi Sushi" → wip_position_access → [Barista, Cook]

John Doe bisa produksi Nasi Sushi di:
- Serpong: ✅ (position = Barista)
- Condet: ❌ (position = Server, bukan Barista/Cook)
- Tapi jika John cover sebagai Cook → ✅ bisa di semua cabang
```

---

## 📊 API Response Example

### GET `/employees/:id/branches`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "employee_id": "john-uuid",
      "branch_id": "serpong-uuid",
      "role_id": "admin-uuid",
      "position_id": "barista-uuid",
      "is_primary": true,
      "approval_limit": 5000000,
      "status": "active",
      "employee_name": "John Doe",
      "branch_name": "Sushimas Serpong",
      "branch_code": "SRP",
      "role_name": "Admin",
      "position_code": "BARISTA",
      "position_name": "Barista",
      "department_name": "Bar",
      "created_at": "2026-01-08T10:00:00Z"
    },
    {
      "id": "uuid-2",
      "employee_id": "john-uuid",
      "branch_id": "condet-uuid",
      "role_id": "user-uuid",
      "position_id": "server-uuid",
      "is_primary": false,
      "approval_limit": 0,
      "status": "active",
      "employee_name": "John Doe",
      "branch_name": "Sushimas Condet",
      "branch_code": "CDT",
      "role_name": "User",
      "position_code": "SERVER",
      "position_name": "Server",
      "department_name": "Service",
      "created_at": "2026-01-08T11:00:00Z"
    }
  ]
}
```

---

## 🔑 Key Benefits

1. **Fleksibilitas Maksimal**
   - Employee bisa punya posisi berbeda per cabang
   - Tetap support multi-position (cover) global

2. **Tidak Ada Tabel yang Tidak Terpakai**
   - `employee_branches.position_id` → posisi utama per cabang
   - `employee_positions` → posisi cover (global)

3. **WIP Access Control Lebih Granular**
   - Bisa filter: "Barista di Serpong boleh produksi X"
   - Cover position tetap berlaku di semua cabang

4. **Backward Compatible**
   - `position_id` nullable → existing data tetap valid
   - Bisa diisi bertahap

---

## 📝 Next Steps

1. ✅ Backend migration & implementation (DONE)
2. ⏳ Frontend types update
3. ⏳ Frontend form update (tambah position dropdown)
4. ⏳ Frontend display update (tampilkan position per branch)
5. ⏳ Frontend cover positions section
6. ⏳ Testing & validation

---

## 📚 Related Docs

- Design: `.amazonq/docs/DEPARTMENT_POSITION_DESIGN.md`
- Frontend (Employee Positions): `.amazonq/docs/EMPLOYEE_POSITION_FRONTEND.md`
- Infrastructure: `.amazonq/docs/INFRASTRUCTURE.md`
