# Audit Log Implementation Strategy

## 🎯 Recommended Approach: Hybrid (Infrastructure First, Then Per-Module)

---

## Phase 1: Setup Audit Infrastructure First (Week 1)

### Step 1.1: Create Base Audit Log Schema

```sql
-- migrations/001_create_audit_logs_table.sql

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Context
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  
  -- What happened
  entity_type VARCHAR(50) NOT NULL,  -- 'payment_method', 'reconciliation', 'bank_statement'
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,       -- 'CREATED', 'UPDATED', 'DELETED', 'APPROVED', 'REJECTED'
  
  -- Details
  old_values JSONB,
  new_values JSONB,
  changes JSONB,                     -- Computed diff
  
  -- Metadata
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_id VARCHAR(100),
  
  -- Additional context
  notes TEXT,
  metadata JSONB,                    -- Flexible for module-specific data
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Composite index for common queries
CREATE INDEX idx_audit_logs_entity_date ON audit_logs(entity_type, entity_id, created_at DESC);

-- Partitioning by date (optional, for large scale)
-- CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Step 1.2: Create Base Audit Service

```typescript
// src/modules/audit/audit.service.ts

import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from './audit-log.entity'

interface AuditLogInput {
  companyId: string
  userId?: string
  entityType: string
  entityId: string
  action: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  notes?: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>
  ) {}

  /**
   * Create audit log entry
   */
  async log(input: AuditLogInput): Promise<AuditLog> {
    // Calculate changes (diff between old and new)
    const changes = this.calculateChanges(input.oldValues, input.newValues)

    return this.auditLogRepository.save({
      company_id: input.companyId,
      user_id: input.userId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      old_values: input.oldValues,
      new_values: input.newValues,
      changes,
      notes: input.notes,
      metadata: input.metadata,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      request_id: input.requestId
    })
  }

  /**
   * Query audit logs
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    options?: {
      limit?: number
      offset?: number
      startDate?: Date
      endDate?: Date
    }
  ): Promise<AuditLog[]> {
    const query = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.entity_type = :entityType', { entityType })
      .andWhere('audit.entity_id = :entityId', { entityId })
      .orderBy('audit.created_at', 'DESC')

    if (options?.startDate) {
      query.andWhere('audit.created_at >= :startDate', { startDate: options.startDate })
    }

    if (options?.endDate) {
      query.andWhere('audit.created_at <= :endDate', { endDate: options.endDate })
    }

    if (options?.limit) {
      query.limit(options.limit)
    }

    if (options?.offset) {
      query.offset(options.offset)
    }

    return query.getMany()
  }

  /**
   * Query audit logs by user
   */
  async findByUser(
    userId: string,
    options?: {
      limit?: number
      entityType?: string
      action?: string
    }
  ): Promise<AuditLog[]> {
    const query = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.user_id = :userId', { userId })
      .orderBy('audit.created_at', 'DESC')

    if (options?.entityType) {
      query.andWhere('audit.entity_type = :entityType', { entityType: options.entityType })
    }

    if (options?.action) {
      query.andWhere('audit.action = :action', { action: options.action })
    }

    if (options?.limit) {
      query.limit(options.limit)
    }

    return query.getMany()
  }

  /**
   * Get audit trail for a specific entity
   */
  async getAuditTrail(
    entityType: string,
    entityId: string
  ): Promise<{
    entity: { type: string; id: string }
    timeline: Array<{
      timestamp: Date
      action: string
      userId?: string
      userName?: string
      changes: Record<string, any>
      notes?: string
    }>
  }> {
    const logs = await this.findByEntity(entityType, entityId)

    return {
      entity: { type: entityType, id: entityId },
      timeline: logs.map(log => ({
        timestamp: log.created_at,
        action: log.action,
        userId: log.user_id,
        userName: log.metadata?.userName,
        changes: log.changes,
        notes: log.notes
      }))
    }
  }

  /**
   * Calculate diff between old and new values
   */
  private calculateChanges(
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Record<string, any> {
    if (!oldValues || !newValues) {
      return {}
    }

    const changes: Record<string, any> = {}

    // Check for changed and added fields
    for (const key in newValues) {
      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        changes[key] = {
          from: oldValues[key],
          to: newValues[key]
        }
      }
    }

    // Check for deleted fields
    for (const key in oldValues) {
      if (!(key in newValues)) {
        changes[key] = {
          from: oldValues[key],
          to: null
        }
      }
    }

    return changes
  }

  /**
   * Bulk log (for batch operations)
   */
  async logBatch(inputs: AuditLogInput[]): Promise<AuditLog[]> {
    const entries = inputs.map(input => ({
      company_id: input.companyId,
      user_id: input.userId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      old_values: input.oldValues,
      new_values: input.newValues,
      changes: this.calculateChanges(input.oldValues, input.newValues),
      notes: input.notes,
      metadata: input.metadata,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      request_id: input.requestId
    }))

    return this.auditLogRepository.save(entries)
  }
}
```

### Step 1.3: Create Audit Decorator (Optional but Recommended)

```typescript
// src/modules/audit/decorators/audit.decorator.ts

