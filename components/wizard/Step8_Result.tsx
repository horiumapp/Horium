import React from 'react';
import { SetupData } from '../../types';
import { TimetableResultView } from '../result/TimetableResultView';

interface Step8ResultProps {
    data: SetupData;
    setData: React.Dispatch<React.SetStateAction<SetupData>>;
    onReprocess: () => void;
    activeLicenseStatus?: string;
    onLicenseNeeded?: () => void;
}

export const Step8Result: React.FC<Step8ResultProps> = ({
    data,
    setData,
    onReprocess,
    activeLicenseStatus,
    onLicenseNeeded
}) => {
    return (
        <TimetableResultView
            data={data}
            setData={setData}
            onReprocess={onReprocess}
            activeLicenseStatus={activeLicenseStatus}
            onLicenseNeeded={onLicenseNeeded}
            isStandalonePage={false}
        />
    );
};

export default Step8Result;
