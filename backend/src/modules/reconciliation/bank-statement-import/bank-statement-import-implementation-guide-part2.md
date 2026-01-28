# 🚀 Bank Statement Import Module - Implementation Guide (Part 2)

## Service Layer (Continued)

### 6.4 bank-statement-import.service.ts (Part 2)

```typescript
  /**
   * Process import (called by job worker)
   */
  async processImport(
    jobId: number,
    importId: number,
    companyId: string,
    skipDuplicates: boolean
  ): Promise<{ processed_count: number }> {
    this.logger.info('BankStatementImport: Starting import processing', {
      job_id: jobId,
      import_id: importId,
    });

    const client = await this.repository.pool.connect();

    try {
      await client.query('BEGIN');

      // Get import record
      const importRecord = await this.repository.getImportById(importId, companyId);

      if (!importRecord) {
        throw new Error('Import not found');
      }

      // Retrieve temporary stored data
      const rows = await this.retrieveTemporaryData(importId);

      // Validate all rows
      const { validRows, invalidRows, errors } = this.rowValidator.validateRows(
        rows,
        companyId,
        importRecord.bank_account_id,
        importId
      );

      let rowsToInsert = validRows;

      // Filter duplicates if requested
      if (skipDuplicates) {
        const existingStatements = await this.repository.checkExistingStatements({
          company_id: companyId,
          bank_account_id: importRecord.bank_account_id,
          statements: validRows.map((r) => ({
            transaction_date: r.transaction_date,
            reference_number: r.reference_number,
            debit_amount: r.debit_amount,
            credit_amount: r.credit_amount,
            description: r.description,
          })),
        });

        const duplicates = this.duplicateDetector.detectDuplicates(
          rows,
          existingStatements,
          80
        );

        // Filter out duplicates
        const duplicateKeys = new Set(
          duplicates.map((d) =>
            `${d.transaction_date}-${d.reference_number}-${d.debit_amount}-${d.credit_amount}`
          )
        );

        rowsToInsert = validRows.filter((r) => {
          const key = `${r.transaction_date}-${r.reference_number}-${r.debit_amount}-${r.credit_amount}`;
          return !duplicateKeys.has(key);
        });

        this.logger.info('BankStatementImport: Filtered duplicates', {
          import_id: importId,
          original_count: validRows.length,
          after_filter: rowsToInsert.length,
          skipped: validRows.length - rowsToInsert.length,
        });
      }

      // Bulk insert in batches
      const batchSize = 1000;
      let processedCount = 0;

      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        const batch = rowsToInsert.slice(i, i + batchSize);
        
        await this.repository.bulkInsertStatements(batch, client);
        
        processedCount += batch.length;

        // Update progress
        await this.repository.updateImport(
          importId,
          {
            processed_rows: processedCount,
          },
          client
        );

        // Update job progress
        await this.jobsService.updateJobProgress(
          jobId,
          {
            processed_rows: processedCount,
            total_rows: rowsToInsert.length,
            percentage: Math.round((processedCount / rowsToInsert.length) * 100),
            current_status: `Processing batch ${Math.ceil(i / batchSize) + 1}`,
          }
        );

        this.logger.info('BankStatementImport: Batch processed', {
          import_id: importId,
          batch_number: Math.ceil(i / batchSize) + 1,
          processed: processedCount,
          total: rowsToInsert.length,
        });
      }

      // Update import to completed
      await this.repository.updateImport(
        importId,
        {
          status: BankStatementImportStatus.COMPLETED,
          processed_rows: processedCount,
          failed_rows: invalidRows.length,
        },
        client
      );

      // Clean up temporary data
      await this.cleanupTemporaryData(importId);

      await client.query('COMMIT');

      this.logger.info('BankStatementImport: Processing completed', {
        import_id: importId,
        processed_count: processedCount,
        failed_count: invalidRows.length,
      });

      return { processed_count: processedCount };
    } catch (error: any) {
      await client.query('ROLLBACK');

      this.logger.error('BankStatementImport: Processing failed', {
        import_id: importId,
        error: error.message,
      });

      // Update import to failed
      await this.repository.updateImport(importId, {
        status: BankStatementImportStatus.FAILED,
        error_message: error.message,
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * List imports
   */
  async listImports(
    companyId: string,
    pagination: PaginationParams,
    sort: SortParams = { field: 'created_at', order: 'DESC' },
    filter?: BankStatementImportFilterParams
  ): Promise<PaginatedResponse<BankStatementImport>> {
    return this.repository.listImports(companyId, pagination, sort, filter);
  }

  /**
   * Get import by ID
   */
  async getImportById(
    importId: number,
    companyId: string
  ): Promise<BankStatementImport | null> {
    return this.repository.getImportById(importId, companyId);
  }

  /**
   * Get statements for an import
   */
  async getImportStatements(
    importId: number,
    companyId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<BankStatement>> {
    // Verify import exists and belongs to company
    const importRecord = await this.repository.getImportById(importId, companyId);
    
    if (!importRecord) {
      throw new Error('Import not found');
    }

    return this.repository.listStatements(
      companyId,
      pagination,
      { field: 'transaction_date', order: 'DESC' },
      { import_id: importId }
    );
  }

  /**
   * Delete import and its statements
   */
  async deleteImport(
    importId: number,
    companyId: string,
    userId: string
  ): Promise<void> {
    const client = await this.repository.pool.connect();

    try {
      await client.query('BEGIN');

      // Verify import exists
      const importRecord = await this.repository.getImportById(importId, companyId);
      
      if (!importRecord) {
        throw new Error('Import not found');
      }

      // Don't allow deletion if import is in progress
      if (importRecord.status === BankStatementImportStatus.IMPORTING) {
        throw new Error('Cannot delete import while it is being processed');
      }

      // Delete associated statements
      const deletedCount = await this.repository.deleteStatementsByImportId(
        importId,
        companyId,
        userId,
        client
      );

      // Delete import
      await this.repository.deleteImport(importId, companyId, userId);

      await client.query('COMMIT');

      this.logger.info('BankStatementImport: Import deleted', {
        import_id: importId,
        deleted_statements: deletedCount,
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Store temporary data (for processing later)
   */
  private async storeTemporaryData(
    importId: number,
    rows: any[]
  ): Promise<void> {
    const tempPath = `/tmp/bank-import-${importId}.json`;
    await fs.writeFile(tempPath, JSON.stringify(rows));
  }

  /**
   * Retrieve temporary data
   */
  private async retrieveTemporaryData(importId: number): Promise<any[]> {
    const tempPath = `/tmp/bank-import-${importId}.json`;
    const data = await fs.readFile(tempPath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Cleanup temporary data
   */
  private async cleanupTemporaryData(importId: number): Promise<void> {
    const tempPath = `/tmp/bank-import-${importId}.json`;
    try {
      await fs.unlink(tempPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
}
```

