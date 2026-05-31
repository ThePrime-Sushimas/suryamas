# Implementation Plan: DPO Station Filter

## Overview

Add a mandatory station filter to the DPO generation flow. The implementation spans a database migration, backend DTO/schema/repository/service changes, and frontend multi-select UI in the generate modal plus display in the detail page.

## Tasks

- [x] 1. Database migration and backend type/schema changes
  - [x] 1.1 Create database migration to add `station_codes` column
    - Create a new migration file `backend/database/migrations/YYYYMMDD000000_dpo_station_codes.sql`
    - Add `station_codes TEXT[] NOT NULL DEFAULT '{}'` to `daily_prep_orders` table
    - Add column comment for documentation
    - _Requirements: 5.1_

  - [x] 1.2 Extend `GenerateDpoDto` and `DailyPrepOrder` interfaces in `daily-prep-orders.types.ts`
    - Add `station_codes: string[]` to `GenerateDpoDto`
    - Add `station_codes: string[]` to `DailyPrepOrder`
    - _Requirements: 3.1_

  - [x] 1.3 Extend `generateDpoSchema` in `daily-prep-orders.schema.ts`
    - Add `station_codes: z.array(z.string().min(1)).min(1, 'Minimal 1 station harus dipilih')` to the body schema
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Backend repository and service changes
  - [x] 2.1 Add station filter to `calcForecastLines` in `daily-prep-orders.repository.ts`
    - Add `stationCodes: string[]` parameter to the method signature (becomes $7)
    - In `daily_direct` CTE: add `AND p.station = ANY($7::text[])` to the existing WHERE clause (products JOIN already exists)
    - In `daily_wip` CTE: add `AND p.station = ANY($7::text[])` to the existing WHERE clause (products JOIN already exists)
    - Add `stationCodes` to the query parameter array as the 7th element
    - Current params: [$1=branchPosId, $2=longDays, $3=shortDays, $4=prepDate, $5=targetWarehouseId, $6=sourceWarehouseId] → add $7=stationCodes
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.2 Store `station_codes` in `createWithLines` in `daily-prep-orders.repository.ts`
    - Add `station_codes` to the INSERT column list
    - Add `dto.station_codes` to the parameter array
    - Adjust parameter indices accordingly
    - _Requirements: 5.1_

  - [x] 2.3 Pass `station_codes` through the service `generate` method in `daily-prep-orders.service.ts`
    - Pass `dto.station_codes` as the new parameter to `calcForecastLines`
    - _Requirements: 4.1, 4.3_

  - [x]* 2.4 Write property test: Station codes validation (Property 1)
    - **Property 1: Station codes validation accepts valid inputs and rejects invalid**
    - Generate random arrays of non-empty strings and verify schema accepts them
    - Generate empty arrays, missing fields, arrays with empty strings and verify schema rejects
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x]* 2.5 Write property test: Station filter returns exactly matching products (Property 2)
    - **Property 2: Station filter returns exactly matching products**
    - For any set of products with assigned stations and any non-empty subset of station codes, verify the SQL filter returns exactly matching products
    - Verify products with NULL/empty station are excluded
    - **Validates: Requirements 4.1, 4.2, 6.1**

  - [x]* 2.6 Write property test: Station codes persistence round-trip (Property 3)
    - **Property 3: Station codes persistence round-trip**
    - For any valid station_codes array provided during generation, verify the stored DPO header returns the same array
    - **Validates: Requirements 5.1**

- [x] 3. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend station selection UI
  - [x] 4.1 Add multi-select station dropdown to `DpoGenerateModal.tsx`
    - Import `usePositions` hook from `@/features/settings/api/settings.api`
    - Add `stationCodes` state as `string[]`
    - Filter positions to only active ones
    - Render a multi-select dropdown with checkboxes showing position names
    - Display selected stations as tags/chips
    - Allow deselecting all stations (do NOT prevent last deselect) — instead disable Generate button when empty
    - Mark the field as mandatory with a required indicator
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.2 Add station validation and include `station_codes` in the generate API call
    - Add validation check: if `stationCodes.length === 0`, show toast error and return early
    - Include `station_codes: stationCodes` in the `generateDpo.mutateAsync` payload
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.3 Display station codes on DPO detail page (`DailyPrepOrderDetailPage.tsx`)
    - Fetch positions data using `usePositions` hook
    - Map `dpo.station_codes` to position names
    - Display station names in the DPO header info section
    - For DPO lama (station_codes empty/undefined), show fallback text: "Semua station (sebelum filter)"
    - _Requirements: 5.2, 6.2_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The `usePositions` hook already exists in the codebase — no new API endpoint needed
- Products with NULL/empty station will be excluded by the SQL filter (PostgreSQL `NULL = ANY(...)` evaluates to NULL/falsy)
- The existing `station` field in `DailyPrepOrderLineWithRelations` already provides per-line station display (Requirement 6.2)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5", "2.6"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3"] }
  ]
}
```
