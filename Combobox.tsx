import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface ComboboxProps {
    value: string;
    onChange: (val: string) => void;
    options: string[];
    fullWidth?: boolean;
    className?: string;
    getLabel?: (val: string) => string;
}

export function Combobox({ value, onChange, options, fullWidth = false, className, getLabel = (v) => v }: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(getLabel(value));
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setInputValue(getLabel(value)); }, [value, getLabel]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                const match = options.find(s => s.toLowerCase().startsWith(inputValue.toLowerCase()));
                if (match && inputValue.length > 0) {
                    onChange(match);
                } else {
                    setInputValue(getLabel(value));
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [inputValue, value, onChange, options, getLabel]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        setIsOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const match = options.find(s => s.toLowerCase().startsWith(inputValue.toLowerCase()));
            if (match) {
                setInputValue(getLabel(match));
                onChange(match);
                setIsOpen(false);
            }
        }
    };

    const filtered = options.filter(s => s.toLowerCase().includes(inputValue.toLowerCase()));
    const optionsToShow = filtered.length > 0 ? filtered : options;

    return (
        <div className={cn("relative", fullWidth ? "w-full" : "w-auto")} ref={containerRef}>
            <div className="flex items-center relative">
                <input
                   type="text"
                   value={inputValue}
                   onChange={handleInputChange}
                   onFocus={() => setIsOpen(true)}
                   onKeyDown={handleKeyDown}
                   className={cn(
                        "px-3 py-1.5 border rounded-xl text-xs font-bold uppercase italic outline-none transition peer h-10",
                        fullWidth ? "w-full" : "w-40",
                        className
                   )}
                />
                <button 
                  onClick={() => setIsOpen(!isOpen)}
                  className="absolute right-3 text-slate-500 hover:text-white"
                >
                  <ChevronDown size={14} />
                </button>
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border-2 border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                    {optionsToShow.map(s => (
                        <div 
                           key={s} 
                           className="px-4 py-3 text-xs text-white hover:bg-white/10 hover:text-blue-400 cursor-pointer text-left font-bold uppercase italic transition-colors"
                           onClick={() => {
                               setInputValue(getLabel(s));
                               onChange(s);
                               setIsOpen(false);
                           }}
                        >
                           {getLabel(s)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
