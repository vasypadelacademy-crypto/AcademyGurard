import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO, startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isValid } from 'date-fns';

export function DayPickerDropdown({ startDate, endDate, onChange, customPresets }: { startDate: string, endDate: string, onChange: (start: string, end: string, id?: string) => void, customPresets?: { label: string, getRange: () => { from: Date | undefined, to: Date | undefined, id?: string } }[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedText = (!startDate && !endDate) ? 'ALL TIME' : (
    (startDate && startDate.startsWith('package:')) ? 'CURRENT PACKAGE' :
    startDate && endDate ? (startDate === endDate ? format(new Date(startDate), 'MMM d, yyyy') : `${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`) : 
    (startDate ? `${format(new Date(startDate), 'MMM d, yyyy')} - ...` : `... - ${format(new Date(endDate), 'MMM d, yyyy')}`)
  );

  const presets = customPresets || [
    { label: 'TODAY', getRange: () => ({ from: startOfToday(), to: endOfToday() }) },
    { label: 'THIS WEEK', getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
    { label: 'THIS MONTH', getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: 'ALL TIME', getRange: () => ({ from: undefined, to: undefined }) },
  ];

  const handlePresetClick = (getRange: () => { from: Date | undefined, to: Date | undefined, id?: string }) => {
    const range = getRange();
    const startStr = range.from ? format(range.from, 'yyyy-MM-dd') : '';
    const endStr = range.to ? format(range.to, 'yyyy-MM-dd') : '';
    onChange(startStr, endStr, range.id);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative z-20">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 bg-slate-900 border-2 border-slate-800 rounded-xl px-4 h-[52px] hover:border-slate-700 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3 w-full min-w-0">
          <span className="text-slate-500 group-hover:text-blue-500 transition-colors uppercase shrink-0"><CalendarIcon size={16} /></span>
          <div className="flex-1 min-w-0 flex items-center justify-between">
             <p className="text-[10px] font-normal text-slate-300 uppercase tracking-widest truncate">
               {selectedText}
             </p>
             {(startDate || endDate) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('', '');
                  }}
                  className="hover:text-red-400 text-slate-500 transition-colors shrink-0 ml-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
             )}
          </div>
        </div>
        <ChevronDown size={14} className={cn("text-slate-500 transition-transform shrink-0 ml-2", isOpen ? "rotate-180" : "")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-[100] mt-2 bg-slate-900 border-2 border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col w-64 right-0 lg:left-0"
          >
            <div className="flex border-b-2 border-slate-800">
              <button 
                onClick={() => setMode('presets')}
                className={cn("flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors", mode === 'presets' ? "text-white border-b-2 border-blue-500 bg-slate-800/50" : "text-slate-500 hover:text-slate-300")}
              >
                Presets
              </button>
              <button 
                onClick={() => setMode('custom')}
                className={cn("flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors", mode === 'custom' ? "text-white border-b-2 border-blue-500 bg-slate-800/50" : "text-slate-500 hover:text-slate-300")}
              >
                Custom
              </button>
            </div>

            {mode === 'presets' ? (
              <div className="p-2 space-y-1">
                 {presets.map(p => (
                   <button
                     key={p.label}
                     onClick={() => handlePresetClick(p.getRange)}
                     className="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all flex items-center justify-between"
                   >
                     {p.label}
                   </button>
                 ))}
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Start Date</label>
                  <div className="relative">
                    <input 
                      type="date"
                      value={startDate?.startsWith('package:') ? '' : startDate}
                      onChange={(e) => onChange(e.target.value, endDate?.startsWith('package:') ? '' : endDate)}
                      className="w-full bg-slate-950 border-2 border-slate-800 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors select-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:z-10 relative"
                    />
                    <CalendarIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-0" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">End Date</label>
                  <div className="relative">
                    <input 
                      type="date"
                      value={endDate?.startsWith('package:') ? '' : endDate}
                      onChange={(e) => onChange(startDate?.startsWith('package:') ? '' : startDate, e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-800 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors select-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:z-10 relative"
                    />
                    <CalendarIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-0" />
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-widest py-3 rounded-lg mt-2 transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
