import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SettlementDashboard } from '../components/SettlementDashboard.tsx';
import { SettlementWizard } from '../components/SettlementWizard.tsx';

export const SettlementGroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = React.useState(false);

  const handleWizardComplete = () => {
    setShowWizard(false);
  };

  if (showWizard) {
    return (
      <SettlementWizard
        onComplete={handleWizardComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SettlementDashboard
          onCreateNew={() => setShowWizard(true)}
          onViewDetails={(id) => navigate(`/bank-reconciliation/settlement-groups/${id}`)}
        />
      </div>
    </div>
  );
};
