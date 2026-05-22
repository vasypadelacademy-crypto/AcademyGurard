import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../lib/DataContext';
import { VpLogoSvg } from '../components/VpLogoSvg';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { 
  Users, 
  CreditCard, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  Package as PackageIcon,
  ChevronRight,
  TrendingDown,
  Clock,
  X,
  Bell,
  Search,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  User,
  ArrowRight,
  Download,
  Upload
} from 'lucide-react';
import { cn, formatCurrency, formatKLE, formatTimeAMPM, getGroupColor } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { format, isSameDay } from 'date-fns';
import Papa from 'papaparse';
import { PaymentModal } from '../components/PaymentModal';
import { calculatePackageValues } from '../lib/pricingUtils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { players, packages, sessions, payments, packageTypes, groups, locations, pricingSchemes, levels, appUsers, addMasterData } = useData();
  const [packageFilter, setPackageFilter] = useState<'current' | 'all'>('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [payingPackage, setPayingPackage] = useState<any>(null);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleExportBackup = () => {
    setIsExporting(true);
    setBackupStatus(null);
    try {
      const collections = [
        { type: 'packageTypes', data: packageTypes },
        { type: 'locations', data: locations },
        { type: 'levels', data: levels },
        { type: 'groups', data: groups },
        { type: 'pricingSchemes', data: pricingSchemes },
        { type: 'players', data: players },
        { type: 'packages', data: packages },
        { type: 'sessions', data: sessions },
        { type: 'payments', data: payments },
        { type: 'appUsers', data: appUsers }
      ];

      const rows: any[] = [];
      collections.forEach(col => {
        (col.data || []).forEach((item: any) => {
          const { id, ownerId, createdAt, updatedAt, addedBy, updatedBy, ...rest } = item;
          rows.push({
            BACKUP_ENTITY_TYPE: col.type,
            BACKUP_LEGACY_ID: id || '',
            ...rest
          });
        });
      });

      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `VasY_Academy_Full_Backup_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setBackupStatus({ type: 'success', message: 'Full backup exported successfully' });
    } catch (err: any) {
      setBackupStatus({ type: 'error', message: `Export failed: ${err.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setBackupStatus(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let successCount = 0;
        let failCount = 0;
        const idMap: Record<string, string> = {};

        const processRows = async (types: string[]) => {
          for (const type of types) {
            const typeRows = rows.filter(r => r.BACKUP_ENTITY_TYPE === type);
            for (const row of typeRows) {
              const { BACKUP_ENTITY_TYPE, BACKUP_LEGACY_ID, ...payload } = row;
              try {
                Object.keys(payload).forEach(key => {
                  const val = payload[key];
                  if (val === 'true') payload[key] = true;
                  else if (val === 'false') payload[key] = false;
                  else if (val !== '' && !isNaN(val as any) && !key.toLowerCase().includes('phone') && !key.toLowerCase().includes('id') && key !== 'ref') {
                    payload[key] = Number(val);
                  }
                  if (key.toLowerCase().includes('id') && idMap[val]) {
                    payload[key] = idMap[val];
                  }
                });

                const result: any = await addMasterData(BACKUP_ENTITY_TYPE, payload);
                if (result && result.id && BACKUP_LEGACY_ID) {
                  idMap[BACKUP_LEGACY_ID] = result.id;
                }
                successCount++;
              } catch (err) {
                console.error(`Failed to import ${BACKUP_ENTITY_TYPE}`, err);
                failCount++;
              }
            }
          }
        };

        const masterTypes = ['locations', 'levels', 'groups', 'pricingSchemes', 'packageTypes', 'appUsers'];
        const transactionalTypes = ['players', 'packages', 'sessions', 'payments'];
        await processRows(masterTypes);
        await processRows(transactionalTypes);

        setBackupStatus({ 
          type: failCount === 0 ? 'success' : 'error', 
          message: `Restore complete: ${successCount} records added. ${failCount} failed.` 
        });
        setIsImporting(false);
      },
      error: (err) => {
        setBackupStatus({ type: 'error', message: `CSV Parse Error: ${err.message}` });
        setIsImporting(false);
      }
    });
  };

  // Pre-calculate mappings for O(1) lookups
  const playersMap = useMemo(() => new Map((players || []).map(p => [String(p.id), p])), [players]);
  const groupsMap = useMemo(() => new Map((groups || []).map(g => [String(g.id), g])), [groups]);
  const locationsMap = useMemo(() => new Map((locations || []).map(l => [String(l.id), l])), [locations]);
  const levelsMap = useMemo(() => new Map((levels || []).map(l => [String(l.id), l])), [levels]);
  const packageTypesMap = useMemo(() => new Map((packageTypes || []).map(t => [t.code, t])), [packageTypes]);

  const getPricingFallback = (code: string, p: any) => {
    if (!p) return { value: 0, cost: 0 };
    const monthToUse = p.effectiveMonth || p.createdAt?.slice(0, 7) || new Date().toISOString().slice(0, 7);
    const nSessions = p?.numSessions || 8;
    const scheme = pricingSchemes.find(ps => 
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
    
    return { value: scheme?.sessionValue || 0, cost: scheme?.sessionCost || 0 };
  };

  const getPackageFinancials = useCallback((p: any, pkgSessions: any[]) => {
    if (!p) return { turnover: 0, cost: 0, profit: 0, pending: 0, paid: 0 };
    
    // Use the central pricing utility for consistency
    const { derivedTotalDue, derivedTotalCost, derivedBaseAmount } = calculatePackageValues(p, pkgSessions, pricingSchemes, p.forceSystemPricing || false);
    
    const turnover = derivedTotalDue;
    const cost = derivedTotalCost;

    // 3. Calculate paid amount from payments collection (most reliable)
    const pkgPayments = (payments || []).filter(pay => String(pay.packageId) === String(p.id));
    const actualPaid = pkgPayments.reduce((acc, pay) => acc + Number(pay.amount || 0), 0);
    
    // Only use pkg.paidAmount if no payments are recorded (for legacy/imported data)
    const paidToUse = actualPaid > 0 ? actualPaid : (Number(p.paidAmount || 0));

    return {
      turnover,
      cost,
      profit: turnover - cost,
      paid: paidToUse,
      pending: Math.max(0, turnover - paidToUse),
      isPaid: Math.abs(turnover - paidToUse) <= 1.0
    };
  }, [sessions, payments, pricingSchemes]);

  const openKpiDetails = (kpiName: string) => {
    setActiveKpi(kpiName);
    setIsModalOpen(true);
  };

  // Calculations for summary results
  const allActivePackages = useMemo(() => {
    // 1. Map sessions by packageId for O(1) lookup
    const sessionsByPackage: Record<string, typeof sessions> = {};
    (sessions || []).forEach(s => {
      const pkgId = String(s.packageId);
      if (!sessionsByPackage[pkgId]) sessionsByPackage[pkgId] = [];
      sessionsByPackage[pkgId].push(s);
    });

    // 2. Group packages by player to find the LATEST active package for each
    const playerPackages: Record<string, typeof packages> = {};
    packages.forEach(p => {
      const pid = String(p.playerId);
      if (!playerPackages[pid]) playerPackages[pid] = [];
      playerPackages[pid].push(p);
    });

    const active: typeof packages = [];
    Object.values(playerPackages).forEach(pkgs => {
      // Sort by date/creation to get latest
      const sorted = [...pkgs].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      
      // Find the first one that has pending sessions
      const latestActive = sorted.find(p => {
        const pkgSessions = sessionsByPackage[String(p.id)] || [];
        const usedCount = pkgSessions.filter(s => 
          s.status === 'Attended' || 
          s.status === 'Compensated' || 
          s.status === 'Attended Comp. Session' ||
          s.status === 'Absent'
        ).length;
        return usedCount < (p.numSessions || 8);
      });

      if (latestActive) active.push(latestActive);
      else if (sorted[0]) active.push(sorted[0]);
    });

    return active;
  }, [packages, sessions]);

  const basePackages = packageFilter === 'current' ? allActivePackages : packages;
  
  const filteredPackages = useMemo(() => {
    const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t);
    if (searchTerms.length === 0) return basePackages;
    
    return basePackages.filter(p => {
      const player = playersMap.get(String(p.playerId));
      const group = player ? groupsMap.get(String(player.groupId)) : undefined;
      
      const searchable = [
        player?.name,
        player?.email,
        group?.name,
        group?.code,
        p.packageTypeCode
      ].map(s => (s || '').toLowerCase());

      return searchTerms.every(term => 
        searchable.some(field => field.includes(term))
      );
    });
  }, [basePackages, searchTerm, players, groups]);

  const activePlayerIds = useMemo(() => new Set(filteredPackages.map(p => String(p.playerId))), [filteredPackages]);
  const activePlayersCount = activePlayerIds.size;

  const activeGroupIds = useMemo(() => {
    return new Set(players.filter(p => activePlayerIds.has(String(p.id))).map(p => p.groupId).filter(Boolean));
  }, [players, activePlayerIds]);
  const activeGroupsCount = activeGroupIds.size;

  const { totalGrossTurnover, totalProjectedProfit, totalProjectedCosts, realizedRevenue, totalOutstanding, monthlyData, packageTypeSummary } = useMemo(() => {
    let turnoverResult = 0;
    let profitResult = 0;
    let costResult = 0;
    let realizedResult = 0;
    let pendingResult = 0;

    const months: Record<string, { month: string, turnover: number, profit: number }> = {};
    const pkgSummary: Record<string, { sessions: number, attended: number, absent: number, value: number, profit: number }> = {};

    // Map sessions by packageId for performance
    const sessionsByPackage: Record<string, typeof sessions> = {};
    (sessions || []).forEach(s => {
      const pkgId = String(s.packageId);
      if (!sessionsByPackage[pkgId]) sessionsByPackage[pkgId] = [];
      sessionsByPackage[pkgId].push(s);
    });

    filteredPackages.forEach(p => {
      const pkgSessions = sessionsByPackage[String(p.id)] || [];
      const financials = getPackageFinancials(p, pkgSessions);
      
      const pkgType = p.packageTypeCode || 'Unknown';
      if (!pkgSummary[pkgType]) {
        pkgSummary[pkgType] = { sessions: 0, attended: 0, absent: 0, value: 0, profit: 0 };
      }

      // Update pkgSummary with session counts (for the type stats)
      pkgSessions.forEach(s => {
        if (s.status === 'Attended' || s.status === 'Compensated' || s.status === 'Attended Comp. Session') {
          pkgSummary[pkgType].attended += 1;
          pkgSummary[pkgType].sessions += 1;
        } else if (s.status === 'Absent') {
          pkgSummary[pkgType].absent += 1;
          pkgSummary[pkgType].sessions += 1;
        }
      });
      // For types summary, we might need a better count if no sessions exist, 
      // but let's keep it consistent with turnover for now.
      if (pkgSessions.length === 0) {
        pkgSummary[pkgType].sessions += (p.numSessions || 8);
      }

      turnoverResult += financials.turnover;
      costResult += financials.cost;
      profitResult += financials.profit;
      realizedResult += financials.paid;
      pendingResult += financials.pending;

      pkgSummary[pkgType].value += financials.turnover;
      pkgSummary[pkgType].profit += financials.profit;

      const month = p.effectiveMonth || p.createdAt?.slice(0, 7) || new Date().toISOString().slice(0, 7);
      if (!months[month]) {
        months[month] = { month, turnover: 0, profit: 0 };
      }
      months[month].turnover += financials.turnover;
      months[month].profit += financials.profit;
    });

    return { 
      totalGrossTurnover: turnoverResult, 
      totalProjectedProfit: profitResult, 
      totalProjectedCosts: costResult,
      realizedRevenue: realizedResult,
      totalOutstanding: pendingResult,
      monthlyData: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6),
      packageTypeSummary: Object.entries(pkgSummary).map(([name, stats]) => ({ name, ...stats }))
    };
  }, [filteredPackages, sessions, pricingSchemes]);

  const collectionEfficiency = totalGrossTurnover > 0 ? Math.round((realizedRevenue / totalGrossTurnover) * 100) : 0;
  const profitMargin = totalGrossTurnover > 0 ? Math.round((totalProjectedProfit / totalGrossTurnover) * 100) : 0;
  
  // Calculate stats based on Attended, Compensated, or Absent sessions
  const validSessions = useMemo(() => {
    const pkgIds = new Set(filteredPackages.map(p => String(p.id)));
    return (sessions || []).filter(s => {
      const isStatusValid = ['Attended', 'Scheduled', 'Compensated', 'Attended Comp. Session', 'Absent'].includes(s.status);
      if (!isStatusValid) return false;
      
      // Only include sessions belonging to the currently filtered packages
      return pkgIds.has(String(s.packageId));
    });
  }, [sessions, filteredPackages]);

  // Calculate average cost per hour
  const averageCostPerHour = validSessions.length > 0 
    ? validSessions.reduce((acc, s) => {
        let sc = Number(s.cost) || 0;
        if (sc === 0 && s.packageId) {
          const pkg = packages.find(p => p.id === s.packageId);
          if (pkg) {
            const scheme = pricingSchemes.find(ps => ps.packageTypeCode === pkg.packageTypeCode && ps.numSessions === pkg.numSessions);
            if (scheme) sc = scheme.sessionCost || 0;
          }
        }
        return acc + sc;
      }, 0) / validSessions.length 
    : 0;
  
  const totalPackageSessions = filteredPackages.reduce((acc, p) => acc + (p.numSessions || 0), 0);
  const totalAttendedFromFiltered = validSessions.length;
  const utilizationRate = totalPackageSessions > 0 ? Math.round((totalAttendedFromFiltered / totalPackageSessions) * 100) : 0;

  // Package Type Summary removed (computed above)


  // Monthly Analytics Data removed (computed above)

  // Distribution Data
  const getDistributionData = (type: 'location' | 'level') => {
    const distribution: Record<string, number> = {};
    
    // Pre-map sessions for O(1) lookup
    const sessionsByPackage: Record<string, typeof sessions> = {};
    (sessions || []).forEach(s => {
      const pkgId = String(s.packageId);
      if (!sessionsByPackage[pkgId]) sessionsByPackage[pkgId] = [];
      sessionsByPackage[pkgId].push(s);
    });

    filteredPackages.forEach(p => {
      let key = 'Other';
      const player = playersMap.get(String(p.playerId));

      if (type === 'location') {
        const locId = p.locationId || player?.locationId;
        const location = locationsMap.get(String(locId));
        key = location?.name || 'Unknown Location';
      } else if (type === 'level') {
        const levelId = player?.levelId;
        const level = levelsMap.get(String(levelId));
        key = level?.name || levelId || 'No Level';
      }
      
      const pkgSessions = sessionsByPackage[String(p.id)] || [];
      const { turnover } = getPackageFinancials(p, pkgSessions);
      
      distribution[key] = (distribution[key] || 0) + turnover;
    });

    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  };

  // Margin calculation
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center shrink-0">
            <VpLogoSvg className="h-full w-full text-white" />
          </div>
          <div>
            <p className="text-[10px] md:text-xs text-blue-500 uppercase tracking-[0.2em] mb-2 leading-none whitespace-nowrap">VAS-Y PADEL ACADEMY</p>
            <h1 className="text-2xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none italic">Dashboard</h1>
            <p className="text-slate-400 mt-4 uppercase text-[10px] md:text-xs tracking-widest leading-none font-bold">Consolidated operational and financial performance metrics</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="relative group w-full md:w-64">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={16} />
             <input 
               type="text"
               placeholder="SEARCH PLAYER/GROUP..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
             />
             {searchTerm && (
               <button 
                 onClick={() => setSearchTerm('')}
                 className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
               >
                 <X size={14} />
               </button>
             )}
          </div>

          <button 
            onClick={() => setIsBackupOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 border-2 border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-slate-600 transition-all whitespace-nowrap"
          >
            <Download size={14} />
            BACKUP & RESTORE
          </button>

          <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 self-start md:self-center">
            <button 
              onClick={() => setPackageFilter('current')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                packageFilter === 'current' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Current Only
            </button>
            <button 
              onClick={() => setPackageFilter('all')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                packageFilter === 'all' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Historical
            </button>
          </div>
        </div>
      </header>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPIBox 
          title="Active Groups" 
          value={activeGroupsCount.toString()} 
          icon={Users} 
          subValue={`${groups.length} TOTAL`}
          color="blue"
          onClick={() => openKpiDetails('Groups')}
        />
        <KPIBox 
          title="Active Athletes" 
          value={activePlayersCount.toString()} 
          icon={Users} 
          subValue={`${players.length} ENROLLED`}
          color="indigo"
          onClick={() => openKpiDetails('Athletes')}
        />
        <KPIBox 
          title="Gross Turnover" 
          value={formatKLE(totalGrossTurnover)} 
          icon={TrendingUp} 
          subValue="TOTAL PACKAGE VALUE"
          color="emerald"
          onClick={() => openKpiDetails('Revenue')}
        />
        <KPIBox 
          title="Profit Margin" 
          value={formatKLE(totalProjectedProfit)} 
          icon={TrendingUp} 
          subValue={`${profitMargin}% PROJECTED MARGIN`}
          color="emerald"
          onClick={() => openKpiDetails('Profit')}
        />
        <KPIBox 
          title="Outstanding Balance" 
          value={formatKLE(totalOutstanding)} 
          icon={TrendingDown} 
          subValue={`${collectionEfficiency}% EFFICIENCY`}
          color="red"
          onClick={() => openKpiDetails('Outstanding')}
        />
        <KPIBox 
          title="Training Volume" 
          value={`${totalPackageSessions}`} 
          icon={Clock} 
          subValue="TOTAL SLOTS FOR SELECTED"
          color="amber"
          onClick={() => openKpiDetails('Volume')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Financial Summary */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bento-card bg-slate-900/50 border-2 border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                <TrendingUp className="text-blue-500" />
                Revenue Analytics
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Gross Turnover</span>
                <p className="text-4xl text-white font-black tracking-tighter">{formatKLE(totalGrossTurnover)}</p>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">Projected Profit</span>
                <p className="text-4xl text-emerald-400 font-black tracking-tighter">{formatKLE(totalProjectedProfit)}</p>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] text-red-500 uppercase font-black tracking-widest">Total Op. Costs</span>
                <p className="text-4xl text-red-400 font-black tracking-tighter">{formatKLE(totalProjectedCosts)}</p>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Outstanding (Lock)</span>
                <p className="text-2xl text-slate-400 font-black tracking-tighter">{formatKLE(totalOutstanding)}</p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="flex justify-between items-end mb-3">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Collection Efficiency</span>
                  <span className="text-xl font-black text-blue-500">{collectionEfficiency}%</span>
                </div>
                <div className="h-4 w-full bg-slate-950 rounded-full border-2 border-slate-800 p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${collectionEfficiency}%` }}
                    className="h-full bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-3">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Profit Margin</span>
                  <span className={cn("text-xl font-black", profitMargin >= 0 ? "text-emerald-500" : "text-red-500")}>{profitMargin}%</span>
                </div>
                <div className="h-4 w-full bg-slate-950 rounded-full border-2 border-slate-800 p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, profitMargin))}%` }}
                    className={cn("h-full rounded-full shadow-lg", profitMargin >= 0 ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-500 shadow-red-500/20")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Revenue & Margin Analytics Chart */}
          <div className="bento-card bg-slate-900/50 border-2 border-slate-800 p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                <BarChart3 className="text-blue-500" />
                Monthly Performance Analytics
              </h2>
              <div className="flex bg-slate-950 border-2 border-slate-800 rounded-xl overflow-hidden p-1">
                <button
                  onClick={() => setChartType('bar')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors",
                    chartType === 'bar' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white"
                  )}
                >
                  Bar
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors",
                    chartType === 'line' ? "bg-slate-800 text-white" : "text-slate-500 hover:text-white"
                  )}
                >
                  Line
                </button>
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                      tickFormatter={(val) => (val || '').toString().split('-').reverse().join('/')}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', tracking: 'widest' }} />
                    <Bar dataKey="turnover" name="Turnover" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                      tickFormatter={(val) => (val || '').toString().split('-').reverse().join('/')}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', tracking: 'widest' }} />
                    <Line type="monotone" dataKey="turnover" name="Turnover" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue Distribution */}
          {/* Package Type Summary Table */}
          <div className="bento-card bg-slate-900/50 border-2 border-slate-800 p-8">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-4 mb-8">
              <Layers className="text-blue-500" />
              Package Type Performance
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-slate-500 font-black uppercase tracking-widest border-b border-slate-800">
                    <th className="text-left pb-4">Package</th>
                    <th className="text-center pb-4">Total Sessions</th>
                    <th className="text-center pb-4">Attended</th>
                    <th className="text-center pb-4">Absent</th>
                    <th className="text-right pb-4">Realized Value</th>
                    <th className="text-right pb-4">Avg. Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {packageTypeSummary.map((item) => (
                    <tr key={item.name} className="group hover:bg-white/5 transition-colors">
                      <td className="py-4">
                        <span className="text-sm font-black text-white uppercase italic">{item.name}</span>
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-sm font-black text-slate-400">{item.sessions}</span>
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-sm font-black text-emerald-500">{item.attended}</span>
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-sm font-black text-amber-500">{item.absent}</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-sm font-black text-blue-500">{formatKLE(item.value)}</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-sm font-black text-emerald-400">{formatKLE(item.sessions > 0 ? item.profit / item.sessions : 0)}</span>
                      </td>
                    </tr>
                  ))}
                  {packageTypeSummary.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        No package data detected
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DistributionCard 
            getDistributionData={getDistributionData}
          />
        </div>

        {/* Right Column: Mini Stats & Quick Links */}
        <div className="space-y-6">
          <div className="p-8 rounded-[2rem] bg-indigo-600 text-white shadow-bento relative overflow-hidden group">
            <Layers className="absolute -right-6 -bottom-6 h-32 w-32 text-white/10 rotate-12 transition-transform group-hover:scale-110" />
            <h3 className="text-sm font-black uppercase tracking-widest opacity-80 mb-6">Utilization Rate</h3>
            <div className="space-y-8 relative z-10">
              <div>
                <p className="text-5xl font-black tracking-tighter">{utilizationRate}%</p>
                <p className="text-[10px] font-bold uppercase mt-1 opacity-70">Capacity Utilization</p>
              </div>
              <div className="pt-6 border-t border-white/20 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-2xl font-black tracking-tighter">{totalAttendedFromFiltered}</span>
                  <p className="text-[8px] font-bold uppercase mt-1 opacity-70">Attended</p>
                </div>
                <div>
                  <span className="text-2xl font-black tracking-tighter">{totalPackageSessions}</span>
                  <p className="text-[8px] font-bold uppercase mt-1 opacity-70">Total Slots</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-[2rem] bg-slate-900 border-2 border-slate-800 text-white shadow-bento flex flex-col justify-between h-[300px]">
             <div>
               <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Inventory Summary</h3>
               <p className="text-xs text-slate-500 font-medium uppercase tracking-widest leading-relaxed">System tracking active modules and deployment nodes across the academy.</p>
             </div>
             
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Locations</span>
                  <span className="text-xl font-black text-white">{locations.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Package Types</span>
                  <span className="text-xl font-black text-white">{packageTypes.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Payments</span>
                  <span className="text-xl font-black text-emerald-500">{payments.length}</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative z-10 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8 border-b-2 border-slate-800 pb-6">
                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4">
                  <PackageIcon className="text-blue-500" />
                  {activeKpi || 'Data Details'}
                  <span className="text-xs bg-blue-600 px-3 py-1 rounded-full not-italic ml-4">
                    {filteredPackages.length} RECORDS
                  </span>
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {activeKpi === 'Groups' ? (
                  <div className="space-y-4">
                    {groups.filter(g => activeGroupIds.has(g.id!)).map(group => {
                      const groupPlayers = players.filter(p => p.groupId === group.id);
                      return (
                        <div key={group.id} className="bg-slate-950/40 border border-slate-800 rounded-3xl p-6 hover:border-blue-500/30 transition-all group">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/20 border border-white/10 group-hover:scale-105 transition-transform" style={{ backgroundColor: getGroupColor(group.id!, group.color) }}>
                                <Users size={24} />
                              </div>
                              <div>
                                <h4 className="text-xl font-black text-white uppercase tracking-tight italic">{group.name}</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{groupPlayers.length} Active Athletes Registered</p>
                              </div>
                            </div>
                            
                            <div className="flex-1 flex flex-wrap gap-2 md:justify-center">
                              {groupPlayers.map(pl => (
                                <Link 
                                  key={pl.id} 
                                  to={`/players/${pl.id}`}
                                  className="text-[10px] bg-slate-900 text-slate-400 font-black px-3 py-1.5 rounded-lg border border-slate-800 hover:border-blue-500 hover:text-white transition-all uppercase tracking-widest"
                                >
                                  {pl.name}
                                </Link>
                              ))}
                            </div>

                            <Link 
                              to="/sessions" 
                              className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
                            >
                              View Sessions
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : activeKpi === 'Athletes' ? (
                   <div className="space-y-3">
                     {players.filter(p => activePlayerIds.has(p.id!)).map(player => (
                        <Link 
                          key={player.id} 
                          to={`/players/${player.id}`} 
                          className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 hover:border-blue-500/30 transition-all group flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                              <User size={20} className="text-blue-500" />
                            </div>
                            <div>
                              <h4 className="text-lg font-black text-white uppercase italic group-hover:text-blue-400 transition-colors">{player.name}</h4>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{player.email || 'No Email Registered'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {player.level && (
                              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest">
                                Level {player.level}
                              </span>
                            )}
                            <div className="p-2 rounded-xl bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowRight size={18} />
                            </div>
                          </div>
                        </Link>
                     ))}
                   </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPackages
                      .map(pkg => {
                        const player = playersMap.get(String(pkg.playerId));
                        const pkgSessions = (sessions || []).filter(s => String(s.packageId) === String(pkg.id));
                        const usedSessions = pkgSessions.filter(s => 
                          s.status === 'Attended' || 
                          s.status === 'Compensated' || 
                          s.status === 'Attended Comp. Session' ||
                          s.status === 'Absent'
                        ).length;
                        
                        const financials = getPackageFinancials(pkg, pkgSessions);
                        const derivedValue = financials.turnover;
                        const pending = financials.pending;
                        const paidAmount = financials.paid;
                        const profit = financials.profit;
                        
                        // If we are showing "Outstanding" KPI, only show packages with pending balance
                        if (activeKpi === 'Outstanding' && pending <= 0.01) return null;

                        const progress = pkg.numSessions > 0 ? (usedSessions / pkg.numSessions) * 100 : 0;
                        const isOutstanding = activeKpi === 'Outstanding';
                        const showProfit = activeKpi === 'Profit Margin';
                        
                        return (
                          <div 
                            key={pkg.id} 
                            onClick={() => {
                              setIsModalOpen(false);
                              navigate(`/players/${pkg.playerId}?pkgId=${pkg.id}`);
                            }}
                            className={cn(
                              "bg-slate-950/40 border border-slate-800 rounded-3xl p-6 transition-all group cursor-pointer",
                              isOutstanding ? "hover:border-red-500/30" : "hover:border-blue-500/30"
                            )}
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "h-14 w-14 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105",
                                  isOutstanding 
                                    ? "bg-red-500/10 border-red-500/20" 
                                    : "bg-blue-500/10 border-blue-500/20"
                                )}>
                                  {isOutstanding ? <AlertCircle className="text-red-500" size={24} /> : <PackageIcon className="text-blue-500" size={24} />}
                                </div>
                                <div>
                                  <h4 className="text-xl font-black text-white uppercase tracking-tight italic">{player?.name || 'Unknown Player'}</h4>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                     <span className="text-[10px] bg-blue-600 font-black text-white px-2 py-0.5 rounded uppercase tracking-widest">{pkg.packageTypeCode}</span>
                                     {pkg.packageName && <span className="text-[10px] bg-slate-800 font-black text-slate-300 px-2 py-0.5 rounded uppercase tracking-widest">{pkg.packageName}</span>}
                                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">{pkg.numSessions} Sessions Package</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex-1 max-w-xs hidden xl:block mx-8">
                                 <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Progress</span>
                                    <span className="text-[10px] text-white font-black">{usedSessions} / {pkg.numSessions}</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${progress}%` }}
                                      className="h-full bg-blue-600 rounded-full"
                                    />
                                 </div>
                              </div>

                              <div className="flex items-center gap-8">
                                <div className="text-right min-w-[120px]">
                                  <p className={cn(
                                    "text-2xl font-black italic tracking-tighter",
                                    isOutstanding ? "text-red-500" : (showProfit ? "text-emerald-500" : "text-blue-500")
                                  )}>
                                    {isOutstanding ? formatCurrency(pending) : (showProfit ? formatCurrency(profit) : formatCurrency(derivedValue))}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                    {isOutstanding ? 'Due Balance' : (showProfit ? 'Projected Profit' : 'Gross Value')}
                                  </p>
                                </div>
                                
                                <div className="text-right hidden sm:block min-w-[100px]">
                                  <p className="text-lg font-black text-white/80 italic tracking-tighter">
                                    {formatCurrency(paidAmount)}
                                  </p>
                                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Received</p>
                                </div>

                                {pending > 0.01 ? (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setPayingPackage(pkg); }}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 group-hover:rotate-3"
                                    title="Record Payment"
                                  >
                                    <CreditCard size={20} />
                                  </button>
                                ) : (
                                  <div className="p-4 rounded-2xl bg-slate-800 text-slate-500 group-hover:text-white transition-colors">
                                    <ArrowRight size={20} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                )}
              </div>
              
              {filteredPackages.length === 0 && (
                <div className="p-20 text-center border-2 border-dashed border-slate-800 rounded-[2rem]">
                  <Search size={48} className="mx-auto text-slate-700 mb-4" />
                  <p className="text-slate-500 font-black uppercase tracking-widest">No matching results found for the current filters.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {payingPackage && (
        <PaymentModal 
          pkg={payingPackage} 
          onClose={() => {
            setPayingPackage(null);
            // We might want to refresh the dashboard data if needed, but useData usually handles it via Firestore listeners
          }} 
        />
      )}

      {/* Backup Modal */}
      <AnimatePresence>
        {isBackupOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBackupOpen(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-xl bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8 border-b-2 border-slate-800 pb-6">
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4">
                  <Download className="text-blue-500" />
                  System Migration
                </h2>
                <button 
                  onClick={() => setIsBackupOpen(false)}
                  className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-3xl group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-10 w-10 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-500">
                      <Download size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-tighter">Export Ecosystem</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Generate current DB snapshot</p>
                    </div>
                  </div>
                  <button
                    onClick={handleExportBackup}
                    disabled={isExporting}
                    className="w-full bento-button-black bg-blue-600 text-white border-none py-3 disabled:opacity-50"
                  >
                    {isExporting ? <Clock className="animate-spin" size={16} /> : 'GENERATE FULL BACKUP'}
                  </button>
                </div>

                <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-3xl group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-10 w-10 bg-emerald-600/10 rounded-xl flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                      <Upload size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-tighter">Restore State</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Append records from legacy CSV</p>
                    </div>
                  </div>
                  <label className={cn(
                    "w-full flex items-center justify-center gap-2 bento-button-black bg-emerald-600 text-white border-none py-3 cursor-pointer",
                    isImporting && "opacity-50 pointer-events-none"
                  )}>
                    {isImporting ? <Clock className="animate-spin" size={16} /> : <Upload size={16} />}
                    <span>UPLOAD BACKUP FILE</span>
                    <input type="file" accept=".csv" onChange={handleImportBackup} className="hidden" />
                  </label>
                </div>

                {backupStatus && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "p-4 rounded-2xl border-2 flex items-center justify-between gap-3 font-bold text-[10px] uppercase tracking-widest",
                      backupStatus.type === 'success' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-red-500/10 border-red-500/30 text-red-500"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {backupStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {backupStatus.message}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DistributionCard({ getDistributionData }: any) {
  const [type, setType] = useState<'location' | 'level'>('location');
  const data = getDistributionData(type);
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="bento-card bg-slate-900/50 border-2 border-slate-800 p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
          <PieChartIcon className="text-amber-500" />
          Revenue Distribution
        </h2>
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(['location', 'level'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                type === t ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-400"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              label={({ percent, value }) => `${formatKLE(value)} (${(percent * 100).toFixed(0)}%)`}
            >
              {data.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
               contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
               itemStyle={{ color: '#fff' }}
               formatter={(val: number) => formatKLE(val)}
            />
            <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', tracking: 'widest' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KPIBox({ title, value, icon: Icon, subValue, color, onClick }: any) {
  const colors: any = {
    blue: "bg-blue-600/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]",
    indigo: "bg-indigo-600/10 text-indigo-400 border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]",
    emerald: "bg-emerald-600/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    amber: "bg-amber-600/10 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]",
    red: "bg-red-600/10 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
  };

  const textColors: any = {
    blue: "text-blue-500",
    indigo: "text-indigo-500",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    red: "text-red-500"
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "bento-card flex flex-col items-center text-center p-6 bg-slate-950/50 hover:bg-slate-900 border-2 border-slate-800 hover:border-slate-600 transition-all group",
        onClick && "cursor-pointer"
      )}
    >
      <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center border-2 mb-4 transition-transform group-hover:rotate-6", colors[color])}>
        <Icon size={22} />
      </div>
      <div className="h-8 flex items-center justify-center w-full mb-1">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{title}</h3>
      </div>
      <p className="text-3xl font-black text-white tracking-tighter mb-2 italic">{value}</p>
      <div className="mt-2 pt-2 border-t border-slate-800/50 w-full h-10 flex items-center justify-center">
        <p className={cn("text-[10px] font-black uppercase tracking-widest leading-tight px-2", textColors[color])}>{subValue}</p>
      </div>
    </div>
  );
}


function StatCard({ title, value, icon: Icon, color, trend, onClick }: any) {
    const colors: any = {
        indigo: "bg-blue-600/10 text-blue-400 border-blue-500/20 shadow-bento",
        red: "bg-red-600/10 text-red-400 border-red-500/20 shadow-bento",
        blue: "bg-slate-800 text-slate-300 border-slate-700 shadow-bento",
        green: "bg-emerald-600/10 text-emerald-400 border-emerald-500/20 shadow-bento"
    };

    return (
        <div 
            onClick={onClick}
            className="bg-slate-900/50 p-6 rounded-2xl border-2 border-slate-800 shadow-bento group transition-transform hover:-translate-y-1 cursor-pointer hover:border-slate-600"
        >
            <div className={cn("inline-flex p-2.5 rounded-xl border-2 mb-4 transition-all group-hover:rotate-12", colors[color])}>
                <Icon size={20} />
            </div>
            <h3 className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest">{title}</h3>
            <p className="text-2xl md:text-4xl font-black text-white tracking-tight mt-1">{value}</p>
            <div className="mt-4 pt-4 border-t border-slate-800/50">
                <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-[0.1em] flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-blue-500 animate-pulse"></span>
                    {trend}
                </p>
            </div>
        </div>
    );
}

// Stats
