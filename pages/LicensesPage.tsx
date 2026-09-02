import React, { useState } from 'react';
import { LicenseSelection } from '../components/licenses/LicenseSelection';
import PlansPage from './PlansPage';
import { BudgetRequest } from '../components/licenses/BudgetRequest';

interface LicensesPageProps {
  onBack: () => void;
  onStartTestMode: () => void;
  scheduleId?: string;
}

type LicenseView = 'selection' | 'purchase' | 'budget';

export const LicensesPage: React.FC<LicensesPageProps> = ({ onBack, onStartTestMode, scheduleId }) => {
  const [view, setView] = useState<LicenseView>('selection');

  const handleBackToSelection = () => setView('selection');

  return (
    <div className="flex-1 academic-gradient min-h-[calc(100vh-64px)] overflow-y-auto">
      {view === 'selection' && (
        <LicenseSelection
          onSelectPurchase={() => setView('purchase')}
          onSelectBudget={() => setView('budget')}
          onStartTestMode={onStartTestMode}
          onBack={onBack}
        />
      )}

      {view === 'purchase' && (
        <PlansPage
          scheduleId={scheduleId}
          onBackToStart={handleBackToSelection}
        />
      )}

      {view === 'budget' && (
        <BudgetRequest
          onBack={handleBackToSelection}
        />
      )}
    </div>
  );
};

export default LicensesPage;