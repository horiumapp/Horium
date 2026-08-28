import React from 'react';
import { SetupData } from '../types';
import { TimetableResultView } from '../components/result/TimetableResultView';

interface TimetableResultProps {
  data: SetupData;
  setData?: React.Dispatch<React.SetStateAction<SetupData>>;
  onReprocess: () => void;
  onLicenseNeeded?: () => void;
  activeLicenseStatus?: string;
}

const TimetableResult: React.FC<TimetableResultProps> = ({
  data,
  setData,
  onReprocess,
  onLicenseNeeded,
  activeLicenseStatus
}) => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <TimetableResultView
        data={data}
        setData={setData}
        onReprocess={onReprocess}
        onLicenseNeeded={onLicenseNeeded}
        activeLicenseStatus={activeLicenseStatus}
        isStandalonePage={true}
      />
    </div>
  );
};

export default TimetableResult;
