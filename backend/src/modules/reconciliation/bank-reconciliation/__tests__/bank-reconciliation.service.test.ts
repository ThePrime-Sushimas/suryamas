/**
 * Unit Tests for Bank Reconciliation Service - MultiMatch Feature
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";

describe("BankReconciliationService - MultiMatch", () => {
  let service: any;
  let mockRepository: any;
  let mockOrchestrator: any;
  let mockFeeService: any;

  // Mock data
  const mockAggregate = {
    id: "aggregate-1",
    company_id: "company-1",
    transaction_date: "2025-01-11",
    gross_amount: 5500000,
    nett_amount: 5069986,
    payment_method_id: 1,
    payment_methods: [{ name: "Debit BCA", code: "DEBIT_BCA" }],
  };

  const mockStatement1 = {
    id: "statement-1",
    company_id: "company-1",
    transaction_date: "2025-01-12",
    description: "KR OTOMATIS MID: 885002200709",
    debit_amount: 0,
    credit_amount: 4754200,
    is_reconciled: false,
  };

  const mockStatement2 = {
    id: "statement-2",
    company_id: "company-1",
    transaction_date: "2025-01-12",
    description: "KARTU KREDIT MID: 002200709",
    debit_amount: 0,
    credit_amount: 282794,
    is_reconciled: false,
  };

  const mockStatementAlreadyReconciled = {
    ...mockStatement1,
    is_reconciled: true,
  };

  const mockReconciliationGroup = {
    id: "group-1",
    company_id: "company-1",
    aggregate_id: "aggregate-1",
    total_bank_amount: 5036994,
    aggregate_amount: 5069986,
    difference: -32992,
    status: "DISCREPANCY",
    bank_reconciliation_group_details: [
      { statement_id: "statement-1", amount: 4754200 },
      { statement_id: "statement-2", amount: 282794 },
    ],
  };

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      findById: jest.fn(),
      isAggregateInGroup: jest.fn(),
      createReconciliationGroup: jest.fn(),
      addStatementsToGroup: jest.fn(),
      getReconciliationGroupById: jest.fn(),
      markStatementsAsReconciledWithGroup: jest.fn(),
      undoReconciliationGroup: jest.fn(),
      getUnreconciledStatementsForSuggestion: jest.fn(),
      getReconciliationGroups: jest.fn(),
      logAction: jest.fn(),
    };

    // Create mock orchestrator
    mockOrchestrator = {
      getAggregateById: jest.fn(),
      updateReconciliationStatus: jest.fn(),
      getAggregatesByDateRange: jest.fn(),
      findPotentialAggregatesForStatement: jest.fn(),
      bulkUpdateReconciliationStatus: jest.fn(),
      getReconciliationSummary: jest.fn(),
    };

    // Create mock fee service
    mockFeeService = {
      reconcile: jest.fn(),
    };

    // Import and create service
    const { BankReconciliationService } = require("../bank-reconciliation.service");
    const { BankReconciliationRepository } = require("../bank-reconciliation.repository");
    const { IReconciliationOrchestratorService } = require("../../orchestrator/reconciliation-orchestrator.types");
    const { FeeReconciliationService } = require("../../fee-reconciliation/fee-reconciliation.service");

    service = new BankReconciliationService(
      mockRepository,
      mockOrchestrator,
      mockFeeService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createMultiMatch", () => {
    it("should create multi-match successfully with valid data", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(mockAggregate);
      mockRepository.isAggregateInGroup.mockResolvedValue(false);
      mockRepository.findById
        .mockResolvedValueOnce(mockStatement1)
        .mockResolvedValueOnce(mockStatement2);
      mockRepository.createReconciliationGroup.mockResolvedValue("group-1");
      mockRepository.addStatementsToGroup.mockResolvedValue(undefined);
      mockRepository.markStatementsAsReconciledWithGroup.mockResolvedValue(undefined);
      mockOrchestrator.updateReconciliationStatus.mockResolvedValue(undefined);
      mockRepository.logAction.mockResolvedValue(undefined);

      // Act
      const result = await service.createMultiMatch(
        "company-1",
        "aggregate-1",
        ["statement-1", "statement-2"],
        "user-1",
        "Test multi-match",
        false,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.groupId).toBe("group-1");
      expect(result.aggregateId).toBe("aggregate-1");
      expect(result.statementIds).toEqual(["statement-1", "statement-2"]);
      expect(result.totalBankAmount).toBe(5036994);
      expect(result.aggregateAmount).toBe(5069986);
      expect(result.difference).toBe(-32992);

      expect(mockRepository.createReconciliationGroup).toHaveBeenCalledTimes(1);
      expect(mockRepository.addStatementsToGroup).toHaveBeenCalledTimes(1);
      expect(mockRepository.markStatementsAsReconciledWithGroup).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.updateReconciliationStatus).toHaveBeenCalledTimes(1);
      expect(mockRepository.logAction).toHaveBeenCalledTimes(1);
    });

    it("should throw error when aggregate not found", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createMultiMatch(
          "company-1",
          "aggregate-1",
          ["statement-1"],
          "user-1",
        ),
      ).rejects.toThrow("Aggregate tidak ditemukan");
    });

    it("should throw error when aggregate belongs to different company", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue({
        ...mockAggregate,
        company_id: "different-company",
      });

      // Act & Assert
      await expect(
        service.createMultiMatch(
          "company-1",
          "aggregate-1",
          ["statement-1"],
          "user-1",
        ),
      ).rejects.toThrow("Aggregate tidak milik company ini");
    });

    it("should throw error when aggregate already in a group", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(mockAggregate);
      mockRepository.isAggregateInGroup.mockResolvedValue(true);

      // Act & Assert
      await expect(
        service.createMultiMatch(
          "company-1",
          "aggregate-1",
          ["statement-1"],
          "user-1",
        ),
      ).rejects.toThrow("Aggregate sudah menjadi bagian dari group");
    });

    it("should throw error when statement is already reconciled", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(mockAggregate);
      mockRepository.isAggregateInGroup.mockResolvedValue(false);
      mockRepository.findById.mockResolvedValue(mockStatementAlreadyReconciled);

      // Act & Assert
      await expect(
        service.createMultiMatch(
          "company-1",
          "aggregate-1",
          ["statement-1"],
          "user-1",
        ),
      ).rejects.toThrow("Beberapa statement tidak valid atau sudah dicocokkan");
    });

    it("should throw error when statement belongs to different company", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(mockAggregate);
      mockRepository.isAggregateInGroup.mockResolvedValue(false);
      mockRepository.findById.mockResolvedValue({
        ...mockStatement1,
        company_id: "different-company",
      });

      // Act & Assert
      await expect(
        service.createMultiMatch(
          "company-1",
          "aggregate-1",
          ["statement-1"],
          "user-1",
        ),
      ).rejects.toThrow("Beberapa statement tidak valid atau sudah dicocokkan");
    });

    it("should throw error when difference exceeds tolerance without override", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(mockAggregate);
      mockRepository.isAggregateInGroup.mockResolvedValue(false);
      // Create statements with larger difference
      mockRepository.findById
        .mockResolvedValueOnce({ ...mockStatement1, credit_amount: 1000000 })
        .mockResolvedValueOnce({ ...mockStatement2, credit_amount: 1000000 });

      // Act & Assert
      await expect(
        service.createMultiMatch(
          "company-1",
          "aggregate-1",
          ["statement-1", "statement-2"],
          "user-1",
          undefined,
          false,
        ),
      ).rejects.toThrow("Selisih melebihi tolerance");
    });

    it("should succeed when difference exceeds tolerance but override is true", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(mockAggregate);
      mockRepository.isAggregateInGroup.mockResolvedValue(false);
      // Create statements with larger difference
      mockRepository.findById
        .mockResolvedValueOnce({ ...mockStatement1, credit_amount: 1000000 })
        .mockResolvedValueOnce({ ...mockStatement2, credit_amount: 1000000 });
      mockRepository.createReconciliationGroup.mockResolvedValue("group-1");
      mockRepository.addStatementsToGroup.mockResolvedValue(undefined);
      mockRepository.markStatementsAsReconciledWithGroup.mockResolvedValue(undefined);
      mockOrchestrator.updateReconciliationStatus.mockResolvedValue(undefined);
      mockRepository.logAction.mockResolvedValue(undefined);

      // Act
      const result = await service.createMultiMatch(
        "company-1",
        "aggregate-1",
        ["statement-1", "statement-2"],
        "user-1",
        undefined,
        true, // override = true
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.groupId).toBe("group-1");
    });
  });

  describe("undoMultiMatch", () => {
    it("should undo multi-match successfully", async () => {
      // Arrange
      mockRepository.getReconciliationGroupById.mockResolvedValue(mockReconciliationGroup);
      mockRepository.undoReconciliationGroup.mockResolvedValue(undefined);
      mockOrchestrator.updateReconciliationStatus.mockResolvedValue(undefined);
      mockRepository.logAction.mockResolvedValue(undefined);

      // Act
      await service.undoMultiMatch("group-1", "user-1");

      // Assert
      expect(mockRepository.undoReconciliationGroup).toHaveBeenCalledWith("group-1");
      expect(mockOrchestrator.updateReconciliationStatus).toHaveBeenCalledWith(
        "aggregate-1",
        "PENDING",
      );
      expect(mockRepository.logAction).toHaveBeenCalledTimes(1);
    });

    it("should throw error when group not found", async () => {
      // Arrange
      mockRepository.getReconciliationGroupById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.undoMultiMatch("group-1")).rejects.toThrow(
        "Group tidak ditemukan",
      );
    });

    it("should throw error when group already undone", async () => {
      // Arrange
      mockRepository.getReconciliationGroupById.mockResolvedValue({
        ...mockReconciliationGroup,
        deleted_at: new Date().toISOString(),
      });

      // Act & Assert
      await expect(service.undoMultiMatch("group-1")).rejects.toThrow(
        "Group sudah di-undo",
      );
    });
  });

  describe("getSuggestedGroupStatements", () => {
    it("should return suggestions for valid aggregate", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(mockAggregate);
      mockRepository.getUnreconciledStatementsForSuggestion.mockResolvedValue([
        mockStatement1,
        mockStatement2,
      ]);

      // Act
      const suggestions = await service.getSuggestedGroupStatements(
        "company-1",
        "aggregate-1",
      );

      // Assert
      expect(Array.isArray(suggestions)).toBe(true);
      expect(mockRepository.getUnreconciledStatementsForSuggestion).toHaveBeenCalled();
    });

    it("should throw error when aggregate not found", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getSuggestedGroupStatements("company-1", "aggregate-1"),
      ).rejects.toThrow("Aggregate tidak ditemukan");
    });

    it("should return empty array when no statements found", async () => {
      // Arrange
      mockOrchestrator.getAggregateById.mockResolvedValue(mockAggregate);
      mockRepository.getUnreconciledStatementsForSuggestion.mockResolvedValue([]);

      // Act
      const suggestions = await service.getSuggestedGroupStatements(
        "company-1",
        "aggregate-1",
      );

      // Assert
      expect(suggestions).toEqual([]);
    });
  });

  describe("getReconciliationGroups", () => {
    it("should return reconciliation groups for date range", async () => {
      // Arrange
      const mockGroups = [mockReconciliationGroup];
      mockRepository.getReconciliationGroups.mockResolvedValue(mockGroups);

      // Act
      const groups = await service.getReconciliationGroups(
        "company-1",
        new Date("2025-01-01"),
        new Date("2025-01-31"),
      );

      // Assert
      expect(groups).toEqual(mockGroups);
      expect(mockRepository.getReconciliationGroups).toHaveBeenCalledWith(
        "company-1",
        expect.any(Date),
        expect.any(Date),
      );
    });
  });

  describe("getMultiMatchGroup", () => {
    it("should return group details", async () => {
      // Arrange
      mockRepository.getReconciliationGroupById.mockResolvedValue(mockReconciliationGroup);

      // Act
      const group = await service.getMultiMatchGroup("group-1");

      // Assert
      expect(group).toEqual(mockReconciliationGroup);
      expect(mockRepository.getReconciliationGroupById).toHaveBeenCalledWith("group-1");
    });
  });

  describe("calculateDifference", () => {
    it("should calculate correct difference and percentage", () => {
      // Act
      const result = service.calculateDifference(5069986, 5036994);

      // Assert
      expect(result.absolute).toBe(32992);
      expect(result.percentage).toBeCloseTo(0.65, 1);
    });

    it("should handle zero aggregate amount", () => {
      // Act
      const result = service.calculateDifference(0, 1000);

      // Assert
      expect(result.absolute).toBe(1000);
      expect(result.percentage).toBe(0);
    });
  });
});

describe("MultiMatch Suggestion Algorithm", () => {
  let service: any;

  beforeEach(() => {
    // Create minimal mock for algorithm testing
    const mockRepository = {
      findById: jest.fn(),
      isAggregateInGroup: jest.fn(),
      createReconciliationGroup: jest.fn(),
      addStatementsToGroup: jest.fn(),
      getReconciliationGroupById: jest.fn(),
      markStatementsAsReconciledWithGroup: jest.fn(),
      undoReconciliationGroup: jest.fn(),
      getUnreconciledStatementsForSuggestion: jest.fn(),
      getReconciliationGroups: jest.fn(),
      logAction: jest.fn(),
    };

    const mockOrchestrator = {
      getAggregateById: jest.fn(),
      updateReconciliationStatus: jest.fn(),
      getAggregatesByDateRange: jest.fn(),
      findPotentialAggregatesForStatement: jest.fn(),
      bulkUpdateReconciliationStatus: jest.fn(),
      getReconciliationSummary: jest.fn(),
    };

    const mockFeeService = {
      reconcile: jest.fn(),
    };

    // Import and create service
    const { BankReconciliationService } = require("../bank-reconciliation.service");
    const { BankReconciliationRepository } = require("../bank-reconciliation.repository");
    const { IReconciliationOrchestratorService } = require("../../orchestrator/reconciliation-orchestrator.types");
    const { FeeReconciliationService } = require("../../fee-reconciliation/fee-reconciliation.service");

    service = new BankReconciliationService(
      mockRepository,
      mockOrchestrator,
      mockFeeService,
    );
  });

  describe("extractMID", () => {
    it("should extract MID from description", () => {
      const result = service["extractMID"]("KR OTOMATIS MID: 885002200709");
      expect(result).toBe("885002200709");
    });

    it("should extract MID with different format", () => {
      const result = service["extractMID"]("MID 002200709");
      expect(result).toBe("002200709");
    });

    it("should return null when no MID found", () => {
      const result = service["extractMID"]("Some random description");
      expect(result).toBeNull();
    });
  });
});

