# Bulk Actions - Reusable Guide

Fitur bulk actions sudah dibuat reusable dan bisa diterapkan ke modul lain dengan mudah.

## 🎯 Komponen Reusable

### Frontend
- **`useBulkSelection`** - Hook untuk manage selection state
- **`BulkActionBar`** - Komponen untuk menampilkan bulk action buttons

### Backend
- **`bulk.util.ts`** - Utility functions untuk bulk update dan delete

## 📝 Cara Implementasi di Modul Baru

### 1. Frontend Setup

#### a. Import Hook dan Component
```tsx
import { useBulkSelection } from '../../hooks/useBulkSelection'
import BulkActionBar from '../../components/BulkActionBar'
```

#### b. Use Hook
```tsx
const { items } = useYourStore() // items harus punya property 'id'
const { 
  selectedIds, 
  selectAll, 
  selectOne, 
  clearSelection, 
  isSelected, 
  isAllSelected, 
  selectedCount 
} = useBulkSelection(items)
```

#### c. Define Bulk Actions
```tsx
const handleBulkAction = async () => {
  if (confirm(`Action on ${selectedCount} items?`)) {
    await yourStore.bulkAction(selectedIds)
    clearSelection()
  }
}
```

#### d. Add UI Components
```tsx
{/* Bulk Action Bar */}
<BulkActionBar
  selectedCount={selectedCount}
  actions={[
    { 
      label: 'Action 1', 
      onClick: handleAction1, 
      className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700' 
    },
    { 
      label: 'Action 2', 
      onClick: handleAction2, 
      className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700' 
    },
  ]}
/>

{/* Table Header Checkbox */}
<th>
  <input 
    type="checkbox" 
    checked={isAllSelected} 
    onChange={(e) => selectAll(e.target.checked)} 
  />
</th>

{/* Table Row Checkbox */}
<td>
  <input 
    type="checkbox" 
    checked={isSelected(item.id)} 
    onChange={(e) => selectOne(item.id, e.target.checked)} 
  />
</td>
```

### 2. Backend Setup

#### a. Repository Layer
```typescript
async bulkUpdate(ids: string[], data: any): Promise<void> {
  const { error } = await supabase
    .from('[table]')
    .update(data)
    .in('id', ids)
  if (error) throw new Error(error.message)
}

async bulkDelete(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('[table]')
    .delete()
    .in('id', ids)
  if (error) throw new Error(error.message)
}
```

#### b. Service Layer
```typescript
async bulkUpdate(ids: string[], data: any): Promise<void> {
  await [module]Repository.bulkUpdate(ids, data)
}

async bulkDelete(ids: string[]): Promise<void> {
  await [module]Repository.bulkDelete(ids)
}
```

#### c. Controller Layer
```typescript
import { handleBulkUpdate, handleBulkDelete } from '../../utils/bulk.util'

async bulkUpdate(req: AuthRequest, res: Response) {
  return handleBulkUpdate(
    req, 
    res, 
    (ids, data) => [module]Service.bulkUpdate(ids, data), 
    'update'
  )
}

async bulkDelete(req: AuthRequest, res: Response) {
  return handleBulkDelete(
    req, 
    res, 
    (ids) => [module]Service.bulkDelete(ids)
  )
}
```

#### d. Routes
```typescript
router.post('/bulk/update', authenticate, (req, res) => controller.bulkUpdate(req, res))
router.post('/bulk/delete', authenticate, (req, res) => controller.bulkDelete(req, res))
```

### 3. Store Setup (Frontend)

```typescript
interface YourState {
  items: YourType[]
  bulkUpdate: (ids: string[], data: any) => Promise<void>
  bulkDelete: (ids: string[]) => Promise<void>
}

export const useYourStore = create<YourState>((set) => ({
  items: [],
  
  bulkUpdate: async (ids, data) => {
    await api.post('/[module]/bulk/update', { ids, ...data })
    set((state) => ({
      items: state.items.map((item) => 
        ids.includes(item.id) ? { ...item, ...data } : item
      ),
    }))
  },
  
  bulkDelete: async (ids) => {
    await api.post('/[module]/bulk/delete', { ids })
    set((state) => ({
      items: state.items.filter((item) => !ids.includes(item.id)),
    }))
  },
}))
```

## ✅ Fitur yang Tersedia

### useBulkSelection Hook
- `selectedIds` - Array of selected IDs
- `selectAll(checked)` - Select/deselect all items
- `selectOne(id, checked)` - Select/deselect single item
- `clearSelection()` - Clear all selections
- `isSelected(id)` - Check if item is selected
- `isAllSelected` - Check if all items are selected
- `selectedCount` - Number of selected items

### BulkActionBar Component
Props:
- `selectedCount` - Number of selected items
- `actions` - Array of action objects:
  - `label` - Button text
  - `onClick` - Click handler
  - `className` - Optional custom styling

### Backend Utilities
- `handleBulkUpdate(req, res, updateFn, actionName)` - Generic bulk update handler
- `handleBulkDelete(req, res, deleteFn)` - Generic bulk delete handler

## 🎨 Customization

### Custom Actions
```tsx
<BulkActionBar
  selectedCount={selectedCount}
  actions={[
    { label: 'Archive', onClick: handleArchive },
    { label: 'Export', onClick: handleExport },
    { label: 'Assign', onClick: handleAssign },
  ]}
/>
```

### Custom Styling
```tsx
actions={[
  { 
    label: 'Danger Action', 
    onClick: handleDanger,
    className: 'px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700'
  }
]}
```

### Conditional Actions
```tsx
const actions = [
  { label: 'Edit', onClick: handleEdit },
  ...(hasPermission ? [{ label: 'Delete', onClick: handleDelete }] : []),
]
```

## 📊 Example: Products Module

```tsx
// Frontend
const { products, bulkUpdateStatus, bulkDelete } = useProductStore()
const { selectedIds, selectAll, selectOne, clearSelection, isSelected, isAllSelected, selectedCount } = useBulkSelection(products)

const handleBulkPublish = async () => {
  if (confirm(`Publish ${selectedCount} products?`)) {
    await bulkUpdateStatus(selectedIds, { status: 'published' })
    clearSelection()
  }
}

<BulkActionBar
  selectedCount={selectedCount}
  actions={[
    { label: 'Publish', onClick: handleBulkPublish },
    { label: 'Unpublish', onClick: handleBulkUnpublish },
    { label: 'Delete', onClick: handleBulkDelete },
  ]}
/>
```

## 🚀 Ready to Use!

Semua komponen sudah siap pakai. Tinggal:
1. Import hook dan component
2. Define bulk action handlers
3. Add checkboxes ke table
4. Add BulkActionBar
5. Implement backend endpoints

Pattern yang sama bisa digunakan untuk semua modul!
