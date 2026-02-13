/**
 * Settlement Groups Page
 * Main page for managing settlement groups
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SettlementDashboard } from '../components/SettlementDashboard.tsx';
import { SettlementWizard } from '../components/SettlementWizard.tsx';

export const SettlementGroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = React.useState(false);

  const handleCreateNew = () => {
    setShowWizard(true);
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    // TODO: Refresh the dashboard data
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
  };

  const handleViewDetails = (groupId: string) => {
    navigate(`/bank-reconciliation/settlement-groups/${groupId}`);
  };

  if (showWizard) {
    return (
      <SettlementWizard
        onComplete={handleWizardComplete}
        onCancel={handleWizardCancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SettlementDashboard
          onCreateNew={handleCreateNew}
          onViewDetails={handleViewDetails}
        />
      </div>
    </div>
  );
};
