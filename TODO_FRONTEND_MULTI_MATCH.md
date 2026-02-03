# TODO: Frontend Multi-Match Feature Implementation

## 📋 Overview
Implementasi frontend untuk custom multi-match feature (1 POS Aggregate = N Bank Statements)

---

## Day 1: Setup & Infrastructure (Sudah Ada)

- [x] ~~Custom hook `useBankReconciliation` - SUDAH ADA dengan method multi-match~~
- [x] ~~API functions - SUDAH ADA (`createMultiMatch`, `undoMultiMatch`, dll)~~
- [x] ~~Types definitions - SUDAH ADA (`ReconciliationGroup`, `MultiMatchSuggestion`, dll)~~

## Day 2: BankMutationTable Updates ✅ DONE

- [x] Update `BankMutationTable.tsx`:
  - [x] Tambah checkbox column untuk multi-select
  - [x] Tambah state `selectedStatementIds`
  - [x] Tambah mode selection toggle
  - [x] Tambah "Select All" functionality
  - [x] Tambah "Multi-Match" button di header
  - [x] Tambah indicator jika statement sudah dalam group
  - [x] Highlight rows yang selected

## Day 3: MultiMatchModal Updates ✅ DONE

- [x] Update `MultiMatchModal.tsx`:
  - [x] Accept `initialStatements` prop
  - [x] Load suggestions untuk selected statements
  - [x] Auto-select statements yang di-pass dari parent
  - [x] Handle both single aggregate & multiple statements
  - [x] Tambah mode untuk statements-first (select statements dulu, baru cari aggregate)

## Day 4: BankReconciliationPage Integration ✅ DONE

- [x] Update `BankReconciliationPage.tsx`:
  - [x] Import MultiMatchModal
  - [x] Import MultiMatchGroupList
  - [x] Tambah state: `isMultiMatchModalOpen`, `multiMatchMode`, `showGroupList`
  - [x] Handle `onMultiMatch` dari table → open modal
  - [x] Handle `onConfirm` dari modal → create match & refresh
  - [x] Tambah sidebar untuk Group List (collapsible)
  - [x] Layout 2-column: Main content + Sidebar

## Day 5: MultiMatchGroupList Component ✅ DONE

- [x] Create `MultiMatchGroupList.tsx`:
  - [x] List semua reconciliation groups
  - [x] Expand/collapse untuk lihat detail statements
  - [x] Tampilkan aggregate info
  - [x] Tampilkan statements list
  - [x] Tampilkan notes & audit trail
  - [x] Tombol "Undo" per group
  - [x] Loading states
  - [x] Empty state message

## Day 6: Testing & Polish

- [ ] Functional Testing:
  - [ ] Single statement selection works
  - [ ] Multi-statement selection works
  - [ ] "Select All" checkbox works
  - [ ] Multi-match button enabled/disabled correctly
  - [ ] Modal opens with selected data
  - [ ] Suggestions load correctly
  - [ ] Difference validation works
  - [ ] Confirm creates reconciliation group
  - [ ] Groups list updates after create
  - [ ] Undo functionality works
  - [ ] Refresh maintains state

- [ ] UI/UX Testing:
  - [ ] Responsive on mobile/tablet
  - [ ] Loading states show correctly
  - [ ] Error messages are clear
  - [ ] Success feedback is visible
  - [ ] Keyboard navigation works
  - [ ] Modal closes on ESC/outside click

## Day 5: MultiMatchGroupList Component

- [ ] Create `MultiMatchGroupList.tsx`:
  - [ ] List semua reconciliation groups
  - [ ] Expand/collapse untuk lihat detail statements
  - [ ] Tampilkan aggregate info
  - [ ] Tampilkan statements list
  - [ ] Tampilkan notes & audit trail
  - [ ] Tombol "Undo" per group
  - [ ] Loading states
  - [ ] Empty state message

## Day 6: Testing & Polish

- [ ] Functional Testing:
  - [ ] Single statement selection works
  - [ ] Multi-statement selection works
  - [ ] "Select All" checkbox works
  - [ ] Multi-match button enabled/disabled correctly
  - [ ] Modal opens with selected data
  - [ ] Suggestions load correctly
  - [ ] Difference validation works
  - [ ] Confirm creates reconciliation group
  - [ ] Groups list updates after create
  - [ ] Undo functionality works
  - [ ] Refresh maintains state

- [ ] UI/UX Testing:
  - [ ] Responsive on mobile/tablet
  - [ ] Loading states show correctly
  - [ ] Error messages are clear
  - [ ] Success feedback is visible
  - [ ] Keyboard navigation works
  - [ ] Modal closes on ESC/outside click

## 📦 Files Status

| File | Status | Action |
|------|--------|--------|
| `types/bank-reconciliation.types.ts` | ✅ Ada | - |
| `api/bank-reconciliation.api.ts` | ✅ Ada | - |
| `hooks/useBankReconciliation.ts` | ✅ Ada | - |
| `components/reconciliation/MultiMatchModal.tsx` | ✅ Ada | Update |
| `components/reconciliation/BankMutationTable.tsx` | ✅ Ada | Update |
| `components/reconciliation/ManualMatchModal.tsx` | ✅ Ada | - |
| `pages/BankReconciliationPage.tsx` | ✅ Ada | Update |
| `components/reconciliation/MultiMatchGroupList.tsx` | ❌ Baru | Create |

---

## 🚀 Quick Start Commands

```bash
# Navigate ke frontend
cd frontend

# Install dependencies (jika perlu)
npm install

# Start development server
npm run dev
```

---

## 📝 Notes

- Backend sudah fully implemented (bisa dicek di MULTI_MATCH_FEATURE_PLAN.md section 14)
- API endpoints sudah tersedia
- Types dan API functions sudah diimplementasi
- Fokus ke UI/UX components dan integration

