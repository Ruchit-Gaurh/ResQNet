import React, { useState } from 'react';
import { ShieldCheck, X, AlertCircle } from 'lucide-react';

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
  const [reviewerName, setReviewerName] = useState('Ruchit Gaurh (Lead Responder)');
  const [notes, setNotes] = useState(
    'Physically confirmed match with Ward 2 emergency intake desk. Scars and identification marks match family description.'
  );
  const [evidenceUsed, setEvidenceUsed] = useState<string[]>([
    'EVID-PHOTO-SIMILARITY',
    'EVID-FACIAL-SCAR-EYEBROW',
    'EVID-HOSPITAL-INTAKE-FORM'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0F172A] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Authorize Identity Confirmation</h3>
              <p className="text-xs text-slate-400">Match ID: {matchId} • AI Score: {overallScore.toFixed(1)}%</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comparison Summary */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs flex justify-between items-center">
          <div>
            <div className="text-slate-400 font-medium">Missing Case:</div>
            <div className="text-white font-bold text-sm">{missingName}</div>
          </div>
          <div className="text-slate-500 font-mono font-bold">⇄</div>
          <div className="text-right">
            <div className="text-slate-400 font-medium">Intake Candidate:</div>
            <div className="text-white font-bold text-sm">{candidateName}</div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Authorized Reviewer Signature
            </label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Evidence Items Used for Verification
            </label>
            <div className="space-y-1.5 text-xs">
              {[
                { id: 'EVID-PHOTO-SIMILARITY', label: 'Visual Photo / Facial Embedding Correlation' },
                { id: 'EVID-FACIAL-SCAR-EYEBROW', label: 'Distinguishing Facial Marks / Scar Correlation' },
                { id: 'EVID-HOSPITAL-INTAKE-FORM', label: 'Hospital Admission Card & Attending Nurse Confirmation' },
                { id: 'EVID-CLOTHING-INVENTORY', label: 'Clothing Inventory (Blue T-shirt)' }
              ].map((item) => (
                <label
                  key={item.id}
                  className="flex items-center space-x-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:bg-slate-800/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={evidenceUsed.includes(item.id)}
                    onChange={() => toggleEvidence(item.id)}
                    className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span className="text-slate-300">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Verification Notes & Provenance
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              placeholder="Provide context and notes for the permanent audit trail..."
            />
          </div>
        </div>

        {/* Warning Notice */}
        <div className="flex items-start space-x-2 text-xs text-amber-300/90 bg-amber-950/30 border border-amber-500/30 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            This action marks the missing person as <strong>VERIFIED</strong>. An encrypted case update packet will be
            dispatched over the mesh and internet to the authorized family.
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg shadow-emerald-600/30 transition-all flex items-center space-x-2"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Confirm & Verify Identity</span>
          </button>
        </div>
      </div>
    </div>
  );
};
