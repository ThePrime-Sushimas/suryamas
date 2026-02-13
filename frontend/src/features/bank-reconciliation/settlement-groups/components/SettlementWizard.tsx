/**
 * Settlement Wizard Component
 * 3-step wizard for creating bulk settlement groups
 */

import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle, Circle, ArrowLeft, ArrowRight, Loader2, Search, Building, Calendar, FileText, CreditCard, AlertTriangle } from 'lucide-react';
import { useSettlementGroupsStore } from '../hooks/useSettlementGroups';
import { useAvailableBankStatements, useAvailableAggregatesForSettlement, useCreateSettlementGroup } from '../hooks/useSettlementGroups';
import type { SettlementWizardStep, AvailableBankStatementDto, AvailableAggregateDto, AggregateSelection } from '../types/settlement-groups.types';
import { useToast } from '@/contexts/ToastContext';

interface SettlementWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

interface SelectAggregatesStepProps {
  selectedAggregates: AggregateSelection[];
  setSelectedAggregates: React.Dispatch<React.SetStateAction<AggregateSelection[]>>;
}

interface ReviewConfirmStepProps {
  selectedAggregates: AggregateSelection[];
}

export const SettlementWizard: React.FC<SettlementWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const toast = useToast();

  const {
    wizardSteps,
    currentStep,
    setCurrentStep,
    selectedBankStatement,
    wizardNotes,
    overrideDifference,
    resetWizard,
  } = useSettlementGroupsStore();

  // Local state for selected aggregates
  const [selectedAggregates, setSelectedAggregates] = useState<AggregateSelection[]>([]);

  const createSettlementGroup = useCreateSettlementGroup();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepData = wizardSteps[currentStep];
  const progress = ((currentStep + 1) / wizardSteps.length) * 100;

  const canProceedToNext = () => {
    switch (currentStep) {
      case 0: // Select Bank Statement
        return !!selectedBankStatement;
      case 1: // Select Aggregates
        return selectedAggregates.length > 0;
      case 2: // Review & Confirm
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < wizardSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Call API to create settlement group
      const result = await createSettlementGroup.mutateAsync({
        bankStatementId: selectedBankStatement!,
        aggregateIds: selectedAggregates.map(a => a.id),
        notes: wizardNotes,
        overrideDifference,
      });

      // Show success message
      toast.success(`Settlement group created successfully! Settlement Number: ${result.settlementNumber}`);

      onComplete?.();
      resetWizard();
    } catch (err) {
      console.error('Failed to create settlement group:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create settlement group';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetWizard();
    onCancel?.();
  };

  const renderStepIndicator = (step: SettlementWizardStep) => {
    const isCompleted = step.isCompleted;
    const isActive = step.isActive;

    return (
      <div key={step.id} className="flex flex-col items-center">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
            isActive
              ? "border-blue-500 bg-blue-500 text-white"
              : isCompleted
              ? "border-green-500 bg-green-500 text-white"
              : "border-gray-300 bg-white text-gray-500"
          }`}
        >
          {isCompleted ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </div>
        <div className="mt-2 text-center">
          <div
            className={`text-sm font-medium ${
              isActive
                ? "text-blue-600"
                : isCompleted
                ? "text-green-600"
                : "text-gray-500"
            }`}
          >
            {step.title}
          </div>
          <div className="text-xs text-gray-500 mt-1 max-w-24">
            {step.description}
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <SelectBankStatementStep />;
      case 1:
        return <SelectAggregatesStep selectedAggregates={selectedAggregates} setSelectedAggregates={setSelectedAggregates} />;
      case 2:
        return <ReviewConfirmStep selectedAggregates={selectedAggregates} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Create Settlement Group
        </h2>
        <p className="text-gray-600">
          Follow the steps to create a bulk settlement by matching multiple POS aggregates to a single bank statement.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {wizardSteps.map((step, index) => (
            <React.Fragment key={step.id}>
              {renderStepIndicator(step)}
              {index < wizardSteps.length - 1 && (
                <div className="flex-1 h-px bg-gray-300 mx-4 -mt-5" />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold">
              {currentStep + 1}
            </span>
            {currentStepData.title}
          </h3>
        </div>
        <div className="p-6">
          {renderStepContent()}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handleCancel}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>

        <div className="flex gap-2">
          {currentStep > 0 && (
            <button
              onClick={handlePrevious}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>
          )}

          {currentStep < wizardSteps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceedToNext() || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!canProceedToNext() || isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Settlement Group'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Placeholder components for each step
const SelectBankStatementStep: React.FC = () => {
  const { selectedBankStatement, setSelectedBankStatement } = useSettlementGroupsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input - wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  const { data: bankStatementsData, isLoading } = useAvailableBankStatements({
    search: debouncedSearch || undefined,
    limit: 50,
  });

  const bankStatements = bankStatementsData?.data || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSelect = (statement: AvailableBankStatementDto) => {
    setSelectedBankStatement(statement.id, {
      id: statement.id,
      transaction_date: statement.transaction_date,
      description: statement.description,
      amount: statement.amount,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-600">
        Select a bank statement to reconcile with multiple POS aggregates.
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text"
          placeholder="Search by description or reference number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Statements Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading bank statements...</span>
          </div>
        ) : bankStatements.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {searchTerm ? 'No statements found matching your search' : 'No unreconciled bank statements available'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bankStatements.map((statement: AvailableBankStatementDto) => (
                  <tr 
                    key={statement.id}
                    onClick={() => handleSelect(statement)}
                    className={`cursor-pointer transition-colors ${
                      selectedBankStatement === statement.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="radio"
                        name="bankStatement"
                        checked={selectedBankStatement === statement.id}
                        onChange={() => handleSelect(statement)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatDate(statement.transaction_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{statement.description}</div>
                        {statement.reference_number && (
                          <div className="text-xs text-gray-500">Ref: {statement.reference_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-400" />
                        {statement.source_file || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                      <span className={statement.amount < 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(statement.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {selectedBankStatement && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Selected:</strong> Bank statement has been selected. Click "Next" to continue.
          </p>
        </div>
      )}
    </div>
  );
};

const SelectAggregatesStep: React.FC<SelectAggregatesStepProps> = ({
  selectedAggregates,
  setSelectedAggregates,
}) => {

  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input - wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Fetch all unreconciled aggregates (no date filter)
  // After bank statement is selected, show ALL aggregates regardless of date
  const { data: aggregatesData, isLoading } = useAvailableAggregatesForSettlement({
    search: debouncedSearch || undefined,
    limit: 100,
  });

  const aggregates = aggregatesData?.data || [];

  // Calculate selected amounts
  const selectedTotal = useMemo(() => {
    return selectedAggregates.reduce((sum, agg) => sum + (agg.nett_amount || 0), 0);
  }, [selectedAggregates]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleToggleAggregate = (aggregate: AvailableAggregateDto) => {
    const isSelected = selectedAggregates.some(a => a.id === aggregate.id);
    if (isSelected) {
      setSelectedAggregates(selectedAggregates.filter(a => a.id !== aggregate.id));
    } else {
      const newAggregate: AggregateSelection = {
        id: aggregate.id,
        allocatedAmount: aggregate.nett_amount || 0,
        originalAmount: aggregate.nett_amount || 0,
        selected: true,
        branchName: aggregate.branch_name || undefined,
        branchCode: aggregate.branch_code || undefined,
        payment_method_name: aggregate.payment_method_name || undefined,
        transaction_date: aggregate.transaction_date,
        nett_amount: aggregate.nett_amount,
      };
      setSelectedAggregates([...selectedAggregates, newAggregate]);
    }
  };

  const isSelected = (id: string) => selectedAggregates.some(a => a.id === id);

  return (
    <div className="space-y-4">
      <p className="text-gray-600">
        Select POS aggregates to match with the selected bank statement.
        You can select multiple aggregates to reconcile them together.
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text"
          placeholder="Search by branch, payment method, or reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Aggregates Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading aggregates...</span>
          </div>
        ) : aggregates.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              {searchTerm ? 'No aggregates found matching your search' : 'No unreconciled aggregates available'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {aggregates.map((aggregate: AvailableAggregateDto) => (
                  <tr 
                    key={aggregate.id}
                    onClick={() => handleToggleAggregate(aggregate)}
                    className={`cursor-pointer transition-colors ${
                      isSelected(aggregate.id)
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected(aggregate.id)}
                        onChange={() => handleToggleAggregate(aggregate)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatDate(aggregate.transaction_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-400" />
                        {aggregate.branch_name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {aggregate.payment_method_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                      {formatCurrency(aggregate.nett_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Summary */}
      {selectedAggregates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-blue-800">
                <strong>{selectedAggregates.length}</strong> aggregates selected
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Total: {formatCurrency(selectedTotal)}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedAggregates([]);
              }}
              className="text-xs text-red-600 hover:text-red-800 underline"
            >
              Clear all selections
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ReviewConfirmStep: React.FC<ReviewConfirmStepProps> = ({
  selectedAggregates,
}) => {
  const {
    selectedBankStatementData,
    wizardNotes,
    setWizardNotes,
    overrideDifference,
    setOverrideDifference,
  } = useSettlementGroupsStore();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const totalAggregates = selectedAggregates.reduce((sum, agg) => sum + (agg.nett_amount || 0), 0);
  const difference = selectedBankStatementData ? selectedBankStatementData.amount - totalAggregates : 0;
  const differencePercent = selectedBankStatementData?.amount 
    ? Math.abs(difference) / Math.abs(selectedBankStatementData.amount) * 100 
    : 0;
  const isWithinThreshold = differencePercent <= 5;

  if (!selectedBankStatementData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No bank statement selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Review the settlement details before confirming the settlement group.
      </p>

      {/* Bank Statement Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-3">Selected Bank Statement</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-blue-600">Date</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(selectedBankStatementData.transaction_date)}</p>
          </div>
          <div>
            <p className="text-xs text-blue-600">Amount</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(selectedBankStatementData.amount)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-blue-600">Description</p>
            <p className="text-sm text-gray-900">{selectedBankStatementData.description}</p>
          </div>
        </div>
      </div>

      {/* Aggregates Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex justify-between items-start mb-3">
          <h4 className="text-sm font-semibold text-green-800">Selected Aggregates</h4>
          <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
            {selectedAggregates.length} items
          </span>
        </div>
        
        {selectedAggregates.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedAggregates.map((agg) => (
              <div key={agg.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{agg.branchName || 'N/A'}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">{agg.payment_method_name || 'N/A'}</span>
                </div>
                <span className="font-medium text-gray-900">{formatCurrency(agg.nett_amount || 0)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No aggregates selected</p>
        )}
        
        <div className="mt-3 pt-3 border-t border-green-200 flex justify-between items-center">
          <span className="text-sm font-medium text-green-800">Total Aggregates</span>
          <span className="text-lg font-bold text-green-700">{formatCurrency(totalAggregates)}</span>
        </div>
      </div>

      {/* Difference Summary */}
      <div className={`border rounded-lg p-4 ${isWithinThreshold ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Difference</p>
            <p className="text-xs text-gray-500">
              {formatCurrency(selectedBankStatementData.amount)} - {formatCurrency(totalAggregates)}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${isWithinThreshold ? 'text-gray-700' : 'text-red-600'}`}>
              {formatCurrency(difference)}
            </p>
            <p className="text-xs text-gray-500">{differencePercent.toFixed(2)}%</p>
          </div>
        </div>
        
        {/* Notes Input */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={wizardNotes}
            onChange={(e) => setWizardNotes(e.target.value)}
            placeholder="Add notes about this settlement..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
          />
        </div>

        {/* Override Difference Checkbox */}
        {!isWithinThreshold && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={overrideDifference}
                onChange={(e) => setOverrideDifference(e.target.checked)}
                className="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 rounded"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Override Difference Threshold
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  The difference ({formatCurrency(difference)} / {differencePercent.toFixed(2)}%) exceeds the 5% threshold.
                  Check this box to proceed anyway.
                </p>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

