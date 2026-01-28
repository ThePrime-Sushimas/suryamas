# 📋 Rencana Upgrade Tampilan Bank Statement Import

## 📊 Analisis Kode Existing
- **BankStatementImportPage.tsx** - Halaman utama dengan layout dasar
- **BankStatementImportTable.tsx** - Tabel data dengan styling standar
- **UploadModal.tsx** - Modal upload dengan validasi dasar
- **AnalysisModal.tsx** - Modal analisis dengan statistics
- **ImportProgress.tsx** - Progress indicator
- **Store** - Zustand store sudah lengkap

## 🎯 Pattern yang Harus Diikuti (dari journal-headers)
- Header dengan title dan subtitle
- Filter dengan search, quick filters, dan expand
- Table dengan sorting icons dan hover effects
- Status badges dengan icons
- Empty states dengan illustrations
- Loading states dengan skeletons
- Pagination yang jelas

## 📝 Langkah Implementasi

### Step 1: Update Constants
- [ ] Tambahkan status labels dan colors yang lebih lengkap
- [ ] Export constants untuk digunakan di components

### Step 2: Create Status Badge Component
- [ ] Buat `BankStatementImportStatusBadge.tsx`
- [ ] Dengan icons sesuai status

### Step 3: Create Filters Component
- [ ] Buat `BankStatementImportFilters.tsx`
- [ ] Search input dengan icon
- [ ] Quick filters (Hari Ini, Minggu Ini, Bulan Ini)
- [ ] Expandable filter section
- [ ] Status dropdown

### Step 4: Update Table Component
- [ ] Tambahkan sortable columns dengan icons
- [ ] Row hover effects
- [ ] Better empty state
- [ ] Action buttons dengan icons

### Step 5: Update UploadModal
- [ ] Drag & drop zone
- [ ] Bank account dropdown dengan search
- [ ] Better file validation UI
- [ ] Progress bar yang lebih baik

### Step 6: Update AnalysisModal
- [ ] Statistics cards yang lebih baik
- [ ] Progress环形指示器
- [ ] Better warning alerts

### Step 7: Update ImportProgress
- [ ] Animated progress bar
- [ ] ETA calculation
- [ ] Cancel option

### Step 8: Update Page Layout
- [ ] Header section dengan title/subtitle
- [ ] Error message display
- [ ] Loading skeleton
- [ ] Empty states dengan illustrations
- [ ] Better pagination

## 🎨 Design Decisions

### Colors
- Background: `bg-gray-50 dark:bg-gray-900`
- Cards: `bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700`
- Primary: `bg-blue-600`
- Text: `text-gray-900 dark:text-white`

### Icons (lucide-react)
- Upload: `Upload`
- Search: `Search`
- Filter: `Filter`
- Table actions: `Eye, Trash2, RotateCcw`

### Status Colors
- PENDING: `orange`
- ANALYZED: `blue`
- IMPORTING: `yellow`
- COMPLETED: `green`
- FAILED: `red`

## ✅ Implementasi Dimulai

