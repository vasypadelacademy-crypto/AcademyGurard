import React, { useState } from 'react';
import { useData } from '../lib/DataContext';
import { 
  Edit2,
  Trash2,
  Clock,
  Plus, 
  Search, 
  Filter, 
  Upload, 
  ChevronRight, 
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  Trophy,
  Package as PackageIcon,
  Download,
  AlertCircle,
  CheckCircle2,
  Users,
  X,
  ChevronDown,
  LayoutGrid,
  List,
  Bell,
  ArrowLeft,
  Tag,
  FileText,
  Pen
} from 'lucide-react';
import { cn, formatCurrency, getGroupColor, parseTimeTo24h, toTitleCase } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Player } from '../types';
import PlayerNotesModal from '../components/PlayerNotesModal';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { FilterDropdown } from '../components/FilterDropdown';
import { downloadTemplate } from '../lib/templates';
import { auth } from '../lib/firebase';
import { PackageBreakdown } from '../components/PackageBreakdown';
import { calculatePackageValues } from '../lib/pricingUtils';

export default function Players() {
  const navigate = useNavigate();
  const { 
    players, levels, locations, groups, packageTypes, 
    addMasterData, updateMasterData, deleteMasterData, 
    packages, pricingSchemes, sessions, payments, reminders, 
    currentUserRole, loading,
    searchTerm, setSearchTerm,
    filterType, setFilterType,
    locationFilter, setLocationFilter,
    levelFilter, setLevelFilter,
    groupFilter, setGroupFilter,
    playerStatusFilter: statusFilter,
    setPlayerStatusFilter: setStatusFilter
  } = useData();
  
  React.useEffect(() => {
    console.log("[DEBUG] Players loaded count:", players.length);
  }, [players]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [groupViewMode, setGroupViewMode] = useState<'grid' | 'list'>('list');
  const [groupByMode, setGroupByMode] = useState<'player' | 'group'>('player');
  const [sortConfigs, setSortConfigs] = useState<{ key: string, direction: 'asc' | 'desc' }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showMassUpload, setShowMassUpload] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [breakdown, setBreakdown] = useState<{ packages: any[], playerId: string, position: { top: number, left: number } } | null>(null);
  const [showNotesPlayer, setShowNotesPlayer] = useState<Player | null>(null);

  const handleBalanceClick = (e: React.MouseEvent, playerId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const pId = String(playerId);
      // Sort like in PlayerDetail
      const playerPackagesOfPlayer = packages.filter(p => String(p.playerId) === pId).sort((a, b) => {
        const dateCompare = a.startDate.localeCompare(b.startDate);
        if (dateCompare !== 0) return dateCompare;
        return (a.id || '').localeCompare(b.id || '');
      });
      // Enhance with M-X
      const enhancedPackages = playerPackagesOfPlayer.map((p, idx) => ({ ...p, displayId: `M${idx + 1}` }));
      
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setBreakdown({
          packages: enhancedPackages,
          playerId: pId,
          position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX }
      });
  }

  const hasActiveFilters = filterType !== 'all' || locationFilter !== 'all' || levelFilter !== 'all' || groupFilter !== 'all';
  const isAnyFilterApplied = searchTerm !== '' || filterType !== 'all' || locationFilter !== 'all' || levelFilter !== 'all' || groupFilter !== 'all' || statusFilter !== 'active';

  const getAsDateString = (val: any) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object' && (val as any).toDate) {
      try {
        return (val as any).toDate().toISOString();
      } catch (e) {
        return '';
      }
    }
    if (val instanceof Date) return val.toISOString();
    return String(val);
  };

  const handleMassUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("[DEBUG] Handle mass upload called");
    if (!auth.currentUser) {
        setImportStatus({ type: 'error', message: "Please wait for authentication to complete before importing." });
        return;
    }
    console.log("[DEBUG] Auth check passed");
    if (!e.target.files?.length) return;
    setIsUploading(true);
    setImportStatus(null);
    const file = e.target.files[0];
    
    // Check if the file is CSV or Excel
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      if (fileExtension === 'csv') {
        Papa.parse(file, {
          header: false,
          complete: async (results) => {
            await processImportData(results.data, file.name);
            setIsUploading(false);
          },
          error: (err) => {
            setImportStatus({ type: 'error', message: `CSV Error: ${err.message}` });
            setIsUploading(false);
          }
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = async (event) => {
           const data = event.target?.result;
           const workbook = XLSX.read(data, { type: 'binary' });
           const sheets = workbook.SheetNames.map(sheetName => {
               const sheet = workbook.Sheets[sheetName];
               const jsonData = XLSX.utils.sheet_to_json(sheet);
               const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
               return { sheetName, data: jsonData, rawRows };
           });
           await processImportData(sheets, file.name);
           setIsUploading(false);
        };
        reader.onerror = (err) => {
            setImportStatus({ type: 'error', message: `Excel Error: ${err}` });
            setIsUploading(false);
        };
        reader.readAsBinaryString(file);
      } else {
        setImportStatus({ type: 'error', message: "Unsupported file format. Please upload CSV or XLSX." });
        setIsUploading(false);
      }
    } catch (err: any) {
        setImportStatus({ type: 'error', message: `Import Error: ${err.message}` });
        setIsUploading(false);
    }
  };

  // Pre-calculate mappings for O(1) lookups
  const levelsMap = React.useMemo(() => new Map(levels.map(l => [l.id, l])), [levels]);
  const locationsMap = React.useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);
  const groupsMap = React.useMemo(() => new Map(groups.map(g => [g.id, g])), [groups]);
  const pricingSchemesMap = React.useMemo(() => {
    // Group schemes by package code then sort by month desc for faster fallback
    const map = new Map<string, any[]>();
    pricingSchemes.forEach(ps => {
      const existing = map.get(ps.packageTypeCode) || [];
      existing.push(ps);
      map.set(ps.packageTypeCode, existing.sort((a,b) => b.effectiveMonth.localeCompare(a.effectiveMonth)));
    });
    return map;
  }, [pricingSchemes]);

  // Global pre-filter sessions per package for stats
  const sessionsByPackage = React.useMemo(() => {
    const map = new Map<string, any[]>();
    (sessions || []).forEach(s => {
      const pkgId = String(s.packageId);
      const existing = map.get(pkgId) || [];
      existing.push(s);
      map.set(pkgId, existing);
    });
    return map;
  }, [sessions]);

  // Global pre-filter payments per package for stats
  const paymentsByPackage = React.useMemo(() => {
    const map = new Map<string, any[]>();
    (payments || []).forEach(p => {
        const pkgId = String(p.packageId);
        const existing = map.get(pkgId) || [];
        existing.push(p);
        map.set(pkgId, existing);
    });
    return map;
  }, [payments]);

  // Pre-calculate stats for all players to avoid expensive work in render loop
  const playersStats = React.useMemo(() => {
    const statsMap = new Map<string, { totalPending: number, latestPackage: any, needsRenewal: boolean }>();
    
    // Group packages by player first
    const packagesByPlayer = new Map<string, any[]>();
    packages.forEach(pkg => {
      const pId = String(pkg.playerId);
      const existing = packagesByPlayer.get(pId) || [];
      existing.push(pkg);
      packagesByPlayer.set(pId, existing);
    });

    players.forEach(player => {
      const pId = String(player.id);
      const playerPackages = packagesByPlayer.get(pId) || [];
      
      const totalPending = playerPackages.reduce((acc, pkg) => {
        const pkgPayments = paymentsByPackage.get(String(pkg.id)) || [];
        const paidAmount = pkgPayments.length > 0 
          ? pkgPayments.reduce((pAcc, p) => pAcc + Number(p.amount || 0), 0)
          : Number(pkg.paidAmount || 0);
        
        let pkgDue = Number(pkg.totalDue || 0);
        // Use real-time calculation to be consistent with PlayerDetail and Reminders
        if (pricingSchemes && pricingSchemes.length > 0) {
          const pkgSessions = sessionsByPackage.get(String(pkg.id)) || [];
          const { derivedTotalDue } = calculatePackageValues(pkg, pkgSessions, pricingSchemes, pkg.forceSystemPricing || false);
          pkgDue = derivedTotalDue;
        }
        
        const pending = Math.max(0, pkgDue - paidAmount);
        
        // Skip 'Paid', 'Free' or 'Cancelled' packages
        if (pkg.status === 'Paid' || pkg.status === 'Free' || pkg.status === 'Cancelled' || pending <= 0.01) return acc;
        
        return acc + pending;
      }, 0);

      const latestPackage = [...playerPackages].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0];
      
      let needsRenewal = false;
      if (latestPackage) {
          const pkgSessions = sessionsByPackage.get(String(latestPackage.id)) || [];
          const consumedAndScheduled = pkgSessions.filter(s => 
            ['Attended', 'Compensated', 'Attended Comp. Session', 'Scheduled', 'Absent'].includes(s.status)
          ).length;
          const pendingCount = pkgSessions.filter(s => s.status === 'Scheduled').length;
          const toSchedule = Math.max(0, (latestPackage.numSessions || 0) - consumedAndScheduled);
          
          needsRenewal = (toSchedule === 0 && pendingCount <= 1) && player.isActive !== false;
      }

      statsMap.set(pId, { 
        totalPending: Math.max(0, totalPending), 
        latestPackage, 
        needsRenewal 
      });
    });

    return statsMap;
  }, [players, packages, sessionsByPackage, paymentsByPackage, pricingSchemesMap]);

  const filteredPlayers = React.useMemo(() => {
    return players.filter(p => {
      const searchTermLower = searchTerm.toLowerCase();
      
      const group = groupsMap.get(p.groupId);
      const groupName = group?.name?.toLowerCase() || '';
      const groupCode = group?.code?.toLowerCase() || '';
      
      const matchesGlobalSearch = groupByMode === 'group' ? (
        groupName.includes(searchTermLower) ||
        groupCode.includes(searchTermLower)
      ) : (
        p.name?.toLowerCase().includes(searchTermLower)
      );

      const matchesPackage = filterType === 'all' || p.packageTypeCode === filterType;
      const matchesLocation = locationFilter === 'all' || p.locationId === locationFilter;
      const matchesLevel = levelFilter === 'all' || p.levelId === levelFilter;
      const matchesGroup = groupFilter === 'all' || p.groupId === groupFilter;
      const matchesActive = statusFilter === 'all' || (statusFilter === 'active' ? p.isActive !== false : p.isActive === false);
      
      return matchesGlobalSearch && matchesPackage && matchesLocation && matchesLevel && matchesGroup && matchesActive;
    });
  }, [players, searchTerm, levelsMap, locationsMap, groupsMap, filterType, locationFilter, levelFilter, groupFilter, statusFilter, groupByMode]);

  const filteredGroups = React.useMemo(() => {
    const matchedPlayerGroupIds = new Set(filteredPlayers.map(p => p.groupId));
    const isAnyPlayerFilterActive = filterType !== 'all' || locationFilter !== 'all' || levelFilter !== 'all';

    return groups.filter(g => {
      if (groupFilter !== 'all' && g.id !== groupFilter) return false;
      
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTermLower ||
        g.name?.toLowerCase().includes(searchTermLower) || 
        (g.code?.toLowerCase() || '').includes(searchTermLower);
        
      const hasMatchingPlayers = matchedPlayerGroupIds.has(g.id);
      
      if (isAnyPlayerFilterActive) {
          return hasMatchingPlayers && matchesSearch;
      }
      
      return matchesSearch || hasMatchingPlayers;
    });
  }, [groups, groupFilter, searchTerm, filteredPlayers, filterType, locationFilter, levelFilter]);

  const handleSort = (key: string, isMulti: boolean) => {
    setSortConfigs(prev => {
      const existing = prev.find(s => s.key === key);
      if (isMulti) {
        if (existing) {
          // Toggle or remove
          if (existing.direction === 'asc') {
            return prev.map(s => s.key === key ? { ...s, direction: 'desc' } : s);
          } else {
            return prev.filter(s => s.key !== key);
          }
        } else {
          return [...prev, { key, direction: 'asc' }];
        }
      } else {
        // Single sort
        if (existing && prev.length === 1) {
          if (existing.direction === 'asc') {
            return [{ key, direction: 'desc' }];
          } else {
            return [];
          }
        } else {
          return [{ key, direction: 'asc' }];
        }
      }
    });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setShowAddModal(true);
    setError(null);
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeletePlayer = async (id: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteMasterData('players', id);
      setConfirmDeleteId(null);
    } catch (e: any) {
      console.error("Delete failed", e);
      try {
        const errorData = JSON.parse(e.message);
        setError(`ERR: ${errorData.error}`);
      } catch {
        setError("DELETE FAILED");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (data: any) => {
    if (!auth.currentUser) {
      setError("Please wait for authentication to complete before saving.");
      return;
    }
    if (!data.name) {
      setError("Name is mandatory");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (editingPlayer) {
        await updateMasterData('players', editingPlayer.id!, data);
      } else {
        await addMasterData('players', data);
      }
      setShowAddModal(false);
      setEditingPlayer(null);
    } catch (e: any) {
      console.error("Save failed", e);
      try {
        const errorData = JSON.parse(e.message);
        setError(`ERR: ${errorData.error}`);
      } catch {
        setError("SAVE FAILED");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const processImportData = async (sheetsOrData: any[], filename?: string) => {
    console.log("Processing import data...", filename);
    try {
      const isMultiSheet = sheetsOrData.length > 0 && 
                           sheetsOrData[0] !== null &&
                           typeof sheetsOrData[0] === 'object' && 
                           'sheetName' in sheetsOrData[0];
      const sheets = isMultiSheet ? sheetsOrData : [{ sheetName: 'Sheet1', data: sheetsOrData, rawRows: sheetsOrData }];

      let totalCreatedSessions = 0;
      let totalPackages = 0;
      
      // Cache for players created/found during THIS import session to avoid staleness issues
      const importedPlayersCache = new Map<string, any>();
      console.log("[DEBUG] Starting import process. Sheets count:", sheets.length);

      for (const sheet of sheets) {
        console.log("[DEBUG] Processing sheet:", sheet.sheetName);
        const rawRows: any[] = sheet.rawRows || [];
        if (rawRows.length === 0) continue;
        





        // Stage 1: Detect mode (Single Player Report vs Multi-Player Table)
        let headerRowIdx = -1;
        let isMultiPlayerTable = false;
        let playerNameColumn = -1;
        let packageCodeColumn = -1;
        let numSessionsColumn = -1;
        let dateColumn = -1;
        let statusColumn = -1;
        let locColumn = -1;
        let timeColumn = -1;
        let emailColumn = -1;
        let phoneColumn = -1;

        let headers: string[] = [];

        // Search for headers
        for (let r = 0; r < Math.min(20, rawRows.length); r++) {
          const row = Array.isArray(rawRows[r]) ? rawRows[r] : Object.values(rawRows[r] || {});
          const rowStr = row.join(' ').toLowerCase();
          
          if (rowStr.includes('date') && (rowStr.includes('status') || rowStr.includes('session'))) {
            headerRowIdx = r;
            headers = row.map((h: any) => String(h || '').toLowerCase().trim());
            console.log("[Import] Detected headers:", headers);
            
            playerNameColumn = (headers || []).findIndex(h => (h || '').includes('player') || (h || '').includes('athlete') || (h || '').includes('name') || (h || '').includes('student') || h === 'n');
            packageCodeColumn = (headers || []).findIndex(h => (h || '').includes('package') && !(h || '').includes('sessions'));
            numSessionsColumn = (headers || []).findIndex(h => (h || '').includes('sessions') || (h || '').includes('num'));
            dateColumn = (headers || []).findIndex(h => (h || '').includes('date'));
            statusColumn = (headers || []).findIndex(h => (h || '').includes('status'));
            locColumn = (headers || []).findIndex(h => (h || '').includes('location'));
            timeColumn = (headers || []).findIndex(h => (h || '').includes('time'));
            emailColumn = (headers || []).findIndex(h => (h || '').includes('email'));
            phoneColumn = (headers || []).findIndex(h => (h || '').includes('phone') || (h || '').includes('mobile') || (h || '').includes('contact') || (h || '').includes('tel'));

            if (playerNameColumn !== -1 && (dateColumn !== -1 || statusColumn !== -1)) {
              isMultiPlayerTable = true;
              console.log("[Import] Switching to TABLE MODE");
            }
            break;
          }
        }

        if (isMultiPlayerTable) {
           // MODE: TABLE (One row per session, or one row per package)
           // We need to group by player and package to create them correctly
           const dataRows = rawRows.slice(headerRowIdx + 1);
           const groupsByPlayerAndPackage = new Map<string, any[]>();

           dataRows.forEach(rowArr => {
              const row = Array.isArray(rowArr) ? rowArr : Object.values(rowArr || {});
              if (!row[playerNameColumn]) return;

              const pName = String(row[playerNameColumn]).trim();
              const pPkg = packageCodeColumn !== -1 ? String(row[packageCodeColumn]).trim() : (sheet.sheetName || 'Default');
              const key = `${pName.toLowerCase()}|${pPkg.toLowerCase()}`;

              const existing = groupsByPlayerAndPackage.get(key) || [];
              existing.push(row);
              groupsByPlayerAndPackage.set(key, existing);
           });

           const levelCol = (headers || []).findIndex(h => (h || '').includes('level'));
           const locColTable = (headers || []).findIndex(h => (h || '').includes('location'));
           const groupCol = (headers || []).findIndex(h => (h || '').includes('group'));

           for (const [key, rows] of groupsByPlayerAndPackage.entries()) {
              const firstRow = rows[0];
              const cleanName = String(firstRow[playerNameColumn]).replace(/^C\.\s*/i, '').trim();
              const packageCode = packageCodeColumn !== -1 ? String(firstRow[packageCodeColumn]).toUpperCase() : (sheet.sheetName || 'M1');
              const numSessions = numSessionsColumn !== -1 ? parseInt(firstRow[numSessionsColumn]) || 8 : 8;
              const email = emailColumn !== -1 ? String(firstRow[emailColumn] || '') : '';
              const phone = phoneColumn !== -1 ? String(firstRow[phoneColumn] || '') : '';
              
              const rowLevelName = levelCol !== -1 ? String(firstRow[levelCol] || '').trim() : '';
              const rowLocName = locColTable !== -1 ? String(firstRow[locColTable] || '').trim() : '';
              const rowGroupName = groupCol !== -1 ? String(firstRow[groupCol] || '').trim() : '';

              const levelId = levels.find(l => l.name?.toLowerCase() === rowLevelName.toLowerCase())?.id || '';
              const locationId = locations.find(l => l.name?.toLowerCase() === rowLocName.toLowerCase())?.id || locations[0]?.id || '';
              const groupId = groups.find(g => g.name?.toLowerCase() === rowGroupName.toLowerCase() || (g.code || '').toLowerCase() === rowGroupName.toLowerCase())?.id || '';

              // Get/Create Player
              let playerRef = importedPlayersCache.get(cleanName.toLowerCase()) || players.find(p => p.name?.toLowerCase() === cleanName.toLowerCase());
              if (!playerRef) {
                 playerRef = await addMasterData('players', {
                    name: cleanName,
                    levelId,
                    locationId,
                    groupId,
                    packageTypeCode: packageCode,
                    numSessions: numSessions,
                    phone: phone,
                    email: email,
                    isActive: true
                 });
                 importedPlayersCache.set(cleanName.toLowerCase(), playerRef);
              }

              // Create Package
              const parsedSessionsForPkg: any[] = [];
              rows.forEach(row => {
                 let sDate = '';
                 if (dateColumn !== -1 && row[dateColumn]) {
                    const dv = row[dateColumn];
                    if (typeof dv === 'number' && dv > 40000) {
                       const dObj = new Date((dv - (25567 + 2)) * 86400 * 1000);
                       if (!isNaN(dObj.getTime())) sDate = dObj.toISOString().slice(0,10);
                    } else {
                       const d = new Date(dv);
                       if (!isNaN(d.getTime())) sDate = d.toISOString().slice(0,10);
                    }
                 }
                 if (sDate) {
                    let sStatus = 'Scheduled';
                    let sTime = '17:00';
                    if (statusColumn !== -1 && row[statusColumn]) {
                       const s = String(row[statusColumn] || '').toLowerCase();
                       if (s.includes('attend')) sStatus = 'Attended';
                       else if (s.includes('absent')) sStatus = 'Absent';
                       else if (s.includes('cancel')) sStatus = 'Cancelled';
                    }
                    if (timeColumn !== -1 && row[timeColumn]) sTime = parseTimeTo24h(String(row[timeColumn] || ''));
                    parsedSessionsForPkg.push({ date: sDate, status: sStatus, time: sTime });
                 }
              });

              const monthToUse = parsedSessionsForPkg.length > 0 ? parsedSessionsForPkg[0].date.slice(0, 7) : new Date().toISOString().slice(0, 7);
              const finalSessCount = Math.max(parsedSessionsForPkg.length, numSessions);
              
              const scheme = pricingSchemes.find(s => s.packageTypeCode === packageCode && s.numSessions === finalSessCount && s.effectiveMonth === monthToUse) || 
                             pricingSchemes.filter(s => s.packageTypeCode === packageCode && s.numSessions === finalSessCount)
                                          .filter(s => !!s.effectiveMonth)
                                          .sort((a,b) => (b.effectiveMonth || '').localeCompare(a.effectiveMonth || ''))[0];
              const sessionValue = scheme ? scheme.sessionValue : 0;

              const packageRef = await addMasterData('packages', {
                  playerId: playerRef.id || playerRef,
                  packageTypeCode: packageCode,
                  numSessions: finalSessCount,
                  startDate: parsedSessionsForPkg.length > 0 ? parsedSessionsForPkg[0].date : new Date().toISOString().slice(0, 10),
                  totalDue: (sessionValue * finalSessCount),
                  paidAmount: 0,
                  status: 'Not Paid',
                  effectiveMonth: monthToUse,
                  note: 'Imported Table'
              });
              totalPackages++;

              if (packageRef) {
                 const pkgIdStr = (packageRef as any).id || packageRef;
                 for (let k = 0; k < finalSessCount; k++) {
                    const sData = parsedSessionsForPkg[k] || { date: new Date().toISOString().slice(0, 10), status: 'Scheduled', time: '17:00' };
                    await addMasterData('sessions', {
                       packageId: pkgIdStr,
                       playerId: playerRef.id || playerRef,
                       date: sData.date,
                       startTime: sData.time || '17:00',
                       status: sData.status,
                       locationId: locations[0]?.id || '',
                       sessionIndex: `${packageCode}-${k+1}`,
                       value: sessionValue,
                       discount: 0
                    });
                    totalCreatedSessions++;
                 }
              }
           }
        } else {
           // MODE: HEURISTIC (Single Player Report per sheet)
           let playerNameFromSheet = '';
           let packageCodeFromSheet = sheet.sheetName; 
           let numSessionsFromSheet = 8;

           for (let r = 0; r < Math.min(15, rawRows.length); r++) {
             const row = Array.isArray(rawRows[r]) ? rawRows[r] : Object.values(rawRows[r] || {});
             for (let c = 0; c < row.length; c++) {
               const cell = String(row[c] || '').trim();
               if (!cell) continue;
               if (String(cell || '').toLowerCase().includes('attendance report')) {
                   const nextCell = String(row[c+1] || '').trim();
                   if (nextCell) playerNameFromSheet = nextCell;
               } else if (String(cell || '').match(/^C\.\s*(.+)/i)) {
                   playerNameFromSheet = cell.replace(/^C\.\s*/i, '');
               }
               if (String(cell || '').toLowerCase().includes('package:')) {
                  const match = cell.match(/(\d+)\s*sessions/i);
                  if (match) numSessionsFromSheet = parseInt(match[1]);
               }
               if (packageTypes.some(pt => pt.code?.toUpperCase() === cell.toUpperCase())) {
                   packageCodeFromSheet = cell.toUpperCase();
               }
             }
           }

           const cleanName = (playerNameFromSheet || (filename ? filename.replace(/\.[^/.]+$/, "") : "Profile")).replace(/^C\.\s*/i, '').trim();

           let playerRefH = importedPlayersCache.get(cleanName.toLowerCase()) || players.find(p => p.name?.toLowerCase() === cleanName.toLowerCase());
           if (!playerRefH) {
             playerRefH = await addMasterData('players', {
                name: cleanName,
                levelId: '',
                locationId: locations[0]?.id || '',
                groupId: '',
                packageTypeCode: packageCodeFromSheet,
                numSessions: numSessionsFromSheet,
                phone: '',
                email: '',
                isActive: true
             });
             importedPlayersCache.set(cleanName.toLowerCase(), playerRefH);
           }

           const parsedSessions: any[] = [];
           if (headerRowIdx !== -1) {
               for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
                  const row = Array.isArray(rawRows[r]) ? rawRows[r] : Object.values(rawRows[r] || {});
                  if (row.some((c: any) => String(c || '').toLowerCase().includes('attended sessions'))) break;
                  
                  let sDate = '';
                  if (dateColumn !== -1 && row[dateColumn]) {
                     const dv = row[dateColumn];
                     if (typeof dv === 'number' && dv > 40000) {
                        const dObj = new Date((dv - (25567 + 2)) * 86400 * 1000);
                        if (!isNaN(dObj.getTime())) sDate = dObj.toISOString().slice(0,10);
                     } else {
                        const d = new Date(dv);
                        if (!isNaN(d.getTime())) sDate = d.toISOString().slice(0,10);
                     }
                  }

                  if (sDate) {
                     let sStatus = 'Scheduled';
                     let sTime = '17:00';
                     if (statusColumn !== -1 && row[statusColumn]) {
                        const s = String(row[statusColumn]).toLowerCase();
                        if (s.includes('attend')) sStatus = 'Attended';
                        else if (s.includes('absent')) sStatus = 'Absent';
                        else if (s.includes('cancel')) sStatus = 'Cancelled';
                     }
                     if (timeColumn !== -1 && row[timeColumn]) sTime = parseTimeTo24h(String(row[timeColumn] || ''));
                     parsedSessions.push({ date: sDate, status: sStatus, time: sTime });
                  }
               }
           }

           const finalSessCount = Math.max(parsedSessions.length, numSessionsFromSheet);
           const monthToUse = parsedSessions.length > 0 ? parsedSessions[0].date.slice(0, 7) : new Date().toISOString().slice(0, 7);
           const scheme = pricingSchemes.find(s => s.packageTypeCode === packageCodeFromSheet && s.numSessions === finalSessCount && s.effectiveMonth === monthToUse) || 
                          pricingSchemes.filter(s => s.packageTypeCode === packageCodeFromSheet && s.numSessions === finalSessCount)
                                       .filter(s => !!s.effectiveMonth)
                                       .sort((a,b) => (b.effectiveMonth || '').localeCompare(a.effectiveMonth || ''))[0];
           const sessionValue = scheme ? scheme.sessionValue : 0;

           const packageRef = await addMasterData('packages', {
               playerId: playerRefH.id || playerRefH,
               packageTypeCode: packageCodeFromSheet,
               numSessions: finalSessCount,
               startDate: parsedSessions.length > 0 ? parsedSessions[0].date : new Date().toISOString().slice(0, 10),
               totalDue: (sessionValue * finalSessCount),
               paidAmount: 0,
               status: 'Not Paid',
               effectiveMonth: monthToUse,
               note: 'Imported Heuristic'
           });
           totalPackages++;

           if (packageRef) {
              const pkgIdStr = (packageRef as any).id || packageRef;
              for (let k = 0; k < finalSessCount; k++) {
                 const sData = parsedSessions[k] || { date: new Date().toISOString().slice(0, 10), status: 'Scheduled', time: '17:00' };
                 await addMasterData('sessions', {
                    packageId: pkgIdStr,
                    playerId: playerRefH.id || playerRefH,
                    date: sData.date,
                    startTime: sData.startTime || sData.time || '17:00',
                    status: sData.status,
                    locationId: locations[0]?.id || '',
                    sessionIndex: `${packageCodeFromSheet}-${k+1}`,
                    value: sessionValue,
                    discount: 0
                 });
                 totalCreatedSessions++;
              }
           }
        }
      }

      setImportStatus({ type: 'success', message: `Import complete. Captured ${totalPackages} packages and ${totalCreatedSessions} sessions.` });
      setIsUploading(false);
      setTimeout(() => {
        setShowMassUpload(false);
        setImportStatus(null);
      }, 3000);
    } catch (error) {
      console.error("Import error detail:", error);
      setImportStatus({ type: 'error', message: `Import failed: ${error}` });
      setIsUploading(false);
    }
  };

  const unreadReminders = React.useMemo(() => {
    const activePlayerIds = new Set(players.filter(p => p.isActive !== false).map(p => p.id));
    return (reminders || []).filter(r => {
      if (r.status !== 'Unread') return false;
      if (r.playerId && !activePlayerIds.has(r.playerId)) return false;
      
      const stats = playersStats.get(String(r.playerId));
      if (r.category === 'Financial' && stats && stats.totalPending <= 0.01) return false;
      if (r.category === 'Renew' && stats && !stats.needsRenewal) return false;
      
      return true;
    });
  }, [reminders, players, playersStats]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="sr-only">Student Database</p>
          <div className="flex items-center gap-4">
            {groupByMode === 'player' && groupFilter !== 'all' && (
              <button 
                onClick={() => {
                  setGroupFilter('all');
                  setGroupByMode('group');
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl border border-slate-700 transition-all flex items-center gap-2 group mr-2"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest pr-2">Back to Groups</span>
              </button>
            )}
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">
              {groupByMode === 'group' ? 'Groups' : groupFilter !== 'all' ? groups.find(g => g.id === groupFilter)?.name : 'Athletes'}
            </h1>
            {groupFilter === 'all' && (
              <div className="flex bg-slate-900 border-2 border-slate-800 rounded-xl p-1">
                <button 
                  onClick={() => setGroupByMode('player')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all text-[10px] md:text-xs font-black uppercase tracking-widest",
                    groupByMode === 'player' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Athletes
                </button>
                <button 
                  onClick={() => setGroupByMode('group')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all text-[10px] md:text-xs font-black uppercase tracking-widest",
                    groupByMode === 'group' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Groups
                </button>
              </div>
            )}
            <div className="flex bg-slate-900 border-2 border-slate-800 rounded-xl p-1">
              <button 
                onClick={() => groupByMode === 'group' ? setGroupViewMode('grid') : setViewMode('grid')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  (groupByMode === 'group' ? groupViewMode : viewMode) === 'grid' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => groupByMode === 'group' ? setGroupViewMode('list') : setViewMode('list')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  (groupByMode === 'group' ? groupViewMode : viewMode) === 'list' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
              >
                <List size={16} />
              </button>
            </div>
          </div>
          <p className="text-slate-400 mt-2 uppercase text-xs md:text-sm tracking-widest leading-none">Manage profiles and training subscriptions</p>
        </div>
        <div className="flex gap-3">
          <Link to="/reminders" className={cn(
            "relative shrink-0 flex items-center justify-center transition-colors shadow-bento-subtle",
            unreadReminders.length > 0
              ? "h-10 w-10 bg-red-500/20 text-red-500 rounded-full border border-red-500/30 hover:bg-red-500/30 animate-pulse"
              : "h-[42px] w-[42px] bg-slate-900 border-2 border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-700"
          )}>
            <Bell size={18} className={cn(
              unreadReminders.length > 0 ? "text-red-500 animate-pulse" : "text-blue-500"
            )} />
            {unreadReminders.length > 0 && (
                <div className="absolute -top-2 -right-2 flex items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-40 animate-ping"></span>
                  <span className="relative flex h-5 min-w-[20px] items-center justify-center bg-red-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-red-500/40">
                    {unreadReminders.length}
                  </span>
                </div>
            )}
          </Link>
          {currentUserRole?.role !== 'visitor' && (
            <>
              <button 
                onClick={() => downloadTemplate('players')}
                className="flex items-center justify-center h-[42px] w-[42px] bg-slate-900 border-2 border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-700 text-slate-400 hover:text-blue-400 group relative transition-all"
                title="Download Athlete Template"
              >
                <Download size={18} />
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-950 text-[10px] text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-slate-800 pointer-events-none uppercase tracking-widest font-black">
                  Athlete Template
                </div>
              </button>
              <button 
                onClick={() => setShowMassUpload(true)}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 border-2 border-slate-800 shadow-bento-subtle transition uppercase text-base font-black tracking-widest"
              >
                <Upload size={16} />
                <span>Import Excel/CSV</span>
              </button>
              <button 
                onClick={() => {
                  if (groupByMode === 'group') {
                    setEditingGroup(null);
                    setShowAddGroupModal(true);
                  } else {
                    setShowAddModal(true);
                  }
                }}
                className="flex items-center gap-2 bento-button-black h-fit"
              >
                <Plus size={16} />
                <span>{groupByMode === 'group' ? 'New Group' : 'New Player'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search by name, location, group, level or package..."
              className="w-full bg-slate-900/50 border-2 border-slate-800 rounded-2xl pl-12 pr-8 py-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all uppercase tracking-widest font-normal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
             onClick={() => {
                if (isAnyFilterApplied) {
                    setSearchTerm('');
                    setFilterType('all');
                    setLocationFilter('all');
                    setLevelFilter('all');
                    setGroupFilter('all');
                    setStatusFilter('all'); // Clear status filter or set it to 'active'. Wait, the default status filter is 'active'. So let's reset to 'active'
                    setStatusFilter('active');
                } else {
                    setShowFilters(!showFilters);
                }
             }}
             className={cn("flex md:min-w-[140px] items-center justify-center gap-2 px-6 py-4 rounded-2xl border-2 font-black tracking-widest uppercase transition-all shrink-0", 
               isAnyFilterApplied
                 ? "bg-red-600 border-red-500 hover:bg-red-700 hover:border-red-600 text-white shadow-lg shadow-red-900/20" 
                 : showFilters
                   ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                   : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
             )}
          >
             <Filter size={20} className={cn(isAnyFilterApplied ? "text-white" : "", "shrink-0")} />
             <span className="hidden md:inline">{isAnyFilterApplied ? 'Remove Filters' : 'Filters'}</span>
             {isAnyFilterApplied && (
                <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-[10px] ml-1 shrink-0 font-bold border-2 border-red-500 leading-none flex items-center justify-center">
                   {
                      (searchTerm !== '' ? 1 : 0) +
                      (filterType !== 'all' ? 1 : 0) + 
                      (locationFilter !== 'all' ? 1 : 0) + 
                      (levelFilter !== 'all' ? 1 : 0) + 
                      (groupFilter !== 'all' ? 1 : 0) +
                      (statusFilter !== 'active' ? 1 : 0)
                   }
                </span>
             )}
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="relative z-50"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pb-2">
                <FilterDropdown 
                  icon={<PackageIcon size={16} />}
                  label="Package"
                  value={filterType}
                  options={[
                    { value: 'all', label: 'All Packages' },
                    ...packageTypes.map(t => ({ value: t.code, label: t.name })).sort((a, b) => a.label.localeCompare(b.label))
                  ]}
                  onChange={setFilterType}
                  searchable={true}
                />
                
                <div className="flex items-center bg-slate-900/50 border-2 border-slate-800 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all",
                      statusFilter === 'active' ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setStatusFilter('inactive')}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all",
                      statusFilter === 'inactive' ? "bg-red-500 text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    Inactive
                  </button>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest transition-all",
                      statusFilter === 'all' ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    All
                  </button>
                </div>
                <FilterDropdown 
                  icon={<MapPin size={16} />}
                  label="Location"
                  value={locationFilter}
                  options={[
                    { value: 'all', label: 'All Locations' },
                    ...locations.map(l => ({ value: l.id, label: l.name })).sort((a, b) => a.label.localeCompare(b.label))
                  ]}
                  onChange={setLocationFilter}
                  searchable={true}
                />
                <FilterDropdown 
                  icon={<Trophy size={16} />}
                  label="Level"
                  value={levelFilter}
                  options={[
                    { value: 'all', label: 'All Levels' },
                    ...levels.map(l => ({ value: l.id, label: l.name })).sort((a, b) => a.label.localeCompare(b.label))
                  ]}
                  onChange={setLevelFilter}
                  searchable={true}
                />
                <FilterDropdown 
                  icon={<Users size={16} />}
                  label="Group"
                  value={groupFilter}
                  options={[
                    { value: 'all', label: 'All Groups' },
                    ...groups.map(g => ({ value: g.id, label: `${g.code} - ${g.name}` })).sort((a, b) => a.label.localeCompare(b.label))
                  ]}
                  onChange={setGroupFilter}
                  searchable={true}
                />
              </div>
              
              {isAnyFilterApplied && (
                <div className="flex justify-end mt-2">
                  <button 
                    onClick={() => {
                      setSearchTerm('');
                      setFilterType('all');
                      setLocationFilter('all');
                      setLevelFilter('all');
                      setGroupFilter('all');
                      setStatusFilter('active');
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                  >
                    <X size={14} /> clear filters
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {groupByMode === 'group' ? (
        groupViewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map((group) => {
              const groupPlayers = players.filter(p => p.groupId === group.id);
              const groupPlayersCount = groupPlayers.length;
              const activeCount = groupPlayers.filter(p => p.isActive !== false).length;
              const inactiveCount = groupPlayers.filter(p => p.isActive === false).length;
              
              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group cursor-pointer"
                  onClick={() => {
                    setGroupFilter(group.id);
                    setGroupByMode('player');
                  }}
                >
                  <div className="bento-card h-full bg-slate-900/50 hover:border-slate-700 transition-all duration-300 relative flex flex-col">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white border-2 border-slate-800 shadow-bento-subtle shrink-0 font-black text-lg tracking-tighter" style={{ backgroundColor: getGroupColor(group.id!, group.color) }}>
                        {group.code || 'GRP'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-xl font-black text-white uppercase tracking-tight truncate max-w-[240px]">{group.name}</h3>
                          {group.isActive === false && <span className="shrink-0 px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-500 tracking-widest uppercase font-bold leading-none mt-1">Inactive</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Members:</span>
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
                            {groupPlayers.slice(0, 8).map(p => p.name.split(' ')[0]).join(' - ')}
                            {groupPlayers.length > 8 && ` - +${groupPlayers.length - 8} MORE`}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-auto pt-4 flex items-end justify-between border-t border-slate-800/50">
                      <div className="flex items-center gap-6">
                        <div>
                          <span className="text-[10px] text-emerald-500/80 uppercase font-black tracking-widest leading-none block mb-1">Active</span>
                          <p className="text-2xl text-emerald-500 tracking-tighter font-black italic leading-none">{activeCount}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-none block mb-1">Inactive</span>
                          <p className="text-2xl text-slate-400 tracking-tighter font-black italic leading-none">{inactiveCount}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroup(group);
                            setShowAddGroupModal(true);
                          }}
                          className="bg-slate-800 p-2 rounded-lg hover:bg-amber-600 text-slate-400 hover:text-white transition-all shadow-lg"
                        >
                          <Pen size={16} />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await updateMasterData('groups', group.id, { ...group, isActive: group.isActive === false ? true : false });
                          }}
                          className={cn(
                            "w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200",
                            group.isActive !== false ? "bg-emerald-500" : "bg-red-500"
                          )}
                        >
                          <div className={cn("w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200", group.isActive !== false ? "translate-x-4" : "translate-x-0")}></div>
                        </button>
                        {group.isActive === false && <span className="shrink-0 px-2 py-1 rounded text-[10px] bg-red-500/20 text-red-500 tracking-widest uppercase font-bold leading-none">Inactive</span>}
                        <div className="bg-slate-800 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-900/50 border-2 border-slate-800 rounded-[2rem] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th className="px-6 py-4 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest">Group</th>
                    <th className="px-6 py-4 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest">Code</th>
                    <th className="px-6 py-4 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest">Active</th>
                    <th className="px-6 py-4 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest">Inactive</th>
                    <th className="px-6 py-4 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest">Members</th>
                    <th className="px-6 py-4 text-right text-[10px] md:text-sm text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-800/30">
                  {filteredGroups.map((group) => {
                    const groupPlayers = players.filter(p => p.groupId === group.id);
                    const activeCount = groupPlayers.filter(p => p.isActive !== false).length;
                    const inactiveCount = groupPlayers.filter(p => p.isActive === false).length;
                    
                    return (
                      <tr 
                        key={group.id} 
                        className="group hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setGroupFilter(group.id);
                          setGroupByMode('player');
                        }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white border border-slate-700 shadow-sm shrink-0 font-black text-[10px]" style={{ backgroundColor: getGroupColor(group.id!, group.color) }}>
                              {group.code || 'GRP'}
                            </div>
                            <span className="text-xs md:text-sm text-white uppercase font-black tracking-tight">{group.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs md:text-sm text-blue-500 uppercase font-black tracking-widest">{group.code || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm md:text-lg text-emerald-500 font-black tracking-tighter italic">{activeCount}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm md:text-lg text-slate-500 font-black tracking-tighter italic">{inactiveCount}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex -space-x-2">
                            {groupPlayers.slice(0, 5).map((p, i) => (
                              <div 
                                key={p.id} 
                                className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] text-white font-bold uppercase"
                                title={p.name}
                              >
                                {p.name.charAt(0)}
                              </div>
                            ))}
                            {groupPlayers.length > 5 && (
                              <div className="h-6 w-6 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-[8px] text-slate-500 font-bold">
                                +{groupPlayers.length - 5}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingGroup(group);
                                setShowAddGroupModal(true);
                              }}
                              className="bg-slate-800 p-2 rounded-lg hover:bg-amber-600 text-slate-400 hover:text-white transition-all"
                            >
                              <Pen size={14} />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await updateMasterData('groups', group.id, { ...group, isActive: group.isActive === false ? true : false });
                              }}
                              className={cn(
                                "w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200",
                                group.isActive !== false ? "bg-emerald-500" : "bg-red-500"
                              )}
                            >
                              <div className={cn("w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200", group.isActive !== false ? "translate-x-4" : "translate-x-0")}></div>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : viewMode === 'grid' ? (

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlayers.map((player) => {
            const stats = playersStats.get(String(player.id)) || { totalPending: 0, latestPackage: null, needsRenewal: false };
            const levelName = levelsMap.get(player.levelId)?.name;
            const locationName = locationsMap.get(player.locationId)?.name;
            
            const playerUnread = unreadReminders.filter(r => r.playerId === player.id && (r.category === 'Financial' || r.category === 'Renew'));
            const isFinancialStillValid = (stats.totalPending || 0) > 0.01;
            const isRenewStillValid = stats.needsRenewal === true;
            
            const unreadFinancial = playerUnread.filter(r => r.category === 'Financial' && isFinancialStillValid);
            const unreadRenew = playerUnread.filter(r => r.category === 'Renew' && isRenewStillValid);
            
            const hasFinancialInUnread = playerUnread.some(r => r.category === 'Financial');
            const hasRenewInUnread = playerUnread.some(r => r.category === 'Renew');
            
            const dynamicFinancial = (!hasFinancialInUnread && isFinancialStillValid) ? 1 : 0;
            const dynamicRenew = (!hasRenewInUnread && isRenewStillValid) ? 1 : 0;
            
            const alarmsCount = unreadFinancial.length + unreadRenew.length + dynamicFinancial + dynamicRenew;
            
            return (
              <motion.div
                layout
                key={player.id}
                className="group relative"
              >
                {(() => {
                   const pg = groupsMap.get(player.groupId);
                   const displayGroup = pg ? (pg.code ? `${pg.code} . ${pg.name}` : pg.name) : null;
                   return (
                     <>
                <Link 
                  to={`/players/${player.id}`}
                  className="bento-card flex flex-col h-full bg-slate-900/50 hover:border-slate-700 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-8">
                      <div 
                        className={cn("h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center font-black text-2xl md:text-3xl border-2 transition-transform shadow-bento-subtle group-hover:rotate-6", !pg ? "bg-slate-900 text-slate-500 border-slate-800" : "text-white")}
                        style={pg ? { backgroundColor: getGroupColor(pg.id!, pg.color), borderColor: `${getGroupColor(pg.id!, pg.color)}80`, boxShadow: `0 0 20px ${getGroupColor(pg.id!, pg.color)}40` } : undefined}
                      >
                        {player.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {displayGroup && (
                          <div className="text-sm md:text-base text-blue-500 uppercase tracking-widest leading-none mb-1 shadow-glow-blue-sm">
                            {displayGroup}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl md:text-3xl text-white tracking-tight leading-none truncate group-hover:text-blue-400 transition-colors uppercase">{player.name}</h3>
                          {player.isActive === false && <span className="shrink-0 px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-500 tracking-widest uppercase font-bold leading-none mt-1">Inactive</span>}
                          {alarmsCount > 0 && <div className="relative ml-1 mt-1"><Bell className="text-red-500 animate-pulse" size={20} /><span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">{alarmsCount}</span></div>}
                        </div>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-blue-500 tracking-widest uppercase opacity-70">
                          <Trophy size={11} />
                          <span className="truncate">{levelName || 'TBD LEVEL'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6 bg-slate-950/30 p-4 rounded-2xl border border-slate-800/50">
                      {locationName && (
                        <div className="flex items-center gap-3">
                          <MapPin size={12} className="text-slate-600" />
                          <span className="text-xs md:text-sm text-slate-400 uppercase tracking-widest">LOC:</span>
                          <span className="text-xs md:text-sm text-slate-200 uppercase truncate">{locationName}</span>
                        </div>
                      )}
                      {player.tag && (
                        <div className="flex items-center gap-3">
                          <Tag size={12} className="text-blue-500" />
                          <span className="text-xs text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">{player.tag}</span>
                        </div>
                      )}
                      {player.notes && (
                        <div className="flex items-center gap-3">
                          <FileText size={12} className="text-slate-600" />
                          <span className="text-xs text-slate-400 capitalize truncate" title={player.notes}>{player.notes}</span>
                        </div>
                      )}
                      {displayGroup && (
                        <div className="flex items-center gap-3">
                          <Users size={12} className="text-slate-600" />
                          <span className="text-xs md:text-sm text-slate-400 uppercase tracking-widest">GRP:</span>
                          <div className="flex items-center gap-2 truncate">
                            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: getGroupColor(pg.id!, pg.color) }} />
                            <span className="text-xs md:text-sm text-slate-200 uppercase truncate">
                              {displayGroup}
                            </span>
                          </div>
                        </div>
                      )}
                      {player.phone && (
                        <div className="flex items-center gap-3">
                          <Phone size={12} className="text-slate-600" />
                          <span className="text-sm md:text-base text-slate-300">{player.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t-2 border-slate-800/50 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-widest">PKG STATUS</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className={cn("h-2 w-2 rounded-full shadow-bento", stats.needsRenewal ? "bg-blue-500 animate-pulse" : "bg-emerald-500")} />
                        <span className="text-xs md:text-base text-slate-100 uppercase tracking-widest">{player.packageTypeCode || 'STANDBY'} {stats.needsRenewal && <span className="text-blue-500">· RENEW</span>}</span>
                      </div>
                    </div>
                    <div className="text-right cursor-pointer group" onClick={(e) => handleBalanceClick(e, String(player.id))}>
                      <span className="text-xs text-slate-400 uppercase tracking-widest group-hover:text-amber-400">BALANCE</span>
                      <p className={cn(
                        "text-xl md:text-3xl mt-1 uppercase tracking-tighter group-hover:text-amber-400",
                        stats.totalPending > 0 ? "text-red-500" : "text-emerald-500"
                      )}>
                        {formatCurrency(stats.totalPending)}
                      </p>
                      {stats.totalPending > 0 && (
                        <p className="text-[7px] font-normal text-slate-400 uppercase tracking-tighter leading-none mt-1">Settled via Instapay: 01222200548</p>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Actions Overlay: Outside Link but pinned to card */}
                {currentUserRole?.role !== 'visitor' && (
                  <div className="absolute top-4 right-4 z-20 flex gap-2">
                    {confirmDeleteId === player.id ? (
                      <motion.div 
                        layoutId={`actions-${player.id}`}
                        className="flex gap-1 animate-in fade-in slide-in-from-right-2 bg-red-950/90 backdrop-blur-md p-1 rounded-xl border border-red-500/50"
                      >
                         <button 
                           disabled={isSaving}
                           onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePlayer(player.id!); }}
                           className="h-8 px-4 flex items-center justify-center rounded-lg bg-red-600 text-white text-lg uppercase shadow-lg hover:bg-red-500 transition-colors pointer-events-auto"
                         >
                           {isSaving ? '...' : 'YES'}
                         </button>
                         <button 
                           onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null); }}
                           className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                         >
                           <X size={14} />
                         </button>
                      </motion.div>
                    ) : (
                      <motion.div 
                        layoutId={`actions-${player.id}`}
                        className="flex gap-2 backdrop-blur-md p-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/team-messages?playerId=${player.id}`); }} 
                          className="h-9 w-9 flex items-center justify-center border-2 border-slate-800 rounded-xl bg-slate-950/80 text-slate-400 hover:text-blue-400 hover:border-blue-500/50 transition-all"
                          title="Send Message"
                        >
                          <Mail size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditPlayer(player); }} 
                          className="h-9 w-9 flex items-center justify-center border-2 border-slate-800 rounded-xl bg-slate-950/80 text-slate-400 hover:text-blue-400 hover:border-blue-500/50 transition-all"
                          title="Edit Athlete"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(player.id!); }} 
                          className="h-9 w-9 flex items-center justify-center border-2 border-slate-800 rounded-xl bg-slate-950/80 text-slate-400 hover:text-red-500 hover:border-red-500/50 transition-all"
                          title="Remove Athlete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
                </>
                );
              })()}
              </motion.div>
            );
          })}
          {breakdown && (
            <PackageBreakdown packages={breakdown.packages} playerId={breakdown.playerId!} onClose={() => setBreakdown(null)} position={breakdown.position} />
          )}
          {showNotesPlayer && (
            <PlayerNotesModal player={showNotesPlayer} onClose={() => setShowNotesPlayer(null)} />
          )}
        </div>
      ) : (
        <div className="bg-slate-900/50 border-2 border-slate-800 rounded-[2rem] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800">
                  <th 
                    className="px-6 py-4 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors"
                    onClick={(e) => handleSort('group', e.ctrlKey || e.metaKey)}
                  >
                    <div className="flex items-center gap-1">
                      Group
                      {sortConfigs.find(s => s.key === 'group') && (
                        <span className="text-blue-500 text-[8px]">
                          {sortConfigs.find(s => s.key === 'group')?.direction === 'asc' ? '▲' : '▼'}
                          {sortConfigs.length > 1 && sortConfigs.findIndex(s => s.key === 'group') + 1}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3.5 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors"
                    onClick={(e) => handleSort('name', e.ctrlKey || e.metaKey)}
                  >
                    <div className="flex items-center gap-1">
                      Players
                      {sortConfigs.find(s => s.key === 'name') && (
                        <span className="text-blue-500 text-[8px]">
                          {sortConfigs.find(s => s.key === 'name')?.direction === 'asc' ? '▲' : '▼'}
                          {sortConfigs.length > 1 && sortConfigs.findIndex(s => s.key === 'name') + 1}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors"
                    onClick={(e) => handleSort('location', e.ctrlKey || e.metaKey)}
                  >
                    <div className="flex items-center gap-1">
                      Location
                      {sortConfigs.find(s => s.key === 'location') && (
                        <span className="text-blue-500 text-[8px]">
                          {sortConfigs.find(s => s.key === 'location')?.direction === 'asc' ? '▲' : '▼'}
                          {sortConfigs.length > 1 && sortConfigs.findIndex(s => s.key === 'location') + 1}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors"
                    onClick={(e) => handleSort('level', e.ctrlKey || e.metaKey)}
                  >
                    <div className="flex items-center gap-1">
                      Level
                      {sortConfigs.find(s => s.key === 'level') && (
                        <span className="text-blue-500 text-[8px]">
                          {sortConfigs.find(s => s.key === 'level')?.direction === 'asc' ? '▲' : '▼'}
                          {sortConfigs.length > 1 && sortConfigs.findIndex(s => s.key === 'level') + 1}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] md:text-sm text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors"
                    onClick={(e) => handleSort('package', e.ctrlKey || e.metaKey)}
                  >
                    <div className="flex items-center gap-1">
                      Package
                      {sortConfigs.find(s => s.key === 'package') && (
                        <span className="text-blue-500 text-[8px]">
                          {sortConfigs.find(s => s.key === 'package')?.direction === 'asc' ? '▲' : '▼'}
                          {sortConfigs.length > 1 && sortConfigs.findIndex(s => s.key === 'package') + 1}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-right text-[10px] md:text-sm text-slate-400 uppercase tracking-widest cursor-pointer hover:text-blue-500 transition-colors"
                    onClick={(e) => handleSort('balance', e.ctrlKey || e.metaKey)}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Balance
                      {sortConfigs.find(s => s.key === 'balance') && (
                        <span className="text-blue-500 text-[8px]">
                          {sortConfigs.find(s => s.key === 'balance')?.direction === 'asc' ? '▲' : '▼'}
                          {sortConfigs.length > 1 && sortConfigs.findIndex(s => s.key === 'balance') + 1}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right text-[10px] md:text-sm text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-800/30">
                {[...filteredPlayers].sort((a, b) => {
                  if (sortConfigs.length === 0) {
                    const groupA = groupsMap.get(a.groupId)?.name || 'ZZZ';
                    const groupB = groupsMap.get(b.groupId)?.name || 'ZZZ';
                    if (groupA !== groupB) return groupA.localeCompare(groupB);
                    return a.name.localeCompare(b.name);
                  }

                  for (const config of sortConfigs) {
                    let valA: any = '';
                    let valB: any = '';

                    switch (config.key) {
                      case 'group':
                        valA = groupsMap.get(a.groupId)?.name || '';
                        valB = groupsMap.get(b.groupId)?.name || '';
                        break;
                      case 'name':
                        valA = a.name;
                        valB = b.name;
                        break;
                      case 'location':
                        valA = locationsMap.get(a.locationId)?.name || '';
                        valB = locationsMap.get(b.locationId)?.name || '';
                        break;
                      case 'level':
                        valA = levelsMap.get(a.levelId)?.name || '';
                        valB = levelsMap.get(b.levelId)?.name || '';
                        break;
                      case 'package':
                        valA = a.packageTypeCode || '';
                        valB = b.packageTypeCode || '';
                        break;
                      case 'balance':
                        valA = playersStats.get(String(a.id))?.totalPending || 0;
                        valB = playersStats.get(String(b.id))?.totalPending || 0;
                        break;
                    }

                    if (valA !== valB) {
                      if (typeof valA === 'string' && typeof valB === 'string') {
                        return config.direction === 'asc' 
                          ? valA.localeCompare(valB) 
                          : valB.localeCompare(valA);
                      }
                      return config.direction === 'asc' 
                        ? (valA > valB ? 1 : -1) 
                        : (valA < valB ? 1 : -1);
                    }
                  }
                  return 0;
                }).map((player) => {
                  const stats = playersStats.get(String(player.id)) || { totalPending: 0, latestPackage: null, needsRenewal: false };
                  const levelName = levelsMap.get(player.levelId)?.name;
                  const locationName = locationsMap.get(player.locationId)?.name;
                  const group = groupsMap.get(player.groupId);

                  const playerUnread = unreadReminders.filter(r => r.playerId === player.id && (r.category === 'Financial' || r.category === 'Renew'));
                  const isFinancialStillValid = (stats.totalPending || 0) > 0.01;
                  const isRenewStillValid = stats.needsRenewal === true;
                  
                  const unreadFinancial = playerUnread.filter(r => r.category === 'Financial' && isFinancialStillValid);
                  const unreadRenew = playerUnread.filter(r => r.category === 'Renew' && isRenewStillValid);
                  
                  const hasFinancialInUnread = playerUnread.some(r => r.category === 'Financial');
                  const hasRenewInUnread = playerUnread.some(r => r.category === 'Renew');
                  
                  const dynamicFinancial = (!hasFinancialInUnread && isFinancialStillValid) ? 1 : 0;
                  const dynamicRenew = (!hasRenewInUnread && isRenewStillValid) ? 1 : 0;
                  
                  const alarmsCount = unreadFinancial.length + unreadRenew.length + dynamicFinancial + dynamicRenew;

                  return (
                    <tr key={player.id} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
                          onClick={(e) => {
                             e.stopPropagation();
                             if (group) {
                                navigate(`/master?tab=groups&groupId=${group.id}`);
                             }
                          }}
                        >
                           <div 
                             className="h-1.5 w-1.5 rounded-full flex-shrink-0" 
                             style={{ backgroundColor: group ? getGroupColor(group.id!, group.color) : 'transparent' }} 
                           />
                           <span className="text-xs md:text-sm text-slate-300 uppercase tracking-tight truncate max-w-[120px] md:max-w-[180px]">{(group?.code ? `${group.code} . ${group.name}` : group?.name) || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link to={`/players/${player.id}`} className="flex items-center gap-3">
                          <div 
                            className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-black text-base md:text-lg border relative", !group ? "bg-slate-900 text-slate-500 border-slate-800" : "text-white")}
                            style={group ? { backgroundColor: getGroupColor(group.id!, group.color), borderColor: `${getGroupColor(group.id!, group.color)}80`, boxShadow: `0 0 10px ${getGroupColor(group.id!, group.color)}40` } : undefined}
                          >
                            {player.name.charAt(0)}
                            {stats.needsRenewal && <div className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full border-2 border-slate-900 animate-pulse" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs md:text-base text-white leading-none group-hover:text-blue-400 truncate max-w-[150px] md:max-w-xs">{toTitleCase(player.name)}</p>
                              {player.isActive === false && <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] bg-red-500/20 text-red-500 tracking-widest uppercase font-bold leading-none">Inactive</span>}
                              {alarmsCount > 0 && <div className="relative ml-1"><Bell className="text-red-500 animate-pulse" size={14} /><span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full text-[8px] w-3 h-3 flex items-center justify-center">{alarmsCount}</span></div>}
                            </div>
                            <div className="flex items-center gap-2">
                              {player.tag && <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">{player.tag}</span>}
                              {player.notes && <span title={player.notes} className="flex"><FileText size={10} className="text-slate-500" /></span>}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs md:text-sm text-slate-300 uppercase tracking-tight">{locationName || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-xs md:text-sm text-slate-300 uppercase tracking-tight">{levelName || 'TBD LEVEL'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs md:text-sm text-blue-400 uppercase font-black italic tracking-widest whitespace-nowrap">
                          {player.packageTypeCode || 'STANDBY'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right cursor-pointer group" onClick={(e) => handleBalanceClick(e, String(player.id))}>
                        <p className={cn(
                          "text-base md:text-xl uppercase group-hover:text-amber-400",
                          stats.totalPending > 0 ? "text-red-500" : "text-emerald-500"
                        )}>
                          {formatCurrency(stats.totalPending)}
                        </p>
                        {stats.totalPending > 0 && (
                          <p className="hidden"></p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {currentUserRole?.role !== 'visitor' && (
                          <div className="flex justify-end gap-2">
                            {confirmDeleteId === player.id ? (
                              <div className="flex gap-1 animate-in fade-in slide-in-from-right-2 bg-red-950/90 backdrop-blur-md p-1 rounded border border-red-500/50">
                                 <button 
                                   disabled={isSaving}
                                   onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePlayer(player.id!); }}
                                   className="h-7 px-2 flex items-center justify-center rounded bg-red-600 text-white text-[10px] uppercase shadow-lg hover:bg-red-500 transition-colors"
                                 >
                                   {isSaving ? '...' : 'YES'}
                                 </button>
                                 <button 
                                   onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null); }}
                                   className="h-7 w-7 flex items-center justify-center rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                                 >
                                   <X size={12} />
                                 </button>
                              </div>
                            ) : (
                             <>
                              <button 
                                onClick={() => navigate(`/team-messages?playerId=${player.id}`)} 
                                className="h-7 w-7 flex items-center justify-center border border-slate-800 rounded bg-slate-950 text-slate-400 hover:text-blue-400 hover:border-blue-400/50 transition-all shadow-sm"
                                title="Send Message to Player"
                              >
                                <Mail size={12} />
                              </button>
                              <button 
                                onClick={() => handleEditPlayer(player)} 
                                className="h-7 w-7 flex items-center justify-center border border-blue-500/50 rounded bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                title="Edit Profile"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setShowNotesPlayer(player); }} 
                                className="h-7 w-7 flex items-center justify-center border border-slate-800 rounded bg-slate-950 text-slate-500 hover:text-amber-400 transition-all"
                                title="Add/View Notes"
                              >
                                <FileText size={12} />
                              </button>
                             </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {breakdown && (
            <PackageBreakdown packages={breakdown.packages} playerId={breakdown.playerId!} onClose={() => setBreakdown(null)} position={breakdown.position} />
          )}
        </div>
      )}

      {(groupByMode === 'player' ? filteredPlayers.length === 0 : filteredGroups.length === 0) && (
        <div className="text-center py-32 bg-slate-900/50 rounded-[3rem] border-4 border-dashed border-slate-800 mt-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-[2rem] bg-slate-950 text-slate-400 border-2 border-slate-800 shadow-bento mb-8">
            <Users size={40} />
          </div>
          <h3 className="text-2xl font-black text-white uppercase tracking-tight">
            {groupByMode === 'group' ? 'No Groups found' : 'No Athletes found'}
          </h3>
          <p className="text-slate-500 mt-3 uppercase text-lg tracking-widest max-w-xs mx-auto">
            {groupByMode === 'group' ? 'No matching groups in the current database' : 'No matching players in the current roster'}
          </p>
          {currentUserRole?.role !== 'visitor' && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="mt-10 bento-button-black inline-flex items-center gap-3"
            >
              <Plus size={18} />
              <span>CREATE PROFILE</span>
            </button>
          )}
        </div>
      )}

      {/* Add Group Modal */}
      <AnimatePresence>
        {showAddGroupModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddGroupModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 rounded-[2rem] border-2 border-slate-800 shadow-bento p-8"
            >
              <button 
                onClick={() => setShowAddGroupModal(false)}
                className="absolute top-6 right-6 h-8 w-8 flex items-center justify-center border-2 border-slate-800 rounded-lg text-slate-500 hover:text-white transition"
              >
                <X size={16} />
              </button>

              <div className="h-16 w-16 bg-slate-950 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-slate-800 shadow-bento rotate-3">
                <Users size={28} />
              </div>

              <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight text-center">{editingGroup ? 'UPDATE GROUP' : 'INITIALIZE NEW GROUP'}</h2>
              <p className="text-slate-500 mb-8 uppercase text-sm tracking-widest text-center">{editingGroup ? `Update existing group ${editingGroup.name}` : 'Define a new training group for the roster'}</p>

              <GroupForm 
                groupToEdit={editingGroup}
                onSuccess={() => { setShowAddGroupModal(false); setEditingGroup(null); }}
                onCancel={() => { setShowAddGroupModal(false); setEditingGroup(null); }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Player Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setEditingPlayer(null); setShowAddModal(false); }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
             <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 rounded-[2rem] border-2 border-slate-800 shadow-bento overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none">{editingPlayer ? 'Modify Athlete' : 'Athlete Registration'}</h2>
                  <button onClick={() => { setEditingPlayer(null); setShowAddModal(false); }} className="h-9 w-9 flex items-center justify-center border-2 border-slate-800 rounded-lg text-slate-500 hover:text-white transition"><X size={20} /></button>
                </div>
                {error && (
                  <div className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/50 rounded-2xl flex items-center gap-3 text-red-500">
                    <AlertCircle size={18} />
                    <span className="text-lg uppercase tracking-widest">{error}</span>
                  </div>
                )}
                <PlayerForm 
                  initialData={editingPlayer}
                  onCancel={() => { setEditingPlayer(null); setShowAddModal(false); }}
                  onSubmit={handleSubmit}
                  isSaving={isSaving}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mass Upload Modal */}
      <AnimatePresence>
        {showMassUpload && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMassUpload(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 rounded-[2rem] border-2 border-slate-800 shadow-bento overflow-hidden"
            >
              <div className="p-8 text-center">
                <button 
                  onClick={() => setShowMassUpload(false)}
                  className="absolute top-6 right-6 h-8 w-8 flex items-center justify-center border-2 border-slate-800 rounded-lg text-slate-500 hover:text-white transition"
                >
                  <X size={16} />
                </button>
                <div className="h-16 w-16 bg-slate-950 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-slate-800 shadow-bento rotate-3">
                  <Upload size={28} />
                </div>
                <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">DATA INGESTION</h2>
                <p className="text-slate-500 mb-8 uppercase text-sm tracking-widest leading-loose px-4">Upload a CSV or XLSX file containing columns: name, level, location, group, packageType, numSessions, email, phone.</p>
                
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-blue-400 font-bold uppercase tracking-widest text-sm animate-pulse">Processing File... Do Not Close</p>
                  </div>
                ) : importStatus ? (
                  <div className={cn(
                    "p-5 rounded-2xl flex items-center gap-4 text-left mb-6 border-2 shadow-bento-subtle animate-bounce",
                    importStatus.type === 'success' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/50" : "bg-red-500/10 text-red-500 border-red-500/50"
                  )}>
                    {importStatus.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    <p className="text-sm uppercase tracking-tight leading-tight">{importStatus.message}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    <label className="block ring-2 ring-slate-800 rounded-2xl p-4 hover:ring-blue-500 transition-all cursor-pointer bg-slate-950 border-2 border-dashed border-slate-800">
                      <input 
                        type="file" 
                        accept=".csv, .xlsx"
                        onChange={handleMassUpload}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-2 file:border-slate-800 file:text-xs file:bg-slate-900 file:text-slate-300 hover:file:text-white cursor-pointer uppercase tracking-widest"
                      />
                    </label>
                    <button
                      onClick={() => {
                        const csvContent = "name,level,location,group,packageType,numSessions,email,phone\nJohn Doe,Beginner,Main Court,G2-BUE,G2,8,john@example.com,+123456789";
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = "players_template.csv";
                        a.click();
                      }}
                      className="flex items-center justify-center gap-2 text-slate-600 text-sm hover:text-blue-400 transition-colors uppercase tracking-[0.2em]"
                    >
                      <Download size={12} />
                      Download Prototypical Template
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchableSelect({ options, value, onChange, placeholder, disabled, className, onAddClick, allowCustom }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  const selectedOption = options.find((o: any) => o.value === value) || (allowCustom && value ? { value, label: value } : null);
  const filteredOptions = options.filter((o: any) => (o.label || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`${className} flex items-center justify-between !pr-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={14} className="opacity-50 flex-shrink-0 ml-2" />
      </div>
      {isOpen && (
         <div className="absolute z-50 w-full mt-1 bg-slate-900 border-2 border-slate-700 rounded-xl shadow-xl overflow-hidden shadow-bento">
           <div className="p-2 border-b border-slate-800 flex items-center gap-2">
             <Search size={14} className="text-slate-500" />
             <input
               autoFocus
               type="text"
               className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-slate-600 focus:ring-0"
               placeholder="SEARCH..."
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
           <div className="max-h-48 overflow-y-auto custom-scrollbar">
             {filteredOptions.length === 0 && (
                <div className="p-3 text-xs text-slate-500 text-center italic uppercase">
                  No results
                  {onAddClick && searchTerm && (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onAddClick(searchTerm);
                        setSearchTerm('');
                      }}
                      className="block w-full mt-2 bg-blue-600/20 text-blue-400 hover:text-white hover:bg-blue-600 transition-colors rounded px-2 py-1.5 font-bold"
                    >
                      ADD "{searchTerm}"
                    </button>
                  )}
                  {allowCustom && !onAddClick && searchTerm && (
                    <button 
                      type="button"
                      onClick={() => {
                        onChange(searchTerm);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className="block w-full mt-2 bg-blue-600/20 text-blue-400 hover:text-white hover:bg-blue-600 transition-colors rounded px-2 py-1.5 font-bold"
                    >
                      ADD "{searchTerm}"
                    </button>
                  )}
                </div>
             )}
             {filteredOptions.map((opt: any) => (
               <div
                 key={opt.value}
                 onClick={() => {
                   onChange(opt.value);
                   setIsOpen(false);
                   setSearchTerm('');
                 }}
                 className={`p-3 text-xs cursor-pointer hover:bg-slate-800 transition-colors ${value === opt.value ? 'bg-blue-600 text-white' : 'text-slate-300'}`}
               >
                 {opt.label}
               </div>
             ))}
           </div>
         </div>
      )}
    </div>
  );
}

export function PlayerForm({ onCancel, onSubmit, initialData, isSaving }: any) {
  const navigate = useNavigate();
  const { players, levels, locations, groups, packageTypes, addMasterData } = useData();
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const [formData, setFormData] = useState<Partial<Player>>(initialData || {
    name: '',
    levelId: '',
    locationId: '',
    groupId: '',
    packageTypeCode: '',
    numSessions: 8,
    email: '',
    phone: '',
    tag: '',
    notes: '',
    hasParent: false,
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    isActive: true
  });

  const uniqueTags = Array.from(new Set(players.filter(p => p.tag).map(p => p.tag))).sort();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return alert("WARNING: Field 'Athlete Name' should have a value.");
    if (!formData.packageTypeCode) return alert("WARNING: Field 'Package Type Code' should have a value.");
    if (!formData.levelId) return alert("WARNING: Field 'Level Name' should have a value.");
    if (!formData.locationId) return alert("WARNING: Field 'Location Name' should have a value.");
    
    // Sync first active group to groupId for compatibility
    const activeGroup = formData.groupAssignments?.find(a => a.isActive)?.groupId || formData.groupAssignments?.[0]?.groupId;
    onSubmit({ ...formData, groupId: activeGroup || formData.groupId });
  };

  const handleAddGroupFromSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setIsAddingGroup(true);
    setNewGroupCode(searchTerm.trim().toUpperCase());
    setNewGroupName('');
  };

  const handleAddGroup = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newGroupCode.trim()) {
       alert("Group name and code are required");
       return;
    }
    setIsSavingGroup(true);
    try {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const newGroupRef = await addMasterData('groups', { 
         name: newGroupName.trim(), 
         code: newGroupCode.trim().substring(0, 5).toUpperCase(), 
         color: randomColor 
      });
      if (newGroupRef) {
         setFormData({ ...formData, groupId: (newGroupRef as any).id });
      }
      setIsAddingGroup(false);
      setNewGroupName('');
      setNewGroupCode('');
    } catch (err) {
      console.error(err);
      alert("Failed to create group");
    } finally {
      setIsSavingGroup(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 relative">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label-base uppercase">Package Type Code</label>
          <SearchableSelect
            disabled={isSaving}
            className="input-base    "
            value={formData.packageTypeCode}
            onChange={(val: string) => setFormData({ ...formData, packageTypeCode: val })}
            placeholder="SELECT CODE"
            options={packageTypes.map(t => ({ value: t.code, label: `${t.name} (${t.code})` }))}
          />
        </div>
        <div>
          <label className="label-base uppercase">Athlete Name</label>
          <input
            required
            type="text"
            disabled={isSaving}
            className="input-base   "
            placeholder="E.G. OMAR WAEL"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base uppercase">Level Name</label>
          <SearchableSelect
            disabled={isSaving}
            className="input-base    "
            value={formData.levelId}
            onChange={(val: string) => setFormData({ ...formData, levelId: val })}
            placeholder="SELECT LEVEL"
            options={levels.map(l => ({ value: l.id, label: l.name }))}
          />
        </div>
        <div>
          <label className="label-base uppercase">Location Name</label>
          <SearchableSelect
            disabled={isSaving}
            className="input-base    "
            value={formData.locationId}
            onChange={(val: string) => setFormData({ ...formData, locationId: val })}
            placeholder="SELECT LOCATION"
            options={locations.map(l => ({ value: l.id, label: l.name }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label-base uppercase mb-0">Group Assignments</label>
            <button 
              type="button" 
              onClick={() => setIsAddingGroup(true)}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1"
            >
              <Plus size={10} /> Add New
            </button>
          </div>
                    {(formData.groupAssignments || (formData.groupId ? [{ groupId: formData.groupId, isActive: true }] : [])).map((assignment, idx) => (
              assignment && <div key={idx} className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-lg">
                <span 
                  className="text-xs text-white font-bold flex-1 cursor-pointer hover:text-blue-400 underline"
                  onClick={() => {
                    const group = groups.find(g => g.id === assignment.groupId);
                    if (group) {
                      // We need to navigate to MasterData and activate the "groups" tab
                      // Since we are in an SPA and MasterData is a component, we can use history navigation or just set a local state in a common parent if it exists.
                      // Wait, how do we navigate? The routes are defined in App.tsx or similar.
                      // Looking at MasterData, it uses internal state tab.
                      // This might be tricky if they are on entirely different pages.
                      // Let's assume we can navigate via URL query/path.
                      navigate(`/master?tab=groups&groupId=${assignment.groupId}`);
                    }
                  }}
                >
                  {groups.find(g => g.id === assignment.groupId)?.name}
                </span>
                <button
                    type="button"
                    onClick={() => {
                        const newAssignments = [...(formData.groupAssignments || [])];
                        if (newAssignments[idx]) {
                            newAssignments[idx].isActive = !newAssignments[idx].isActive;
                            setFormData({ ...formData, groupAssignments: newAssignments });
                        }
                    }}
                    className={cn("px-2 py-1 text-[10px] font-bold rounded", assignment?.isActive ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500")}
                >
                    {assignment?.isActive ? 'ACTIVE' : 'INACTIVE'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const newAssignments = formData.groupAssignments!.filter((_, i) => i !== idx);
                        setFormData({ ...formData, groupAssignments: newAssignments });
                    }}
                    className="text-slate-500 hover:text-red-500"
                >
                    <X size={14} />
                </button>
              </div>
            ))}
            <SearchableSelect
              disabled={isSaving}
              className="input-base    "
              value={''}
              onChange={(val: string) => {
                  const currentAssignments = formData.groupAssignments || (formData.groupId ? [{ groupId: formData.groupId, isActive: true }] : []);
                  if (!currentAssignments.find(a => a.groupId === val)) {
                      setFormData({ ...formData, groupAssignments: [...currentAssignments, { groupId: val, isActive: true }] });
                  }
              }}
              placeholder="ASSIGN NEW GROUP"
              options={groups.filter(g => g.isActive !== false || g.id === formData.groupId || (formData.groupAssignments && formData.groupAssignments.some((asg: any) => String(asg.groupId) === String(g.id)))).map(g => ({ value: g.id, label: `${g.code} - ${g.name}` }))}
              onAddClick={handleAddGroupFromSearch}
            />
          </div>

        </div>
        <div>
          <label className="label-base uppercase">Sessions Package</label>
          <SearchableSelect
            disabled={isSaving}
            className="input-base    "
            value={formData.numSessions?.toString() || '8'}
            onChange={(val: string) => setFormData({ ...formData, numSessions: Number(val) })}
            placeholder="SELECT SESSIONS"
            options={[
              { value: '1', label: 'Drop in (1)' },
              { value: '4', label: '4 Sessions' },
              { value: '8', label: '8 Sessions' },
            ]}
          />
        </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base uppercase">Phone (Signal)</label>
          <input
            type="tel"
            disabled={isSaving}
            className="input-base  "
            placeholder="+20..."
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="label-base uppercase">Email Channel</label>
          <input
            type="email"
            disabled={isSaving}
            className="input-base  "
            placeholder="PLAYER@ENGINE.COM"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base uppercase">Tag</label>
          <SearchableSelect
            disabled={isSaving}
            className="input-base     w-full"
            value={formData.tag || ''}
            onChange={(val: string) => setFormData({ ...formData, tag: val })}
            placeholder="SELECT OR ADD TAG"
            options={uniqueTags.map(t => ({ value: t, label: t as string }))}
            allowCustom={true}
          />
        </div>
        <div>
          <label className="label-base uppercase">Notes</label>
          <input
            type="text"
            disabled={isSaving}
            className="input-base  "
            placeholder="ADDITIONAL NOTES..."
            value={formData.notes || ''}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm font-black text-slate-300 uppercase tracking-widest">Player is Active</span>
        
        <div className="flex items-center gap-3">
          <span className={cn("text-xs font-bold uppercase tracking-widest", formData.isActive !== false ? "text-slate-300" : "text-slate-500")}>Active</span>
          <button
            type="button"
            onClick={() => setFormData({...formData, isActive: formData.isActive === false ? true : false})}
            className={cn(
              "relative inline-flex items-center h-8 rounded-full w-[4.5rem] transition-colors duration-200 ease-in-out px-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900",
              formData.isActive !== false ? "bg-emerald-500" : "bg-slate-600"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-6 h-6 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-sm",
                formData.isActive !== false ? "transform translate-x-[1.75rem]" : "transform translate-x-0"
              )}
            >
              {formData.isActive !== false ? <CheckCircle2 size={14} className="text-emerald-500" /> : <List size={14} className="text-slate-400 rotate-90" />}
            </div>
          </button>
          <span className={cn("text-xs font-bold uppercase tracking-widest", formData.isActive === false ? "text-slate-300" : "text-slate-500")}>Inactive</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input 
            type="checkbox"
            checked={!!formData.hasParent}
            onChange={(e) => setFormData({ ...formData, hasParent: e.target.checked })}
            className="w-5 h-5 rounded border-2 border-slate-700 bg-slate-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900" 
          />
          <span className="text-sm font-black text-slate-300 uppercase tracking-widest">Has Parent / Guardian</span>
        </label>
        
        {formData.hasParent && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
            <div>
              <label className="label-base uppercase">Parent Name</label>
              <input
                type="text"
                disabled={isSaving}
                className="input-base  "
                placeholder="NAME..."
                value={formData.parentName || ''}
                onChange={e => setFormData({ ...formData, parentName: e.target.value })}
              />
            </div>
            <div>
              <label className="label-base uppercase">Parent Phone</label>
              <input
                type="tel"
                disabled={isSaving}
                className="input-base  "
                placeholder="PHONE..."
                value={formData.parentPhone || ''}
                onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="label-base uppercase">Parent Email</label>
              <input
                type="email"
                disabled={isSaving}
                className="input-base  "
                placeholder="EMAIL..."
                value={formData.parentEmail || ''}
                onChange={e => setFormData({ ...formData, parentEmail: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} disabled={isSaving} className="px-5 py-2.5 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white rounded-xl transition disabled:opacity-50">Standby</button>
        <button 
          type="submit"
          disabled={isSaving}
          className="bento-button-black flex items-center justify-center min-w-[160px] disabled:opacity-50 h-10"
        >
          {isSaving ? <Clock className="animate-spin" size={18} /> : (initialData ? 'UPDATE PROFILE' : 'CONFIRM PROFILE')}
        </button>
      </div>
    </form>
    <AnimatePresence>
      {isAddingGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-bento relative"
          >
            <button 
              type="button"
              onClick={() => setIsAddingGroup(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
              <Plus className="text-blue-500" size={24} />
              Initialize New Group
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="label-base uppercase text-blue-400">Group Code</label>
                <input
                  type="text"
                  autoFocus
                  disabled={isSavingGroup}
                  className="input-base    w-full"
                  placeholder="e.g. BEG"
                  value={newGroupCode}
                  onChange={(e) => setNewGroupCode(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="label-base uppercase text-blue-400">Group Name</label>
                <input
                  type="text"
                  disabled={isSavingGroup}
                  className="input-base    w-full"
                  placeholder="e.g. Beginners"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                         e.preventDefault();
                         handleAddGroup(e as any);
                     }
                  }}
                />
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSavingGroup}
                onClick={() => setIsAddingGroup(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-white transition-colors uppercase font-bold tracking-widest"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingGroup || !newGroupCode.trim() || !newGroupName.trim()}
                onClick={handleAddGroup}
                className="bento-button-black bg-blue-600 border-transparent text-white px-6 py-2 uppercase tracking-widest text-sm relative group"
              >
                 {isSavingGroup ? <Clock className="animate-spin mx-auto" size={18} /> : 'CONFIRM'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>

  );
}

function GroupForm({ groupToEdit, onSuccess, onCancel }: { groupToEdit?: any, onSuccess: () => void, onCancel: () => void }) {
  const [name, setName] = useState(groupToEdit?.name || '');
  const [code, setCode] = useState(groupToEdit?.code || '');
  const [isSaving, setIsSaving] = useState(false);
  const { addMasterData, updateMasterData } = useData();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    setIsSaving(true);
    try {
      if (groupToEdit) {
        await updateMasterData('groups', groupToEdit.id, { ...groupToEdit, name: name.trim(), code: code.trim().toUpperCase() });
      } else {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        await addMasterData('groups', { 
          name: name.trim(), 
          code: code.trim().toUpperCase(), 
          color: randomColor 
        });
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      alert(`Failed to ${groupToEdit ? 'update' : 'create'} group`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="label-base uppercase text-blue-400">Group Code</label>
          <input
            autoFocus
            type="text"
            required
            disabled={isSaving}
            className="input-base    w-full"
            placeholder="e.g. BEG"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <label className="label-base uppercase text-blue-400">Group Name</label>
          <input
            type="text"
            required
            disabled={isSaving}
            className="input-base    w-full"
            placeholder="e.g. Beginners"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/50">
        <button
          type="button"
          disabled={isSaving}
          onClick={onCancel}
          className="px-6 py-2.5 text-sm text-slate-500 hover:text-white transition-colors uppercase font-black tracking-widest"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || !name.trim() || !code.trim()}
          className="bento-button-black bg-blue-600 border-transparent text-white px-8 py-2.5 uppercase tracking-widest text-sm relative group overflow-hidden"
        >
          <div className="flex items-center gap-2">
            {isSaving ? <Clock className="animate-spin" size={18} /> : <Plus size={18} />}
            <span>{isSaving ? 'CREATING...' : 'CONFIRM GROUP'}</span>
          </div>
        </button>
      </div>
    </form>
  );
}