import { SetMetadata } from '@nestjs/common'

export const AUDIT_METADATA_KEY = 'audit'

export interface AuditMetadata {
  entityType: string
  action: string
  includeRequestContext?: boolean
}

export const Audit = (metadata: AuditMetadata) => 
  SetMetadata(AUDIT_METADATA_KEY, metadata)
```

### Step 1.4: Create Audit Interceptor (Optional)

```typescript
// src/modules/audit/interceptors/audit.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { AuditService } from '../audit.service'
import { AUDIT_METADATA_KEY, AuditMetadata } from '../decorators/audit.decorator'

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMetadata = this.reflector.get<AuditMetadata>(
      AUDIT_METADATA_KEY,
      context.getHandler()
    )

    if (!auditMetadata) {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest()
    const { user, ip, headers } = request

    return next.handle().pipe(
      tap(async (result) => {
        // Log successful operations
        await this.auditService.log({
          companyId: user?.companyId,
          userId: user?.id,
          entityType: auditMetadata.entityType,
          entityId: result?.id,
          action: auditMetadata.action,
          newValues: result,
          ipAddress: auditMetadata.includeRequestContext ? ip : undefined,
          userAgent: auditMetadata.includeRequestContext ? headers['user-agent'] : undefined,
          requestId: request.id
        })
      })
    )
  }
}
```

---

## Phase 2: Implement Per-Module (Incremental)

### Module 1: Payment Methods (Week 2)

```typescript
// payment-methods/payment-methods.service.ts

import { AuditService } from '../audit/audit.service'

@Injectable()
export class PaymentMethodsService {
  constructor(
    private auditService: AuditService
  ) {}

  async create(dto: CreatePaymentMethodDto, userId: string) {
    // Create payment method
    const paymentMethod = await this.repository.save(dto)

    // Audit log
    await this.auditService.log({
      companyId: dto.company_id,
      userId,
      entityType: 'payment_method',
      entityId: paymentMethod.id,
      action: 'CREATED',
      newValues: paymentMethod,
      metadata: {
        moduleName: 'payment-methods'
      }
    })

    return paymentMethod
  }

  async update(id: string, dto: UpdatePaymentMethodDto, userId: string) {
    // Get old values
    const oldPaymentMethod = await this.findOne(id)

    // Update
    await this.repository.update(id, dto)
    const newPaymentMethod = await this.findOne(id)

    // Audit log
    await this.auditService.log({
      companyId: oldPaymentMethod.company_id,
      userId,
      entityType: 'payment_method',
      entityId: id,
      action: 'UPDATED',
      oldValues: oldPaymentMethod,
      newValues: newPaymentMethod,
      metadata: {
        moduleName: 'payment-methods',
        fieldsUpdated: Object.keys(dto)
      }
    })

    return newPaymentMethod
  }

  async delete(id: string, userId: string) {
    const paymentMethod = await this.findOne(id)

    await this.repository.softDelete(id)

    // Audit log
    await this.auditService.log({
      companyId: paymentMethod.company_id,
      userId,
      entityType: 'payment_method',
      entityId: id,
      action: 'DELETED',
      oldValues: paymentMethod,
      metadata: {
        moduleName: 'payment-methods'
      }
    })
  }
}
```

### Module 2: Fee Reconciliation (Week 3)

```typescript
// fee-reconciliation/fee-reconciliation.service.ts

async approveMarketingFee(
  reconciliationId: string,
  userId: string,
  data: { notes?: string; category?: string }
) {
  const oldReconciliation = await this.findOne(reconciliationId)

  // Update status
  const newReconciliation = await this.repository.save({
    ...oldReconciliation,
    status: 'APPROVED',
    approved_by: userId,
    approved_at: new Date(),
    marketing_fee_category: data.category
  })

  // Audit log
  await this.auditService.log({
    companyId: oldReconciliation.company_id,
    userId,
    entityType: 'reconciliation',
    entityId: reconciliationId,
    action: 'APPROVED',
    oldValues: { 
      status: oldReconciliation.status,
      marketing_fee: oldReconciliation.marketing_fee 
    },
    newValues: { 
      status: 'APPROVED',
      marketing_fee: newReconciliation.marketing_fee,
      approved_by: userId,
      approved_at: new Date()
    },
    notes: data.notes,
    metadata: {
      moduleName: 'fee-reconciliation',
      category: data.category,
      marketingFeeAmount: newReconciliation.marketing_fee
    }
  })

  return newReconciliation
}

