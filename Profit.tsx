import { safeParseISO } from "../lib/utils";
import React, { useState, useMemo } from 'react';

import { useData } from '../lib/DataContext';
import { 
  TrendingUp, 
  Filter, 
  Search, 
  Download, 
  DollarSign, 
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  Tag,
  Edit3
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { findBestPricingScheme } from '../lib/pricingUtils';
import { format, isSameMonth, getYear, getMonth } from 'date-fns';
import { motion } from 'motion/react';

export default function Profit() {
  const { 
    sessions, players, packages, packageTypes, locations, levels, pricingSchemes, updateMasterData
  } = useData();

  const [filter, setFilter] = useState({
    packageType: 'all',
    playerId: 'all',
    levelId: 'all',
    locationId: 'all',
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    quarter: '1',
    periodType: 'month', // 'month', 'quarter', 'year'
    comparePrevious: false,
    viewType: 'session', // 'session', 'player', 'location', 'package'
    detailLevel: 'summary' // 'summary', 'detailed'
  });

  const filteredData = useMemo(() => {
    return sessions.filter(s => {
      const sDate = safeParseISO(s.date);
      const player = players.find(p => p.id === s.playerId);
      if (!player) return false;
      const pkg = packages.find(pk => pk.id === s.packageId);

      const matchesYear = getYear(sDate).toString() === filter.year;
      let matchesPeriod = true;
      if (filter.periodType === 'month') {
          matchesPeriod = (getMonth(sDate) + 1).toString().padStart(2, '0') === filter.month;
      } else if (filter.periodType === 'quarter') {
          const quarter = Math.floor(getMonth(sDate) / 3) + 1;
          matchesPeriod = quarter.toString() === filter.quarter;
      }

      const matchesPlayer = filter.playerId === 'all' || s.playerId === filter.playerId;
      const matchesType = filter.packageType === 'all' || pkg?.packageTypeCode === filter.packageType;
      const matchesLevel = filter.levelId === 'all' || player?.levelId === filter.levelId;
      const matchesLocation = filter.locationId === 'all' || s.locationId === filter.locationId;

      return matchesYear && matchesPeriod && matchesPlayer && matchesType && matchesLevel && matchesLocation;
    });
  }, [sessions, filter, players, packages]);

  const getPricingFallback = (code: string, s: any) => {
    const pkg = packages.find(p => p.id === s.packageId);
    const timeline = pkg?.effectiveMonth || 'current';
    const anchor = pkg?.startDate || s.date || new Date().toISOString().slice(0, 10);
    const nSessions = pkg?.numSessions || 8;
    
    const scheme = findBestPricingScheme(pricingSchemes, code, nSessions, timeline, anchor);
    return scheme?.sessionValue || 0;
  };

  const summaryData = useMemo(() => {
    if (filter.detailLevel !== 'summary') return [];
    
    // Grouping logic based on filter.viewType
    const groups: Record<string, { name: string, rev: number, count: number }> = {};
    
    filteredData.forEach(s => {
        let key = 'Other';
        let name = 'Other';
        
        if (filter.viewType === 'player') {
            const p = players.find(p => p.id === s.playerId);
            key = s.playerId;
            name = p?.name || 'Unknown';
        } else if (filter.viewType === 'location') {
            const l = locations.find(l => l.id === s.locationId);
            key = s.locationId || 'none';
            name = l?.name || 'Unknown';
        } else if (filter.viewType === 'package') {
            const p = packages.find(pk => pk.id === s.packageId);
            key = s.packageId || 'none';
            name = p?.packageTypeCode || 'Unknown';
        } else {
             // Session view doesn't really have a "summary" mode distinct from detailed usually, but let's just group by date
             key = s.date;
             name = s.date;
        }

        if (!groups[key]) groups[key] = { name, rev: 0, count: 0 };
        const isValuated = ['Attended', 'Scheduled', 'Compensated', 'Attended Comp. Session', 'Absent'].includes(s.status);
        if (isValuated) {
            const sVal = (s.value !== undefined && s.value !== null && s.value !== 0)
              ? s.value
              : getPricingFallback((s.sessionIndex || '').toString().split('-')[0] || 'G1', s);
            groups[key].rev += (sVal || 0) - (s.discount || 0);
        }
        groups[key].count += 1;
    });
    
    return Object.values(groups);
  }, [filteredData, filter.detailLevel, filter.viewType, players, locations, packages]);

  const stats = useMemo(() => {
    const totalRev = filteredData.reduce((acc, s) => {
        const isValuated = ['Attended', 'Scheduled', 'Compensated', 'Attended Comp. Session', 'Absent'].includes(s.status);
        if (isValuated) {
          const sVal = (s.value !== undefined && s.value !== null && s.value !== 0)
            ? s.value
            : getPricingFallback((s.sessionIndex || '').toString().split('-')[0] || 'G1', s);
          return acc + (sVal || 0) - (s.discount || 0);
        }
        return acc;
    }, 0);
    const sessionsCount = filteredData.length;
    return { totalRev, sessionsCount };
  }, [filteredData]);

  const handleUpdateSession = async (id: string, updates: any) => {
    await updateMasterData('sessions', id, updates);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] md:text-sm font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Financial Intelligence</p>
          <h1 className="text-3xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none">Profit & Revenue</h1>
          <p className="text-slate-400 mt-3 font-bold uppercase text-[10px] md:text-lg tracking-widest leading-none">Analyze your earnings and session values by various criteria</p>
        </div>
        <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-base tracking-widest hover:bg-slate-800 border-2 border-slate-800 shadow-bento-subtle transition active:translate-y-0.5">
          <Download size={18} />
          Export Report
        </button>
      </div>

      {/* Filter Section */}
      <div className="bg-slate-900/50 p-6 rounded-[2.5rem] border-2 border-slate-800 shadow-bento-subtle grid grid-cols-2 lg:grid-cols-8 gap-6">
        <div className="lg:col-span-1">
            <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Chronicle: Period</label>
            <select value={filter.periodType} onChange={e => setFilter({...filter, periodType: e.target.value})} className="w-full border-2 border-slate-800 rounded-xl text-sm md:text-lg  py-3 px-4 bg-slate-950 text-white uppercase tracking-tight focus:ring-0 cursor-pointer">
                <option value="month" className="bg-slate-900">MONTHLY</option>
                <option value="quarter" className="bg-slate-900">QUARTERLY</option>
                <option value="year" className="bg-slate-900">YEARLY</option>
            </select>
        </div>
        <div>
            <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Chronicle: Year</label>
            <select value={filter.year} onChange={e => setFilter({...filter, year: e.target.value})} className="w-full border-2 border-slate-800 rounded-xl text-sm md:text-lg  py-3 px-4 bg-slate-950 text-white uppercase tracking-tight focus:ring-0 cursor-pointer">
                {['2025', '2026', '2027'].map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
            </select>
        </div>
        {filter.periodType === 'month' && (
            <div>
                <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Chronicle: Month</label>
                <select value={filter.month} onChange={e => setFilter({...filter, month: e.target.value})} className="w-full border-2 border-slate-800 rounded-xl text-sm md:text-lg  py-3 px-4 bg-slate-950 text-white uppercase tracking-tight focus:ring-0 cursor-pointer">
                    {Array.from({length: 12}, (_, i) => (i+1).toString().padStart(2, '0')).map(m => (
                        <option key={m} value={m} className="bg-slate-900">{format(new Date(2026, parseInt(m)-1, 1), 'MMMM')}</option>
                    ))}
                </select>
            </div>
        )}
        {filter.periodType === 'quarter' && (
            <div>
                <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Chronicle: Quarter</label>
                <select value={filter.quarter} onChange={e => setFilter({...filter, quarter: e.target.value})} className="w-full border-2 border-slate-800 rounded-xl text-sm md:text-lg  py-3 px-4 bg-slate-950 text-white uppercase tracking-tight focus:ring-0 cursor-pointer">
                    {['1', '2', '3', '4'].map(q => <option key={q} value={q} className="bg-slate-900">{`Q${q}`}</option>)}
                </select>
            </div>
        )}
        <div className="lg:col-span-2 grid grid-cols-3 gap-2">
            <div>
                <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">View Type</label>
                <select value={filter.viewType} onChange={e => setFilter({...filter, viewType: e.target.value})} className="w-full border-2 border-slate-800 rounded-xl text-sm md:text-lg  py-3 px-4 bg-slate-950 text-white uppercase tracking-tight focus:ring-0 cursor-pointer">
                    <option value="session" className="bg-slate-900">SESSIONS</option>
                    <option value="player" className="bg-slate-900">PER PLAYER</option>
                    <option value="location" className="bg-slate-900">PER LOCATION</option>
                    <option value="package" className="bg-slate-900">PER PACKAGE</option>
                </select>
            </div>
            <div>
                <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Detail Level</label>
                <select value={filter.detailLevel} onChange={e => setFilter({...filter, detailLevel: e.target.value})} className="w-full border-2 border-slate-800 rounded-xl text-sm md:text-lg  py-3 px-4 bg-slate-950 text-white uppercase tracking-tight focus:ring-0 cursor-pointer">
                    <option value="summary" className="bg-slate-900">SUMMARY</option>
                    <option value="detailed" className="bg-slate-900">DETAILED</option>
                </select>
            </div>
            <div>
                <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">View Comparison</label>
                <button onClick={() => setFilter({...filter, comparePrevious: !filter.comparePrevious})} className={cn("w-full border-2 rounded-xl text-sm font-black py-3 px-4 uppercase tracking-tight transition-colors h-11", filter.comparePrevious ? "border-blue-500 bg-blue-950 text-blue-200" : "border-slate-800 bg-slate-950 text-slate-400")}>
                    {filter.comparePrevious ? 'ENABLED' : 'DISABLED'}
                </button>
            </div>
        </div>
        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
                <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Module Type</label>
                <select value={filter.packageType} onChange={e => setFilter({...filter, packageType: e.target.value})} className="w-full border-2 border-slate-800 rounded-xl text-sm md:text-lg  py-3 px-4 bg-slate-950 text-white uppercase tracking-tight focus:ring-0 cursor-pointer">
                    <option value="all" className="bg-slate-900">ANY CLASSIFICATION</option>
                    {packageTypes.map(pt => <option key={pt.id} value={pt.code} className="bg-slate-900">{pt.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Identity: Player</label>
                <select value={filter.playerId} onChange={e => setFilter({...filter, playerId: e.target.value})} className="w-full border-2 border-slate-800 rounded-xl text-sm md:text-lg  py-3 px-4 bg-slate-950 text-white uppercase tracking-tight focus:ring-0 cursor-pointer">
                    <option value="all" className="bg-slate-900">ALL ATHLETES</option>
                    {players.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Deployment: Location</label>
                <select value={filter.locationId} onChange={e => setFilter({...filter, locationId: e.target.value})} className="w-full border-2 border-slate-800 rounded-xl text-sm md:text-lg  py-3 px-4 bg-slate-950 text-white uppercase tracking-tight focus:ring-0 cursor-pointer">
                    <option value="all" className="bg-slate-900">ALL FIELDS</option>
                    {locations.map(l => <option key={l.id} value={l.id} className="bg-slate-900">{l.name}</option>)}
                </select>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-blue-600 p-10 rounded-[2.5rem] text-white border-4 border-slate-900 shadow-bento flex items-center justify-between overflow-hidden relative group">
              <div className="relative z-10">
                <span className="text-[10px] md:text-sm font-black uppercase opacity-70 tracking-[0.2em]">Total Revenue</span>
                <p className="text-3xl md:text-7xl font-black mt-3 tracking-tighter">{formatCurrency(stats.totalRev)}</p>
                <div className="mt-8 inline-flex items-center gap-3 text-[10px] md:text-sm font-black text-blue-100 bg-black/20 px-4 py-2 rounded-xl border border-white/10 uppercase tracking-widest backdrop-blur-md">
                   Derived from {stats.sessionsCount} sessions
                </div>
              </div>
              <TrendingUp className="absolute -right-8 -bottom-8 h-56 w-56 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
          </div>
          <div className="bento-card p-10 flex flex-col justify-center bg-slate-950 text-white border-slate-800">
              <span className="text-[10px] md:text-sm font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Average Session Valuation</span>
              <p className="text-3xl md:text-6xl font-black text-white tracking-tighter leading-none">{formatCurrency(stats.sessionsCount ? stats.totalRev / stats.sessionsCount : 0)}</p>
              <div className="mt-8 h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-1">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '70%' }} />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4">Calculated efficiency ratio</p>
          </div>
      </div>

      <div className="bg-slate-950 rounded-[2.5rem] border-2 border-slate-800 shadow-bento overflow-hidden">
          <div className="p-8 border-b-2 border-slate-800 flex items-center justify-between bg-slate-900/30">
              <h2 className="text-xl md:text-3xl font-black text-white flex items-center gap-4 uppercase tracking-tighter leading-none">
                <TableIcon size={24} className="text-slate-400" />
                Session Intelligence Details
              </h2>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-slate-900/80 text-white">
                          {filter.detailLevel === 'detailed' ? (
                              <>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Athlete</th>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Chronicle</th>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Package Module</th>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Module Pos</th>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Raw Value</th>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Deduction</th>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-right text-slate-400">Net Liquidity</th>
                              </>
                          ) : (
                             <>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-slate-400">{filter.viewType === 'player' ? 'Athlete' : filter.viewType === 'location' ? 'Location' : filter.viewType === 'package' ? 'Package' : 'Date'}</th>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Sessions</th>
                                <th className="p-6 text-sm font-black uppercase tracking-[0.2em] text-right text-slate-400">Net Liquidity</th>
                             </>
                          )}
                      </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-800/50">
                      {filter.detailLevel === 'detailed' ? (
                          filteredData.map((s) => {
                            const player = players.find(p => p.id === s.playerId);
                            const pkg = packages.find(pk => pk.id === s.packageId);
                            return (
                                <tr key={s.id} className="hover:bg-blue-900/10 transition-colors group text-white">
                                    <td className="p-6">
                                        <p className="text-xl font-black text-white uppercase tracking-tighter group-hover:text-blue-400 transition-colors">{player?.name || 'Unknown'}</p>
                                        <p className="text-base font-black text-slate-400 uppercase tracking-widest mt-1 bg-slate-900 px-2 py-0.5 rounded w-fit">{levels.find(l => l.id === player?.levelId)?.name}</p>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-xl font-black text-slate-300 uppercase tracking-tight">{s.date ? format(safeParseISO(s.date), 'dd/MM/yyyy') : '-'}</p>
                                        <p className="text-base font-black text-blue-500 uppercase tracking-widest mt-1">{s.date ? format(safeParseISO(s.date), 'EEEE') : '-'}</p>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col">
                                            <span className="text-lg font-black text-white uppercase">{pkg?.packageTypeCode}</span>
                                            <span className="text-base font-black text-slate-400 uppercase tracking-widest mt-1">{pkg?.numSessions} SESSIONS</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <span className="h-8 w-8 rounded-lg bg-slate-900 text-white border border-slate-800 flex items-center justify-center text-base font-black">{s.sessionIndex}</span>
                                            <span className={cn(
                                                "text-base font-black uppercase px-2 py-1 rounded-lg border-2 shadow-bento",
                                                s.status === 'Attended' ? "bg-emerald-600 text-white border-emerald-500" : "bg-red-600 text-white border-red-500"
                                            )}>{s.status}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2 group/input bg-slate-950 border-2 border-slate-800 rounded-xl px-3 py-1.5 w-fit">
                                            <input 
                                                type="number" 
                                                value={s.value || 0}
                                                onChange={(e) => handleUpdateSession(s.id!, { value: Number(e.target.value) })}
                                                className="w-16 bg-transparent border-none p-0 text-base font-black text-white focus:ring-0 cursor-edit uppercase"
                                            />
                                            <Edit3 size={11} className="text-slate-500 opacity-0 group-hover/input:opacity-100 transition-opacity" />
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2 bg-red-950/20 border-2 border-red-900/30 rounded-xl px-3 py-1.5 w-fit">
                                            <Tag size={11} className="text-red-500" />
                                            <input 
                                                type="number" 
                                                value={s.discount || 0}
                                                onChange={(e) => handleUpdateSession(s.id!, { discount: Number(e.target.value) })}
                                                className="w-16 bg-transparent border-none p-0 text-base font-black text-red-500 focus:ring-0"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <p className="text-xl font-black text-white tracking-tighter">{formatCurrency((s.value || 0) - (s.discount || 0))}</p>
                                    </td>
                                </tr>
                            );
                          })
                      ) : (
                          summaryData.map((item, idx) => (
                              <tr key={idx} className="hover:bg-blue-900/10 transition-colors text-white">
                                  <td className="p-6 text-xl font-black uppercase tracking-tight">{item.name}</td>
                                  <td className="p-6 text-xl font-black text-slate-300">{item.count}</td>
                                  <td className="p-6 text-right text-xl font-black tracking-tighter text-white">{formatCurrency(item.rev)}</td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>

              {filteredData.length === 0 && (
                  <div className="p-32 text-center bg-slate-900/20">
                      <div className="h-24 w-24 bg-slate-950 border-4 border-dashed border-slate-800 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-slate-800 rotate-12">
                        <TrendingUp size={48} />
                      </div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Zero Kinetic Revenue</h3>
                      <p className="text-slate-500 mt-3 font-bold uppercase text-lg tracking-widest max-w-xs mx-auto">No transaction data detected for the specific filter sequence</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
}
