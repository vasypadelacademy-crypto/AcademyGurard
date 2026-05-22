import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useData } from '../lib/DataContext';
import { generateEmailBody, generateEmailHtml } from '../lib/emailUtils';
import { calculatePackageValues } from '../lib/pricingUtils';
import { 
  Calendar as CalendarIcon, 
  List, 
  Search, 
  Filter, 
  Clock, 
  MapPin, 
  Plus, 
  Trash2,
  Pencil,
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  CalendarCheck,
  Package as PackageIcon,
  Trophy,
  Users,
  CheckCircle2,
  Bell,
  X,
  ChevronDown,
  Mail,
  Edit2
} from 'lucide-react';
import { cn, formatTimeAMPM, getGroupColor, getSortableDate, toTitleCase } from '../lib/utils';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, subMonths, startOfToday, endOfToday } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { BulkModifyModal } from '../components/BulkModifyModal';
import { FilterDropdown } from '../components/FilterDropdown';
import { useLocation, useNavigate } from 'react-router-dom';

import { DayPickerDropdown } from '../components/DayPickerDropdown';
import { EmailScheduleModal } from '../components/EmailScheduleModal';

import { SessionStatus } from '../types';

const statuses: SessionStatus[] = ['Scheduled', 'Attended', 'Absent', 'Exceptional Regret', 'Regret', 'Cancelled', 'Compensated', 'Hold'];

function StatusStyles(status: string) {
  if (status === 'Mix') return "text-red-500 border-red-500 bg-red-950/20 focus:ring-red-500/50";
  if (['Attended', 'Compensated', 'Attended Comp. Session'].includes(status)) return "text-emerald-400 border-emerald-500 bg-emerald-950/20 focus:ring-emerald-500/50";
  if (['Absent', 'Cancelled'].includes(status)) return "text-red-400 border-red-500 bg-red-950/20 focus:ring-red-500/50";
  if (['Regret', 'Exceptional Regret'].includes(status)) return "text-orange-400 border-orange-500 bg-orange-950/20 focus:ring-orange-500/50";
  if (status === 'Hold') return "text-gray-400 border-gray-500 bg-gray-950/20 focus:ring-gray-500/50";
  return "text-blue-400 border-blue-500 bg-blue-950/20 focus:ring-blue-500/50";
}

