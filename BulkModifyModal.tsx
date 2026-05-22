import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { SessionStatus } from '../types';

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hours = i;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const value = `${hours.toString().padStart(2, '0')}:00`;
  const label = `${displayHours.toString().padStart(2, '0')}:00 ${period}`;
  return { value, label };
});

export function BulkModifyModal({ 
    selectedSessionIds, 
    sessions, 
    pricingSchemes, 
    locations, 
    packageTypes, 
    packages, 
    groups = [],
    groupBy = 'player',
    onClose, 
    updateMasterData 
}: any) {
  const [targetLocationId, setTargetLocationId] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetDayOfWeek, setTargetDayOfWeek] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [targetPackageType, setTargetPackageType] = useState('');
  const [targetStatus, setTargetStatus] = useState<SessionStatus | ''>('');
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApply = async () => {
    setIsProcessing(true);
    try {
      const selectedSessions = sessions.filter((s: any) => selectedSessionIds.has(s.id));
      
      for (const session of selectedSessions) {
        const updates: any = {};
        
        if (targetLocationId) updates.locationId = targetLocationId === 'NO BASE' ? '' : targetLocationId;
        if (targetGroupId) updates.groupId = targetGroupId === 'NO GROUP' ? '' : targetGroupId;
        if (targetDate) updates.date = targetDate;
        if (targetDayOfWeek) {
             const daysOfWeek: Record<string, number> = {
              'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
            };
            const currentSessionDate = new Date(session.date);
            const targetDay = daysOfWeek[targetDayOfWeek];
            const currentDay = currentSessionDate.getDay();
            const diff = (targetDay - currentDay + 7) % 7;
            const newDate = new Date(currentSessionDate);
            newDate.setDate(newDate.getDate() + diff);
            updates.date = newDate.toISOString().slice(0, 10);
        }
        if (targetTime) updates.startTime = targetTime;
        if (targetStatus) {
            if (groupBy !== 'group' || !['Hold', 'Cancelled', 'Regret', 'Exceptional Regret'].includes(session.status)) {
                updates.status = targetStatus;
                if (['Attended', 'Hold', 'Absent', 'Scheduled', 'Cancelled'].includes(targetStatus)) updates.comment = '';
                else if (targetStatus === 'Regret' || targetStatus === 'Exceptional Regret') updates.comment = 'to be compensated';
                else if (targetStatus === 'Compensated') updates.comment = 'attended compensated session';
            }
        }
        
        if (targetPackageType) {
            const newCode = targetPackageType;
            const oldIndex = session.sessionIndex || 'SES-1';
            const numPart = oldIndex.split('-').pop() || '1';
            const newIndex = `${newCode}-${numPart}`;
            
            const pkg = packages.find((p: any) => p.id === session.packageId);
            if (pkg) {
                const monthToUse = pkg.effectiveMonth || new Date().toISOString().slice(0, 7);
                const nSessions = pkg.numSessions || 8;
                
                const getPricing = (code: string) => {
                    const scheme = pricingSchemes.find((s: any) => 
                        s.packageTypeCode === code && 
                        s.numSessions === nSessions &&
                        s.effectiveMonth === monthToUse
                    ) || pricingSchemes.filter((s: any) => 
                        s.packageTypeCode === code && 
                        s.numSessions === nSessions
                    ).sort((a: any,b: any) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]
                    || pricingSchemes.filter((s: any) => 
                        s.packageTypeCode === code
                    ).sort((a: any,b: any) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
                    return { value: scheme?.sessionValue || 0, cost: scheme?.sessionCost || 0 };
                };

                const { value: sessionValue, cost: sessionCost } = getPricing(newCode);
                updates.sessionIndex = newIndex;
                updates.value = sessionValue;
                updates.cost = sessionCost;
            }
        }

        if (Object.keys(updates).length > 0) {
            await updateMasterData('sessions', session.id!, updates);
        }
      }

      // Re-calculate package totals if package type changed
      if (targetPackageType) {
          const packagesToUpdate = Array.from(new Set(selectedSessions.map((s: any) => s.packageId)));
          for (const pkgId of packagesToUpdate) {
              const pkg = packages.find((p: any) => p.id === pkgId);
              if (!pkg) continue;

              const getPricingFallback = (code: string) => {
                const monthToUse = pkg.effectiveMonth || new Date().toISOString().slice(0, 7);
                const nSessions = pkg.numSessions || 8;
                const matchingSchemes = pricingSchemes
                  .filter((ps: any) => ps.packageTypeCode === code)
                  .sort((a: any,b: any) => b.effectiveMonth.localeCompare(a.effectiveMonth));
                let s = matchingSchemes.find((ps: any) => ps.numSessions === nSessions && ps.effectiveMonth === monthToUse);
                if (!s) s = matchingSchemes.find((ps: any) => ps.numSessions === nSessions);
                if (!s) s = matchingSchemes.find((ps: any) => ps.effectiveMonth === monthToUse);
                if (!s) s = matchingSchemes[0];
                return s?.sessionValue || 0;
              };

              const pkgSessions = sessions.filter((s: any) => s.packageId === pkgId);
              const newBase = pkgSessions.reduce((acc: number, s: any) => {
                const isValuated = ['Attended', 'Scheduled', 'Compensated', 'Attended Comp. Session', 'Absent'].includes(s.status);
                if (!isValuated && s.id && !selectedSessionIds.has(s.id)) return acc;
                // If the status is being updated to one of the valuated ones, we should count it
                if (targetStatus && !['Attended', 'Scheduled', 'Compensated', 'Attended Comp. Session', 'Absent'].includes(targetStatus) && selectedSessionIds.has(s.id)) return acc;

                let sCode = (s.sessionIndex || '').toString().split('-')[0] || pkg.packageTypeCode;
                if (selectedSessionIds.has(s.id)) sCode = targetPackageType;
                
                const val = (s.value !== undefined && s.value !== null && s.value !== 0 && !selectedSessionIds.has(s.id))
                  ? Number(s.value)
                  : getPricingFallback(sCode);
                return acc + val;
              }, 0);

              await updateMasterData('packages', pkg.id!, {
                baseAmount: newBase,
                totalDue: newBase - (pkg.discountAmount || 0)
              });
          }
      }

      onClose();
    } catch (error) {
      console.error("Bulk update failed", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-slate-900 w-full max-w-md max-h-[90vh] rounded-[2.5rem] p-8 border-2 border-slate-800 shadow-bento overflow-y-auto">
        <h2 className="text-xl font-black text-white italic mb-8 uppercase tracking-tight flex items-center gap-2">
          <Edit2 size={20} className="text-blue-500" />
          Bulk Edit Sessions
        </h2>
        
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6 px-1">
            Modifying {selectedSessionIds.size} selected session(s)
        </p>

        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-base text-[10px] opacity-50">New Location</label>
                <select
                  value={targetLocationId}
                  onChange={e => setTargetLocationId(e.target.value)}
                  className="input-base    "
                >
                  <option value="">Keep Existing</option>
                  <option value="NO BASE">NO BASE</option>
                  {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                </select>
              </div>
              <div>
                <label className="label-base text-[10px] opacity-50">New Session Count</label>
                <input
                  type="number"
                  value={sessionCount}
                  onChange={e => setSessionCount(Number(e.target.value))}
                  className="input-base     w-full"
                  placeholder="Keep Existing"
                />
              </div>
              <div className="border border-slate-700 p-2 rounded-lg">
                <label className="label-base text-[10px] opacity-50">New Day of Week</label>
                <select
                  value={targetDayOfWeek}
                  onChange={e => setTargetDayOfWeek(e.target.value)}
                  className="input-base     w-full bg-slate-800"
                >
                  <option value="">Keep Existing</option>
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              <div className="border border-slate-700 p-2 rounded-lg">
                <label className="label-base text-[10px] opacity-50">New Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  className="input-base     w-full bg-slate-800"
                />
              </div>
              <div>
                <label className="label-base text-[10px] opacity-50">New Time</label>
                <select
                  value={targetTime}
                  onChange={e => setTargetTime(e.target.value)}
                  className="input-base    "
                >
                  <option value="">Keep Existing</option>
                  {TIME_SLOTS.map((t: any) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-base text-[10px] opacity-50">New Package Type</label>
                <select
                  value={targetPackageType}
                  onChange={e => setTargetPackageType(e.target.value)}
                  className="input-base    "
                >
                  <option value="">Keep Existing</option>
                  {packageTypes.map((pt: any) => (
                    <option key={pt.code} value={pt.code}>{pt.name} ({pt.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-base text-[10px] opacity-50">New Status</label>
                <select
                  value={targetStatus}
                  onChange={e => setTargetStatus(e.target.value as SessionStatus)}
                  className="input-base    "
                >
                  <option value="">Keep Existing</option>
                  {['Scheduled', 'Attended', 'Absent', 'Exceptional Regret', 'Regret', 'Cancelled', 'Compensated', 'Hold'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label-base text-[10px] opacity-50">New Group</label>
                <select
                  value={targetGroupId}
                  onChange={e => setTargetGroupId(e.target.value)}
                  className="input-base w-full"
                >
                  <option value="">Keep Existing</option>
                  <option value="NO GROUP">NO GROUP</option>
                  {groups.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.code} - {g.name}</option>
                  ))}
                </select>
              </div>
           </div>
        </div>

        <div className="flex gap-4 mt-10">
           <button onClick={onClose} className="flex-1 px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-white transition">Cancel</button>
           <button 
             onClick={handleApply}
             disabled={isProcessing || (!targetLocationId && !targetTime && !targetPackageType && !targetStatus && !targetDate && !targetDayOfWeek && !sessionCount && !targetGroupId)}
             className="flex-1 bg-blue-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-[1.5rem] uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all transform hover:-translate-y-1 active:scale-95"
           >
             {isProcessing ? 'Applying...' : 'Apply Changes'}
           </button>
        </div>
      </motion.div>
    </div>
  );
}