async rejectMarketingFee(
  reconciliationId: string,
  userId: string,
  reason: string
) {
  const oldReconciliation = await this.findOne(reconciliationId)

  const newReconciliation = await this.repository.save({
    ...oldReconciliation,
    status: 'REJECTED',
    rejected_by: userId,
    rejected_at: new Date()
  })

  // Audit log
  await this.auditService.log({
    companyId: oldReconciliation.company_id,
    userId,
    entityType: 'reconciliation',
    entityId: reconciliationId,
    action: 'REJECTED',
    oldValues: { status: oldReconciliation.status },
    newValues: { 
      status: 'REJECTED',
      rejected_by: userId,
      rejected_at: new Date()
    },
    notes: reason,
    metadata: {
      moduleName: 'fee-reconciliation',
      marketingFeeAmount: oldReconciliation.marketing_fee
    }
  })

  return newReconciliation
}
```

### Module 3: Bank Statements (Week 4)

```typescript
// bank-statements/bank-statements.service.ts

async importStatements(
  file: Express.Multer.File,
  companyId: string,
  userId: string
) {
  // Parse file
  const statements = await this.parseFile(file)

  // Bulk insert
  const inserted = await this.repository.save(statements)

  // Bulk audit log
  await this.auditService.logBatch(
    inserted.map(stmt => ({
      companyId,
      userId,
      entityType: 'bank_statement',
      entityId: stmt.id,
      action: 'IMPORTED',
      newValues: stmt,
      metadata: {
        moduleName: 'bank-statements',
        importSource: 'FILE_UPLOAD',
        fileName: file.originalname,
        recordCount: inserted.length
      }
    }))
  )

  return {
    success: true,
    count: inserted.length,
    statements: inserted
  }
}
```

---

## Phase 3: Add Audit Queries & Reports (Week 5)

### Audit History Endpoint

```typescript
// audit/audit.controller.ts

@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('entity/:entityType/:entityId')
  async getEntityAuditTrail(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string
  ) {
    return this.auditService.getAuditTrail(entityType, entityId)
  }

  @Get('user/:userId')
  async getUserActivity(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('entityType') entityType?: string
  ) {
    return this.auditService.findByUser(userId, { limit, entityType })
  }

  @Get('reports/activity')
  async getActivityReport(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Query('companyId') companyId: string
  ) {
    return this.auditService.generateActivityReport(
      companyId,
      startDate,
      endDate
    )
  }
}
```

---

## 📊 What to Audit Per Module

### Critical Actions (MUST Audit)

| Module | Actions to Audit |
|--------|------------------|
| **Payment Methods** | CREATE, UPDATE, DELETE, FEE_CONFIG_CHANGE |
| **Reconciliation** | APPROVE, REJECT, MANUAL_ADJUSTMENT, RECALCULATE |
| **Bank Statements** | IMPORT, CATEGORIZE, MATCH, UNMATCH |
| **Users** | LOGIN, LOGOUT, PERMISSION_CHANGE, PASSWORD_RESET |
| **Companies** | CREATE, UPDATE, SETTINGS_CHANGE |

### Fields to Track (What Changed)

```typescript
// Example: Payment Method
{
  entityType: 'payment_method',
  oldValues: {
    fee_percentage: 20,
    fee_fixed_amount: 500,
    fee_fixed_per_transaction: true
  },
  newValues: {
    fee_percentage: 25,  // Changed!
    fee_fixed_amount: 500,
    fee_fixed_per_transaction: true
  },
  changes: {
    fee_percentage: { from: 20, to: 25 }
  }
}
```

---

## ⚙️ Configuration Options

### Option 1: Audit Everything (Paranoid Mode)
```typescript
// Good for: Financial systems, compliance-heavy industries
const auditConfig = {
  mode: 'PARANOID',
  auditAllActions: true,
  includeReadOperations: true,  // Even SELECT queries!
  retentionDays: 2555,           // 7 years
  encryptSensitiveFields: true
}
```

### Option 2: Audit Critical Only (Balanced)
```typescript
// Good for: Most applications
const auditConfig = {
  mode: 'BALANCED',
  auditActions: ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'],
  includeReadOperations: false,
  retentionDays: 365,
  encryptSensitiveFields: true
}
```

### Option 3: Audit Minimal (Performance First)
```typescript
// Good for: High-traffic, low-risk features
const auditConfig = {
  mode: 'MINIMAL',
  auditActions: ['DELETE', 'APPROVE'],
  includeReadOperations: false,
  retentionDays: 90,
  encryptSensitiveFields: false
}
```

---

## 🚀 Rollout Timeline

```
Week 1: Setup Infrastructure
├─ Day 1-2: Create audit_logs table
├─ Day 3-4: Build AuditService
└─ Day 5: Write tests