export default function Schedule({ defaultView = 'week', defaultGroupBy = 'group' }: { defaultView?: 'list' | 'week' | 'month', defaultGroupBy?: 'player' | 'group' }) {
  const { 
    sessions, players, levels, packageTypes, locations, groups, evaluations, 
    updateMasterData, deleteMasterData, currentUserRole, pricingSchemes, packages, payments,
    searchTerm, setSearchTerm,
    filterType, setFilterType,
    locationFilter, setLocationFilter,
    levelFilter, setLevelFilter,
    groupFilter, setGroupFilter,
    sessionStatusFilter: statusFilter,
    setSessionStatusFilter: setStatusFilter
  } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const isAttendance = location.pathname === '/attendance';

  const [isCompactGrouping, setIsCompactGrouping] = useState(true);
  const [showBulkModifyModal, setShowBulkModifyModal] = useState(false);

  // Pre-calculate mappings for O(1) lookups
  const playersMap = useMemo(() => new Map((players || []).map(p => [String(p.id), p])), [players]);
  const groupsMap = useMemo(() => new Map((groups || []).map(g => [String(g.id), g])), [groups]);
  const locationsMap = useMemo(() => new Map((locations || []).map(l => [String(l.id), l])), [locations]);
  const levelsMap = useMemo(() => new Map((levels || []).map(l => [String(l.id), l])), [levels]);
  const packageTypesMap = useMemo(() => new Map((packageTypes || []).map(t => [String(t.id), t])), [packageTypes]);

  const sessionIndexMap = useMemo(() => {
    const map = new Map<string, string>();
    const sessionsByPackage = new Map<string, any[]>();
    
    // Group all sessions by package
    sessions.forEach(s => {
      const pkgId = String(s.packageId);
      if (!sessionsByPackage.has(pkgId)) sessionsByPackage.set(pkgId, []);
      sessionsByPackage.get(pkgId)!.push(s);
    });

    // For each package, sort and assign indexes
    sessionsByPackage.forEach((pkgSessions, pkgId) => {
      const pkg = packages?.find(p => String(p.id) === pkgId);
      const pkgTypeCode = (pkg?.packageTypeCode || 'SES').toUpperCase();
      
      const sorted = [...pkgSessions].sort((a, b) => {
        const dateA = getSortableDate(a.date);
        const dateB = getSortableDate(b.date);
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        if (a.startTime !== b.startTime) return (a.startTime || '').localeCompare(b.startTime || '');
        return String(a.id).localeCompare(String(b.id));
      });
      sorted.forEach((s, idx) => {
        // Force calculation based on date order for total consistency
        const pkgTypeCode = (s.sessionTypeCode || pkg?.packageTypeCode || 'SES').toUpperCase();
        const label = `${pkgTypeCode}-${idx + 1}`;
        map.set(String(s.id), label);
      });
    });
    return map;
  }, [sessions, packages, packageTypesMap]);

  const [view, setView] = useState<'list' | 'week' | 'month'>(defaultView);
  const [groupBy, setGroupBy] = useState<'player' | 'group'>(defaultGroupBy);

  const [regretFilter, setRegretFilter] = useState<{ playerId: string, packageId: string } | null>(null);
  const [dateFilterStart, setDateFilterStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [dateFilterEnd, setDateFilterEnd] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    setView(defaultView);
    setGroupBy(defaultGroupBy);
    setRegretFilter(null);
    
    // Reset date filters to whole week when switching between Schedule and Attendance
    const today = new Date();
    const start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    setDateFilterStart(start);
    setDateFilterEnd(end);
    setSelectedDate(today);
  }, [defaultView, defaultGroupBy, isAttendance]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [sortConfigs, setSortConfigs] = useState<{ key: string, direction: 'asc'|'desc' }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters = filterType !== 'all' || locationFilter !== 'all' || levelFilter !== 'all' || groupFilter !== 'all' || statusFilter !== 'all' || regretFilter !== null;
  const isAnyFilterApplied = searchTerm !== '' || filterType !== 'all' || locationFilter !== 'all' || levelFilter !== 'all' || groupFilter !== 'all' || statusFilter !== 'all' || regretFilter !== null;

  const handleSort = (key: string, e: React.MouseEvent) => {
      setSortConfigs(prev => {
          const isMultiSort = e.ctrlKey || e.metaKey;
          const existingIndex = prev.findIndex(c => c.key === key);
          
          if (isMultiSort) {
              const next = [...prev];
              if (existingIndex >= 0) {
                  if (next[existingIndex].direction === 'asc') {
                      next[existingIndex].direction = 'desc';
                  } else {
                      next.splice(existingIndex, 1);
                  }
              } else {
                  next.push({ key, direction: 'asc' });
              }
              return next;
          } else {
              if (existingIndex === 0 && prev.length === 1) {
                  if (prev[0].direction === 'asc') return [{ key, direction: 'desc' }];
                  return [];
              }
              return [{ key, direction: 'asc' }];
          }
      });
  };

  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isEditingSlot, setIsEditingSlot] = useState(false);
  const [editSlotData, setEditSlotData] = useState<any>(null);

  useEffect(() => {
    if (selectedSlot) {
        setIsEditingSlot(false);
        setEditSlotData({
            date: selectedSlot.date,
            startTime: selectedSlot.startTime,
            locationId: selectedSlot.locationId || '',
            status: selectedSlot.status,
            sessionTypeCode: selectedSlot.sessionTypeCode || '',
            groupId: selectedSlot.groupId || getSessionGroup(selectedSlot)?.id || ''
        });
    }
  }, [selectedSlot]);
  const [showConflicts, setShowConflicts] = useState(false);

  const [confirmSendEmails, setConfirmSendEmails] = useState(false);
  const [groupModePlayers, setGroupModePlayers] = useState<any[] | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [validatedConflicts, setValidatedConflicts] = useState<Set<string>>(new Set());

  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState(false);

  const getSessionGroup = useCallback((session: any) => {
    if (session.groupId) return groupsMap.get(String(session.groupId));
    const player = playersMap.get(String(session.playerId));
    if (player?.groupId) return groupsMap.get(String(player.groupId));
    return null;
  }, [groupsMap, playersMap]);

  const scheduleSafeDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const packageLabelsMap = useMemo(() => {
    const map = new Map<string, string>(); // packageId -> "M1", "M2"
    const playerPackagesGroups: Record<string, any[]> = {};
    
    // Group packages by player
    (packages || []).forEach(pkg => {
        if (!pkg.playerId) return;
        const pid = String(pkg.playerId);
        if (!playerPackagesGroups[pid]) playerPackagesGroups[pid] = [];
        playerPackagesGroups[pid].push(pkg);
    });

    // Sort and label
    Object.keys(playerPackagesGroups).forEach(pid => {
        const playerPkgs = playerPackagesGroups[pid].sort((a, b) => {
            const dateA = a.startDate || a.createdAt || '';
            const dateB = b.startDate || b.createdAt || '';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return (a.packageTypeCode || '').localeCompare(b.packageTypeCode || '');
        });
        playerPkgs.forEach((pkg, idx) => {
            map.set(String(pkg.id), `M${idx + 1}`);
        });
    });
    return map;
  }, [packages]);

  const getDisplayName = (session: any) => {
      const group = getSessionGroup(session);

      if (groupBy === 'group' && group) {
           if (session._exploded) {
               const player = playersMap.get(String(session.playerId));
               return player ? toTitleCase((player.name || '').split(' ')[0]) : 'Unknown';
           }
           const activeNames = (session._groupPlayers || [])
              .map((p: any, idx: number) => ({ p, status: (session._groupStatuses || [])[idx] }))
              // Only filter out sessions that shouldn't show player name
              .filter((item: any) => !['Hold', 'Regret', 'Exceptional Regret'].includes(item.status))
              .map((item: any) => toTitleCase((item.p?.name || '').split(' ')[0]));
           return activeNames.join(' - ');
      } else {
        const player = playersMap.get(String(session.playerId));
        const fullName = player ? toTitleCase(player.name || 'Unknown') : 'Unknown';
        const pkgLabel = packageLabelsMap.get(String(session.packageId));
        if (pkgLabel) {
            return `${pkgLabel} - ${fullName}`;
        }
        return fullName;
      }
  };

  const LocationDisplay = ({ session }: { session: any }) => {
    const loc = locationsMap.get(String(session.locationId));
    let name = 'No Location';
    let gps = '';
    
    if (loc) {
      name = loc.name;
      gps = loc.gps || '';
    } else {
      const player = playersMap.get(String(session.playerId));
      if (player?.locationId) {
         const pLoc = locationsMap.get(String(player.locationId));
         if (pLoc) {
           name = pLoc.name;
           gps = pLoc.gps || '';
         }
      }
    }
    
    return (
      <div className="flex items-center gap-2">
        <span>{name}</span>
        {gps && (
          <a href={gps} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-emerald-500 hover:text-emerald-400" title="Open GPS map">
            <MapPin size={14} />
          </a>
        )}
      </div>
    );
  };

  const getLocationName = (session: any) => {
    const loc = locationsMap.get(String(session.locationId));
    if (loc) return loc.name;
    const player = playersMap.get(String(session.playerId));
    if (player?.locationId) {
       const pLoc = locationsMap.get(String(player.locationId));
       if (pLoc) return pLoc.name;
    }
    return 'No Location';
  };

  const getStatusBadge = (st: string) => {
      switch (st) {
          case 'Attended': return <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/20 px-1.5 py-0.5 rounded flex-shrink-0" title="Attended">A</span>;
          case 'Absent': return <span className="text-[10px] font-bold text-red-500 bg-red-500/20 px-1.5 py-0.5 rounded flex-shrink-0" title="Absent">A</span>;
          case 'Cancelled': return <span className="text-[10px] font-bold text-red-500 bg-red-500/20 px-1.5 py-0.5 rounded flex-shrink-0" title="Cancelled">C</span>;
          case 'Hold': return <span className="text-[10px] font-bold text-gray-400 bg-gray-500/20 px-1.5 py-0.5 rounded flex-shrink-0" title="Hold">H</span>;
          case 'Compensated': return <span className="text-[10px] font-bold text-blue-500 bg-blue-500/20 px-1.5 py-0.5 rounded flex-shrink-0" title="Compensated">C</span>;
          case 'Mix': return <span className="text-[10px] font-bold text-red-500 bg-red-500/20 px-1.5 py-0.5 rounded flex-shrink-0" title="Mix">M</span>;
          case 'Regret': return <span className="text-[10px] font-bold text-orange-500 bg-orange-500/20 px-1.5 py-0.5 rounded flex-shrink-0" title="Regret">R</span>;
          case 'Exceptional Regret': return <span className="text-[10px] font-bold text-orange-500 bg-orange-500/20 px-1.5 py-0.5 rounded flex-shrink-0" title="Exceptional Regret">ER</span>;
          case 'Scheduled': return <span className="text-[10px] font-bold text-blue-400 bg-blue-400/20 px-1.5 py-0.5 rounded flex-shrink-0" title="Scheduled">S</span>;
          default: return null;
      }
  };

  const getStatusIndicator = (session: any) => {
      return <span className="ml-1 flex-shrink-0 flex items-center">{getStatusBadge(session.status)}</span>;
  };

  const currentPackageIdsSet = useMemo(() => {
    const latestPkgs = new Map<string, any>();
    (packages || []).forEach(pkg => {
        const existing = latestPkgs.get(pkg.playerId);
        if (!existing || pkg.startDate > existing.startDate) {
            latestPkgs.set(pkg.playerId, pkg);
        }
    });
    return new Set(Array.from(latestPkgs.values()).map(p => String(p.id)));
  }, [packages]);

  const filteredSessions = useMemo(() => {
    let result = (sessions || []).filter(s => {
      const player = playersMap.get(String(s.playerId));
      if (!player) return false;
      const effectiveLocationId = s.locationId || player?.locationId;
      const matchesSearch = !searchTerm ? true : (player?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPackage = filterType === 'all' 
        ? true 
        : filterType.match(/^\d{4}-\d{2}$/) 
            ? s.date.startsWith(filterType) 
            : player?.packageTypeCode === filterType;
      
      const matchesLocation = locationFilter === 'all' || effectiveLocationId === locationFilter;
      const matchesLevel = levelFilter === 'all' || player?.levelId === levelFilter;
      const matchesGroup = groupFilter === 'all' || getSessionGroup(s)?.id === groupFilter;
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      
      let matchesRegret = true;
      if (regretFilter) {
          matchesRegret = (s.playerId === regretFilter.playerId && s.packageId === regretFilter.packageId && ['Regret', 'Exceptional Regret'].includes(s.status));
      }

      const isPackageFilter = dateFilterStart?.startsWith('package:') || false;
      const targetPackageId = isPackageFilter ? dateFilterStart!.split(':')[1] : null;
      const matchesDate = isPackageFilter 
          ? (targetPackageId === 'current' ? currentPackageIdsSet.has(String(s.packageId)) : s.packageId === targetPackageId)
          : (!dateFilterStart || s.date >= dateFilterStart) && (!dateFilterEnd || s.date <= dateFilterEnd);

      return matchesSearch && matchesPackage && matchesLocation && matchesLevel && matchesGroup && matchesStatus && matchesRegret && matchesDate;
    });

    if (groupBy === 'group') {
        const grouped = new Map<string, any>();
        result.forEach(s => {
           const group = getSessionGroup(s);
           const groupId = group ? group.id : `nogroup-${s.playerId}`;
           const key = `${groupId}-${s.date}-${s.startTime}`;
           if (!grouped.has(key)) {
               grouped.set(key, { 
                   ...s, 
                   _groupPlayers: [playersMap.get(String(s.playerId))],
                   _groupStatuses: [s.status],
                   _sessionIds: [s.id]
               });
           } else {
               grouped.get(key)._groupPlayers.push(playersMap.get(String(s.playerId)));
               grouped.get(key)._groupStatuses.push(s.status);
               grouped.get(key)._sessionIds.push(s.id);
           }
        });
        
        const explodedResult: any[] = [];
        grouped.forEach(s => {
            // Normalize statuses for deduplication
            const normalizedStatuses = s._groupStatuses.map((st: string) => st.trim());
            const uniqueStatuses = Array.from(new Set(normalizedStatuses));
            
            const group = getSessionGroup(s);
            const groupPlayersCount = group ? players.filter(p => p.groupId === group.id).length : 1;
            const isPartialGroupTime = group && s._groupPlayers.length < groupPlayersCount;
            
            if (!isCompactGrouping && uniqueStatuses.length > 1) {
               s._groupPlayers.forEach((player: any, idx: number) => {
                   explodedResult.push({ ...s, id: s._sessionIds[idx], playerId: player.id, status: s._groupStatuses[idx], _exploded: true, _isPartialGroupTime: isPartialGroupTime });
               });
            } else {
               s._isPartialGroupTime = isPartialGroupTime;
               // Calculate actual status based on active/presented players
               const activeStatuses = s._groupStatuses.filter((st: string) => 
                   !['Hold', 'Cancelled', 'Regret', 'Exceptional Regret'].includes(st.trim())
               );
               const uniqueActive = Array.from(new Set(activeStatuses.map((st: string) => st.trim())));
               if (uniqueActive.length > 0) {
                   if (uniqueActive.includes('Scheduled')) {
                       s.status = 'Scheduled';
                   } else if (uniqueActive.includes('Attended')) {
                       s.status = 'Attended';
                   } else if (uniqueActive.includes('Compensated')) {
                       s.status = 'Compensated';
                   } else {
                       s.status = uniqueActive[0];
                   }
               } else {
                   // All are inactive (Hold, Cancelled, Regret, Exceptional Regret)
                   const uniqueInactive = Array.from(new Set(s._groupStatuses.map((st: string) => st.trim())));
                   if (uniqueInactive.includes('Hold')) {
                       s.status = 'Hold';
                   } else if (uniqueInactive.includes('Regret')) {
                       s.status = 'Regret';
                   } else if (uniqueInactive.includes('Exceptional Regret')) {
                       s.status = 'Exceptional Regret';
                   } else {
                       s.status = uniqueInactive[0] || 'Scheduled';
                   }
               }
               explodedResult.push(s);
            }
        });
        result = explodedResult;
    }

    if (sortConfigs.length > 0) {
        result.sort((a: any, b: any) => {
            for (const sortConfig of sortConfigs) {
                let aVal: any = ''; let bVal: any = '';
                if (sortConfig.key === 'group') {
                    const groupA = getSessionGroup(a);
                    const groupB = getSessionGroup(b);
                    const getSortName = (g: any) => g ? (g.code ? (g.code.endsWith('.') ? g.code : `${g.code}.`) : g.name) : 'zzz';
                    aVal = getSortName(groupA).toLowerCase();
                    bVal = getSortName(groupB).toLowerCase();
                } else if (sortConfig.key === 'player') {
                    aVal = getDisplayName(a).toLowerCase();
                    bVal = getDisplayName(b).toLowerCase();
                } else if (sortConfig.key === 'session') {
                    aVal = a.sessionIndex; bVal = b.sessionIndex;
                } else if (sortConfig.key === 'date') {
                    aVal = getSortableDate(a.date); bVal = getSortableDate(b.date);
                } else if (sortConfig.key === 'time') {
                    aVal = a.startTime; bVal = b.startTime;
                } else if (sortConfig.key === 'location') {
                    aVal = getLocationName(a).toLowerCase();
                    bVal = getLocationName(b).toLowerCase();
                } else if (sortConfig.key === 'status') {
                    aVal = a.status; bVal = b.status;
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    } else {
        result.sort((a, b) => getSortableDate(a.date).localeCompare(getSortableDate(b.date)) || a.startTime.localeCompare(b.startTime));
    }

    return result;
  }, [sessions, players, packageTypes, levels, locations, groups, searchTerm, filterType, locationFilter, levelFilter, groupFilter, statusFilter, dateFilterStart, dateFilterEnd, sortConfigs, groupBy, isCompactGrouping, playersMap, groupsMap, locationsMap, levelsMap, packageTypesMap]);

  const currentPackageRange = useMemo(() => {
    let targetPlayerId: string | null = null;
    
    // Only infer single player if one is directly referenced in search
    const searchMatches = players.filter(p => searchTerm && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (searchMatches.length === 1) {
        targetPlayerId = searchMatches[0].id!;
    }

    if (targetPlayerId) {
        const playerPkgs = packages?.filter(pkg => pkg.playerId === targetPlayerId);
        if (playerPkgs && playerPkgs.length > 0) {
            // Sort by startDate desc
            const sortedPkgs = [...playerPkgs].sort((a,b) => b.startDate.localeCompare(a.startDate));
            const latestPkg = sortedPkgs[0];
            const pkgSessions = sessions.filter(s => s.packageId === latestPkg.id);
            if (pkgSessions.length > 0) {
                pkgSessions.sort((a, b) => a.date.localeCompare(b.date));
                return {
                    from: new Date(pkgSessions[0].date),
                    to: new Date(pkgSessions[pkgSessions.length - 1].date),
                    id: `package:${latestPkg.id}`
                };
            } else {
                return {
                    from: new Date(latestPkg.startDate),
                    to: new Date(latestPkg.startDate),
                    id: `package:${latestPkg.id}`
                };
            }
        }
    }
    
    // For all players case
    return {
        from: undefined,
        to: undefined,
        id: 'package:current'
    };
  }, [players, packages, sessions, searchTerm]);

  const customPresets = useMemo(() => {
    const base: { label: string, getRange: () => { from: Date | undefined, to: Date | undefined, id?: string } }[] = [
        { label: 'TODAY', getRange: () => ({ from: startOfToday(), to: endOfToday() }) },
        { label: 'THIS WEEK', getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
        { label: 'THIS MONTH', getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    ];
    if (currentPackageRange) {
        base.push({ label: 'CURRENT PACKAGE', getRange: () => currentPackageRange });
    }
    base.push({ label: 'ALL TIME', getRange: () => ({ from: undefined, to: undefined }) });
    return base;
  }, [currentPackageRange]);

  const sessionsByDateAndHour = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredSessions.forEach(s => {
      const h = (s.startTime || '00:00').split(':')[0].padStart(2, '0');
      const key = `${s.date}_${h}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(s);
    });
    return map;
  }, [filteredSessions]);

    const handleJumpToSlot = (date: string, time: string) => {
        setSearchTerm(`${date} ${formatTimeAMPM(time)}`);
        setSelectedDate(scheduleSafeDate(date));
        setShowConflicts(false);
    };

    const conflicts = useMemo(() => {
     const slots: Record<string, any[]> = {};
     filteredSessions.forEach(s => {
         const key = `${s.date}_${s.startTime}_${s.locationId || 'noloc'}`;
         const group = getSessionGroup(s);
         const subjectId = group ? group.id : s.playerId;
         
         if (!slots[key]) slots[key] = [];
         
         if (!slots[key].find((item: any) => item.subjectId === subjectId)) {
             slots[key].push({ ...s, subjectId });
         }
     });
     
     const result = [];
     for (const key in slots) {
         if (slots[key].length > 1 && !validatedConflicts.has(key)) {
             result.push({
                 key,
                 date: slots[key][0].date,
                 startTime: slots[key][0].startTime,
                 sessions: slots[key]
             });
         }
     }
     return result.sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [filteredSessions, getSessionGroup, validatedConflicts]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  const displayedWeekDays = useMemo(() => {
    if (view !== 'week') return weekDays;
    
    // Filter days that have at least one session in filteredSessions
    const activeDays = weekDays.filter(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      return filteredSessions.some(s => s.date === dateStr);
    });

    // Fallback: If no sessions in the entire week, show all days
    // This prevents a confusingly empty grid if navigating to a week with nothing
    return activeDays.length > 0 ? activeDays : weekDays;
  }, [weekDays, filteredSessions, view]);

  const moveToDate = (date: Date) => {
    const todayStr = format(startOfToday(), 'yyyy-MM-dd');
    const targetStr = format(date, 'yyyy-MM-dd');
    
    if (view === 'week') {
      const start = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      setDateFilterStart(start);
      setDateFilterEnd(end);
    } else if (view === 'month') {
      const start = format(startOfMonth(date), 'yyyy-MM-dd');
      const end = format(endOfMonth(date), 'yyyy-MM-dd');
      setDateFilterStart(start);
      setDateFilterEnd(end);
    } else {
      setDateFilterStart(targetStr);
      setDateFilterEnd(targetStr);
    }
    setSelectedDate(date);
  };

  const handleStatusUpdate = async (session: typeof sessions[0], newStatus: SessionStatus) => {
      if (groupBy === 'group' && !(session as any)._exploded) {
          const group = getSessionGroup(session);
          if (group) {
              const sessionsToUpdate = sessions.filter(s => 
                  s.date === session.date && 
                  s.startTime === session.startTime && 
                  getSessionGroup(s)?.id === group.id
              );
              // Update only sessions in the group that are active/presented
              const activeSessionsToUpdate = sessionsToUpdate.filter(s => 
                  !['Hold', 'Cancelled', 'Regret', 'Exceptional Regret'].includes(s.status)
              );
              for (const s of activeSessionsToUpdate) {
                  await updateMasterData('sessions', s.id!, { ...s, status: newStatus });
              }
              return;
          }
      }
      await updateMasterData('sessions', session.id!, { ...session, status: newStatus });
  };

  const handleFieldUpdate = async (session: any, field: string, value: any) => {
      if (currentUserRole?.role === 'visitor') return;
      if (groupBy === 'group' && !session._exploded) {
          const group = getSessionGroup(session);
          if (group) {
              const sessionsToUpdate = sessions.filter(s => 
                  s.date === session.date && 
                  s.startTime === session.startTime && 
                  getSessionGroup(s)?.id === group.id
              );
              for (const s of sessionsToUpdate) {
                  await updateMasterData('sessions', s.id!, { ...s, [field]: value });
              }
              return;
          }
      }
      await updateMasterData('sessions', session.id!, { ...session, [field]: value });
  };

  const handleDeleteSlot = () => {
      setConfirmDeleteSlot(true);
  };

  const confirmDeleteSlotAction = () => {
      if (groupBy === 'group') {
          const group = getSessionGroup(selectedSlot);
          if (group) {
              const sessionsToDelete = sessions.filter(s => 
                  s.date === selectedSlot.date && 
                  s.startTime === selectedSlot.startTime && 
                  getSessionGroup(s)?.id === group.id
              );
              sessionsToDelete.forEach(s => {
                  deleteMasterData('sessions', s.id!);
              });
          } else {
              deleteMasterData('sessions', selectedSlot.id!);
          }
      } else {
          deleteMasterData('sessions', selectedSlot.id!);
      }
      setSelectedSlot(null);
      setConfirmDeleteSlot(false);
  };

  const handleSaveSlotEdit = async () => {
      if (!editSlotData?.date || !editSlotData?.startTime) return;
      if (groupBy === 'group') {
          const group = getSessionGroup(selectedSlot);
          if (group) {
              const sessionsToUpdate = sessions.filter(s => 
                  s.date === selectedSlot.date && 
                  s.startTime === selectedSlot.startTime && 
                  getSessionGroup(s)?.id === group.id
              );
              for (const s of sessionsToUpdate) {
                  await updateMasterData('sessions', s.id!, { 
                      ...s, 
                      date: editSlotData.date, 
                      startTime: editSlotData.startTime,
                      locationId: editSlotData.locationId,
                      status: editSlotData.status,
                      sessionTypeCode: editSlotData.sessionTypeCode,
                      groupId: editSlotData.groupId
                  });
              }
          } else {
              await updateMasterData('sessions', selectedSlot.id!, { 
                  ...selectedSlot, 
                  date: editSlotData.date, 
                  startTime: editSlotData.startTime,
                  locationId: editSlotData.locationId,
                  status: editSlotData.status,
                  sessionTypeCode: editSlotData.sessionTypeCode,
                  groupId: editSlotData.groupId
              });
          }
      } else {
          await updateMasterData('sessions', selectedSlot.id!, { 
              ...selectedSlot, 
              date: editSlotData.date, 
              startTime: editSlotData.startTime,
              locationId: editSlotData.locationId,
              status: editSlotData.status,
              sessionTypeCode: editSlotData.sessionTypeCode,
              groupId: editSlotData.groupId
          });
      }
      setSelectedSlot(null);
  };

  const displayedHours = useMemo(() => {
    const hours = new Set<string>();
    filteredSessions.forEach(s => {
      if (displayedWeekDays.some(d => isSameDay(scheduleSafeDate(s.date), d))) {
          const h = (s.startTime || '00:00').split(':')[0];
         hours.add(`${h.padStart(2, '0')}:00`);
      }
    });
    
    const sorted = Array.from(hours).sort();
    if (sorted.length === 0) {
       return ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    }
    return sorted;
  }, [filteredSessions, weekDays]);

  const visibleSessions = useMemo(() => {
    if (view === 'list') return filteredSessions;
    if (view === 'week') {
        return filteredSessions.filter(s => displayedWeekDays.some(d => isSameDay(scheduleSafeDate(s.date), d)));
    }
    if (view === 'month') {
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);
        return filteredSessions.filter(s => {
            const sessionDate = scheduleSafeDate(s.date);
            return sessionDate >= start && sessionDate <= end;
        });
    }
    return filteredSessions;
  }, [filteredSessions, view, weekDays, selectedDate]);

  const kpiStats = useMemo(() => {
    const counts = { Scheduled: 0, Attended: 0, Absent: 0, Cancelled: 0, Compensated: 0, Hold: 0, Regret: 0, 'Exceptional Regret': 0 };
    visibleSessions.forEach(s => {
       if (groupBy === 'group' && s._groupStatuses && !s._exploded) {
           s._groupStatuses.forEach((st: string) => {
               if (counts[st as keyof typeof counts] !== undefined) counts[st as keyof typeof counts]++;
           });
       } else {
           if (counts[s.status as keyof typeof counts] !== undefined) counts[s.status as keyof typeof counts]++;
       }
    });

    return [
       { label: 'Attended', count: counts.Attended, color: 'text-emerald-400 bg-emerald-500/10' },
       { label: 'Absent', count: counts.Absent, color: 'text-red-400 bg-red-500/10' },
       { label: 'Cancelled', count: counts.Cancelled, color: 'text-red-400 bg-red-500/10' },
       { label: 'Compensated', count: counts.Compensated, color: 'text-blue-400 bg-blue-500/10' },
       { label: 'Regrets', count: counts.Regret + counts['Exceptional Regret'], color: 'text-orange-400 bg-orange-500/10' },
       { label: 'Hold', count: counts.Hold, color: 'text-gray-400 bg-gray-500/10' },
       { label: 'Scheduled', count: counts.Scheduled, color: 'text-blue-300 bg-blue-400/10' },
    ].filter(k => k.count > 0);
  }, [visibleSessions, groupBy]);

  return (
    <div className={cn("p-4 md:p-8 mx-auto space-y-10", view === 'week' ? "max-w-[98vw]" : "max-w-7xl")}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-xs md:text-sm text-blue-500 uppercase tracking-[0.2em] mb-2 leading-none">Master Timeline</p>
          <div className="flex items-center gap-4">
             <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none">{isAttendance ? 'Attendance' : 'Schedule'}</h1>
             {conflicts.length > 0 && (
                <button 
                  onClick={() => setShowConflicts(true)}
                  className="flex items-center justify-center h-10 w-10 bg-red-500/20 text-red-500 rounded-full border border-red-500/30 hover:bg-red-500/30 animate-pulse relative"
                  title={`${conflicts.length} scheduling conflicts detected`}
                >
                   <div className="absolute -top-2 -right-2 flex items-center justify-center">
                     <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-40 animate-ping"></span>
                     <span className="relative flex h-5 min-w-[20px] items-center justify-center bg-red-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-red-500/40">
                       {conflicts.length}
                     </span>
                   </div>
                   <Bell size={20} className="animate-pulse" />
                </button>
             )}
          </div>
          <p className="text-slate-400 mt-2 uppercase text-sm tracking-widest leading-none">Global coordination of academy training assets</p>
        </div>
        
        <div className="flex gap-2">
            <div className="flex bg-slate-900 p-1.5 rounded-xl self-start border-2 border-slate-800 shadow-bento">
              <button 
                onClick={() => {
                    setGroupBy('player');
                    setIsCompactGrouping(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-widest", 
                  groupBy === 'player' ? "bg-white text-slate-950 shadow-bento" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Player
              </button>
              <button 
                onClick={() => setGroupBy('group')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-widest", 
                  groupBy === 'group' ? "bg-white text-slate-950 shadow-bento" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Group
              </button>
            </div>
            
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-xl border-2 border-slate-800 cursor-pointer shadow-bento">
                <input 
                    type="checkbox" 
                    checked={isCompactGrouping} 
                    onChange={(e) => {
                        const checked = e.target.checked;
                        setIsCompactGrouping(checked);
                        if (checked) {
                            setGroupBy('group');
                        }
                    }}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Compact View</span>
            </label>
            
            {!isAttendance && (
              <div className="flex bg-slate-900 p-1.5 rounded-xl self-start border-2 border-slate-800 shadow-bento">
                <button 
                  onClick={() => {
                      setView('list');
                      const start = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                      const end = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                      setDateFilterStart(start);
                      setDateFilterEnd(end);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] md:text-sm font-black transition-all uppercase tracking-widest", 
                    view === 'list' ? "bg-white text-slate-950 shadow-bento" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <List size={16} />
                  List
                </button>
                <button 
                  onClick={() => {
                      setView('week');
                      const start = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                      const end = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                      setDateFilterStart(start);
                      setDateFilterEnd(end);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] md:text-sm font-black transition-all uppercase tracking-widest", 
                    view === 'week' ? "bg-white text-slate-950 shadow-bento" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <CalendarIcon size={16} />
                  Week
                </button>
                <button 
                  onClick={() => {
                      setView('month');
                      const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
                      const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
                      setDateFilterStart(start);
                      setDateFilterEnd(end);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] md:text-sm font-black transition-all uppercase tracking-widest", 
                    view === 'month' ? "bg-white text-slate-950 shadow-bento" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <CalendarIcon size={16} />
                  Month
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Search & Criteria */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by name, location, group..."
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
                    setStatusFilter('all');
                    setRegretFilter(null);
                } else {
                    setShowFilters(!showFilters);
                }
             }}
             className={cn("flex md:min-w-[140px] flex-1 sm:flex-none items-center justify-center gap-2 px-6 py-4 rounded-2xl border-2 font-black tracking-widest uppercase transition-all shrink-0", 
               isAnyFilterApplied
                 ? "bg-red-600 border-red-500 hover:bg-red-700 hover:border-red-600 text-white shadow-lg shadow-red-900/20" 
                 : showFilters
                   ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                   : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
             )}
          >
             <Filter size={20} className={cn(isAnyFilterApplied ? "text-white" : "", "shrink-0")} />
             <span className="hidden sm:inline">{isAnyFilterApplied ? 'Remove Filters' : 'Filters'}</span>
             {isAnyFilterApplied && (
                <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-[10px] ml-1 shrink-0 font-bold border-2 border-red-500 leading-none flex items-center justify-center">
                   {
                      (searchTerm !== '' ? 1 : 0) +
                      (filterType !== 'all' ? 1 : 0) + 
                      (locationFilter !== 'all' ? 1 : 0) + 
                      (levelFilter !== 'all' ? 1 : 0) + 
                      (groupFilter !== 'all' ? 1 : 0) +
                      (statusFilter !== 'all' ? 1 : 0) +
                      (regretFilter !== null ? 1 : 0)
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 pb-2">
                <DayPickerDropdown 
                  startDate={dateFilterStart}
                  endDate={dateFilterEnd}
                  customPresets={customPresets}
                  onChange={(start, end, id) => {
                     if (id?.startsWith('package:')) {
                         setDateFilterStart(id);
                         setDateFilterEnd(id);
                         if (start) setSelectedDate(scheduleSafeDate(start));
                     } else {
                         setDateFilterStart(start);
                         setDateFilterEnd(end);
                         if (start) setSelectedDate(scheduleSafeDate(start));
                     }
                  }}
                />
                <FilterDropdown 
                  icon={<PackageIcon size={16} />}
                  label="Package"
                  value={filterType}
                  options={[
                    { value: 'all', label: 'All Packages' },
                    ...packageTypes.map(t => ({ value: t.code, label: t.name })).sort((a,b) => a.label.localeCompare(b.label))
                  ]}
                  onChange={setFilterType}
                  searchable={true}
                />
                <FilterDropdown 
                  icon={<MapPin size={16} />}
                  label="Location"
                  value={locationFilter}
                  options={[
                    { value: 'all', label: 'All Locations' },
                    ...locations.map(l => ({ value: l.id, label: l.name })).sort((a,b) => a.label.localeCompare(b.label))
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
                    ...levels.map(l => ({ value: l.id, label: l.name })).sort((a,b) => a.label.localeCompare(b.label))
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
                    ...groups.map(g => ({ value: g.id, label: `${g.code} - ${g.name}` })).sort((a,b) => a.label.localeCompare(b.label))
                  ]}
                  onChange={setGroupFilter}
                  searchable={true}
                />
                <FilterDropdown 
                  icon={<CheckCircle2 size={16} />}
                  label="Status"
                  value={statusFilter}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    ...statuses.map(s => ({ value: s, label: s })).sort((a,b) => a.label.localeCompare(b.label))
                  ]}
                  onChange={setStatusFilter}
                  searchable={true}
                />
              </div>

              {(isAnyFilterApplied || dateFilterStart !== format(startOfToday(), 'yyyy-MM-dd') || dateFilterEnd !== format(endOfToday(), 'yyyy-MM-dd')) && (
                <div className="flex justify-end mt-2">
                  <button 
                    onClick={() => {
                        setSearchTerm('');
                        setFilterType('all');
                        setLocationFilter('all');
                        setLevelFilter('all');
                        setGroupFilter('all');
                        setStatusFilter('all');
                        setRegretFilter(null);
                        setDateFilterStart(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
                        setDateFilterEnd(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                  >
                    <X size={14} /> reset all filters
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {showBulkModifyModal && (
            <BulkModifyModal
              selectedSessionIds={selectedSessionIds}
              sessions={sessions}
              pricingSchemes={pricingSchemes}
              locations={locations}
              packageTypes={packageTypes}
              packages={packages}
              groups={groups}
              groupBy={groupBy}
              onClose={() => {
                setShowBulkModifyModal(false);
                setSelectedSessionIds(new Set());
              }}
              updateMasterData={updateMasterData}
            />
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/30 p-4 rounded-[2rem] border-2 border-slate-800/50 shadow-inner">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <button 
            onClick={() => {
              const current = dateFilterStart && !dateFilterStart.startsWith('package:') ? new Date(dateFilterStart) : new Date();
              moveToDate(subDays(current, 1));
            }}
            className="flex items-center justify-center w-10 h-10 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-all shadow-bento shrink-0"
            title="Yesterday"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={() => {
              const today = startOfToday();
              const todayStr = format(today, 'yyyy-MM-dd');
              const isCurrentlyTodayOnly = dateFilterStart === todayStr && dateFilterEnd === todayStr;

              if (isCurrentlyTodayOnly) {
                // Return to whole week view of the current selectedDate
                const start = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                const end = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                setDateFilterStart(start);
                setDateFilterEnd(end);
                setView(isAttendance ? 'list' : 'week');
              } else {
                // Switch to today list filter
                setDateFilterStart(todayStr);
                setDateFilterEnd(todayStr);
                setSelectedDate(today);
                setView('list');
              }
            }}
            className={cn(
              "px-6 py-2.5 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-bento shrink-0",
              (dateFilterStart === format(startOfToday(), 'yyyy-MM-dd') && dateFilterEnd === format(endOfToday(), 'yyyy-MM-dd'))
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600"
            )}
          >
            Today
          </button>
          <button 
            onClick={() => {
              const current = dateFilterEnd && !dateFilterEnd.startsWith('package:') ? new Date(dateFilterEnd) : new Date();
              moveToDate(addDays(current, 1));
            }}
            className="flex items-center justify-center w-10 h-10 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-all shadow-bento shrink-0"
            title="Tomorrow"
          >
            <ChevronRight size={18} />
          </button>

          <div className="ml-2 px-4 h-10 border border-slate-800/60 rounded-xl bg-slate-900/50 shadow-inner flex items-center justify-center shrink-0">
            <span className="text-xs md:text-sm font-bold text-blue-400 uppercase tracking-widest whitespace-nowrap">
              {(() => {
                if (dateFilterStart?.startsWith('package:')) {
                   const pid = dateFilterStart.split(':')[1];
                   if (pid === 'current') return 'Current Package';
                   const p = packages.find(x => String(x.id) === pid);
                   if (p) {
                      const ply = players.find(x => String(x.id) === String(p.playerId));
                      return `${ply?.name || 'Player'} - ${p.packageTypeCode || 'PKG'}`;
                   }
                   return 'Package';
                }
                
                const start = dateFilterStart ? new Date(dateFilterStart) : new Date();
                const end = dateFilterEnd ? new Date(dateFilterEnd) : new Date();
                
                if (dateFilterStart === dateFilterEnd) {
                   return format(start, 'EEE, d MMM yyyy');
                } else {
                   if (start.getFullYear() !== end.getFullYear()) {
                     return `${format(start, 'd MMM yy')} - ${format(end, 'd MMM yy')}`;
                   } else if (start.getMonth() !== end.getMonth()) {
                     return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`;
                   } else {
                     return `${format(start, 'd')} - ${format(end, 'd MMM yyyy')}`;
                   }
                }
              })()}
            </span>
          </div>
        </div>

        {kpiStats.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
             {kpiStats.map(kpi => (
                <div key={kpi.label} className={cn("px-3 py-1 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-2 border border-white/5", kpi.color)}>
                   <span>{kpi.label}</span>
                   <span className="text-white bg-slate-950/50 px-1.5 py-0.5 rounded-md font-black">{kpi.count}</span>
                </div>
             ))}
          </div>
        )}
      </div>

      {view === 'list' && (
        <div className="bg-slate-950 rounded-[2rem] border-2 border-slate-800 shadow-bento overflow-hidden">
          {selectedSessionIds.size > 0 && (
            <div className="bg-slate-900/80 p-4 border-b-2 border-slate-800 flex items-center justify-between">
               <span className="text-sm font-black uppercase text-blue-400 tracking-widest">{selectedSessionIds.size} Sessions Selected</span>
               <div className="flex gap-2">
                  <button onClick={() => setShowBulkModifyModal(true)} className="text-xs font-bold text-white uppercase tracking-widest px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg">bulk edit</button>
                  <button 
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete the selected sessions?')) {
                        selectedSessionIds.forEach(id => deleteMasterData('sessions', id));
                        setSelectedSessionIds(new Set());
                      }
                    }}
                    className="text-xs font-bold text-white uppercase tracking-widest px-4 py-2 bg-red-600/80 hover:bg-red-500 rounded-lg flex items-center gap-2"
                  >
                     <Trash2 size={14} /> Delete
                  </button>
                  <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmSendEmails(true);
                    }}                
                    className="text-xs font-bold text-white uppercase tracking-widest px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2 cursor-pointer relative z-10"
                    disabled={isSendingEmails}
                  >
                    <Mail size={14} /> {isSendingEmails ? 'Sending...' : (groupBy === 'group' ? 'Group Send' : 'Player Email')}
                  </button>

                  <select className="bg-slate-950 border border-slate-700 rounded-lg text-xs p-2 text-white outline-none focus:border-blue-500" onChange={(e) => {
                      const newStatus = e.target.value as SessionStatus;
                      filteredSessions.filter(s => selectedSessionIds.has(s.id!)).forEach(s => handleStatusUpdate(s, newStatus));
                      setSelectedSessionIds(new Set());
                  }}>
                    <option value="">Bulk Status Update</option>
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setSelectedSessionIds(new Set())} className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest px-4 py-2 bg-slate-800 rounded-lg">Cancel</button>
               </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-slate-800 bg-slate-900/50 text-[10px] md:text-sm uppercase tracking-widest text-slate-500">
                 <th className="px-2 py-3">
                     <input type="checkbox" checked={selectedSessionIds.size === filteredSessions.length && filteredSessions.length > 0} onChange={(e) => {
                        if (e.target.checked) setSelectedSessionIds(new Set(filteredSessions.map(s => s.id!)));
                        else setSelectedSessionIds(new Set());
                     }} className="rounded border-slate-700 bg-slate-950 text-blue-500 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                 </th>
                 <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors" onClick={(e) => handleSort('group', e)}>
                    Group
                    {sortConfigs.find(c => c.key === 'group')?.direction === 'asc' ? ' ↑' : sortConfigs.find(c => c.key === 'group')?.direction === 'desc' ? ' ↓' : ''}
                    {sortConfigs.length > 1 && sortConfigs.findIndex(c => c.key === 'group') >= 0 && <span className="text-[8px] ml-1 text-slate-500">{sortConfigs.findIndex(c => c.key === 'group') + 1}</span>}
                 </th>
                 <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors" onClick={(e) => handleSort('player', e)}>
                    Player(s)
                    {sortConfigs.find(c => c.key === 'player')?.direction === 'asc' ? ' ↑' : sortConfigs.find(c => c.key === 'player')?.direction === 'desc' ? ' ↓' : ''}
                    {sortConfigs.length > 1 && sortConfigs.findIndex(c => c.key === 'player') >= 0 && <span className="text-[8px] ml-1 text-slate-500">{sortConfigs.findIndex(c => c.key === 'player') + 1}</span>}
                 </th>
                 <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors" onClick={(e) => handleSort('session', e)}>
                    Session#
                    {sortConfigs.find(c => c.key === 'session')?.direction === 'asc' ? ' ↑' : sortConfigs.find(c => c.key === 'session')?.direction === 'desc' ? ' ↓' : ''}
                    {sortConfigs.length > 1 && sortConfigs.findIndex(c => c.key === 'session') >= 0 && <span className="text-[8px] ml-1 text-slate-500">{sortConfigs.findIndex(c => c.key === 'session') + 1}</span>}
                 </th>
                 <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors" onClick={(e) => handleSort('date', e)}>
                    Date
                    {sortConfigs.find(c => c.key === 'date')?.direction === 'asc' ? ' ↑' : sortConfigs.find(c => c.key === 'date')?.direction === 'desc' ? ' ↓' : ''}
                    {sortConfigs.length > 1 && sortConfigs.findIndex(c => c.key === 'date') >= 0 && <span className="text-[8px] ml-1 text-slate-500">{sortConfigs.findIndex(c => c.key === 'date') + 1}</span>}
                 </th>
                 <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors" onClick={(e) => handleSort('time', e)}>
                    Time
                    {sortConfigs.find(c => c.key === 'time')?.direction === 'asc' ? ' ↑' : sortConfigs.find(c => c.key === 'time')?.direction === 'desc' ? ' ↓' : ''}
                    {sortConfigs.length > 1 && sortConfigs.findIndex(c => c.key === 'time') >= 0 && <span className="text-[8px] ml-1 text-slate-500">{sortConfigs.findIndex(c => c.key === 'time') + 1}</span>}
                 </th>
                 <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors" onClick={(e) => handleSort('location', e)}>
                    Location
                    {sortConfigs.find(c => c.key === 'location')?.direction === 'asc' ? ' ↑' : sortConfigs.find(c => c.key === 'location')?.direction === 'desc' ? ' ↓' : ''}
                    {sortConfigs.length > 1 && sortConfigs.findIndex(c => c.key === 'location') >= 0 && <span className="text-[8px] ml-1 text-slate-500">{sortConfigs.findIndex(c => c.key === 'location') + 1}</span>}
                 </th>
                 <th className="px-2 py-3 text-center">Status</th>
                 <th className="px-2 py-3">Session Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredSessions.map((session, sessionIdx) => {
                const player = playersMap.get(String(session.playerId));
                const location = locationsMap.get(String(session.locationId));
                // Use a stable key that includes index if session.id is not unique enough for this view
                const rowKey = `${session.id || 'new'}-${session.playerId || 'noplayer'}-${sessionIdx}`;
                
                return (
                   <tr key={rowKey} className="text-xs text-white font-normal hover:bg-slate-900/50">
                     <td className="px-2 py-3">
                        <input type="checkbox" checked={selectedSessionIds.has(String(session.id || sessionIdx))} onChange={(e) => {
                            const idsToToggle = (groupBy === 'group' && session._sessionIds) ? session._sessionIds.map(String) : [String(session.id || sessionIdx)];
                            const newSelected = new Set(selectedSessionIds);
                            if (e.target.checked) idsToToggle.forEach(id => newSelected.add(id));
                            else idsToToggle.forEach(id => newSelected.delete(id));
                            setSelectedSessionIds(newSelected);
                        }} className="rounded border-slate-700 bg-slate-950 text-blue-500 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                     </td>
                      <td className="px-2 py-3">
                         <div className="flex items-center gap-2">
                            {(() => {
                              const group = getSessionGroup(session);
                              if (!group) return null;
                              return <div className="h-3 w-3 rounded-full flex-shrink-0 shadow-sm border border-black/10" style={{ backgroundColor: getGroupColor(group.id!, group.color) }} />;
                           })()}
                           {groupBy === 'player' && currentUserRole?.role !== 'visitor' ? (
                             (() => {
                               const p = playersMap.get(String(session.playerId));
                               const activeGroups = (groups || []).filter((g: any) => {
                                 if (p?.groupAssignments && p.groupAssignments.length > 0) {
                                   const assignment = p.groupAssignments.find((a: any) => String(a.groupId) === String(g.id));
                                   return assignment?.isActive === true;
                                 }
                                 return p?.groupId && String(g.id) === String(p.groupId);
                               });
                               const currentGroup = getSessionGroup(session);
                               return (
                                 <select
                                   value={currentGroup?.id || ''}
                                   className="bg-transparent border-none outline-none cursor-pointer hover:text-blue-400 p-0 text-white text-base max-w-[130px] font-normal"
                                   onChange={(e) => {
                                      handleFieldUpdate(session, 'groupId', e.target.value || '');
                                   }}
                                 >
                                    <option value="" className="bg-slate-900 text-slate-500">NO GROUP</option>
                                    {activeGroups.map((g: any) => (
                                      <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                                        {g.code ? (g.code.endsWith('.') ? g.code : `${g.code}.`) : g.name}
                                      </option>
                                    ))}
                                 </select>
                               );
                             })()
                           ) : (
                             (() => {
                               const group = getSessionGroup(session);
                               const displayText = group ? (group.code ? (group.code.endsWith('.') ? group.code : `${group.code}.`) : group.name) : '---';
                               return <span className="text-base">{displayText}</span>;
                             })()
                           )}
                        </div>
                     </td>
                    <td className="px-2 py-3 text-slate-300">
                      <div className="flex flex-col text-slate-300">
                        <span className="text-lg">{getDisplayName(session)}</span>
                        {(() => {
                           const p = playersMap.get(String(session.playerId));
                           const lastEval = evaluations?.filter(e => e.playerId === p?.id).sort((a,b) => b.date.localeCompare(a.date))[0];
                           if (lastEval) {
                             return (
                               <div className="flex items-center gap-1 mt-1">
                                 <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                      className={cn("h-full", lastEval.percentage >= 80 ? "bg-emerald-500" : "bg-blue-500")} 
                                      style={{ width: `${lastEval.percentage}%` }} 
                                    />
                                 </div>
                                 <span className={cn("text-xs font-black", lastEval.percentage >= 80 ? "text-emerald-500" : "text-blue-500")}>
                                    {lastEval.percentage}%
                                 </span>
                               </div>
                             );
                           }
                           return null;
                        })()}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-base">
                      {currentUserRole?.role !== 'visitor' ? (
                        <div className="relative group/idx inline-block min-w-[60px]">
                          <select
                            value={session.sessionTypeCode || (packages?.find(p => String(p.id) === String(session.packageId))?.packageTypeCode) || 'SES'}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                            onChange={(e) => {
                               handleFieldUpdate(session, 'sessionTypeCode', e.target.value);
                            }}
                          >
                             {packageTypes.map(t => (
                               <option key={t.id} value={t.code} className="bg-slate-900 text-white">{t.code}</option>
                             ))}
                          </select>
                          <span className="text-white group-hover/idx:text-blue-400 font-bold underline decoration-dotted underline-offset-4 decoration-slate-600">
                            {sessionIndexMap.get(String(session.id)) || '---'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-white font-bold">
                          {sessionIndexMap.get(String(session.id)) || '---'}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="relative group w-fit cursor-pointer">
                        <div className="flex items-center gap-1.5 px-1 py-0.5 rounded transition-colors group-hover:bg-slate-800">
                           <span className="text-base text-white group-hover:text-blue-400">{session.date ? format(scheduleSafeDate(session.date), 'dd/MM/yyyy') : ''}</span>
                           <span className="text-sm text-slate-400 font-bold">{session.date ? `- ${format(scheduleSafeDate(session.date), 'EEE')}` : ''}</span>
                        </div>
                        <input 
                          type="date"
                          value={session.date}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          onClick={(e) => {
                             try {
                                 ('showPicker' in e.target) && (e.target as HTMLInputElement).showPicker();
                             } catch (err) {}
                          }}
                          onChange={(e) => {
                             handleFieldUpdate(session, 'date', e.target.value);
                          }}
                          disabled={currentUserRole?.role === 'visitor'}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="relative group w-fit cursor-pointer">
                        <div className="flex items-center gap-1 px-1 py-0.5 rounded transition-colors group-hover:bg-slate-800">
                           <span className={cn("text-base uppercase group-hover:text-blue-400", session._isPartialGroupTime ? "text-red-500" : "text-white")}>{formatTimeAMPM(session.startTime)}</span>
                        </div>
                        <input 
                          type="time"
                          value={session.startTime}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          onClick={(e) => {
                             try {
                                 ('showPicker' in e.target) && (e.target as HTMLInputElement).showPicker();
                             } catch (err) {}
                          }}
                          onChange={(e) => {
                             handleFieldUpdate(session, 'startTime', e.target.value);
                          }}
                          disabled={currentUserRole?.role === 'visitor'}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <select
                        value={session.locationId || player?.locationId || ''}
                        className="bg-transparent border-none outline-none cursor-pointer hover:text-blue-400 p-0 text-white text-base max-w-[130px] font-normal"
                        onChange={(e) => {
                           handleFieldUpdate(session, 'locationId', e.target.value || undefined);
                        }}
                        disabled={currentUserRole?.role === 'visitor'}
                      >
                         <option value="" className="bg-slate-900 text-slate-500">No Location</option>
                         {locations?.map((loc: any) => (
                             <option key={loc.id} value={loc.id} className="bg-slate-900 text-white">{loc.name}</option>
                         ))}
                      </select>
                    </td>
                    <td className="px-2 py-3 text-center relative">
                      {['Regret', 'Exceptional Regret'].includes(session.status) && (
                        <div 
                          className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full text-[10px] font-black h-6 w-6 flex items-center justify-center z-10 shadow-lg cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => navigate(`/players/${session.playerId}?activePackageId=${session.packageId}&filter=regret`)}
                        >
                          {sessions.filter(s => 
                             String(s.playerId) === String(session.playerId) && 
                             String(s.packageId) === String(session.packageId) && 
                             ['Regret', 'Exceptional Regret'].includes(s.status)
                          ).length}
                        </div>
                      )}
                      {currentUserRole?.role !== 'visitor' ? (
                        <div className="flex flex-col gap-1 items-center">
                            <select 
                              value={session.status} 
                              onChange={e => handleStatusUpdate(session, e.target.value as SessionStatus)}
                              className={cn(
                                "px-2 py-1 rounded-lg text-[10px] md:text-base font-black uppercase cursor-pointer outline-none appearance-none text-center border focus:ring-1 border-opacity-30",
                                StatusStyles(session.status)
                              )}
                            >
                               {session.status === 'Mix' && <option value="Mix" className="bg-slate-900 text-red-500">MIX</option>}
                               <option value="Scheduled" className="bg-slate-900 text-slate-300">SCHEDULED</option>
                               <option value="Attended" className="bg-slate-900 text-emerald-400">ATTENDED</option>
                               <option value="Compensated" className="bg-slate-900 text-emerald-400">COMPENSATED</option>
                               <option value="Exceptional Regret" className="bg-slate-900 text-orange-400">EXCEPTIONAL REGRET</option>
                               <option value="Regret" className="bg-slate-900 text-orange-400">REGRET</option>
                               <option value="Absent" className="bg-slate-900 text-red-400">ABSENT</option>
                               <option value="Cancelled" className="bg-slate-900 text-red-400">CANCELLED</option>
                               <option value="Hold" className="bg-slate-900 text-gray-400">HOLD</option>
                            </select>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-center">
                            <div className={cn(
                              "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest w-fit border border-opacity-30 mx-auto min-w-[100px] text-center",
                              StatusStyles(session.status)
                            )}>
                              {session.status}
                            </div>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <input 
                        type="text"
                        value={session.comment || ''}
                        onChange={(e) => {
                           handleFieldUpdate(session, 'comment', e.target.value);
                        }}
                        placeholder="Note..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none focus:border-blue-500 placeholder:text-slate-600"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredSessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-b-2xl border-x border-b border-slate-800">
               <CalendarIcon size={48} className="text-slate-700 mb-4" />
               <p className="text-slate-400 font-bold text-lg">No sessions found for this selection</p>
               <p className="text-slate-600 text-sm mt-1">Try moving to another date or adjusting filters</p>
            </div>
          )}
          </div>
        </div>
      )}
      {(view === 'week' || view === 'month') && (
        <div className="bg-slate-950 rounded-[2rem] border-2 border-slate-800 shadow-bento overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b-2 border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-6">
                    <button onClick={() => moveToDate(subDays(selectedDate, view === 'week' ? 7 : 30))} className="h-10 w-10 flex items-center justify-center bg-slate-950 border-2 border-slate-800 rounded-xl shadow-bento hover:bg-slate-900 transition-all active:translate-y-0.5 text-slate-500 hover:text-white"><ChevronLeft size={20} /></button>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                        {view === 'week' 
                            ? `Week of ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}` 
                            : format(selectedDate, 'MMMM yyyy')}
                    </h3>
                    <div className="flex items-center gap-4">
                        <button onClick={() => moveToDate(addDays(selectedDate, view === 'week' ? 7 : 30))} className="h-10 w-10 flex items-center justify-center bg-slate-950 border-2 border-slate-800 rounded-xl shadow-bento hover:bg-slate-900 transition-all active:translate-y-0.5 text-slate-500 hover:text-white"><ChevronRight size={20} /></button>
                        {view === 'week' && (
                            <span className="text-sm font-black text-slate-500 uppercase tracking-widest">
                                {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')} - {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Scheduled</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Done</span>
                  </div>
                </div>
            </div>
            
            {view === 'week' ? (
              <div className="overflow-x-auto bg-slate-950">
                <div 
                  className="grid border-collapse min-w-[700px] border-l border-t border-slate-700/50"
                  style={{ 
                    gridTemplateColumns: `minmax(80px, 100px) repeat(${displayedWeekDays.length}, 1fr)` 
                  }}
                >
                    <div className="p-4 border-r border-b border-slate-700/50 flex flex-col justify-end bg-slate-900/50">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Time</span>
                    </div>
                    {displayedWeekDays.map(day => (
                        <div key={`header-${day.toString()}`} className={cn(
                            "p-4 text-center border-r border-b border-slate-700/50",
                            isSameDay(day, new Date()) ? "bg-blue-600 text-white" : "bg-slate-900/50"
                        )}>
                            <p className={cn("text-[10px] md:text-xs font-normal uppercase tracking-[0.2em] mb-1", isSameDay(day, new Date()) ? "opacity-80" : "text-slate-400")}>{format(day, 'EEEE')}</p>
                            <p className={cn("text-lg md:text-2xl font-black tracking-tighter", isSameDay(day, new Date()) ? "text-white" : "text-slate-200")}>{format(day, 'd')}</p>
                        </div>
                    ))}

                    {displayedHours.map((hour, hIdx) => {
                        const hPrefix = hour.split(':')[0];
                        return (
                            <React.Fragment key={hour}>
                                {/* Time Column */}
                                <div className={cn(
                                    "min-h-[120px] p-2 border-r border-b border-slate-700/50 flex flex-col items-center justify-start pt-4",
                                    hIdx % 2 === 0 ? "bg-slate-900/20" : "bg-slate-900/40"
                                )}>
                                    <span className="text-xs md:text-sm font-black text-slate-400 uppercase">{formatTimeAMPM(hour)}</span>
                                </div>
                                {/* Days Columns */}
                                {displayedWeekDays.map((day, dayIdx) => {
                                    const dateKey = format(day, 'yyyy-MM-dd');
                                    const hourKey = `${dateKey}_${hPrefix}`;
                                    const hourSessions = (sessionsByDateAndHour.get(hourKey) || []).sort((a, b) => a.startTime.localeCompare(b.startTime));
                                    
                                    return (
                                        <div key={`${day.toString()}-${hour}`} className={cn(
                                            "min-h-[120px] p-2 border-r border-b border-slate-700/50 flex flex-col gap-2 transition-colors relative group",
                                            hIdx % 2 === 0 ? "bg-slate-950/20" : "bg-slate-950/60",
                                            "hover:bg-slate-800/40"
                                        )}>
                                            {hourSessions.map((s, sIdx) => {
                                                const group = getSessionGroup(s);
                                                return (
                                                    <div key={`${s.id}-${hour}-${day.toString()}-${sIdx}`} 
                                                        onClick={() => setSelectedSlot(s)}
                                                        className={cn(
                                                            "p-2 rounded-lg border-l-4 hover:shadow-bento cursor-pointer text-white w-full shadow-sm transition-all hover:translate-x-1",
                                                            s.status === 'Attended' ? "opacity-70" : ""
                                                        )}
                                                        style={{ 
                                                            borderLeftColor: group ? getGroupColor(group.id!, group.color) : '#3b82f6',
                                                            backgroundColor: group ? `${getGroupColor(group.id!, group.color)}20` : s.status === 'Attended' ? 'rgba(16,185,129,0.1)' : 'rgba(30,41,59,0.5)',
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-between gap-1 mb-1">
                                                            <span className="text-[9px] font-black bg-slate-900 px-1.5 py-0.5 rounded text-slate-300 shadow-sm">{formatTimeAMPM(s.startTime)}</span>
                                                        </div>
                                                        <div className="font-normal truncate text-[10px] md:text-sm leading-tight mb-1" style={{ color: group ? getGroupColor(group.id!, group.color) : '#cbd5e1' }}>
                                                            {getDisplayName(s)}
                                                            {getStatusIndicator(s)}
                                                        </div>
                                                        <div className="text-[9px] md:text-xs font-black text-slate-500 uppercase tracking-widest truncate leading-none">{getLocationName(s)}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </div>
              </div>
            ) : (
                <>
                <div className="grid grid-cols-7 border-b border-t border-slate-700/50 bg-slate-900/50">
                    {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                        <div key={day} className="p-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] relative after:absolute after:right-0 after:top-2 after:bottom-2 after:w-px after:bg-slate-700/50 last:after:hidden">{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 border-b border-slate-700/50 bg-slate-950">
                    {eachDayOfInterval({
                      start: startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 }),
                      end: endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 })
                    }).map(day => {
                      const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                      const daysessions = filteredSessions.filter(s => isSameDay(scheduleSafeDate(s.date), day)).sort((a,b) => a.startTime.localeCompare(b.startTime));
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div key={day.toString()} 
                           onClick={() => { setSelectedDate(day); setView('list'); }}
                           className={cn(
                             "border-r border-b border-slate-700/50 min-h-[140px] p-2 cursor-pointer transition-colors hover:bg-slate-900", 
                             isToday ? "bg-blue-600/5" : "bg-slate-950", 
                             !isCurrentMonth && "opacity-40 bg-slate-900/20"
                           )}>
                            <div className="flex justify-between items-start mb-2">
                                <p className={cn(
                                    "text-sm font-black w-7 h-7 flex items-center justify-center transition-all",
                                    isToday ? "bg-blue-600 text-white rounded-full shadow-lg shadow-blue-900/40" : "text-slate-500"
                                )}>{format(day, 'd')}</p>
                                {daysessions.length > 0 && !isToday && <div className="h-1 w-1 rounded-full bg-blue-500/50" />}
                            </div>
                            <div className="space-y-1">
                                {daysessions.slice(0, 3).map((s, sIdx) => {
                                    const group = getSessionGroup(s);
                                    const gColor = group ? getGroupColor(group.id!, group.color) : '#3b82f6';
                                    return (
                                    <div key={`${s.id}-${day.toString()}-${sIdx}`} 
                                       onClick={(e) => { e.stopPropagation(); setSelectedSlot(s); }}
                                       className={cn(
                                           "p-1.5 rounded-lg border-l-4 hover:shadow-bento cursor-pointer text-white w-full transition-all hover:translate-x-1",
                                           s.status === 'Attended' ? "opacity-60" : ""
                                       )}
                                       style={{ 
                                         borderLeftColor: gColor,
                                         backgroundColor: `${gColor}15`
                                       }}
                                    >
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <span className="text-[8px] font-black bg-slate-950/50 px-1 rounded text-slate-400 border border-slate-800 shadow-sm">{formatTimeAMPM(s.startTime)}</span>
                                        </div>
                                        <div className="font-normal truncate text-[10px] leading-tight mb-0.5" style={{ color: gColor }}>
                                            {getDisplayName(s)}
                                            {getStatusIndicator(s)}
                                        </div>
                                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate leading-none">{getLocationName(s)}</div>
                                    </div>
                                    );
                                })}
                                {daysessions.length > 3 && (
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center pt-1">
                                        + {daysessions.length - 3} more sessions
                                    </p>
                                )}
                            </div>
                        </div>
                      )
                    })}
                </div>
                </>
            )}
        </div>
      )}

      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedSlot(null)} />
            <div className="relative w-full max-w-md rounded-3xl border-2 border-slate-800 bg-slate-900 shadow-bento overflow-hidden">
                <div className="flex items-center justify-between border-b-2 border-slate-800 bg-slate-950/50 p-6">
                    <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter">{isEditingSlot ? 'Edit Slot' : 'Slot Details'}</h3>
                    <div className="flex items-center gap-2">
                        {currentUserRole?.role !== 'visitor' && !isEditingSlot && (
                            <>
                                <button onClick={() => setIsEditingSlot(true)} className="rounded-xl p-2 text-blue-500 hover:bg-slate-800 transition-colors" title="Edit Session">
                                    <Pencil size={18} />
                                </button>
                                <button onClick={handleDeleteSlot} className="rounded-xl p-2 text-red-500 hover:bg-slate-800 transition-colors" title="Delete Session">
                                    <Trash2 size={18} />
                                </button>
                            </>
                        )}
                        <button onClick={() => setSelectedSlot(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-6">
                    {isEditingSlot ? (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">Date</label>
                                <input 
                                    type="date"
                                    value={editSlotData?.date || ''}
                                    onChange={(e) => setEditSlotData({ ...editSlotData, date: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-normal text-white outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">Time</label>
                                <select 
                                    value={editSlotData?.startTime || '08:00'}
                                    onChange={(e) => setEditSlotData({ ...editSlotData, startTime: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-normal text-white outline-none focus:border-blue-500"
                                >
                                    {['07:00','08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'].map(t => (
                                        <option key={t} value={t}>{formatTimeAMPM(t)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">Location</label>
                                <select 
                                    value={editSlotData?.locationId || ''}
                                    onChange={(e) => setEditSlotData({ ...editSlotData, locationId: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-normal text-white outline-none focus:border-blue-500"
                                >
                                    <option value="">Default (Player Location)</option>
                                    {locations.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">Group</label>
                                <select 
                                    value={editSlotData?.groupId || ''}
                                    onChange={(e) => {
                                        const newGroupId = e.target.value;
                                        let isActive = false;
                                        
                                        const player = playersMap.get(String(selectedSlot.playerId));
                                        if (player?.groupAssignments && player.groupAssignments.length > 0) {
                                            const assignment = player.groupAssignments.find((a: any) => String(a.groupId) === newGroupId);
                                            if (assignment?.isActive) isActive = true;
                                        } else {
                                            if (String(player?.groupId) === newGroupId) isActive = true;
                                        }
                                        if (!isActive && newGroupId) {
                                            alert('Activate the player to the group ahead');
                                            return;
                                        }

                                        setEditSlotData({ ...editSlotData, groupId: newGroupId });
                                    }}
                                    disabled={groupBy === 'group'}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-normal text-white outline-none focus:border-blue-500 disabled:opacity-50"
                                >
                                    <option value="">NO GROUP</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.code} - {g.name}</option>
                                    ))}
                                </select>
                                {groupBy === 'group' && <p className="text-[9px] pl-1 text-slate-500">Must be in Player view to change group.</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">Session Type</label>
                                <select 
                                    value={editSlotData?.sessionTypeCode || (packages?.find(p => String(p.id) === String(selectedSlot.packageId))?.packageTypeCode) || 'SES'}
                                    onChange={(e) => setEditSlotData({ ...editSlotData, sessionTypeCode: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-normal text-white outline-none focus:border-blue-500 uppercase cursor-pointer"
                                >
                                    {packageTypes.map(t => (
                                        <option key={t.id} value={t.code}>{t.name} ({t.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">Status</label>
                                <select 
                                    value={editSlotData?.status || 'Scheduled'}
                                    onChange={(e) => setEditSlotData({ ...editSlotData, status: e.target.value as SessionStatus })}
                                    className={cn(
                                        "w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-black outline-none focus:border-blue-500 uppercase cursor-pointer",
                                        StatusStyles(editSlotData?.status || 'Scheduled')
                                    )}
                                >
                                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <div className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">Session #</div>
                                <div className="text-xs md:text-lg font-bold text-blue-400">
                                    {sessionIndexMap.get(String(selectedSlot.id)) || '---'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">Date & Time</div>
                                <div className="text-xs md:text-lg font-bold text-white flex items-center gap-2">
                                    <Clock size={16} className="text-blue-500" />
                                    {format(scheduleSafeDate(selectedSlot.date), 'dd/MM/yyyy')} at {formatTimeAMPM(selectedSlot.startTime)}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">Location</div>
                                <div className="text-xs md:text-lg font-bold text-white flex items-center gap-2">
                                    <MapPin size={16} className="text-emerald-500" />
                                    {getLocationName(selectedSlot)}
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <div className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-widest">{groupBy === 'group' ? 'Group / Players' : 'Player'}</div>
                                <div className="text-xs md:text-lg font-bold text-slate-300">
                                    {getDisplayName(selectedSlot)}
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status Update</div>
                                <p className="text-[10px] text-slate-400 mb-2 italic">
                                    {currentUserRole?.role === 'visitor' 
                                        ? "View-only access: Status modification restricted."
                                        : groupBy === 'group' 
                                            ? "Note: Updating status here will affect all players in this group for this specific time slot."
                                            : "Update status for this specific player."}
                                </p>
                                {currentUserRole?.role === 'visitor' ? (
                                <div className={cn(
                                    "w-full bg-slate-950 border-2 border-slate-800 rounded-xl p-3 text-sm font-bold uppercase text-center",
                                    StatusStyles(selectedSlot.status)
                                )}>
                                    {selectedSlot.status}
                                </div>
                                ) : (
                                <select 
                                    value={selectedSlot.status}
                                    onChange={(e) => {
                                        handleStatusUpdate(selectedSlot, e.target.value as SessionStatus);
                                        setSelectedSlot({ ...selectedSlot, status: e.target.value });
                                    }}
                                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-blue-500 uppercase cursor-pointer"
                                >
                                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                    {selectedSlot.status === 'Mix' && <option value="Mix" className="bg-slate-900 text-red-500">MIX</option>}
                                </select>
                                )}
                            </div>
                        </>
                    )}
                </div>
                <div className="p-6 border-t border-slate-800 bg-slate-950/30 flex gap-4">
                    {isEditingSlot ? (
                        <>
                            <button 
                                onClick={() => setIsEditingSlot(false)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveSlotEdit}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors"
                            >
                                Save Changes
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col w-full gap-3">
                            <button 
                                onClick={() => setSelectedSlot(null)}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {showConflicts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowConflicts(false)} />
            <div className="relative bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-8 border-2 border-red-500/30 shadow-bento overflow-hidden max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                       <Bell className="text-red-500" size={24} /> 
                       Scheduling Conflicts
                    </h2>
                    <button onClick={() => setShowConflicts(false)} className="text-slate-500 hover:text-white p-2">
                        <X size={20} />
                    </button>
                </div>
                <div className="overflow-y-auto custom-scrollbar flex-1 space-y-6 pr-2">
                    {conflicts.map(c => (
                        <div key={c.key} className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800 space-y-4">
                           <div className="flex justify-between items-start">
                              <div>
                                 <p className="text-red-400 font-black text-sm uppercase tracking-widest mb-1">Conflict Detected</p>
                                 <p className="text-white font-bold text-lg">
                                    {format(scheduleSafeDate(c.date), 'dd/MM/yyyy')} @ {formatTimeAMPM(c.startTime)}
                                 </p>
                              </div>
                              <button 
                                disabled={currentUserRole?.role === 'visitor'}
                                onClick={() => {
                                  const newValidated = new Set(validatedConflicts);
                                  newValidated.add(c.key);
                                  setValidatedConflicts(newValidated);
                                }}
                                className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg hover:bg-emerald-400 transition-colors shadow-sm disabled:opacity-50"
                              >
                                Validate Overlap
                              </button>
                           </div>
                           <div className="space-y-3">
                                {c.sessions.map((cs: any) => {
                                 const group = getSessionGroup(cs);
                                 const locName = getLocationName(cs);
                                 const isGroup = !!group;
                                 return (
                                    <div key={`${cs.id}-${c.key}`} className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 gap-4">
                                        <div 
                                          className="flex items-center gap-3 cursor-pointer group/item"
                                          onClick={() => handleJumpToSlot(cs.date, cs.startTime)}
                                        >
                                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: group?.color || '#3b82f6' }} />
                                            <div>
                                                <p className="font-bold text-white text-sm group-hover/item:text-blue-400 transition-colors">
                                                    {getDisplayName(cs)}
                                                </p>
                                                <p className="text-[10px] text-slate-500 uppercase font-black italic">{locName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                              disabled={currentUserRole?.role === 'visitor'}
                                              type="date"
                                              value={cs.date}
                                              onChange={(e) => {
                                                const newDate = e.target.value;
                                                const relatedSessions = sessions.filter(s => 
                                                  s.date === cs.date && 
                                                  s.startTime === cs.startTime &&
                                                  (isGroup ? getSessionGroup(s)?.id === group.id : s.playerId === cs.playerId)
                                                );
                                                relatedSessions.forEach(rs => {
                                                  updateMasterData('sessions', rs.id!, { ...rs, date: newDate });
                                                });
                                              }}
                                              className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-white px-2 py-1.5 rounded-lg outline-none focus:border-blue-500 disabled:opacity-50"
                                            />
                                            <select 
                                              disabled={currentUserRole?.role === 'visitor'}
                                              value={cs.startTime}
                                              onChange={(e) => {
                                                const newTime = e.target.value;
                                                const relatedSessions = sessions.filter(s => 
                                                  s.date === cs.date && 
                                                  s.startTime === cs.startTime &&
                                                  (isGroup ? getSessionGroup(s)?.id === group.id : s.playerId === cs.playerId)
                                                );
                                                relatedSessions.forEach(rs => {
                                                  updateMasterData('sessions', rs.id!, { ...rs, startTime: newTime });
                                                });
                                              }}
                                              className="bg-slate-950 border border-slate-800 text-[10px] font-bold text-white px-2 py-1.5 rounded-lg outline-none focus:border-blue-500 disabled:opacity-50"
                                            >
                                                {['07:00','08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'].map(t => (
                                                  <option key={t} value={t}>{formatTimeAMPM(t)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                 )
                              })}
                           </div>
                        </div>
                    ))}
                    {conflicts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <CheckCircle2 size={48} className="text-emerald-500/20" />
                            <p className="text-slate-500 italic font-black uppercase text-[10px] tracking-widest leading-none">Operational synchronization complete</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
      
      {/* Confirm Delete Slot Modal */}
      {confirmDeleteSlot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-red-500/50 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setConfirmDeleteSlot(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full p-2">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <Trash2 className="text-red-500" size={28} />
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Delete Session</h2>
            </div>
            
            <p className="text-slate-300 mb-6 font-medium leading-relaxed">
              {groupBy === 'group' 
                ? "Are you sure you want to delete this session for ALL players in this group?"
                : "Are you sure you want to delete this session?"}
              <br/><br/>
              This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setConfirmDeleteSlot(false)}
                className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteSlotAction}
                className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Slot Modal */}
      {confirmDeleteSlot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-red-500/50 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setConfirmDeleteSlot(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full p-2">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <Trash2 className="text-red-500" size={28} />
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Delete Session</h2>
            </div>
            
            <p className="text-slate-300 mb-6 font-medium leading-relaxed">
              {groupBy === 'group' 
                ? "Are you sure you want to delete this session for ALL players in this group?"
                : "Are you sure you want to delete this session?"}
              <br/><br/>
              This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setConfirmDeleteSlot(false)}
                className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteSlotAction}
                className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Send Emails Modal */}
      {confirmSendEmails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setConfirmSendEmails(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full p-2">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <Mail className="text-blue-500" size={28} />
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Send Schedule Emails</h2>
            </div>
            
            <p className="text-slate-300 mb-6 font-medium leading-relaxed">
              Are you sure to send the schedule to the concerned players for the {Array.from(selectedSessionIds).length} selected sessions/slots? 
              This will send individualized schedules to each player.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setConfirmSendEmails(false)}
                className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                disabled={isSendingEmails}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                        setIsSendingEmails(true);

                        const selectedSessionsRaw = filteredSessions.filter(s => selectedSessionIds.has(s.id!));
                        
                        // Collect all unique actual session objects (flattening group slots if necessary)
                        const uniqueSessionIds = new Set<string>();
                        selectedSessionsRaw.forEach(s => {
                            if (s._exploded && s.id) {
                                uniqueSessionIds.add(String(s.id));
                            } else if (s._sessionIds) {
                                s._sessionIds.forEach((id: string) => uniqueSessionIds.add(String(id)));
                            } else if (s.id) {
                                uniqueSessionIds.add(String(s.id));
                            }
                        });

                        const allActualSessions = Array.from(uniqueSessionIds)
                           .map(id => sessions.find(rs => String(rs.id) === id))
                           .filter((s: any) => s && !['Cancelled', 'Hold'].includes(s.status));

                        const sessionsByPlayer = allActualSessions.reduce((acc, s) => {
                            if (!acc[s.playerId]) acc[s.playerId] = [];
                            acc[s.playerId].push(s);
                            return acc;
                        }, {} as Record<string, any[]>);

                        let sendCount = 0;
                        let errorCount = 0;

                        const promises = Object.entries(sessionsByPlayer).map(async ([playerId, playerSessions]) => {
                            const player = playersMap.get(playerId);
                            if (!player || !player.email) {
                                errorCount++;
                                return;
                            }
                            
                            const playerPkgs = (packages || []).filter(p => String(p.playerId) === playerId);
                            const activePkg = playerPkgs.sort((a,b) => (b.startDate||'').localeCompare(a.startDate||''))[0];
                            if (!activePkg) return;

                            const fullPackageSessions = (sessions || []).filter(s => String(s.packageId) === String(activePkg.id));
                            const { derivedTotalDue } = calculatePackageValues(activePkg, fullPackageSessions, pricingSchemes, true);
                            const realPaidAmount = Number(activePkg.paidAmount || 0);

                            const pkgLabel = packageLabelsMap.get(String(activePkg.id)) || activePkg.packageTypeCode || 'Package';

                            let oldDue = 0;
                            playerPkgs.forEach(pkg => {
                                if (String(pkg.id) === String(activePkg.id)) return;
                                const pkgPayments = (payments || []).filter(p => String(p.packageId) === String(pkg.id));
                                const pPaid = pkgPayments.length > 0 ? pkgPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0) : Number(pkg.paidAmount || 0);
                                const pDue = Number(pkg.totalDue || 0);
                                const pending = Math.max(0, pDue - pPaid);
                                if (pkg.status !== 'Paid' && pkg.status !== 'Free' && pending > 0.01) {
                                    oldDue += pending;
                                }
                            });

                            const body = generateEmailBody(player, activePkg, fullPackageSessions, locations, playerSessions as any[], derivedTotalDue, realPaidAmount, pkgLabel, undefined, sessionIndexMap, undefined, oldDue, groups);
                            const htmlBody = generateEmailHtml(player, activePkg, fullPackageSessions, locations, playerSessions as any[], derivedTotalDue, realPaidAmount, pkgLabel, undefined, sessionIndexMap, undefined, oldDue, groups);

                            try {
                                const response = await fetch('/api/send-email', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        to: player.email,
                                        subject: `Vas-y Padel Academy - Training Schedule for C. ${toTitleCase(player.name)}`,
                                        body: body,
                                        html: htmlBody
                                    })
                                });
                                if (response.ok) {
                                    sendCount++;
                                } else {
                                    errorCount++;
                                }
                            } catch (e) {
                                errorCount++;
                            }
                        });

                        await Promise.all(promises);
                        // Hide confirmation
                        setConfirmSendEmails(false);
                        setIsSendingEmails(false);
                        
                        // Show success
                        setSuccessMessage("Schedule is submitted to all concerned players");
                        setSelectedSessionIds(new Set());
                }}
                className="px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-2"
                disabled={isSendingEmails}
              >
                {isSendingEmails ? (
                  <>
                     <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                     Sending...
                  </>
                ) : 'Yes, Send Emails'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSuccessMessage(null)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-emerald-950 border-2 border-emerald-500 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-center"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setSuccessMessage(null)} className="absolute top-4 right-4 text-emerald-400 hover:text-white bg-emerald-900 rounded-full p-1.5">
              <X size={16} />
            </button>
            <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">Success</h3>
            <p className="text-emerald-200 font-medium">
              {successMessage}
            </p>
            <button 
              onClick={() => setSuccessMessage(null)}
              className="mt-6 w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm bg-emerald-600 text-white hover:bg-emerald-500"
            >
              OK
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
