import React, { useState } from 'react';
import { ShieldCheck, X, Check, AlertCircle } from 'lucide-react';

interface VerificationActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reviewerName: string, notes: string, evidenceUsed: string[]) => void;
  matchId: string;
  missingName: string;
  candidateName: string;
  overallScore: number;
}

export const VerificationActionModal: React.FC<VerificationActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  matchId,
  missingName,
  candidateName,
  overallScore
}) => {
  const [reviewerName, setReviewerName] = useState('Ruchit Gaurh (Lead Tech)');
  const [notes, setNotes] = useState('Physically cross-verified with Ward 2 emergency intake ledger and scar description.');
  const [evidenceUsed, setEvidenceUsed] = useState<string[]>([
    'EVID-PHOTO-SIMILARITY',
    'EVID-FACIAL-SCAR',
    'EVID-HOSPITAL-INTAKE'
  ]);

  if (!isOpen) return null;

  const toggleEvidence = (item: string) => {
    if (evidenceUsed.includes(item)) {
      setEvidenceUsed(evidenceUsed.filter((e) => e !== item));
    } else {
      setEvidenceUsed([...evidenceUsed, item]);
    }
  };

  const handleConfirm = () => {
    onConfirm(reviewerName, notes, evidenceUsed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-300 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-xs text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Authorize Identity Confirmation</h3>
              <p className="text-[11px] text-slate-500 font-mono">Match ID: {matchId} • AI Score: {overallScore.toFixed(1)}%</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Comparison Summary */}
        <div className="flex items-center justify-between text-xs py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Missing Person</span>
            <strong className="text-slate-900 text-xs">{missingName}</strong>
          </div>
          <span className="text-slate-400 font-bold font-mono">⇄</span>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Hospital Intake</span>
            <strong className="text-slate-900 text-xs">{candidateName}</strong>
          </div>
        </div>

        {/* Reviewer Name */}
        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Authorized Responder Name
          </label>
          <input
            type="text"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
          />
        </div>

        {/* Evidence Checklist */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Verified Physical Evidence Checklist
          </label>
          <div className="space-y-1">
            {[
              { id: 'EVID-PHOTO-SIMILARITY', label: 'Photo facial similarity and feature correlation' },
              { id: 'EVID-FACIAL-SCAR', label: 'Distinguishing eyebrow scar and neck birthmark verified' },
              { id: 'EVID-HOSPITAL-INTAKE', label: 'Hospital admission form confirmed with attending staff' },
              { id: 'EVID-CLOTHING', label: 'Navy round-neck t-shirt clothing match' }
            ].map((ev) => (
              <label
                key={ev.id}
                className="flex items-center space-x-2 p-1.5 rounded bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70"
              >
                <input
                  type="checkbox"
                  checked={evidenceUsed.includes(ev.id)}
                  onChange={() => toggleEvidence(ev.id)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-0"
                />
                <span className="text-[11px] text-slate-700">{ev.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Immutable Audit Trail Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            placeholder="Document notes for permanent case graph..."
          />
        </div>

        {/* Protocol Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-800 flex items-start space-x-2">
          <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <span>
            Confirming this will mark the person as <strong>VERIFIED</strong>. An encrypted confirmation packet will be broadcast across the BLE mesh to the family.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors flex items-center space-x-1 shadow-xs"
          >
            <ShieldCheck size={14} />
            <span>Confirm & Dispatch Mesh Packet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
