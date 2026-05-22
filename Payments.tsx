import { safeParseISO } from "../lib/utils";
import React, { useState, useMemo } from 'react';

import { useData } from '../lib/DataContext';
import { format, } from 'date-fns';
import { 
  CreditCard, 
  Search, 
  Filter, 
  ChevronRight, 
  DollarSign, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Download
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function Payments() {
  const { packages, players, payments, packageTypes, pricingSchemes, sessions } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const player = players.find(p => p.id === pkg.playerId);
      const matchesSearch = player ? player.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a,b) => b.startDate.localeCompare(a.startDate));
  }, [packages, players, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const getPricingFallback = (code: string, p: any) => {
      const monthToUse = p.effectiveMonth || p.createdAt?.slice(0, 7) || new Date().toISOString().slice(0, 7);
      const nSessions = p.numSessions || 8;
      const s = pricingSchemes.find(ps => 
        ps.packageTypeCode === code && 
        ps.numSessions === nSessions &&
        ps.effectiveMonth === monthToUse
      ) || pricingSchemes.filter(ps => 
        ps.packageTypeCode === code && 
        ps.numSessions === nSessions
      ).sort((a,b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]
      || pricingSchemes.filter(ps => 
        ps.packageTypeCode === code
      ).sort((a,b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
      return s?.sessionValue || 0;
    };

    return (packages || []).reduce((acc, p) => {
      const pkgSessions = (sessions || []).filter(s => String(s.packageId) === String(p.id));
      let derivedValue = 0;
      
      if (pkgSessions.length > 0) {
        derivedValue = pkgSessions.reduce((pAcc, s) => {
          const isValuated = ['Attended', 'Scheduled', 'Compensated', 'Attended Comp. Session', 'Absent'].includes(s.status);
          if (!isValuated) return pAcc;
          const sCode = (s.sessionIndex || '').toString().split('-')[0] || p.packageTypeCode;
          const val = (s.value !== undefined && s.value !== null && s.value !== 0) 
            ? Number(s.value) 
            : getPricingFallback(sCode, p);
          return pAcc + val;
        }, 0) - (p.discountAmount || 0);
      } else {
        const fallbackVal = getPricingFallback(p.packageTypeCode, p);
        derivedValue = (fallbackVal * (p.numSessions || 8)) - (p.discountAmount || 0);
      }

      const pending = Math.max(0, derivedValue - (p.paidAmount || 0));
      return {
        totalDue: acc.totalDue + derivedValue,
        totalPaid: acc.totalPaid + (p.paidAmount || 0),
        totalPending: acc.totalPending + pending
      };
    }, { totalDue: 0, totalPaid: 0, totalPending: 0 });
  }, [packages, sessions, pricingSchemes]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs md:text-sm text-blue-500 uppercase tracking-[0.2em] mb-2 leading-none">Economics / Finance</p>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none">Financial Ledger</h1>
          <p className="text-slate-400 mt-3 uppercase text-[10px] md:text-xs tracking-widest leading-none">Track all subscriptions, payments, and outstanding balances</p>
        </div>
        <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-slate-800 border-2 border-slate-800 shadow-bento-subtle transition active:translate-y-0.5">
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-blue-600 p-8 rounded-[2rem] text-white border-4 border-slate-900 shadow-bento flex flex-col justify-between relative overflow-hidden group">
           <div className="relative z-10">
             <span className="text-xs md:text-lg uppercase opacity-70 tracking-widest leading-none">Total Collected</span>
             <p className="text-3xl md:text-6xl font-black mt-2 tracking-tighter">{formatCurrency(stats.totalPaid)}</p>
             <div className="mt-8 inline-flex items-center gap-2 text-xs md:text-lg text-blue-50 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 uppercase tracking-widest backdrop-blur-sm">
               <TrendingUp size={14} /> Global Growth
             </div>
           </div>
           <CreditCard className="absolute -right-6 -bottom-6 h-40 w-40 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
        </div>
        
        <div className="bento-card p-10 flex flex-col justify-center bg-slate-900/50 border-slate-800">
           <span className="text-xs md:text-lg text-slate-300 uppercase tracking-[0.2em] mb-4">Awaiting Payment</span>
           <p className="text-3xl md:text-6xl font-black text-red-500 tracking-tighter">{formatCurrency(stats.totalPending)}</p>
           <p className="mt-6 text-[10px] md:text-lg text-slate-100 uppercase tracking-widest bg-slate-800/50 border border-slate-700 px-3 py-1.5 rounded-lg w-fit leading-none">
            {packages.filter(p => p.status !== 'Paid').length} ACTIVE PACKAGES
           </p>
        </div>

        <div className="bento-card p-10 flex flex-col justify-center bg-slate-900 text-white border-slate-800">
           <span className="text-xs md:text-lg text-slate-300 uppercase tracking-[0.2em] mb-4">Projected Revenue</span>
           <p className="text-3xl md:text-6xl font-black text-white tracking-tighter">{formatCurrency(stats.totalDue)}</p>
           <p className="mt-6 text-[10px] md:text-lg text-slate-400 uppercase tracking-widest border border-slate-600 px-3 py-1.5 rounded-lg w-fit leading-none">
            CONTRACTED VALUE
           </p>
        </div>
      </div>

      <div className="bg-slate-950 rounded-[2.5rem] border-2 border-slate-800 shadow-bento overflow-hidden">
        <div className="p-8 border-b-2 border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900/30">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Filter by player name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 border-2 border-slate-800 rounded-2xl bg-slate-900/50 text-white text-base md:text-xl uppercase tracking-tight focus:ring-0 shadow-bento-subtle focus:border-blue-500 transition-colors font-black"
            />
          </div>
          <div className="flex bg-slate-900 p-1.5 rounded-2xl border-2 border-slate-800 shadow-bento-subtle w-fit">
             {['all', 'Paid', 'Partially Paid', 'Not Paid'].map(status => (
               <button 
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-4 py-2.5 text-[10px] md:text-sm rounded-xl transition-all uppercase tracking-widest font-black",
                    statusFilter === status ? "bg-white text-slate-900 shadow-bento" : "text-slate-400 hover:text-slate-200"
                  )}
               >
                 {status}
               </button>
             ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-white">
                <th className="p-6 text-xs md:text-base uppercase tracking-[0.2em] text-slate-400">Athlete</th>
                <th className="p-6 text-xs md:text-base uppercase tracking-[0.2em] text-slate-400">Module Details</th>
                <th className="p-6 text-xs md:text-base uppercase tracking-[0.2em] text-slate-400">Status</th>
                <th className="p-6 text-xs md:text-base uppercase tracking-[0.2em] text-right text-slate-400">Raw Value</th>
                <th className="p-6 text-xs md:text-base uppercase tracking-[0.2em] text-right text-slate-400">Invoiced</th>
                <th className="p-6 text-xs md:text-base uppercase tracking-[0.2em] text-right text-slate-400">Pending</th>
                <th className="p-6 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-800/50">
              {filteredPackages.map(pkg => {
                const player = players.find(p => p.id === pkg.playerId);
                
                // Dynamic pricing derivation
                const getPricingFallback = (code: string, p: any) => {
                  const monthToUse = p.effectiveMonth || p.createdAt?.slice(0, 7) || new Date().toISOString().slice(0, 7);
                  const nSessions = p.numSessions || 8;
                  const s = pricingSchemes.find(ps => 
                    ps.packageTypeCode === code && 
                    ps.numSessions === nSessions &&
                    ps.effectiveMonth === monthToUse
                  ) || pricingSchemes.filter(ps => 
                    ps.packageTypeCode === code && 
                    ps.numSessions === nSessions
                  ).sort((a,b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]
                  || pricingSchemes.filter(ps => 
                    ps.packageTypeCode === code
                  ).sort((a,b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
                  return s?.sessionValue || 0;
                };

                const pkgSessions = (sessions || []).filter(s => String(s.packageId) === String(pkg.id));
                let derivedValue = 0;
                if (pkg.baseAmountOverride > 0) {
                   derivedValue = Number(pkg.baseAmountOverride) - Number(pkg.discountAmount || 0);
                } else if (pkgSessions.length > 0) {
                  derivedValue = pkgSessions.reduce((pAcc, s) => {
                    if (s.status === 'Cancelled') return pAcc;
                    const sCode = (s.sessionIndex || '').toString().split('-')[0] || pkg.packageTypeCode;
                    const val = getPricingFallback(sCode, pkg);
                    return pAcc + val;
                  }, 0) - (pkg.discountAmount || 0);
                } else {
                  const fallbackVal = getPricingFallback(pkg.packageTypeCode, pkg);
                  derivedValue = (fallbackVal * (pkg.numSessions || 8)) - (pkg.discountAmount || 0);
                }

                const finalDue = Math.max(derivedValue, Number(pkg.totalDue || 0));
                const pending = Math.max(0, finalDue - (pkg.paidAmount || 0));
                
                return (
                  <tr key={pkg.id} className="hover:bg-blue-900/10 transition-colors group">
                    <td className="p-6">
                      <p className="text-xl md:text-3xl text-white uppercase tracking-tighter group-hover:text-blue-400 transition-colors">{player?.name || 'Unknown'}</p>
                      <p className="text-xs md:text-xl text-slate-400 uppercase tracking-widest mt-1">START: {pkg.startDate ? format(safeParseISO(pkg.startDate), 'dd/MM/yyyy') : 'N/A'}</p>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col">
                        <span className="text-sm md:text-xl text-white uppercase bg-slate-800 px-2 py-0.5 rounded w-fit border border-slate-700">{pkg.packageTypeCode}</span>
                        <span className="text-xs md:text-xl text-blue-500 uppercase tracking-[0.2em] mt-1.5">{pkg.numSessions} SESSIONS</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={cn(
                        "text-sm md:text-xl uppercase px-3 py-1.5 rounded-xl border-2 shadow-bento",
                        pkg.status === 'Paid' ? "bg-emerald-600 text-white border-emerald-500" :
                         pkg.status === 'Partially Paid' ? "bg-amber-500 text-white border-amber-400" :
                        "bg-red-600 text-white border-red-500"
                      )}>
                        {pkg.status}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <p className="text-base md:text-3xl text-slate-300 uppercase">{formatCurrency(derivedValue)}</p>
                    </td>
                    <td className="p-6 text-right">
                      <p className="text-base md:text-3xl text-emerald-500 underline decoration-2 underline-offset-4">{formatCurrency(pkg.paidAmount)}</p>
                    </td>
                    <td className="p-6 text-right">
                      <p className={cn("text-xl md:text-4xl font-black", pending > 0 ? "text-red-500" : "text-emerald-500")}>
                        {formatCurrency(pending)}
                      </p>
                    </td>
                    <td className="p-6">
                      <Link 
                        to={`/players/${pkg.playerId}`} 
                        className="h-10 w-10 flex items-center justify-center border-2 border-slate-800 rounded-xl bg-slate-950 text-white shadow-bento hover:bg-slate-900 transition-all active:translate-y-0.5"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredPackages.length === 0 && (
             <div className="p-32 text-center bg-slate-900/20">
                <div className="h-24 w-24 bg-slate-950 border-4 border-dashed border-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-slate-800">
                   <DollarSign size={48} />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Zero Economic Records</h3>
                <p className="text-slate-500 mt-3 font-bold uppercase text-xs tracking-widest max-w-xs mx-auto">No subscriptions detected within the current filter criteria</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