---

## 7. Controller Layer

### 7.1 bank-statement-import.controller.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { BankStatementImportService } from './bank-statement-import.service';
import { Logger } from '../../utils/logger';
import { validateUploadedFile } from './schema';
import crypto from 'crypto';
import fs from 'fs/promises';

export class BankStatementImportController {
  constructor(
    private readonly service: BankStatementImportService,
    private readonly logger: Logger
  ) {}

  /**
   * Upload and analyze bank statement file
   * POST /api/v1/bank-statement-imports/upload
   */
  upload = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate file
      validateUploadedFile(req.file);

      const { bank_account_id } = req.body;
      const companyId = req.user!.company_id;
      const userId = req.user!.id;

      // Calculate file hash
      const fileBuffer = await fs.readFile(req.file!.path);
      const fileHash = crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex');

      const fileResult = {
        file_name: req.file!.originalname,
        file_size: req.file!.size,
        file_path: req.file!.path,
        file_hash: fileHash,
        mime_type: req.file!.mimetype,
      };

      // Analyze file
      const result = await this.service.analyzeFile(
        fileResult,
        parseInt(bank_account_id),
        companyId,
        userId
      );

      res.status(200).json({
        success: true,
        data: {
          import: result.import,
          analysis: result.analysis,
        },
        message: 'File analyzed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Confirm import and start processing
   * POST /api/v1/bank-statement-imports/:id/confirm
   */
  confirm = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const importId = parseInt(req.params.id);
      const { skip_duplicates = false, dry_run = false } = req.body;
      const companyId = req.user!.company_id;
      const userId = req.user!.id;

      if (dry_run) {
        // TODO: Implement dry run (preview what would be imported)
        res.status(200).json({
          success: true,
          message: 'Dry run completed',
        });
        return;
      }

      const result = await this.service.confirmImport(
        importId,
        companyId,
        skip_duplicates,
        userId
      );

      res.status(200).json({
        success: true,
        data: {
          import: result.import,
          job_id: result.job_id,
        },
        message: 'Import started successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * List all imports
   * GET /api/v1/bank-statement-imports
   */
  list = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const companyId = req.user!.company_id;
      const {
        page = 1,
        limit = 50,
        bank_account_id,
        status,
        date_from,
        date_to,
      } = req.query;

      const result = await this.service.listImports(
        companyId,
        {
          page: parseInt(String(page)),
          limit: parseInt(String(limit)),
        },
        { field: 'created_at', order: 'DESC' },
        {
          bank_account_id: bank_account_id
            ? parseInt(String(bank_account_id))
            : undefined,
          status: status as any,
          date_from: date_from as string,
          date_to: date_to as string,
        }
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get import by ID
   * GET /api/v1/bank-statement-imports/:id
   */
  getById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const importId = parseInt(req.params.id);
      const companyId = req.user!.company_id;

      const importRecord = await this.service.getImportById(importId, companyId);

      if (!importRecord) {
        res.status(404).json({
          success: false,
          message: 'Import not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: importRecord,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get statements for an import
   * GET /api/v1/bank-statement-imports/:id/statements
   */
  getStatements = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const importId = parseInt(req.params.id);
      const companyId = req.user!.company_id;
      const { page = 1, limit = 50 } = req.query;

      const result = await this.service.getImportStatements(
        importId,
        companyId,
        {
          page: parseInt(String(page)),
          limit: parseInt(String(limit)),
        }
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete import
   * DELETE /api/v1/bank-statement-imports/:id
   */
  delete = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const importId = parseInt(req.params.id);
      const companyId = req.user!.company_id;
      const userId = req.user!.id;

      await this.service.deleteImport(importId, companyId, userId);

      res.status(200).json({
        success: true,
        message: 'Import deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
```

---

## 8. Routes Configuration

### 8.1 bank-statement-import.routes.ts

```typescript
import { Router } from 'express';
import multer from 'multer';
import { BankStatementImportController } from './bank-statement-import.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import {
  uploadBankStatementSchema,
  confirmBankStatementImportSchema,
  getImportByIdSchema,
  deleteImportSchema,
  listImportsQuerySchema,
  getImportStatementsSchema,
} from './schema';

// Configure multer for file upload
const upload = multer({
  dest: '/tmp/uploads',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files are allowed.'));
    }
  },
});

export function createBankStatementImportRoutes(
  controller: BankStatementImportController
): Router {
  const router = Router();

  // All routes require authentication
  router.use(authenticate);

  /**
   * Upload and analyze file
   */
  router.post(
    '/upload',
    upload.single('file'),
    validateRequest(uploadBankStatementSchema),
    controller.upload
  );

  /**
   * Confirm import
   */
  router.post(
    '/:id/confirm',
    validateRequest(confirmBankStatementImportSchema),
    controller.confirm
  );

  /**
   * List imports
   */
  router.get(
    '/',
    validateRequest(listImportsQuerySchema),
    controller.list
  );

  /**
   * Get import by ID
   */
  router.get(
    '/:id',
    validateRequest(getImportByIdSchema),
    controller.getById
  );

  /**
   * Get statements for import
   */
  router.get(
    '/:id/statements',
    validateRequest(getImportStatementsSchema),
    controller.getStatements
  );

  /**
   * Delete import
   */
  router.delete(
    '/:id',
    validateRequest(deleteImportSchema),
    controller.delete
  );

  return router;
}
```

---

## 9. Job Processing

### 9.1 Integration with Jobs Service

**File:** `jobs/processors/bank-statement-import.processor.ts`

```typescript
import { Job } from '../types';
import { BankStatementImportService } from '../../bank-statement-import/bank-statement-import.service';
import { Logger } from '../../../utils/logger';

export class BankStatementImportProcessor {
  constructor(
    private readonly service: BankStatementImportService,
    private readonly logger: Logger
  ) {}

  /**
   * Process bank statement import job
   */
  async process(job: Job): Promise<any> {
    this.logger.info('Processing bank statement import job', {
      job_id: job.id,
      metadata: job.metadata,
    });

    const { importId, companyId, skipDuplicates } = job.metadata;

    try {
      const result = await this.service.processImport(
        job.id,
        importId,
        companyId,
        skipDuplicates
      );

      this.logger.info('Bank statement import job completed', {
        job_id: job.id,
        processed: result.processed_count,
      });

      return result;
    } catch (error: any) {
      this.logger.error('Bank statement import job failed', {
        job_id: job.id,
        error: error.message,
      });

      throw error;
    }
  }
}
```

### 9.2 Register Processor

**In:** `jobs/jobs.service.ts`

```typescript
import { BankStatementImportProcessor } from './processors/bank-statement-import.processor';

// ... in JobsService class

private async processJob(job: Job): Promise<void> {
  try {
    let result: any;

    switch (job.module) {
      case 'bank_statements':
        const bankStatementProcessor = new BankStatementImportProcessor(
          this.bankStatementImportService,
          this.logger
        );
        result = await bankStatementProcessor.process(job);
        break;

      // ... other processors

      default:
        throw new Error(`Unknown job module: ${job.module}`);
    }

    await this.completeJob(job.id, result);
  } catch (error: any) {
    await this.failJob(job.id, error.message);
  }
}
```

---

## 10. Error Handling

### 10.1 errors.ts

```typescript
/**
 * Custom error classes for bank statement import
 */

export class BankStatementImportError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'BankStatementImportError';
  }
}

export class FileValidationError extends BankStatementImportError {
  constructor(message: string, details?: any) {
    super(message, 'BS001', 400, details);
    this.name = 'FileValidationError';
  }
}

export class InvalidFileTypeError extends BankStatementImportError {
  constructor() {
    super('Invalid file type. Only Excel files are allowed', 'BS002', 400);
    this.name = 'InvalidFileTypeError';
  }
}

export class MissingColumnsError extends BankStatementImportError {
  constructor(missingColumns: string[]) {
    super(
      `Missing required columns: ${missingColumns.join(', ')}`,
      'BS003',
      400,
      { missing_columns: missingColumns }
    );
    this.name = 'MissingColumnsError';
  }
}

export class InvalidDateFormatError extends BankStatementImportError {
  constructor(rowNumber: number, value: any) {
    super(
      `Invalid date format at row ${rowNumber}`,
      'BS004',
      400,
      { row_number: rowNumber, value }
    );
    this.name = 'InvalidDateFormatError';
  }
}

export class InvalidAmountFormatError extends BankStatementImportError {
  constructor(rowNumber: number, field: string, value: any) {
    super(
      `Invalid amount format at row ${rowNumber}, field ${field}`,
      'BS005',
      400,
      { row_number: rowNumber, field, value }
    );
    this.name = 'InvalidAmountFormatError';
  }
}

export class DuplicateTransactionError extends BankStatementImportError {
  constructor(duplicateCount: number) {
    super(
      `Found ${duplicateCount} duplicate transaction(s)`,
      'BS006',
      400,
      { duplicate_count: duplicateCount }
    );
    this.name = 'DuplicateTransactionError';
  }
}

export class BankAccountNotFoundError extends BankStatementImportError {
  constructor(bankAccountId: number) {
    super(
      `Bank account with ID ${bankAccountId} not found`,
      'BS007',
      404,
      { bank_account_id: bankAccountId }
    );
    this.name = 'BankAccountNotFoundError';
  }
}

export class ImportNotFoundError extends BankStatementImportError {
  constructor(importId: number) {
    super(
      `Import with ID ${importId} not found`,
      'BS008',
      404,
      { import_id: importId }
    );
    this.name = 'ImportNotFoundError';
  }
}

export class ImportAlreadyProcessingError extends BankStatementImportError {
  constructor(importId: number) {
    super(
      `Import ${importId} is already being processed`,
      'BS009',
      400,
      { import_id: importId }
    );
    this.name = 'ImportAlreadyProcessingError';
  }
}

export class FileAlreadyImportedError extends BankStatementImportError {
  constructor(existingImportId: number) {
    super(
      `This file has already been imported (Import ID: ${existingImportId})`,
      'BS010',
      400,
      { existing_import_id: existingImportId }
    );
    this.name = 'FileAlreadyImportedError';
  }
}
```

### 10.2 Error Handler Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import { BankStatementImportError } from '../modules/bank-statement-import/errors';
import { ZodError } from 'zod';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Bank Statement Import errors
  if (error instanceof BankStatementImportError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.errors,
      },
    });
    return;
  }

  // Multer file upload errors
  if (error.message.includes('File too large')) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BS001',
        message: 'File size exceeds maximum allowed size (50MB)',
      },
    });
    return;
  }

  // Generic errors
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests - Service

**File:** `__tests__/service.test.ts`

```typescript
import { BankStatementImportService } from '../bank-statement-import.service';
import { BankStatementImportRepository } from '../bank-statement-import.repository';
import { JobsService } from '../../jobs/jobs.service';
import { Logger } from '../../../utils/logger';

describe('BankStatementImportService', () => {
  let service: BankStatementImportService;
  let repository: jest.Mocked<BankStatementImportRepository>;
  let jobsService: jest.Mocked<JobsService>;
  let logger: jest.Mocked<Logger>;

  beforeEach(() => {
    repository = {
      createImport: jest.fn(),
      updateImport: jest.fn(),
      getImportById: jest.fn(),
      checkFileHashExists: jest.fn(),
      // ... mock other methods
    } as any;

    jobsService = {
      createJob: jest.fn(),
      updateJobProgress: jest.fn(),
    } as any;

    logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    service = new BankStatementImportService(repository, jobsService, logger);
  });

  describe('analyzeFile()', () => {
    it('should parse valid Excel file and create import', async () => {
      // Arrange
      const fileResult = {
        file_name: 'test.xlsx',
        file_size: 1024,
        file_path: '/tmp/test.xlsx',
        file_hash: 'abc123',
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      repository.checkFileHashExists.mockResolvedValue(null);
      repository.createImport.mockResolvedValue({
        id: 1,
        company_id: 'company-1',
        bank_account_id: 1,
        file_name: 'test.xlsx',
        status: 'PENDING',
        total_rows: 0,
        processed_rows: 0,
        failed_rows: 0,
        created_at: new Date().toISOString(),
      } as any);

      // Act & Assert
      // TODO: Mock Excel file reading
      // const result = await service.analyzeFile(fileResult, 1, 'company-1', 'user-1');
      // expect(result.import).toBeDefined();
      // expect(result.analysis).toBeDefined();
    });

    it('should reject duplicate file', async () => {
      // Arrange
      const fileResult = {
        file_name: 'test.xlsx',
        file_size: 1024,
        file_path: '/tmp/test.xlsx',
        file_hash: 'abc123',
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      repository.checkFileHashExists.mockResolvedValue({
        id: 999,
      } as any);

      // Act & Assert
      await expect(
        service.analyzeFile(fileResult, 1, 'company-1', 'user-1')
      ).rejects.toThrow('File already imported');
    });
  });

  describe('confirmImport()', () => {
    it('should create job and update status', async () => {
      // Arrange
      repository.getImportById.mockResolvedValue({
        id: 1,
        status: 'ANALYZED',
        total_rows: 100,
        bank_account_id: 1,
      } as any);

      jobsService.createJob.mockResolvedValue({
        id: 1,
        type: 'import',
        status: 'PENDING',
      } as any);

      repository.updateImport.mockResolvedValue({
        id: 1,
        status: 'IMPORTING',
        job_id: 1,
      } as any);

      // Act
      const result = await service.confirmImport(1, 'company-1', false, 'user-1');

      // Assert
      expect(result.job_id).toBe(1);
      expect(jobsService.createJob).toHaveBeenCalled();
      expect(repository.updateImport).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'IMPORTING' })
      );
    });

    it('should reject if import not in ANALYZED status', async () => {
      // Arrange
      repository.getImportById.mockResolvedValue({
        id: 1,
        status: 'COMPLETED',
      } as any);

      // Act & Assert
      await expect(
        service.confirmImport(1, 'company-1', false, 'user-1')
      ).rejects.toThrow('Import must be in ANALYZED status');
    });
  });
});
```

### 11.2 Integration Tests

**File:** `__tests__/integration.test.ts`

```typescript
import request from 'supertest';
import { app } from '../../../app';
import { pool } from '../../../database';

describe('Bank Statement Import API', () => {
  let authToken: string;
  let companyId: string;
  let bankAccountId: number;

  beforeAll(async () => {
    // Setup: Create test user, company, bank account
    // Get auth token
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    await pool.end();
  });

  describe('POST /api/v1/bank-statement-imports/upload', () => {
    it('should upload and analyze valid Excel file', async () => {
      const response = await request(app)
        .post('/api/v1/bank-statement-imports/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('bank_account_id', bankAccountId.toString())
        .attach('file', '__tests__/fixtures/valid-statement.xlsx');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.import).toBeDefined();
      expect(response.body.data.analysis).toBeDefined();
      expect(response.body.data.analysis.total_rows).toBeGreaterThan(0);
    });

    it('should reject invalid file type', async () => {
      const response = await request(app)
        .post('/api/v1/bank-statement-imports/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('bank_account_id', bankAccountId.toString())
        .attach('file', '__tests__/fixtures/invalid.txt');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject file without required columns', async () => {
      const response = await request(app)
        .post('/api/v1/bank-statement-imports/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('bank_account_id', bankAccountId.toString())
        .attach('file', '__tests__/fixtures/missing-columns.xlsx');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BS003');
    });
  });

  describe('POST /api/v1/bank-statement-imports/:id/confirm', () => {
    let importId: number;

    beforeEach(async () => {
      // Upload and analyze file first
      const uploadResponse = await request(app)
        .post('/api/v1/bank-statement-imports/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('bank_account_id', bankAccountId.toString())
        .attach('file', '__tests__/fixtures/valid-statement.xlsx');

      importId = uploadResponse.body.data.import.id;
    });

    it('should confirm import and create job', async () => {
      const response = await request(app)
        .post(`/api/v1/bank-statement-imports/${importId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ skip_duplicates: false });

      expect(response.status).toBe(200);
      expect(response.body.data.job_id).toBeDefined();
      expect(response.body.data.import.status).toBe('IMPORTING');
    });
  });

  describe('GET /api/v1/bank-statement-imports', () => {
    it('should list imports with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/bank-statement-imports')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });
  });
});
```

---

## 12. Deployment Checklist

### Pre-Deployment

- [ ] Run all database migrations
- [ ] Install dependencies (`npm install`)
- [ ] Update environment variables:
  - [ ] `UPLOAD_MAX_FILE_SIZE=52428800` (50MB)
  - [ ] `TEMP_UPLOAD_DIR=/tmp/uploads`
  - [ ] `JOB_QUEUE_ENABLED=true`
- [ ] Configure file upload directory permissions
- [ ] Set up virus scanning (optional but recommended)

### Testing

- [ ] Run unit tests: `npm run test:unit`
- [ ] Run integration tests: `npm run test:integration`
- [ ] Test with sample Excel files
- [ ] Verify duplicate detection
- [ ] Test job processing
- [ ] Load testing with large files (10k+ rows)

### Security

- [ ] Validate file types strictly
- [ ] Implement rate limiting on upload endpoint
- [ ] Add virus scanning integration
- [ ] Review file storage security
- [ ] Audit access control

### Monitoring

- [ ] Set up alerts for failed imports
- [ ] Monitor job queue processing
- [ ] Track file upload metrics
- [ ] Log analysis for errors
- [ ] Dashboard for import status

### Documentation

- [ ] API documentation (Swagger/OpenAPI)
- [ ] User guide for Excel format
- [ ] Troubleshooting guide
- [ ] Error code reference

---

## 📚 Additional Resources

- **Excel Format Template**: Create a template Excel file for users
- **Error Message Catalog**: Document all error codes and solutions
- **Performance Optimization**: Consider using streams for very large files
- **Batch Size Tuning**: Adjust based on database performance
- **Monitoring Dashboard**: Build UI for tracking import status

---

**End of Implementation Guide**
