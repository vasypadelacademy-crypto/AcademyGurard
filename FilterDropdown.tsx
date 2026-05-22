import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export function FilterDropdown({ icon, label, value, options, onChange, searchable }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o: any) => o.value === value);
  const filteredOptions = searchable 
    ? options.filter((o: any) => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  return (
    <div ref={wrapperRef} className="relative">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-slate-900/50 border-2 border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition-all cursor-pointer group"
      >
        <span className="text-slate-500 group-hover:text-blue-500 transition-colors uppercase">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[8px] font-normal text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</p>
          <p className="text-xs font-normal text-slate-200 uppercase truncate tracking-tight">{selectedOption?.label || 'All'}</p>
        </div>
        <ChevronDown size={14} className={cn("text-slate-600 transition-transform", isOpen && "rotate-180")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-50 w-full mt-2 bg-slate-900 border-2 border-slate-800 rounded-xl shadow-2xl overflow-hidden py-1 max-h-[300px] flex flex-col"
          >
            {searchable && (
              <div className="p-2 border-b border-slate-800 flex items-center gap-2">
                <Search size={14} className="text-slate-500" />
                <input 
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
                />
              </div>
            )}
            <div className="overflow-y-auto custom-scrollbar">
              {filteredOptions.map((opt: any) => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm font-medium uppercase tracking-widest transition-colors",
                    value === opt.value ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <div className="px-4 py-2.5 text-sm text-slate-600 uppercase">No results</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
