import React from 'react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface PackageBreakdownProps {
  packages: any[];
  playerId: string;
  onClose: () => void;
  position: { top: number; left: number };
}

export const PackageBreakdown = ({ packages, playerId, onClose, position }: PackageBreakdownProps) => {
  const navigate = useNavigate();
  // Filter for packages with due > 0.01. Use calculatedPending if available for consistency with alarms
  const duePackages = packages.filter(p => {
    const pending = p.calculatedPending !== undefined ? p.calculatedPending : (Number(p.totalDue || 0) - Number(p.paidAmount || 0));
    return pending > 0.01;
  });

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div 
        className="fixed z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-2 min-w-[200px]"
        style={{ top: position.top, left: position.left }}
      >
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 py-1 border-b border-slate-800 mb-1">Due Details</div>
        {duePackages.map((pkg) => {
          const pending = pkg.calculatedPending !== undefined ? pkg.calculatedPending : (Number(pkg.totalDue || 0) - Number(pkg.paidAmount || 0));
          return (
            <button
              key={pkg.id}
              className="w-full text-left px-2 py-2 hover:bg-slate-800 rounded-lg flex items-center justify-between text-xs text-white"
              onClick={() => {
                navigate(`/players/${playerId}?activePackageId=${pkg.id}`);
                onClose();
              }}
            >
              <span>{pkg.displayId || pkg.packageTypeCode}</span>
              <span className="font-bold text-red-500">{pending.toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
