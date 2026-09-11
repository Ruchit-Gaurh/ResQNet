import React from 'react';
import { DisasterCase } from '../types';
import { CaseMergeView } from '../components/duplicates/CaseMergeView';

interface DuplicateConsolidationProps {
  cases: DisasterCase[];
  onMerge: (canonicalCaseId: string, duplicateCaseIds: string[], reason: string) => void;
}

export const DuplicateConsolidation: React.FC<DuplicateConsolidationProps> = ({
  cases,
  onMerge
}) => {
  return (
    <div className="space-y-6">
      <CaseMergeView cases={cases} onMerge={onMerge} />
    </div>
  );
};
