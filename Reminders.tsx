import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../lib/DataContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  Trash2, 
  AlertCircle, 
  CreditCard, 
  Calendar,
  CheckCircle2,
  X,
  Plus,
  Mail,
  Loader2,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { cn, formatCurrency, toTitleCase } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Reminder } from '../types';
import { calculatePackageValues } from '../lib/pricingUtils';
import { generateEmailHtml, generateEmailBody, generateFinancialEmailHtml, generateFinancialEmailBody } from '../lib/emailUtils';
import { PackageBreakdown } from '../components/PackageBreakdown';

export default function Reminders() {
  const { reminders, players, packages, sessions, payments, pricingSchemes, locations, groups, updateMasterData, deleteMasterData } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Renew' | 'Financial'>((location.state as any)?.filter || 'All');
  const [playerFilter, setPlayerFilter] = useState<string | null>((location.state as any)?.playerId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'createdAt' | 'expectingDate'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isSending, setIsSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ [id: string]: 'idle' | 'sending' | 'sent' | 'error' }>({});
  const [showEmailReport, setShowEmailReport] = useState(false);
  const [emailReport, setEmailReport] = useState<{ name: string; status: 'success' | 'error'; message?: string }[]>([]);
  const [breakdown, setBreakdown] = useState<{ packages: any[], playerId: string, position: { top: number, left: number } } | null>(null);


  useEffect(() => {
    if ((location.state as any)?.filter) {
      const f = (location.state as any).filter;
      setFilter(f);
      if (f === 'Financial') {
        setSortField('expectingDate');
        setSortDirection('asc');
      }
    }
    if ((location.state as any)?.playerId) {
      setPlayerFilter((location.state as any).playerId);
    }
  }, [location.state]);

  const allRemindersWithDynamic = useMemo(() => {
    // Start with unread master reminders but filter them based on current validity
    const list = reminders.filter(r => {
      if (r.status !== 'Unread') return false;
      const player = players.find(p => p.id === r.playerId);
      if (!player) return true;

      // Ensure 'Financial' alarms are only shown if there's actually pending due
      if (r.category === 'Financial') {
        const playerPackages = packages.filter(pkg => pkg.playerId === player.id);
          const pkgPending = playerPackages.reduce((acc, pkg) => {
            const pkgPayments = payments.filter(pay => String(pay.packageId) === String(pkg.id));
            const realPaid = pkgPayments.length > 0 
              ? pkgPayments.reduce((pAcc, pay) => pAcc + Number(pay.amount || 0), 0)
              : Number(pkg.paidAmount || 0);

            let pkgDue = Number(pkg.totalDue || 0);
            if (pricingSchemes && pricingSchemes.length > 0) {
              const pkgSessions = sessions.filter(s => s.packageId === pkg.id && s.status !== 'Cancelled');
              const { derivedTotalDue } = calculatePackageValues(pkg as any, pkgSessions as any, pricingSchemes as any, pkg.forceSystemPricing || false);
              pkgDue = derivedTotalDue;
            }
            const pkgRem = Math.max(0, pkgDue - realPaid);
            
            if (pkg.status === 'Paid' || pkg.status === 'Free' || pkg.status === 'Cancelled' || pkgRem <= 0.01) return acc;
            return acc + pkgRem;
          }, 0);
          return pkgPending > 0.01;
      }

      // Ensure 'Renew' alarms are only shown if nearing completion
      if (r.category === 'Renew') {
        const playerPackages = packages.filter(pkg => pkg.playerId === player.id);
        const latestPackage = [...playerPackages].sort((a,b) => (b.startDate || b.createdAt || '').localeCompare(a.startDate || a.createdAt || ''))[0];
        if (!latestPackage) return false;
        const pkgSessions = sessions.filter(s => s.packageId === latestPackage.id && s.status !== 'Cancelled');
        const consumed = pkgSessions.filter(s => 
          ['Attended', 'Absent', 'Exceptional Regret', 'Regret', 'Compensated'].includes(s.status)
        ).length;
        const left = (latestPackage.numSessions || 0) - consumed;
        return left <= 1 && player.isActive !== false;
      }

      return true;
    }).map(r => {
      if (r.category === 'Financial') {
        const player = players.find(p => p.id === r.playerId);
        if (player) {
          const playerPackages = packages.filter(pkg => pkg.playerId === player.id);
          const unpaidPackages = playerPackages.filter(pkg => {
            const pkgPayments = payments.filter(pay => String(pay.packageId) === String(pkg.id));
            const realPaid = pkgPayments.length > 0 ? pkgPayments.reduce((pAcc, pay) => pAcc + Number(pay.amount || 0), 0) : Number(pkg.paidAmount || 0);
            let pkgDue = Number(pkg.totalDue || 0);
            if (pricingSchemes && pricingSchemes.length > 0) {
              const pkgSessions = sessions.filter(s => s.packageId === pkg.id && s.status !== 'Cancelled');
              const { derivedTotalDue } = calculatePackageValues(pkg as any, pkgSessions as any, pricingSchemes as any, pkg.forceSystemPricing || false);
              pkgDue = derivedTotalDue;
            }
            const pkgRem = Math.max(0, pkgDue - realPaid);
            return pkg.status !== 'Paid' && pkg.status !== 'Free' && pkg.status !== 'Cancelled' && pkgRem > 0.01;
          }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

          let totalPending = 0;
          let breakdownStr = '';
          const sortedAll = [...playerPackages].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
          
          unpaidPackages.forEach(pkg => {
            const pkgPayments = payments.filter(pay => String(pay.packageId) === String(pkg.id));
            const realPaid = pkgPayments.length > 0 ? pkgPayments.reduce((pAcc, pay) => pAcc + Number(pay.amount || 0), 0) : Number(pkg.paidAmount || 0);
            let pkgDue = Number(pkg.totalDue || 0);
            if (pricingSchemes && pricingSchemes.length > 0) {
              const pkgSessions = sessions.filter(s => s.packageId === pkg.id && s.status !== 'Cancelled');
              const { derivedTotalDue } = calculatePackageValues(pkg as any, pkgSessions as any, pricingSchemes as any, pkg.forceSystemPricing || false);
              pkgDue = derivedTotalDue;
            }
            const pending = Math.max(0, pkgDue - realPaid);
            if (pkg.status !== 'Paid' && pkg.status !== 'Cancelled' && pending > 0.01) {
              const idx = sortedAll.findIndex(p => p.id === pkg.id);
              const label = idx >= 0 ? `M${idx + 1}` : '';
              breakdownStr += `${label} ${formatCurrency(pending)} EGP, `;
              totalPending += pending;
            }
          });

          let computedExpectingDate = undefined;
          if (unpaidPackages.length > 0) {
            const oldestUnpaid = unpaidPackages[0];
            const oldestUnpaidSessions = sessions.filter(s => String(s.packageId) === String(oldestUnpaid.id) && s.status !== 'Cancelled');
            const sortedS = [...oldestUnpaidSessions].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
            computedExpectingDate = sortedS.length > 0 ? sortedS[0].date : oldestUnpaid.startDate;
          }

          if (breakdownStr) {
            breakdownStr = breakdownStr.slice(0, -2) + '. ';
            return {
              ...r,
              message: `${player.name.toUpperCase()}: FINANCIAL ALARM. ${breakdownStr}TOTAL DUE: ${formatCurrency(totalPending)} EGP.`,
              expectingDate: computedExpectingDate
            };
          }
        }
      }
      return r;
    });

    const activePlayers = players.filter(p => p.isActive !== false);
    
    const sessionsByPackage = new Map<string, any[]>();
    sessions.forEach(s => {
      if (s.packageId) {
        const id = String(s.packageId);
        const existing = sessionsByPackage.get(id) || [];
        existing.push(s);
        sessionsByPackage.set(id, existing);
      }
    });

    const packagesByPlayer = new Map<string, any[]>();
    packages.forEach(pkg => {
      const pId = String(pkg.playerId);
      const existing = packagesByPlayer.get(pId) || [];
      existing.push(pkg);
      packagesByPlayer.set(pId, existing);
    });

    activePlayers.forEach(player => {
       const pId = String(player.id);
       const playerPackages = packagesByPlayer.get(pId) || [];
       const playerUnread = list.filter(r => r.playerId === pId && r.status === 'Unread');
       const hasDbFinancial = playerUnread.some(r => r.category === 'Financial');
       const hasDbRenew = playerUnread.some(r => r.category === 'Renew');

       // Check Renew
       let needsRenewal = false;
       playerPackages.sort((a,b) => (b.startDate || b.createdAt || '').localeCompare(a.startDate || a.createdAt || ''));
       const latestPackage = playerPackages[0];
       if (latestPackage && !hasDbRenew) {
          const pkgSessions = (sessionsByPackage.get(String(latestPackage.id)) || []).filter(s => s.status !== 'Cancelled');
          const consumedAndScheduled = pkgSessions.filter(s => 
            ['Attended', 'Compensated', 'Attended Comp. Session', 'Scheduled', 'Absent'].includes(s.status)
          ).length;
          const pendingCount = pkgSessions.filter(s => s.status === 'Scheduled').length;
          const toSchedule = Math.max(0, (latestPackage.numSessions || 0) - consumedAndScheduled);
          needsRenewal = (toSchedule === 0 && pendingCount <= 1);
          
          if (needsRenewal) {
             list.push({
                id: `dynamic-renew-${pId}`,
                playerId: pId,
                category: 'Renew',
                message: `${player.name}: INVOICE RENEWAL ALERT. Package is nearing or at completion.`,
                status: 'Unread',
                createdAt: Date.now()
             } as Reminder);
          }
       }
       
       // Check Financial
       let oldestPackageDate: string | null = null;
         let totalPending = playerPackages.reduce((acc, pkg) => {
             const pkgPayments = payments.filter(pay => String(pay.packageId) === String(pkg.id));
             const realPaid = pkgPayments.length > 0 
               ? pkgPayments.reduce((pAcc, pay) => pAcc + Number(pay.amount || 0), 0)
               : Number(pkg.paidAmount || 0);
 
             let pkgDue = Number(pkg.totalDue || 0);
             const pkgSessions = (sessionsByPackage.get(String(pkg.id)) || []).filter(s => s.status !== 'Cancelled');
             if (pricingSchemes && pricingSchemes.length > 0) {
                 const { derivedTotalDue } = calculatePackageValues(pkg as any, pkgSessions as any, pricingSchemes as any, pkg.forceSystemPricing || false);
                 pkgDue = derivedTotalDue;
             }
             const pkgRem = Math.max(0, pkgDue - realPaid);
             if (pkg.status === 'Paid' || pkg.status === 'Free' || pkgRem <= 0.01) return acc;
             
             // Accurate Due Inv Date: First Session Date, if not found then pkg.startDate
             const sortedSessions = [...pkgSessions].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
             const firstSessionDate = sortedSessions.length > 0 ? sortedSessions[0].date : pkg.startDate;

             if (!oldestPackageDate || (firstSessionDate && firstSessionDate < oldestPackageDate)) {
                 oldestPackageDate = firstSessionDate || null;
             }
             return acc + pkgRem;
         }, 0);
         
         if (totalPending > 0.01) {
             let dueDays = 0;
             if (oldestPackageDate) {
                 const start = new Date(oldestPackageDate);
                 const today = new Date();
                 dueDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
             }
             
             // Calculate Package ID for message
             let computedPkgLabel = "";
            let computedExpectingDate = oldestPackageDate;
             // Refind the oldest package to get label
             const unpaidPackages = playerPackages.filter(pkg => {
                const pkgPayments = payments.filter(pay => String(pay.packageId) === String(pkg.id));
                const realPaid = pkgPayments.length > 0 
                  ? pkgPayments.reduce((pAcc, pay) => pAcc + Number(pay.amount || 0), 0)
                  : Number(pkg.paidAmount || 0);

                let pkgDue = Number(pkg.totalDue || 0);
                const pkgSessions = (sessionsByPackage.get(String(pkg.id)) || []).filter(s => s.status !== 'Cancelled');
                if (pricingSchemes && pricingSchemes.length > 0) {
                    const { derivedTotalDue } = calculatePackageValues(pkg as any, pkgSessions as any, pricingSchemes as any, pkg.forceSystemPricing || false);
                    pkgDue = derivedTotalDue;
                }
                const pkgRem = Math.max(0, pkgDue - realPaid);
                return (pkg.status !== 'Paid' && pkg.status !== 'Free' && pkg.status !== 'Cancelled' && pkgRem > 0.01);
             }).sort((a,b) => (a.startDate || '').localeCompare(b.startDate || ''));
             
             if (unpaidPackages.length > 0) {
               const oldestUnpaid = unpaidPackages[0];
               const sortedPlayerPackages = [...playerPackages].sort((a, b) => {
                  const dateCompare = (a.startDate || '').localeCompare(b.startDate || '');
                  if (dateCompare !== 0) return dateCompare;
                  return (a.id || '').localeCompare(b.id || '');
                });
                const packageIndex = sortedPlayerPackages.findIndex(p => p.id === oldestUnpaid.id);
                computedPkgLabel = packageIndex >= 0 ? 'M' + (packageIndex + 1) : '';

                const oldestUnpaidSessions = (sessionsByPackage.get(String(oldestUnpaid.id)) || []).filter(s => s.status !== 'Cancelled');
                const sortedSessions = [...oldestUnpaidSessions].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
                computedExpectingDate = sortedSessions.length > 0 ? sortedSessions[0].date : oldestUnpaid.startDate;
             }

             let breakdownStr = '';
             let sortedPlayerPackagesAll = [...playerPackages].sort((a,b) => {
                 const dateCompare = (a.startDate || '').localeCompare(b.startDate || '');
                 if (dateCompare !== 0) return dateCompare;
                 return (a.id || '').localeCompare(b.id || '');
             });

             unpaidPackages.forEach(pkg => {
                 const pkgIndex = sortedPlayerPackagesAll.findIndex(p => p.id === pkg.id);
                 const pkgLabel = pkgIndex >= 0 ? `M${pkgIndex + 1}` : '';
                 
                 const pkgPayments = payments.filter(pay => String(pay.packageId) === String(pkg.id));
                 const realPaid = pkgPayments.length > 0 
                   ? pkgPayments.reduce((pAcc, pay) => pAcc + Number(pay.amount || 0), 0)
                   : Number(pkg.paidAmount || 0);
                   
                 let pkgDue = Number(pkg.totalDue || 0);
                 if (pricingSchemes && pricingSchemes.length > 0) {
                     const pkgSessionsForBreakdown = (sessionsByPackage.get(String(pkg.id)) || []).filter(s => s.status !== 'Cancelled');
                     const { derivedTotalDue } = calculatePackageValues(pkg as any, pkgSessionsForBreakdown as any, pricingSchemes as any, pkg.forceSystemPricing || false);
                     pkgDue = derivedTotalDue;
                 }
                 const pending = Math.max(0, pkgDue - realPaid);
                 if (pending > 0.01) {
                     breakdownStr += `${pkgLabel} ${formatCurrency(pending)} EGP, `;
                 }
             });
             
             if (breakdownStr) {
                 breakdownStr = breakdownStr.slice(0, -2) + '. ';
             }

             list.push({
                id: `dynamic-fin-${pId}`,
                playerId: pId,
                category: 'Financial',
                message: `${player.name.toUpperCase()}: FINANCIAL ALARM. ${breakdownStr}TOTAL DUE: ${formatCurrency(totalPending)} EGP.`,
                status: 'Unread',
                dueDays,
                expectingDate: computedExpectingDate || undefined,
                createdAt: Date.now()
             } as Reminder);
         }
    });

    const uniqueList: Reminder[] = [];
    const seenKeys = new Set<string>();
    list.forEach(r => {
      if (!r.playerId) {
        uniqueList.push(r);
        return;
      }
      const key = `${r.playerId}-${r.category}`;
      if (!seenKeys.has(key)) {
        uniqueList.push(r);
        seenKeys.add(key);
      }
    });

    return uniqueList;
  }, [reminders, players, packages, sessions, payments, pricingSchemes]);

  const filteredReminders = useMemo(() => {
    const activePlayerIds = new Set(players.filter(p => p.isActive !== false).map(p => p.id));
    let list = allRemindersWithDynamic.filter(r => r.category !== 'Conflict' && (!r.playerId || activePlayerIds.has(r.playerId)));
    if (filter !== 'All') list = list.filter(r => r.category === filter);
    if (playerFilter) list = list.filter(r => r.playerId === playerFilter);
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(rem => {
        const player = players.find(p => p.id === rem.playerId);
        const locationName = player ? (locations.find(l => l.id === player.locationId)?.name || '') : '';
        const group = player ? groups.find(g => g.id === player.groupId) : null;
        const groupName = group ? (group.name || '') : '';
        const groupCode = group ? (group.code || '') : '';
        const playerInfo = player ? `${player.name} ${locationName} ${groupName} ${groupCode} ${player.packageTypeCode || ''}`.toLowerCase() : '';
        return playerInfo.includes(term) || rem.message.toLowerCase().includes(term);
      });
    }

    return list;
  }, [allRemindersWithDynamic, filter, playerFilter, players, searchTerm]);

  const handleSort = (field: 'createdAt' | 'expectingDate') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'expectingDate' ? 'asc' : 'desc');
    }
  };

  const sortedReminders = useMemo(() => {
    const list = [...filteredReminders];
    list.sort((a, b) => {
      let valA: any, valB: any;
      if (sortField === 'expectingDate') {
        const getExpVal = (r: Reminder) => {
            if (r.expectingDate) return r.expectingDate;
            const d = (r.createdAt as any)?.toDate ? (r.createdAt as any).toDate() : new Date(Number(r.createdAt) || Date.now());
            return d.toISOString();
        };
        valA = getExpVal(a);
        valB = getExpVal(b);
      } else {
        valA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : Number(a.createdAt);
        valB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : Number(b.createdAt);
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredReminders, sortField, sortDirection]);

  const unreadCount = useMemo(() => {
    const activePlayerIds = new Set(players.filter(p => p.isActive !== false).map(p => p.id));
    return allRemindersWithDynamic.filter(r => r.category !== 'Conflict' && r.status === 'Unread' && (!r.playerId || activePlayerIds.has(r.playerId))).length;
  }, [allRemindersWithDynamic, players]);

  const handleBalanceClick = (e: React.MouseEvent, playerId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const pId = String(playerId);
      // Sort like in PlayerDetail
      const playerPackagesOfPlayer = packages.filter(p => String(p.playerId) === pId).sort((a, b) => {
        const dateCompare = (a.startDate || '').localeCompare(b.startDate || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.id || '').localeCompare(b.id || '');
      });
      // Enhance with M-X and REAL pending due calculation
      const enhancedPackages = playerPackagesOfPlayer.map((pkg, idx) => {
        const pkgPayments = payments.filter(pay => String(pay.packageId) === String(pkg.id));
        const realPaid = pkgPayments.length > 0 
          ? pkgPayments.reduce((pAcc, pay) => pAcc + Number(pay.amount || 0), 0)
          : Number(pkg.paidAmount || 0);

        let pkgDue = Number(pkg.totalDue || 0);
        if (pricingSchemes && pricingSchemes.length > 0) {
          const pkgSessions = sessions.filter(s => String(s.packageId) === String(pkg.id) && s.status !== 'Cancelled');
          const { derivedTotalDue } = calculatePackageValues(pkg, pkgSessions, pricingSchemes, pkg.forceSystemPricing || false);
          pkgDue = derivedTotalDue;
        }

        return { 
          ...pkg, 
          displayId: `M${idx + 1}`,
          calculatedPending: Math.max(0, pkgDue - realPaid)
        };
      }).filter(p => (p.calculatedPending || 0) > 0.01);
      
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setBreakdown({
          packages: enhancedPackages,
          playerId: pId,
          position: { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX }
      });
  }

  const handleRead = async (id: string) => {
    if (!id.startsWith('dynamic-')) {
      await updateMasterData('reminders', id, { status: 'Read' });
    }
  };

  const handleReadSelected = async () => {
    const idsToRead = selectedIds.length > 0 
      ? selectedIds 
      : filteredReminders.filter(r => r.status === 'Unread').map(r => r.id!);
    
    for (const id of idsToRead) {
      if (!id.startsWith('dynamic-')) {
        await updateMasterData('reminders', id, { status: 'Read' });
      }
    }
    setSelectedIds([]);
  };

  const [deleteMode, setDeleteMode] = useState<'selected' | 'all' | 'single'>('selected');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const handleClearSelected = () => {
    if (selectedIds.length === 0) {
      // Delete All visible
      setDeleteMode('all');
    } else {
      setDeleteMode('selected');
    }
    setShowConfirmDelete(true);
  };

  const handleSingleDelete = (id: string) => {
    setItemToDelete(id);
    setDeleteMode('single');
    setShowConfirmDelete(true);
  };

  const handleDeleteConfirmed = async () => {
    if (deleteMode === 'single' && itemToDelete && !itemToDelete.startsWith('dynamic-')) {
      await deleteMasterData('reminders', itemToDelete);
    } else if (deleteMode === 'selected') {
      for (const id of selectedIds) {
        if (!id.startsWith('dynamic-')) {
           await deleteMasterData('reminders', id);
        }
      }
    } else if (deleteMode === 'all') {
      const allFilteredIds = filteredReminders.map(r => r.id!);
      for (const id of allFilteredIds) {
        if (!id.startsWith('dynamic-')) {
           await deleteMasterData('reminders', id);
        }
      }
    }
    setSelectedIds([]);
    setItemToDelete(null);
    setShowConfirmDelete(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredReminders.length && filteredReminders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReminders.map(r => r.id!));
    }
  };

  const isAllSelected = filteredReminders.length > 0 && filteredReminders.every(r => selectedIds.includes(r.id!));

  const handleSendFinancialEmails = async () => {
    if (selectedIds.length === 0) return;
    
    setIsSending(true);
    setEmailReport([]);
    const reports: any[] = [];

    const selectedReminders = filteredReminders.filter(r => selectedIds.includes(r.id!));
    
    for (const reminder of selectedReminders) {
      if (reminder.category !== 'Financial') continue;
      
      const player = players.find(p => p.id === reminder.playerId);
      const recipientEmail = player?.email || player?.parentEmail;

      if (!recipientEmail) {
        reports.push({ name: player?.name || 'Unknown', status: 'error', message: 'No email found' });
        continue;
      }

      try {
        // Gather data for this specific player
        const playerPackages = packages.filter(pkg => pkg.playerId === player.id);
        const playerSessions = sessions.filter(s => s.playerId === player.id && s.status !== 'Cancelled');
        
        // Find the active/oldest unpaid package to base the email on
        let derivedTotalDue: number | undefined;
        let realPaid: number | undefined;

        const unpaidPackages = playerPackages.filter(pkg => {
          const pkgPayments = payments.filter(pay => String(pay.packageId) === String(pkg.id));
          const actualPaid = pkgPayments.length > 0 
            ? pkgPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
            : Number(pkg.paidAmount || 0);

          let pkgDue = Number(pkg.totalDue || 0);
          const pkgSess = playerSessions.filter(s => String(s.packageId) === String(pkg.id));
          if (pricingSchemes && pricingSchemes.length > 0) {
              const { derivedTotalDue: dt } = calculatePackageValues(pkg as any, pkgSess as any, pricingSchemes as any, pkg.forceSystemPricing || false);
              pkgDue = Math.max(pkgDue, dt);
          }

          if (pkgDue > actualPaid && pkg.status !== 'Free') {
             // For the active package logic, maybe we want to keep dt and actualPaid when we find the right one
             return true;
          }
          return false;
        }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

        let totalDueAmount = 0;
        const packagesBreakdown: { label: string, due: number, startDate: string }[] = [];
        
        const sortedPlayerPackages = [...playerPackages].sort((a, b) => {
          const dateCompare = (a.startDate || '').localeCompare(b.startDate || '');
          if (dateCompare !== 0) return dateCompare;
          return (a.id || '').localeCompare(b.id || '');
        });

        unpaidPackages.forEach(pkg => {
          const pkgPayments = payments.filter(pay => String(pay.packageId) === String(pkg.id));
          const actualPaid = pkgPayments.length > 0
            ? pkgPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
            : Number(pkg.paidAmount || 0);

          let pkgDue = Number(pkg.totalDue || 0);
          const pkgSess = playerSessions.filter(s => String(s.packageId) === String(pkg.id));
          if (pricingSchemes && pricingSchemes.length > 0) {
              const { derivedTotalDue: dt } = calculatePackageValues(pkg as any, pkgSess as any, pricingSchemes as any, pkg.forceSystemPricing || false);
              pkgDue = dt;
          }

          const pending = Math.max(0, pkgDue - actualPaid);
          if (pending > 0.01) {
             const pIndex = sortedPlayerPackages.findIndex(p => p.id === pkg.id);
             packagesBreakdown.push({
                label: pIndex >= 0 ? `M${pIndex + 1}` : 'Package',
                due: pending,
                startDate: pkg.startDate || ''
             });
             totalDueAmount += pending;
          }
        });

        const html = generateFinancialEmailHtml(
          player,
          totalDueAmount,
          packagesBreakdown
        );

        const body = generateFinancialEmailBody(
          player,
          totalDueAmount,
          packagesBreakdown
        );

        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipientEmail,
            subject: `Payment Reminder - C. ${player.name}`,
            body: body,
            html: html
          })
        });

        if (!response.ok) throw new Error(await response.text());

        reports.push({ name: player.name, status: 'success' });
      } catch (error: any) {
        reports.push({ name: player?.name || 'Unknown', status: 'error', message: error.message });
      }
    }

    setEmailReport(reports);
    setIsSending(false);
    setShowEmailReport(true);
    setSelectedIds([]);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="h-16 w-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center border-4 border-slate-900 shadow-bento group-hover:rotate-6 transition-transform">
               <Bell size={32} strokeWidth={3} />
            </div>
            {unreadCount > 0 && (
               <span className="absolute -top-2 -right-2 h-7 min-w-[28px] bg-red-500 text-white text-sm font-black rounded-full flex items-center justify-center border-2 border-slate-900 px-1.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                 {unreadCount}
               </span>
            )}
          </div>
          <div>
            <p className="text-[10px] md:text-xs font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Notification Center</p>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none">Alarms</h1>
            <p className="text-slate-400 mt-3 font-bold uppercase text-[10px] md:text-xs tracking-widest leading-none">Operational alerts for coaching modules</p>
          </div>
        </div>

        <div className="flex gap-3">
          {(['All', 'Renew', 'Financial'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] md:text-sm font-black uppercase tracking-widest border-2 transition-all shadow-bento-subtle",
                filter === cat 
                  ? "bg-blue-600 text-white border-blue-500 scale-105" 
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:text-white"
              )}
            >
              {cat === 'Financial' ? 'FINANCIAL ALARM' : cat}
              {cat !== 'All' && (
                <span className="ml-2 text-[10px] opacity-70">
                  ({allRemindersWithDynamic.filter(r => r.category === cat).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {filteredReminders.length > 0 && (
            <>
              {filter === 'Financial' && selectedIds.length > 0 && (
                <button 
                  onClick={handleSendFinancialEmails}
                  disabled={isSending}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl text-[10px] md:text-sm font-black uppercase tracking-widest hover:bg-emerald-500 border-2 border-slate-800 shadow-bento transition active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                >
                  {isSending ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
                  SEND GROUP EMAIL ({selectedIds.length})
                </button>
              )}

              <button 
                onClick={handleReadSelected}
                className="flex items-center gap-2 bg-blue-600/10 text-blue-400 px-5 py-3 rounded-2xl text-[10px] md:text-sm font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white border-2 border-blue-500/30 shadow-bento transition active:translate-y-0.5"
              >
                <CheckCircle2 size={18} />
                {selectedIds.length > 0 ? `READ SELECTED (${selectedIds.length})` : 'READ ALL'}
              </button>
              
              <button 
                onClick={handleClearSelected}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] md:text-sm font-black uppercase tracking-widest border-2 shadow-bento transition active:translate-y-0.5",
                  selectedIds.length > 0 
                    ? "bg-red-600/10 text-red-500 border-red-500/30 hover:bg-red-600 hover:text-white" 
                    : "bg-red-600 text-white border-red-500 hover:bg-red-500"
                )}
              >
                <Trash2 size={18} />
                {selectedIds.length > 0 ? `DELETE SELECTED (${selectedIds.length})` : 'DELETE ALL'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
        <input
          type="text"
          placeholder="Search by name, location, group..."
          className="w-full bg-slate-900/50 border-2 border-slate-800 rounded-2xl pl-12 pr-8 py-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all uppercase tracking-widest font-normal"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-slate-950 rounded-[2.5rem] border-2 border-slate-800 shadow-bento overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-800 bg-slate-900/50 text-sm uppercase font-bold tracking-[0.2em] text-slate-500">
              <th className="px-6 py-5 w-16">
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="h-6 w-6 rounded-lg border-2 border-slate-800 bg-slate-900 text-white focus:ring-0 transition-all cursor-pointer accent-white"
                />
              </th>
              <th className="px-6 py-5 w-20">Type</th>
              <th className="px-6 py-5">Message</th>
              <th 
                className="px-6 py-5 w-40 cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => handleSort(filter === 'Financial' ? 'expectingDate' : 'createdAt')}
              >
                <div className="flex items-center gap-2">
                  {filter === 'Financial' ? 'DUE INV DATE' : 'Date'}
                  <ArrowUpDown size={14} className={cn(
                    "text-slate-500",
                    sortField === (filter === 'Financial' ? 'expectingDate' : 'createdAt') && "text-blue-500"
                  )} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-800/50">
            {sortedReminders.map((reminder) => {
              let isZeroPending = false;
              let isOnePending = false;
              let latestSessionDateStr: string | undefined = undefined;
              let dynamicRenewMessage: string | undefined = undefined;

              if (reminder.category === 'Renew' && reminder.playerId) {
                const playerPackages = packages.filter(pkg => pkg.playerId === reminder.playerId);
                const latestPackage = [...playerPackages].sort((a,b) => (b.startDate || b.createdAt || '').localeCompare(a.startDate || a.createdAt || ''))[0];
                if (latestPackage) {
                  const pkgSessions = sessions.filter(s => s.packageId === latestPackage.id && s.status !== 'Cancelled');
                  const consumedAndScheduled = pkgSessions.filter(s => ['Attended', 'Compensated', 'Attended Comp. Session', 'Scheduled', 'Absent'].includes(s.status)).length;
                  const pendingCount = pkgSessions.filter(s => s.status === 'Scheduled').length;
                  const toSchedule = Math.max(0, (latestPackage.numSessions || 0) - consumedAndScheduled);
                  
                  if (toSchedule === 0 && pendingCount === 0) {
                     isZeroPending = true;
                     dynamicRenewMessage = 'Current package has been fully consumed';
                  } else if (toSchedule === 0 && pendingCount === 1) {
                     isOnePending = true;
                     dynamicRenewMessage = 'Package is nearing or at completion';
                  }

                  const sortedSessions = [...pkgSessions].sort((a,b) => (b.date || '').localeCompare(a.date || ''));
                  if (sortedSessions.length > 0) {
                      latestSessionDateStr = sortedSessions[0].date;
                  }
                }
              }

              const isFin = reminder.category === 'Financial';
              let playerPrefix = '';
              if (reminder.playerId) {
                  const p = players.find(x => x.id === reminder.playerId);
                  if (p) playerPrefix = `${p.name}: `;
              }

              return (
              <tr 
                key={reminder.id} 
                className={cn(
                  "hover:bg-blue-600/5 transition-colors group",
                  reminder.status === 'Read' ? "opacity-50" : "bg-slate-900/20"
                )}
              >
                <td className="px-6 py-4">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(reminder.id!)}
                    onChange={() => toggleSelect(reminder.id!)}
                    className="h-6 w-6 rounded-lg border-2 border-slate-800 bg-slate-900 text-white focus:ring-0 transition-all cursor-pointer accent-white"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className={cn(
                    "px-4 py-2 rounded-xl flex items-center justify-center border-2 shrink-0 font-black text-[10px] tracking-widest uppercase",
                    reminder.category === 'Renew' && !isZeroPending
                      ? "bg-blue-950/40 text-blue-400 border-blue-900/50" 
                      : "bg-red-950/40 text-red-500 border-red-900/50"
                  )}>
                    {reminder.category === 'Renew' ? 'RENEW' : 'FINANCIAL'}
                  </div>
                </td>
                <td className="px-6 py-4 min-w-[300px] cursor-pointer"
                  onClick={() => {
                    if (reminder.playerId) {
                      navigate(`/players/${reminder.playerId}`);
                    }
                  }}
                >
                  <p className={cn(
                    "text-xs md:text-sm uppercase tracking-tight group-hover:opacity-80 transition-opacity", 
                    reminder.status === 'Unread' ? "font-semibold text-white" : "font-medium text-slate-500",
                    reminder.category === 'Renew' && isZeroPending ? "text-red-500" : "",
                    reminder.category === 'Renew' && !isZeroPending ? "text-blue-400" : ""
                  )}>
                    {reminder.category === 'Financial' ? (
                       <span>
                          {reminder.message.replace(/FINANCIAL ALARM\.?\s*/gi, '').split(/(TOTAL DUE: [\d,]+\.\d{2} EGP\.)/).map((part, i) => {
                             if (part.includes('TOTAL DUE:')) {
                                return (
                                  <span 
                                    key={i} 
                                    className="text-red-500 cursor-pointer hover:text-red-400 underline decoration-red-500/30 underline-offset-4"
                                    onClick={(e) => reminder.playerId ? handleBalanceClick(e, reminder.playerId) : undefined}
                                  >
                                    {part}
                                  </span>
                                );
                             }
                             return part;
                          })}
                       </span>
                    ) : (
                       dynamicRenewMessage ? `${playerPrefix}${dynamicRenewMessage}` : reminder.message.replace(/INVOICE RENEWAL ALERT\.?\s*/gi, '')
                    )}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {reminder.expectingDate ? (
                      <>
                        {reminder.category === 'Renew' && (
                          <p className={cn("text-[10px] md:text-sm font-bold uppercase tracking-widest leading-none mb-1", isZeroPending ? "text-red-500" : "text-blue-400")}>
                            Renew Expected
                          </p>
                        )}
                        <p className={cn("text-sm md:text-lg leading-none", 
                          reminder.category === 'Renew' ? "font-black" : "font-semibold text-red-500",
                          reminder.category === 'Renew' && isZeroPending ? "text-red-500" : "",
                          reminder.category === 'Renew' && !isZeroPending ? "text-blue-400" : ""
                        )}>
                           {(() => {
                              if (!reminder.expectingDate) return '';
                              try {
                                const d = new Date(reminder.expectingDate);
                                if (isNaN(d.getTime())) return reminder.expectingDate;
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = d.getFullYear();
                                return `${day}/${month}/${year}`;
                              } catch (e) {
                                return reminder.expectingDate;
                              }
                           })()}
                        </p>
                      </>
                    ) : (
                     <>
                       <p className={cn("text-xs md:text-sm uppercase tracking-widest", 
                          reminder.category === 'Financial' ? "text-red-500 font-semibold" : "font-semibold text-slate-500",
                          reminder.category === 'Renew' && isZeroPending ? "text-red-500" : "",
                          reminder.category === 'Renew' && !isZeroPending ? "text-blue-400" : ""
                       )}>
                          {(() => {
                            if (reminder.category === 'Renew' && latestSessionDateStr) {
                               const d = new Date(latestSessionDateStr);
                               if (!isNaN(d.getTime())) {
                                   return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                               }
                            }
                            const date = (reminder.createdAt as any)?.toDate ? (reminder.createdAt as any).toDate() : new Date(reminder.createdAt || Date.now());
                            return date instanceof Date && !isNaN(date.getTime()) ? date.toLocaleDateString('en-GB') : 'TBD';
                          })()}
                       </p>
                       {(!reminder.category || (reminder.category !== 'Renew' && reminder.category !== 'Financial')) && (
                          <p className="text-[10px] md:text-xs font-medium text-slate-600">
                              {(() => {
                                const date = (reminder.createdAt as any)?.toDate ? (reminder.createdAt as any).toDate() : new Date(reminder.createdAt || Date.now());
                                return date instanceof Date && !isNaN(date.getTime()) ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                              })()}
                          </p>
                       )}
                     </>
                   )}
                </td>
                {/* Actions cell removed */}
              </tr>
            )})}
          </tbody>
        </table>

        {filteredReminders.length === 0 && (
          <div className="text-center py-32 bg-slate-900/20">
            <div className="h-20 w-20 bg-slate-950 border-4 border-dashed border-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-8 text-slate-800 rotate-12">
              <Bell size={40} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">No Alarms Detected</h3>
            <p className="text-slate-500 mt-3 font-bold uppercase text-[10px] tracking-widest max-w-[200px] mx-auto">Systems operational within expected parameters</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEmailReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowEmailReport(false)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="relative bg-slate-900 p-8 rounded-[2.5rem] shadow-bento border-4 border-slate-800 max-w-2xl w-full"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-emerald-950/20 text-emerald-500 rounded-2xl flex items-center justify-center border-2 border-emerald-500/30">
                    <Mail size={24} />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Email Batch Status</h2>
                </div>
                <button onClick={() => setShowEmailReport(false)} className="text-slate-500 hover:text-white transition">
                  <X size={24} />
                </button>
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                {emailReport.map((report, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border-2 border-slate-800/50">
                    <div>
                      <p className="text-sm font-black text-white uppercase tracking-tight">{report.name}</p>
                      {report.message && <p className="text-[10px] text-red-400 uppercase font-bold mt-1">{report.message}</p>}
                    </div>
                    {report.status === 'success' ? (
                      <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        <Check size={14} /> Sent
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        <X size={14} /> Failed
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setShowEmailReport(false)}
                className="w-full mt-8 py-4 bg-slate-800 font-black text-white rounded-2xl hover:bg-slate-700 transition uppercase text-sm tracking-widest border-2 border-slate-700"
              >
                CLOSE REPORT
              </button>
            </motion.div>
          </div>
        )}

        {showConfirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setShowConfirmDelete(false)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              className="relative bg-slate-900 p-10 rounded-[3rem] shadow-bento border-4 border-slate-800 max-w-md w-full text-center"
            >
              <div className="h-20 w-20 bg-red-950/20 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border-2 border-red-500/30 rotate-6 shadow-bento-subtle">
                <Trash2 size={40} />
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-white mb-4 uppercase tracking-tighter leading-none">
                {deleteMode === 'all' ? 'Purge All?' : deleteMode === 'single' ? 'Purge Record?' : 'Execute Purge?'}
              </h2>
              <p className="text-slate-400 mb-10 text-[10px] md:text-xs font-bold uppercase tracking-widest leading-relaxed">
                {deleteMode === 'all' 
                  ? 'This protocol will permanently eliminate the ENTIRE visible notification registry.' 
                  : deleteMode === 'single'
                  ? 'This protocol will permanently eliminate this specific record from the registry.'
                  : `This protocol will permanently eliminate ${selectedIds.length} records from the registry.`
                }
              </p>
              <div className="flex gap-4">
                 <button onClick={() => setShowConfirmDelete(false)} className="flex-1 px-6 py-4 bg-slate-800 font-black text-slate-400 rounded-2xl hover:text-white transition uppercase text-sm tracking-widest border-2 border-transparent">ABORT</button>
                 <button onClick={handleDeleteConfirmed} className="flex-1 px-6 py-4 bg-red-600 font-black text-white rounded-2xl hover:bg-red-500 transition shadow-bento border-2 border-slate-800 uppercase text-sm tracking-widest">CONFIRM PURGE</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {breakdown && (
        <PackageBreakdown packages={breakdown.packages} playerId={breakdown.playerId!} onClose={() => setBreakdown(null)} position={breakdown.position} />
      )}
    </div>
  );
}
