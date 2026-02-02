/**
 * Integration Tests for Bank Reconciliation API - All Schemas
 */

import { describe, it, expect } from "@jest/globals";

// Import all schemas
const {
  manualReconcileSchema,
  autoMatchSchema,
  getStatementsQuerySchema,
  getSummaryQuerySchema,
  multiMatchSchema,
  multiMatchGroupQuerySchema,
  multiMatchSuggestionsQuerySchema,
} = require("../bank-reconciliation.schema");

describe("Schema Validation - Manual Reconcile", () => {
  describe("manualReconcileSchema", () => {
    it("should validate valid manual reconcile request", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123e4567-e89b-12d3-a456-426614174000",
          statementId: "123e4567-e89b-12d3-a456-426614174001",
          notes: "Test notes",
          overrideDifference: false,
        },
      };

      const result = manualReconcileSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should validate without optional fields", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementId: "456",
        },
      };

      const result = manualReconcileSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should reject invalid companyId UUID", () => {
      const invalidRequest = {
        body: {
          companyId: "not-a-uuid",
          aggregateId: "123",
          statementId: "456",
        },
      };

      const result = manualReconcileSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject empty aggregateId", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "",
          statementId: "456",
        },
      };

      const result = manualReconcileSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject empty statementId", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementId: "",
        },
      };

      const result = manualReconcileSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should accept notes up to 500 chars", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementId: "456",
          notes: "x".repeat(500),
        },
      };

      const result = manualReconcileSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should reject notes > 500 chars", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementId: "456",
          notes: "x".repeat(501),
        },
      };

      const result = manualReconcileSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should accept boolean overrideDifference", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementId: "456",
          overrideDifference: true,
        },
      };

      const result = manualReconcileSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });
  });
});

describe("Schema Validation - Auto Match", () => {
  describe("autoMatchSchema", () => {
    it("should validate valid auto match request", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          bankAccountId: 1,
          matchingCriteria: {
            amountTolerance: 0.01,
            dateBufferDays: 3,
            differenceThreshold: 100,
          },
        },
      };

      const result = autoMatchSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should validate without optional bankAccountId", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      const result = autoMatchSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should validate without optional matchingCriteria", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      const result = autoMatchSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should reject invalid companyId UUID", () => {
      const invalidRequest = {
        body: {
          companyId: "invalid-uuid",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      const result = autoMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject invalid startDate format", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "01-01-2025", // Wrong format
          endDate: "2025-01-31",
        },
      };

      const result = autoMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject invalid endDate format", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "31-01-2025", // Wrong format
        },
      };

      const result = autoMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject negative amountTolerance", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          matchingCriteria: {
            amountTolerance: -0.01,
          },
        },
      };

      const result = autoMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject dateBufferDays > 30", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          matchingCriteria: {
            dateBufferDays: 31,
          },
        },
      };

      const result = autoMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject negative differenceThreshold", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          matchingCriteria: {
            differenceThreshold: -100,
          },
        },
      };

      const result = autoMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });
});

describe("Schema Validation - Get Statements", () => {
  describe("getStatementsQuerySchema", () => {
    it("should validate valid query", () => {
      const validQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          bankAccountId: "1",
        },
      };

      const result = getStatementsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should validate without optional bankAccountId", () => {
      const validQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      const result = getStatementsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should validate without optional threshold", () => {
      const validQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          threshold: "0",
        },
      };

      const result = getStatementsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should reject invalid companyId", () => {
      const invalidQuery = {
        query: {
          companyId: "not-uuid",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      const result = getStatementsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject negative bankAccountId", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          bankAccountId: "-1",
        },
      };

      const result = getStatementsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject negative threshold", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          threshold: "-100",
        },
      };

      const result = getStatementsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });
  });
});

describe("Schema Validation - Get Summary", () => {
  describe("getSummaryQuerySchema", () => {
    it("should validate valid query", () => {
      const validQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      const result = getSummaryQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should reject missing companyId", () => {
      const invalidQuery = {
        query: {
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      const result = getSummaryQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject missing startDate", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          endDate: "2025-01-31",
        },
      };

      const result = getSummaryQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject missing endDate", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
        },
      };

      const result = getSummaryQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject invalid date formats", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "01/01/2025",
          endDate: "31/01/2025",
        },
      };

      const result = getSummaryQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });
  });
});