Week 2: Payment Methods Module
├─ Day 1-2: Add audit to CRUD operations
├─ Day 3: Add audit to fee config changes
└─ Day 4-5: Test & verify

Week 3: Reconciliation Module
├─ Day 1-2: Add audit to approval workflow
├─ Day 3: Add audit to manual adjustments
└─ Day 4-5: Test & verify

Week 4: Bank Statements Module
├─ Day 1-2: Add audit to import
├─ Day 3: Add audit to categorization
└─ Day 4-5: Test & verify

Week 5: Audit Reports & UI
├─ Day 1-3: Build audit trail UI
├─ Day 4: Add activity reports
└─ Day 5: Final testing
```

---

## 🎯 Benefits of This Approach

### ✅ Pros
1. **Infrastructure ready early** - Other developers can use it
2. **Incremental testing** - Audit each module as it's built
3. **Context-aware logging** - Fresh in developer's mind
4. **Easier debugging** - Audit available during development
5. **No big-bang integration** - Reduces risk

### ⚠️ Considerations
1. **Slight overhead per module** - But worth it for quality
2. **Need discipline** - Team must remember to add audit
3. **Initial setup time** - But pays off quickly

---

## 📝 Checklist: Adding Audit to New Module

When adding a new module, follow this checklist:

```typescript
// ✅ Checklist for Module: _______________

// 1. Identify critical actions
const actionsToAudit = [
  'CREATE',
  'UPDATE', 
  'DELETE',
  'APPROVE',
  // ... add custom actions
]

// 2. Inject AuditService
constructor(
  private auditService: AuditService
) {}

// 3. Add audit calls
async create(dto, userId) {
  const entity = await this.repository.save(dto)
  
  await this.auditService.log({
    companyId: dto.company_id,
    userId,
    entityType: 'your_entity_type',
    entityId: entity.id,
    action: 'CREATED',
    newValues: entity
  })
  
  return entity
}

// 4. Add audit tests
describe('Audit Logging', () => {
  it('should create audit log on entity creation', async () => {
    const entity = await service.create(dto, userId)
    const auditLog = await auditService.findByEntity('your_entity_type', entity.id)
    
    expect(auditLog).toBeDefined()
    expect(auditLog.action).toBe('CREATED')
  })
})

// 5. Document in README
// - What actions are audited
// - What fields are tracked
// - Retention policy
```

---

## 🔍 Example: Complete Audit Integration

Here's a complete example showing before/after:

### Before (No Audit)
```typescript
async approveDocument(id: string) {
  await this.repository.update(id, { status: 'APPROVED' })
  return this.findOne(id)
}
```

### After (With Audit)
```typescript
async approveDocument(id: string, userId: string, notes?: string) {
  // Get old values
  const oldDoc = await this.findOne(id)
  
  // Update
  await this.repository.update(id, { 
    status: 'APPROVED',
    approved_by: userId,
    approved_at: new Date()
  })
  const newDoc = await this.findOne(id)
  
  // Audit log
  await this.auditService.log({
    companyId: oldDoc.company_id,
    userId,
    entityType: 'document',
    entityId: id,
    action: 'APPROVED',
    oldValues: { status: oldDoc.status },
    newValues: { 
      status: 'APPROVED',
      approved_by: userId,
      approved_at: newDoc.approved_at
    },
    notes,
    metadata: {
      documentType: oldDoc.type,
      amount: oldDoc.amount
    }
  })
  
  return newDoc
}
```

---

## 📚 Additional Resources

### Audit Log Best Practices
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [GDPR Compliance for Audit Logs](https://gdpr.eu/article-30-records-of-processing-activities/)
- [SOC 2 Audit Requirements](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report)

---

**Recommendation:** Start with Phase 1 this week, then add audit to each module as you develop it.

**Last Updated:** January 28, 2026
