/**
 * Settlement Groups Page
 * Main page for managing settlement groups
 */

import React, { useState } from 'react';
import { SettlementDashboard } from '../components/SettlementDashboard.tsx';
import { SettlementWizard } from '../components/SettlementWizard.tsx';
import { SettlementDetailModal } from '../components/SettlementDetailModal.tsx';

export const SettlementGroupsPage: React.FC = () => {
  const [showWizard, setShowWizard] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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
    setSelectedGroupId(groupId);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setSelectedGroupId(null);
    setShowDetailModal(false);
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

        {showDetailModal && selectedGroupId && (
          <SettlementDetailModal
            groupId={selectedGroupId}
            isOpen={showDetailModal}
            onClose={handleCloseDetailModal}
          />
        )}
      </div>
    </div>
  );
};