describe("Schema Validation - Multi-Match", () => {
  describe("multiMatchSchema", () => {
    it("should validate valid multi-match request", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123e4567-e89b-12d3-a456-426614174000",
          statementIds: [
            "123e4567-e89b-12d3-a456-426614174001",
            "123e4567-e89b-12d3-a456-426614174002",
          ],
          notes: "Test notes",
          overrideDifference: false,
        },
      };

      const result = multiMatchSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should reject invalid companyId", () => {
      const invalidRequest = {
        body: {
          companyId: "not-a-uuid",
          aggregateId: "123",
          statementIds: ["123"],
        },
      };

      const result = multiMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject empty statementIds", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementIds: [],
        },
      };

      const result = multiMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should reject invalid statementId in array", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementIds: ["550e8400-e29b-41d4-a716-446655440001", "not-a-uuid"],
        },
      };

      const result = multiMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should accept optional overrideDifference", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementIds: ["550e8400-e29b-41d4-a716-446655440001"],
          overrideDifference: true,
        },
      };

      const result = multiMatchSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should accept optional notes", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementIds: ["550e8400-e29b-41d4-a716-446655440001"],
          notes: "Optional notes up to 500 chars",
        },
      };

      const result = multiMatchSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should reject notes > 500 chars", () => {
      const invalidRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementIds: ["550e8400-e29b-41d4-a716-446655440001"],
          notes: "x".repeat(501),
        },
      };

      const result = multiMatchSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it("should accept single statementId", () => {
      const validRequest = {
        body: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          statementIds: ["550e8400-e29b-41d4-a716-446655440001"],
        },
      };

      const result = multiMatchSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });
  });

  describe("multiMatchGroupQuerySchema", () => {
    it("should validate valid group query", () => {
      const validQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      const result = multiMatchGroupQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should reject missing startDate", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          endDate: "2025-01-31",
        },
      };

      const result = multiMatchGroupQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject missing endDate", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "2025-01-01",
        },
      };

      const result = multiMatchGroupQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject invalid date format", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: "01-01-2025", // Wrong format
          endDate: "31-01-2025",
        },
      };

      const result = multiMatchGroupQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject invalid companyId", () => {
      const invalidQuery = {
        query: {
          companyId: "invalid-uuid",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        },
      };

      const result = multiMatchGroupQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });
  });

  describe("multiMatchSuggestionsQuerySchema", () => {
    it("should validate valid suggestions query", () => {
      const validQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123e4567-e89b-12d3-a456-426614174000",
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should validate query with optional parameters", () => {
      const validQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123e4567-e89b-12d3-a456-426614174000",
          tolerancePercent: 0.05,
          dateToleranceDays: 2,
          maxStatements: 5,
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should reject missing aggregateId", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject tolerancePercent > 1", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          tolerancePercent: 1.5,
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject tolerancePercent < 0", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          tolerancePercent: -0.1,
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject dateToleranceDays > 30", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          dateToleranceDays: 31,
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject dateToleranceDays < 0", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          dateToleranceDays: -1,
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject maxStatements < 1", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          maxStatements: 0,
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should reject maxStatements > 20", () => {
      const invalidQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123",
          maxStatements: 21,
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it("should accept all default values", () => {
      const validQuery = {
        query: {
          companyId: "550e8400-e29b-41d4-a716-446655440000",
          aggregateId: "123e4567-e89b-12d3-a456-426614174000",
          tolerancePercent: 0.05, // default
          dateToleranceDays: 2, // default
          maxStatements: 5, // default
        },
      };

      const result = multiMatchSuggestionsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });
  });
});

describe("Type Exports", () => {
  it("should export ManualReconcileInput type", () => {
    const { ManualReconcileInput } = require("../bank-reconciliation.schema");
    expect(typeof ManualReconcileInput).toBe("object");
  });

  it("should export AutoMatchInput type", () => {
    const { AutoMatchInput } = require("../bank-reconciliation.schema");
    expect(typeof AutoMatchInput).toBe("object");
  });

  it("should export MultiMatchInput type", () => {
    const { MultiMatchInput } = require("../bank-reconciliation.schema");
    expect(typeof MultiMatchInput).toBe("object");
  });

  it("should export GetStatementsQueryInput type", () => {
    const { GetStatementsQueryInput } = require("../bank-reconciliation.schema");
    expect(typeof GetStatementsQueryInput).toBe("object");
  });

  it("should export GetSummaryQueryInput type", () => {
    const { GetSummaryQueryInput } = require("../bank-reconciliation.schema");
    expect(typeof GetSummaryQueryInput).toBe("object");
  });
});

