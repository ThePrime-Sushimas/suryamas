# TODO: Fix Accounting Purpose Accounts Module

## Critical Issues to Fix

### 1. Empty Validation Logic in service.ts
- [x] Fix `validateBalanceSide` to throw errors for invalid combinations
- [x] Add contra-account support (special cases)

### 2. Missing Company Validation in service.ts
- [x] Add `validatePurposeExists` method
- [x] Add `validateAccountExists` method
- [x] Add company validation in `create` method

### 3. Transaction Handling in repository.ts
- [x] Improve transaction context type safety
- [x] Add proper error handling for transactions

### 4. Inconsistent Error Handling in controller.ts
- [x] Remove duplicate error handling patterns
- [x] Use consistent `handleError` approach

## Files to Modify
1. [x] `backend/src/modules/accounting/accounting-purpose-accounts/accounting-purpose-accounts.service.ts`
2. [x] `backend/src/modules/accounting/accounting-purpose-accounts/accounting-purpose-accounts.repository.ts`
3. [x] `backend/src/modules/accounting/accounting-purpose-accounts/accounting-purpose-accounts.controller.ts`

## Status
- [x] Start fixing
- [x] Fix validateBalanceSide
- [x] Add company validation
- [x] Fix transaction handling
- [x] Fix error handling
- [ ] Verify all tests pass

