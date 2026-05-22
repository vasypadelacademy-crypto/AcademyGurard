import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

const parseISO = (val: any) => {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  return _parseISO(val);
};
import { useParams, useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { VpLogoSvg } from '../components/VpLogoSvg';
import { PlayerForm } from './Players';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  CreditCard, 
  FileText, 
  Trash2, 
  Check, 
  X, 
  Printer, 
  Download,
  FileDown,
  AlertCircle,
  Clock,
  Bell,
  MapPin,
  MessageSquare,
  Package as PackageIcon,
  ChevronRight,
  Edit2,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Search,
  Award,
  Circle,
  Eye,
  Save,
  RotateCcw,
  CheckCircle2,
  List,
  Mail,
  Send,
  RefreshCw
} from 'lucide-react';
import { cn, formatCurrency, formatTimeAMPM, getGroupColor, DISTINCT_COLORS, getSortableDate, toTitleCase } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Combobox } from '../components/Combobox';
import { SessionStatus, Evaluation, SkillScore, Player } from '../types';
import { findBestPricingScheme, calculatePackageValues } from '../lib/pricingUtils';
import { addMonths, format, startOfMonth, parseISO as _parseISO, addDays, getDay, isAfter, isBefore, endOfMonth, eachDayOfInterval } from 'date-fns';
import { SKILL_MATRIX, LEVELS, BADGE_MAPPING, BadgeType } from '../lib/skills';
import html2pdf from 'html2pdf.js';
import { EmailScheduleModal } from '../components/EmailScheduleModal';
import { PaymentModal, EditPaymentModal } from '../components/PaymentModal';
import { PaymentEmailReviewModal } from '../components/PaymentEmailReviewModal';
import { manageFinancialAlarm } from '../lib/financialManager';
import { generatePaymentConfirmationEmailHtml, generatePaymentConfirmationEmailBody } from '../lib/emailUtils';
import { Speedometer } from '../components/Speedometer';
import PlayerNotes from '../components/PlayerNotes';
import PlayerNotesModal from '../components/PlayerNotesModal';

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const period = i >= 12 ? 'PM' : 'AM';
  const displayHours = i % 12 === 0 ? 12 : i % 12;
  const value = `${i.toString().padStart(2, '0')}:00`;
  const label = `${displayHours.toString().padStart(2, '0')}:00 ${period}`;
  return { value, label };
});

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => String(currentYear - 2 + i));

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    players, packages, sessions, payments, packageTypes, locations, levels, groups,
    addMasterData, updateMasterData, deleteMasterData, pricingSchemes, reminders, currentUserRole,
    evaluations
  } = useData();

  const player = useMemo(() => players.find(p => p.id === id), [players, id]);

  const playerEvaluations = useMemo(() => 
    (evaluations || [])
      .filter((e: Evaluation) => e.playerId === id)
      .sort((a,b) => b.date.localeCompare(a.date)),
    [evaluations, id]
  );

  const currentEvaluation = playerEvaluations[0];
  const currentLevel = currentEvaluation?.level || (levels.find(l => l.id === player?.levelId)?.name || 'Beginner'); 
  const masteryProgress = currentEvaluation?.percentage || 0;

  const badgeData = useMemo(() => {
    // 1. Get all uniquely achieved levels (highest date for each level that passed >= 80%)
    const achieved = (evaluations || [])
      .filter((e: Evaluation) => e.playerId === id && e.percentage >= 80)
      .reduce((acc: any[], e: Evaluation) => {
        if (!acc.find(item => item.level === e.level)) {
           acc.push({ 
             id: e.id, 
             level: e.level, 
             date: e.date, 
             type: BADGE_MAPPING[e.level as keyof typeof BADGE_MAPPING] || 'Standard', 
             isAchieved: true 
           });
        }
        return acc;
      }, []);

    // Sort achieved by LEVELS array index
    achieved.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));

    // 2. Identify the "Next" level to show as Locked
    const achievedLevels = achieved.map(a => a.level);
    const lastAchievedIndex = LEVELS.reduce((maxIdx, level, idx) => {
      if (achievedLevels.includes(level)) return Math.max(maxIdx, idx);
      return maxIdx;
    }, -1);

    const nextIndex = lastAchievedIndex + 1;
    if (nextIndex < LEVELS.length) {
      const nextLevel = LEVELS[nextIndex];
      achieved.push({
        id: 'locked-' + nextLevel,
        level: nextLevel,
        date: '',
        type: BADGE_MAPPING[nextLevel as keyof typeof BADGE_MAPPING] || 'Standard',
        isAchieved: false
      });
    }

    return achieved;
  }, [evaluations, id]);
  
  const playerAlarms = useMemo(() => {
    if (player?.isActive === false) return [];
    return reminders.filter(r => r.playerId === id && r.category !== 'Conflict' && r.status === 'Unread');
  }, [reminders, id, player?.isActive]);
  
  const [searchParams] = useSearchParams();
  const [sessionFilter, setSessionFilter] = useState<string | null>(null);
  
  useEffect(() => {
    const pkgId = searchParams.get('activePackageId');
    if (pkgId) setActivePackageId(pkgId);
    
    const filterType = searchParams.get('filter');
    if (filterType === 'regret') setSessionFilter('regret');
    else setSessionFilter(null);
  }, [searchParams]);

  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [editingPackageModal, setEditingPackageModal] = useState<any>(null);
  const [recordingPaymentModal, setRecordingPaymentModal] = useState<any>(null);
  const [editingPaymentModal, setEditingPaymentModal] = useState<any>(null);
  const [showEmailReviewModal, setShowEmailReviewModal] = useState(false);
  const [selectedPaymentForEmail, setSelectedPaymentForEmail] = useState<any>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [showBulkModifyModal, setShowBulkModifyModal] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' } | null>({ key: 'date', direction: 'asc' });

  const handleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };
  
  useEffect(() => {
    if (!player || !id) return;
    
    // Automatically manage financial alarms for this player
    manageFinancialAlarm(
      id,                
      player.name,
      packages || [],
      sessions || [],
      reminders || [],
      addMasterData,                
      updateMasterData,                
      deleteMasterData,
      payments || [],
      pricingSchemes || []
    ).catch(console.error);
  }, [packages, reminders, payments, sessions, pricingSchemes, id, player?.name]);
  
  const playerPackages = useMemo(() => 
    (packages || [])
      .filter(pkg => pkg.playerId === id)
      .sort((a, b) => {
        // Primary sort: Start Date
        const dateCompare = a.startDate.localeCompare(b.startDate);
        if (dateCompare !== 0) return dateCompare;
        // Secondary sort: Package Code (M1, M2 etc) - if present
        // Actually, fallback to Firestore ID
        return (a.id || '').localeCompare(b.id || '');
      }),
    [packages, id]
  );
  
  // Use a ref to track the last known packages length to detect new additions
  const lastPkgsLengthRef = useRef(0);
  const lastIdRef = useRef(id);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryPkgId = params.get('pkgId');

    // 1. If the player changed, reset and pick the last package
    if (id !== lastIdRef.current) {
        setActivePackageId(null);
        lastIdRef.current = id;
        lastPkgsLengthRef.current = playerPackages.length;
        if (queryPkgId && playerPackages.some(p => p.id === queryPkgId)) {
            setActivePackageId(queryPkgId);
        } else if (playerPackages.length > 0) {
            setActivePackageId(playerPackages[playerPackages.length - 1].id!);
        }
        return;
    }

    // 2. Handle pkgId from query param if it exists and is different from activePackageId
    if (queryPkgId && queryPkgId !== activePackageId && playerPackages.some(p => p.id === queryPkgId)) {
        setActivePackageId(queryPkgId);
        return;
    }

    // 3. If we just loaded packages (and didn't have any before)
    if (!activePackageId && playerPackages.length > 0) {
        if (queryPkgId && playerPackages.some(p => p.id === queryPkgId)) {
            setActivePackageId(queryPkgId);
        } else {
            setActivePackageId(playerPackages[playerPackages.length - 1].id!);
        }
    }

    // 4. If a new package was added, auto-select it
    if (playerPackages.length > lastPkgsLengthRef.current && playerPackages.length > 0) {
        setActivePackageId(playerPackages[playerPackages.length - 1].id!);
    }

    lastPkgsLengthRef.current = playerPackages.length;
  }, [id, playerPackages, activePackageId, location.search]);

  const activePackage = useMemo(() => {
    if (!playerPackages || playerPackages.length === 0) return null;
    const found = activePackageId ? playerPackages.find(p => p.id === activePackageId) : null;
    return found || playerPackages[playerPackages.length - 1];
  }, [activePackageId, playerPackages]);

  const currentPackageSessions = useMemo(() => 
    (sessions || []).filter(s => String(s.packageId) === String(activePackage?.id)),
    [sessions, activePackage?.id]
  );

  const [playerVisibleSessions, setPlayerVisibleSessions] = useState<any[]>([]);
  
  useEffect(() => {
    if (sessionFilter === 'regret') {
      setPlayerVisibleSessions(currentPackageSessions.filter(s => ['Regret', 'Exceptional Regret'].includes(s.status)));
    } else {
      setPlayerVisibleSessions(currentPackageSessions);
    }
  }, [currentPackageSessions, sessionFilter]);

  const pkgIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    playerPackages.forEach((pkg, idx) => map.set(String(pkg.id), idx));
    return map;
  }, [playerPackages]);

  const packageTypesMap = useMemo(() => new Map((packageTypes || []).map(t => [String(t.id), t])), [packageTypes]);

  const sessionIndexMap = useMemo(() => {
    const map = new Map<string, string>();
    const sessionsByPackage = new Map<string, any[]>();
    
    // Group all sessions by package
    (sessions || []).forEach(s => {
      const pkgId = String(s.packageId);
      if (!sessionsByPackage.has(pkgId)) sessionsByPackage.set(pkgId, []);
      sessionsByPackage.get(pkgId)!.push(s);
    });

    // For each package, sort and assign indexes
    sessionsByPackage.forEach((pkgSessions, pkgId) => {
      const pkg = packages?.find(p => String(p.id) === pkgId);
      const pkgType = packageTypesMap.get(String(pkg?.packageTypeCode));
      const pkgTypeCode = (pkgType?.code || pkg?.packageTypeCode || 'SES').toUpperCase();
      
      const sorted = [...pkgSessions].sort((a, b) => {
        const dateA = getSortableDate(a.date);
        const dateB = getSortableDate(b.date);
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        if (a.startTime !== b.startTime) return (a.startTime || '').localeCompare(b.startTime || '');
        return String(a.id).localeCompare(String(b.id));
      });
      sorted.forEach((s, idx) => {
        // Force calculation based on date order for total consistency
        // Use session's own type code if set, otherwise fallback to package type code
        const sessionPrefix = s.sessionIndex?.split('-')[0] || pkgTypeCode;
        const label = `${sessionPrefix}-${idx + 1}`;
        map.set(String(s.id), label);
      });
    });
    return map;
  }, [sessions, packages, packageTypesMap]);

  const sortedSessions = useMemo(() => {
    let sortedData = [...currentPackageSessions];
    if (sortConfig !== null) {
        sortedData.sort((a: any, b: any) => {
            const key = sortConfig.key;
            let valA: any = a[key] || '';
            let valB: any = b[key] || '';

            if (key === 'date') {
                valA = getSortableDate(a.date);
                valB = getSortableDate(b.date);
            } else if (key === 'time') {
                 valA = a.startTime || '';
                 valB = b.startTime || '';
            } else if (key === 'location') {
                 valA = locations.find(l => l.id === a.locationId)?.name || '';
                 valB = locations.find(l => l.id === b.locationId)?.name || '';
            } else if (key === 'status') {
                 valA = a.status || '';
                 valB = b.status || '';
            } else if (key === 'session') {
                 const splitA = (a.sessionIndex || 'SES-0').split('-');
                 const splitB = (b.sessionIndex || 'SES-0').split('-');
                 const prefixA = splitA[0] || '';
                 const prefixB = splitB[0] || '';
                 const numA = parseInt(splitA[1] || '0');
                 const numB = parseInt(splitB[1] || '0');
                 
                 if (prefixA !== prefixB) {
                    valA = prefixA;
                    valB = prefixB;
                 } else {
                    valA = numA;
                    valB = numB;
                 }
            } else if (key === 'package') {
                 valA = pkgIndexMap.get(a.packageId) ?? -1;
                 valB = pkgIndexMap.get(b.packageId) ?? -1;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            
            // Tie-breaker: sessionIndex
            const splitA = (a.sessionIndex || 'SES-0').split('-');
            const splitB = (b.sessionIndex || 'SES-0').split('-');
            const numA = parseInt(splitA[1] || '0');
            const numB = parseInt(splitB[1] || '0');
            return numA - numB;
        });
    } else {
         sortedData.sort((a: any, b: any) => {
            const splitA = (a.sessionIndex || 'SES-0').split('-');
            const splitB = (b.sessionIndex || 'SES-0').split('-');
            const numA = parseInt(splitA[1] || '0');
            const numB = parseInt(splitB[1] || '0');
            return numA - numB;
        });
    }
    return sortedData;
  }, [currentPackageSessions, sortConfig, locations, pkgIndexMap]);

  const getPricing = useCallback((pkgCode: string, nSessions: number, monthInput: string) => {
    const s = findBestPricingScheme(pricingSchemes, pkgCode, nSessions, monthInput);
    return {
      sessionValue: s?.sessionValue || 0,
      sessionCost: s?.sessionCost || 0
    };
  }, [pricingSchemes]);

  const { derivedBaseAmount, derivedTotalDue, derivedTotalDiscount } = useMemo(() => {
    return calculatePackageValues(activePackage, currentPackageSessions, pricingSchemes, activePackage?.forceSystemPricing || false);
  }, [activePackage, currentPackageSessions, pricingSchemes]);

  const activePackagePayments = useMemo(() => 
    payments.filter((p: any) => String(p.packageId) === String(activePackage?.id)).sort((a: any, b: any) => (a.date || '').localeCompare(b.date || '')),
    [payments, activePackage?.id]
  );
  
  const realPaidAmount = useMemo(() => {
    const fromPayments = activePackagePayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    return fromPayments > 0 ? fromPayments : (activePackage?.paidAmount || 0);
  }, [activePackagePayments, activePackage?.paidAmount]);
  
  const isContractOutOfSync = activePackage && Math.abs(derivedTotalDue - (activePackage?.totalDue || 0)) > 1;

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeletePackage, setConfirmDeletePackage] = useState<string | null>(null);
  const [confirmDeleteEvalId, setConfirmDeleteEvalId] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);
  const [editingPlayerModal, setEditingPlayerModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [showScheduleReport, setShowScheduleReport] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [showInactiveWarning, setShowInactiveWarning] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [isRedoMode, setIsRedoMode] = useState(false);
  const [showGauges, setShowGauges] = useState(true);

  const handleDeletePlayer = async () => {
    if (deleteStep < 2) {
      setDeleteStep(prev => prev + 1);
      return;
    }
    
    try {
      await deleteMasterData('players', player.id!);
      navigate('/players');
    } catch (error) {
      console.error("Failed to delete player", error);
      alert("CRITICAL: DELETE OPERATION DENIED (Security Rules)");
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (confirmDeletePackage !== packageId) {
      setConfirmDeletePackage(packageId);
      return;
    }
    
    try {
      // Also delete sessions of this package
      const packageSessions = sessions.filter(s => s.packageId === packageId);
      for (const s of packageSessions) {
        await deleteMasterData('sessions', s.id!);
      }
      await deleteMasterData('packages', packageId);
      setConfirmDeletePackage(null);
      if (activePackageId === packageId) setActivePackageId(playerPackages.find(p => p.id !== packageId)?.id || null);
    } catch (error: any) {
      console.error("Failed to delete package", error);
      alert("Failed to delete package. Please check permissions or try again.");
    }
  };

  const handleUpdateSessionComment = async (sessionId: string, comment: string) => {
    try {
      await updateMasterData('sessions', sessionId, { comment });
    } catch (error) {
      console.error("Update session comment failed", error);
    }
  };

  const handleAddManualSession = async () => {
    if (!activePackage) return;
    setShowAddSessionModal(true);
  };

  const handleEmailSchedule = () => {
    if (!player) return;
    setShowEmailModal(true);
  };

  const handleSendPaymentEmail = (payment: any, e?: React.MouseEvent) => {
    console.log('handleSendPaymentEmail called with payment:', payment);
    console.log('Player object:', player);
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    setSelectedPaymentForEmail(payment);
    setShowEmailReviewModal(true);
  };

  const handleAutoScheduleClick = async (count: number) => {
    if (!activePackage) return;
    
    if (window.confirm(`Do you want to use the same schedule pattern from previous sessions to schedule the remaining ${count} sessions?\n\nOK = Auto generate, Cancel = Open add session manual flow`)) {
       const patterns = new Set<string>();
       currentPackageSessions.forEach((s: any) => {
           if (s.date && s.startTime) {
               const d = new Date(`${s.date}T12:00:00`);
               patterns.add(`${d.getDay()}|${s.startTime}`);
           }
       });
       
       let weeklySlots = Array.from(patterns).map(p => {
           const [day, time] = p.split('|');
           return { day: Number(day), time };
       });
       if (weeklySlots.length === 0) weeklySlots = [{ day: 6, time: '17:00' }]; // Sat 17:00 default
       
       let start = new Date();
       if (currentPackageSessions && currentPackageSessions.length > 0) {
           const sorted = [...currentPackageSessions].sort((a:any, b:any) => a.date.localeCompare(b.date));
           const lastDateStr = sorted[sorted.length - 1].date;
           if (lastDateStr) {
               start = new Date(`${lastDateStr}T12:00:00`);
               start = addDays(start, 1);
           }
       }

       let current = start;
       let finalSessions: {date: string, time: string}[] = [];
       // Find next scheduled days
       while (finalSessions.length < count) {
          const dayOfWeek = current.getDay();
          const slot = weeklySlots.find(s => Number(s.day) === dayOfWeek);
          if (slot) {
            finalSessions.push({
              date: format(current, 'yyyy-MM-dd'),
              time: slot.time
            });
          }
          current = addDays(current, 1);
          if (finalSessions.length > 200) break; // safety
       }
       
       const pkgCode = activePackage?.packageTypeCode;
       const nSessions = activePackage?.numSessions || 8;
       const monthToUse = activePackage?.effectiveMonth || new Date().toISOString().slice(0, 7);

       const scheme = pricingSchemes.find((s: any) => 
         s.packageTypeCode === pkgCode && 
         s.numSessions === nSessions &&
         s.effectiveMonth === monthToUse
       ) || pricingSchemes.filter((s:any) => 
         s.packageTypeCode === pkgCode && 
         s.numSessions === nSessions
       ).sort((a:any,b:any) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]
       || pricingSchemes.filter((s:any) => 
         s.packageTypeCode === pkgCode
       ).sort((a:any,b:any) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];

       const sessionValue = scheme ? scheme.sessionValue : 0;
       const sessionCost = scheme ? (scheme.sessionCost || 0) : 0;
       
       const sorted = [...currentPackageSessions].sort((a:any,b:any) => b.date.localeCompare(a.date));
       const lastSessionLocationId = sorted.length > 0 ? sorted[0].locationId : player?.locationId || '';

       let totalAddedValue = 0;
       for (let i = 0; i < finalSessions.length; i++) {
         const session = finalSessions[i];
         
         await addMasterData('sessions', {
          packageId: activePackage?.id!,
          playerId: player!.id!,
          groupId: player!.groupId || '',
          date: session.date, 
          startTime: session.time || '17:00',
          status: 'Scheduled',
          locationId: lastSessionLocationId,
          sessionIndex: `${activePackage?.packageTypeCode}-${currentPackageSessions.length + 1 + i}`,
          value: sessionValue,
          cost: sessionCost,
          discount: 0
         });
         totalAddedValue += sessionValue;
       }

       const newBase = (activePackage.baseAmount || 0) + totalAddedValue;
       await updateMasterData('packages', activePackage.id!, {
         baseAmount: newBase,
         totalDue: newBase - (activePackage.discountAmount || 0)
       });
    } else {
       setShowAddSessionModal(true);
    }
  };

  const totalPending = useMemo(() => {
    return playerPackages.reduce((acc, pkg) => {
      const pkgSessions = (sessions || []).filter(s => String(s.packageId) === String(pkg.id));
      let derivedValue = 0;
      
      const nSessions = Number(pkg?.numSessions || 8);
      const effectiveMonth = pkg.effectiveMonth || pkg.createdAt?.slice(0, 7) || new Date().toISOString().slice(0, 7);

      if (pkgSessions.length > 0) {
        derivedValue = pkgSessions.reduce((sAcc, s) => {
          if (s.status === 'Cancelled') return sAcc;
          
          const prefix = s.sessionIndex && s.sessionIndex.includes('-') 
            ? s.sessionIndex.split('-')[0].toUpperCase() 
            : '';
          const isPrefixValid = pricingSchemes.some(ps => ps.packageTypeCode === prefix);
          const sCode = isPrefixValid ? prefix : pkg.packageTypeCode;
          
          const scheme = findBestPricingScheme(pricingSchemes, sCode, nSessions, effectiveMonth);
          const val = (pkg.forceSystemPricing || s.value === undefined || s.value === null || s.value === 0)
            ? (scheme?.sessionValue || 0)
            : Number(s.value);
          return sAcc + val;
        }, 0);
        derivedValue -= (pkg.discountAmount || 0);
      } else {
        const scheme = findBestPricingScheme(pricingSchemes, pkg.packageTypeCode, nSessions, effectiveMonth);
        const fallbackVal = scheme?.sessionValue || 0;
        derivedValue = (fallbackVal * nSessions) - (pkg.discountAmount || 0);
      }

      const finalDue = Math.max(derivedValue, Number(pkg.totalDue || 0));
      const pending = Math.max(0, finalDue - (pkg.paidAmount || 0));
      
      // Skip 'Paid' or 'Free' packages
      if (pkg.status === 'Paid' || pkg.status === 'Free' || pending <= 0.01) return acc;
      
      return acc + pending;
    }, 0);
  }, [playerPackages, sessions, pricingSchemes]);

  const levelName = levels.find(l => l.id === player?.levelId)?.name || 'N/A';
  const locationName = locations.find(l => l.id === player?.locationId)?.name || 'N/A';
  const groupRecord = groups.find(g => g.id === player?.groupId);
  const groupName = groupRecord ? (groupRecord.code ? `${groupRecord.code} . ${groupRecord.name}` : groupRecord.name) : 'Captain';


  const isExcluded = React.useCallback((status: string | undefined | null) => {
    if (!status) return true;
    const EXCLUDED = ['Cancelled', 'Hold', 'Regret', 'Exceptional Regret'];
    return EXCLUDED.includes(status);
  }, []);

  const overallAttendancePercentage = useMemo(() => {
    const playerPackageIds = new Set(playerPackages.map(p => p.id));
    const relevantSessions = sessions.filter(s => playerPackageIds.has(s.packageId));
    
    const attended = relevantSessions.filter(s => s.status === 'Attended').length;
    const compensated = relevantSessions.filter(s => s.status === 'Compensated' || s.status === 'Attended Comp. Session').length;
    
    // Valid sessions are those NOT in the excluded list (Scheduled, Cancelled, etc.)
    const validSessions = relevantSessions.filter(s => !isExcluded(s.status)).length;
    
    return validSessions > 0 ? Math.round(((attended + compensated) / validSessions) * 100) : 100;
  }, [sessions, playerPackages, isExcluded]);

  const memberSince = useMemo(() => {
    if (playerPackages.length === 0) return '2025-12-10';
    return playerPackages[0].startDate || '2025-12-10';
  }, [playerPackages]);

  const attendedCountTotal = useMemo(() => currentPackageSessions.filter(s => s.status === 'Attended').length, [currentPackageSessions]);
  const compensatedCountTotal = useMemo(() => currentPackageSessions.filter(s => s.status === 'Compensated' || s.status === 'Attended Comp. Session').length, [currentPackageSessions]);
  
  // Valid sessions are those NOT in the excluded list (Scheduled, Cancelled, etc.)
  const activePkgSessionsList = useMemo(() => currentPackageSessions.filter(s => !isExcluded(s.status)), [currentPackageSessions, isExcluded]);
  const activePkgSessions = activePkgSessionsList.length;
  
  // If the user wants 100% for 4/4, the target should be the count of valid recorded sessions.
  const packageTarget = activePkgSessions || 0;
  // The actual contract size
  const contractTotalSessions = Number(activePackage?.numSessions || 0);

  const attendancePercentage = contractTotalSessions > 0 ? Math.round(((attendedCountTotal + compensatedCountTotal) / contractTotalSessions) * 100) : 0;
    
    const regretsCount = useMemo(() => currentPackageSessions.filter(s => s.status === 'Regret' || s.status === 'Exceptional Regret').length, [currentPackageSessions]);
    const absentCount = useMemo(() => currentPackageSessions.filter(s => s.status === 'Absent').length, [currentPackageSessions]);
    const cancelledCount = useMemo(() => currentPackageSessions.filter(s => s.status === 'Cancelled').length, [currentPackageSessions]);
    const pendingCount = useMemo(() => currentPackageSessions.filter(s => s.status === 'Scheduled').length, [currentPackageSessions]);
    const consumedSessionsCount = useMemo(() => currentPackageSessions.filter(s => s.status !== 'Cancelled' && s.status !== 'Hold').length, [currentPackageSessions]);
    const toScheduleCount = useMemo(() => {
        if (!activePackage) return 0;
        const totalContract = Number(activePackage?.numSessions || 0);
        // User's formula: attended + absent + pending (Scheduled) = target
        const consumedAndScheduled = currentPackageSessions.filter(s => 
          ['Attended', 'Compensated', 'Attended Comp. Session', 'Scheduled', 'Absent'].includes(s.status)
        ).length;
        
        return Math.max(0, totalContract - consumedAndScheduled);
    }, [currentPackageSessions, activePackage]);

    const isReadyForRenewal = useMemo(() => {
      if (player?.isActive === false || !activePackage) return false;
      return toScheduleCount === 0 && pendingCount <= 1;
    }, [toScheduleCount, pendingCount, activePackage, player?.isActive]);
    

    const stats = useMemo(() => {
      const baseStats = [
        { label: 'ATTENDED', count: attendedCountTotal + compensatedCountTotal, subLabel: `COMP: ${compensatedCountTotal}`, percentage: `${attendancePercentage}%`, color: 'bg-emerald-500/10 text-emerald-500' },
        { label: 'REGRETS', count: regretsCount, color: 'bg-amber-500/10 text-amber-500' },
        { label: 'ABSENT', count: absentCount, color: 'bg-red-500/10 text-red-500' },
        { label: 'CANCELLED', count: cancelledCount, color: 'bg-slate-500/10 text-slate-500' },
        { label: 'PENDING', count: pendingCount, color: 'bg-orange-500/10 text-orange-500' },
      ];
      if (toScheduleCount > 0) {
        baseStats.push({ label: 'TO SCHEDULE', count: toScheduleCount, color: 'bg-red-500/10 text-red-500 border border-red-500/30' });
      }
      return baseStats;
    }, [attendedCountTotal, compensatedCountTotal, attendancePercentage, regretsCount, absentCount, cancelledCount, pendingCount, toScheduleCount]);

    const alarmsCount = useMemo(() => {
      const filteredAlarms = playerAlarms.filter(r => r.category === 'Financial' || r.category === 'Renew');
      const isFinancialStillValid = totalPending > 0.01;
      const isRenewStillValid = isReadyForRenewal === true;
      
      const unreadFinancial = filteredAlarms.filter(r => r.category === 'Financial' && isFinancialStillValid);
      const unreadRenew = filteredAlarms.filter(r => r.category === 'Renew' && isRenewStillValid);
      
      const hasFinancialInUnread = filteredAlarms.some(r => r.category === 'Financial');
      const hasRenewInUnread = filteredAlarms.some(r => r.category === 'Renew');
      
      const dynamicFinancial = (!hasFinancialInUnread && isFinancialStillValid) ? 1 : 0;
      const dynamicRenew = (!hasRenewInUnread && isRenewStillValid) ? 1 : 0;
      
      return unreadFinancial.length + unreadRenew.length + dynamicFinancial + dynamicRenew;
    }, [playerAlarms, totalPending, isReadyForRenewal]);

    const sessionGroupStats = useMemo(() => {
      const gStats: Record<string, number> = {};
      currentPackageSessions.forEach(s => {
        if (s.status === 'Cancelled' || s.status === 'Hold') return;
        let prefix = s.sessionIndex ? s.sessionIndex.split('-')[0].toUpperCase().trim() : 'SES';
        gStats[prefix] = (gStats[prefix] || 0) + 1;
      });
      return gStats;
    }, [currentPackageSessions]);

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Clock className="animate-spin text-blue-500" size={32} />
        <p className="text-slate-500 font-black uppercase tracking-widest text-lg">Synchronizing Athlete Profile...</p>
        <Link to="/players" className="text-white bg-slate-800 px-4 py-2 rounded-lg text-lg font-black uppercase mt-4">Return to Roster</Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <datalist id="status-opts">
        <option value="Scheduled" />
        <option value="Absent" />
        <option value="Attended" />
        <option value="Compensated" />
        <option value="Exceptional Regret" />
        <option value="Regret" />
        <option value="Cancelled" />
        <option value="Hold" />
      </datalist>
      {/* Top Navigation */}
      <div className="flex items-center gap-3 mb-8">
        <button 
          onClick={() => navigate('/players')}
          className="flex items-center gap-2 h-10 px-4 bg-slate-900 text-slate-400 rounded-xl border-2 border-slate-800 hover:text-white hover:border-slate-700 transition font-black uppercase text-sm md:text-lg tracking-widest"
        >
          <ArrowLeft size={16} />
          Players
        </button>
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 h-10 px-4 bg-slate-900 text-slate-400 rounded-xl border-2 border-slate-800 hover:text-white hover:border-slate-700 transition font-black uppercase text-sm md:text-lg tracking-widest"
        >
          <Clock size={16} />
          Home
        </button>
      </div>

      {isReadyForRenewal && (
        <div className={cn(
          "p-6 rounded-[2rem] flex items-center justify-between mb-8 shadow-bento animate-bounce-slow border-2",
          pendingCount === 0 ? "bg-red-600/10 border-red-500/50" : "bg-blue-600/10 border-blue-500/50"
        )}>
            <div>
              <h2 className={cn("font-black text-base md:text-lg uppercase tracking-tighter", pendingCount === 0 ? "text-red-500" : "text-blue-500")}>Invoice Renewal Alert</h2>
              <p className={cn("font-bold text-[10px] md:text-xs uppercase mt-1", pendingCount === 0 ? "text-red-400/80" : "text-blue-400/80")}>
                {pendingCount === 0 
                  ? 'Renewal Required: last package is fully consumed.' 
                  : 'This athlete has only 1 session remaining. Please renew the invoice for the next package.'}
              </p>
            </div>
            <button 
               onClick={() => setShowGenerateModal(true)}
               className={cn("text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-black uppercase text-xs md:text-sm tracking-widest shadow-bento transition", pendingCount === 0 ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500")}
            >
               Issue New Invoice
            </button>
        </div>
      )}

      {toScheduleCount > 0 && player?.isActive !== false && (
        <div className="bg-red-600/10 border-2 border-red-500/50 p-6 rounded-[2rem] flex items-center justify-between mb-8 shadow-bento animate-bounce-slow">
            <div>
              <h2 className="text-red-500 font-black text-base md:text-lg uppercase tracking-tighter">Schedule Sessions Alert</h2>
              <p className="text-red-400/80 font-bold text-[10px] md:text-xs uppercase mt-1">
                This athlete has {toScheduleCount} session{toScheduleCount > 1 ? 's' : ''} remaining in their current package that {toScheduleCount > 1 ? 'are' : 'is'} not yet scheduled.
              </p>
            </div>
            <button 
               onClick={() => handleAutoScheduleClick(toScheduleCount)}
               className="bg-red-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-black uppercase text-xs md:text-sm tracking-widest shadow-bento hover:bg-red-500 transition"
            >
              Schedule Now
            </button>
        </div>
      )}

      {/* Profile Header */}
      <div className="flex flex-col xl:flex-row gap-8 items-start justify-between bg-slate-900/30 p-8 rounded-[2.5rem] border-2 border-slate-800 shadow-bento">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div 
            className={cn("h-20 w-20 rounded-full flex items-center justify-center font-black text-3xl border-4 shrink-0 shadow-bento text-white", !groupRecord?.color ? "bg-slate-950 border-slate-800" : "")}
            style={groupRecord ? { backgroundColor: getGroupColor(groupRecord.id!, groupRecord.color), borderColor: `${getGroupColor(groupRecord.id!, groupRecord.color)}80`, boxShadow: `0 0 20px ${getGroupColor(groupRecord.id!, groupRecord.color)}40` } : undefined}
          >
            {player.name.charAt(0)}
          </div>
          <div className="text-center md:text-left">
            {groupName && <div className="mb-2 text-blue-400 uppercase text-xs md:text-sm tracking-widest leading-none">{groupName}</div>}
            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none flex flex-wrap items-center justify-center md:justify-start gap-4">
              <span className="truncate">C. {toTitleCase(player.name)}</span>
              {alarmsCount > 0 && <button onClick={() => navigate('/reminders', { state: { playerId: id } })} className="relative ml-2" title="Alarms and Reminders"><Bell className="text-red-500 animate-pulse" /><span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">{alarmsCount}</span></button>}
              {player.isActive === false && <span className="shrink-0 px-2 py-1 rounded text-sm bg-red-500/20 text-red-500 tracking-widest uppercase border border-red-500/30">Inactive</span>}
            </h1>
            <p className="text-slate-400 mt-3 uppercase text-[10px] md:text-xs tracking-widest space-x-2">
              <span>{player.phone || 'No phone'}</span>
              <span>·</span>
              <span>{levelName}</span>
              <span>·</span>
              <span>{locationName}</span>
              <span>·</span>
              <span>Since {memberSince}</span>
              <span>·</span>
              <span className="text-blue-400">{overallAttendancePercentage}% overall</span>
            </p>
            {player.hasParent && (
              <p className="text-slate-400 mt-2 uppercase text-[10px] md:text-xs tracking-widest space-x-2">
                <span className="text-blue-400">Guardian: {toTitleCase(player.parentName)}</span>
                {player.parentPhone && <span>· {player.parentPhone}</span>}
                {player.parentEmail && <span className="lowercase">· {player.parentEmail}</span>}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-center xl:self-start relative">
          {currentUserRole?.role !== 'visitor' && (
            <>
              <button onClick={() => setEditingPlayerModal(true)} className="flex items-center gap-2 h-10 px-5 bg-white text-slate-950 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-slate-100 transition shadow-bento"><Edit2 size={14} /> Edit Profile</button>
              <button onClick={() => setShowScheduleReport(true)} className="flex items-center gap-2 h-10 px-5 bg-emerald-600 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-emerald-500 transition shadow-bento"><FileText size={14} /> Schedule Report</button>
              <button onClick={handleEmailSchedule} className="flex items-center gap-2 h-10 px-5 bg-blue-600 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-blue-500 transition shadow-bento">
                 <Mail size={14} />
                 Email Schedule
              </button>
              <button onClick={() => setShowNotesModal(true)} className="flex items-center justify-center h-10 w-10 bg-slate-800 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-slate-700 transition shadow-bento" title="Athlete Notes">
                 <FileText size={16} />
              </button>
              <button 
                 onClick={() => navigate(`/team-messages?playerId=${player!.id}`)} 
                 className="flex items-center justify-center h-10 w-10 bg-blue-500/10 text-blue-400 border-2 border-blue-500/20 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-500/10 hover:border-blue-600 transition shadow-bento" 
                 title="Send Message to Player"
              >
                 <Mail size={16} />
              </button>
              <button onClick={() => alert("FINANCIAL REPORT COMPILATION IN PROGRESS...")} className="flex items-center gap-2 h-10 px-5 bg-amber-500/10 text-amber-500 border-2 border-amber-500/50 rounded-xl font-black uppercase text-sm tracking-widest hover:bg-amber-500 hover:text-white transition shadow-sm"><CreditCard size={14} /> Financial Report</button>
              
              <div className="flex gap-2">
                <div className="flex items-center gap-3 bg-slate-900 border-2 border-slate-800 rounded-xl px-4 h-10 shadow-bento">
                   <span className={cn("text-[10px] font-bold uppercase tracking-widest", player?.isActive !== false ? "text-slate-300" : "text-slate-600")}>Active</span>
                   <button
                     type="button"
                     onClick={async () => {
                       await updateMasterData('players', player!.id!, { isActive: player?.isActive === false ? true : false });
                     }}
                     className={cn(
                       "relative inline-flex items-center h-5 rounded-full w-9 transition-colors duration-200 ease-in-out px-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500",
                       player?.isActive !== false ? "bg-emerald-500" : "bg-red-500"
                     )}
                   >
                     <div
                       className={cn(
                         "h-4 w-4 bg-white rounded-full transition-transform duration-200 ease-in-out shadow-sm",
                         player?.isActive !== false ? "transform translate-x-[1.15rem]" : "transform translate-x-0"
                       )}
                     />
                   </button>
                   <span className={cn("text-[10px] font-bold uppercase tracking-widest", player?.isActive === false ? "text-red-500" : "text-slate-600")}>Inactive</span>
                </div>
                {deleteStep > 0 ? (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-right-2">
                    <button 
                      onClick={handleDeletePlayer}
                      className="bg-red-600 text-white h-10 px-6 rounded-xl font-black uppercase text-sm tracking-widest shadow-bento border-2 border-red-500"
                    >
                      {deleteStep === 1 ? "ARE YOU SURE?" : "CONFIRM FINAL DELETE"}
                    </button>
                    <button 
                      onClick={() => setDeleteStep(0)}
                      className="bg-slate-800 text-white h-10 px-4 rounded-xl font-black uppercase text-sm tracking-widest"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setDeleteStep(1)}
                    className="flex items-center gap-2 h-10 px-5 bg-red-600 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-red-500 transition shadow-bento"
                  >
                    <Trash2 size={14} /> Delete Profile
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showNotesModal && <PlayerNotesModal player={player} onClose={() => setShowNotesModal(false)} />}

      {/* Package Tabs */}
      <div id="packages" className="flex flex-wrap items-center gap-4">
        {playerPackages.map((pkg, idx) => (
          <div key={pkg.id} className="relative group">
            <div
               onClick={() => {
                 setActivePackageId(pkg.id!);
               }}
               className={cn(
                 "flex flex-col items-start p-4 rounded-xl border-2 transition-all min-w-[140px] cursor-pointer",
                 activePackage?.id === pkg.id 
                  ? "bg-slate-900 border-blue-500 shadow-bento translate-y-[-2px]" 
                  : "bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-400"
               )}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className={cn("text-sm md:text-base font-black uppercase tracking-tight", activePackage?.id === pkg.id ? "text-white" : "text-slate-400")}>M{idx + 1}</span>
                {currentUserRole?.role !== 'visitor' && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {confirmDeletePackage === pkg.id ? (
                      <div className="flex gap-1 animate-in fade-in scale-95 origin-right">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeletePackage(pkg.id!); }}
                          className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase rounded shadow-sm border border-red-500"
                        >
                          CONFIRM DELETE
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setConfirmDeletePackage(null); }}
                          className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-black uppercase rounded shadow-sm"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setEditingPackageModal(pkg); }} className="p-1 hover:bg-slate-800 rounded transition text-slate-400"><Edit2 size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeletePackage(pkg.id!); }} className="p-1 hover:bg-red-900/50 rounded transition text-red-500"><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                )}
              </div>
                <span className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest">
                  {packageTypes.find(t => t.code === pkg.packageTypeCode)?.name} · 
                  {pkg?.numSessions || 0} sessions · 
                  {Math.max(0, (pkg?.numSessions || 0) - sessions.filter(s => s.packageId === pkg.id && ['Attended', 'Compensated', 'Attended Comp. Session', 'Scheduled', 'Absent', 'Regret', 'Exceptional Regret'].includes(s.status)).length)} pending
                </span>
            </div>
          </div>
        ))}
        {currentUserRole?.role !== 'visitor' && (
          <button 
            onClick={() => {
              if (player.isActive === false) {
                setShowInactiveWarning(true);
              } else {
                setShowGenerateModal(true);
              }
            }}
            className="flex items-center gap-2 h-14 px-6 rounded-xl border-2 border-emerald-500/50 text-emerald-500 font-black uppercase text-sm tracking-widest hover:bg-emerald-500/10 transition shadow-sm"
          >
            <Plus size={16} strokeWidth={3} /> New Package
          </button>
        )}
      </div>

      {activePackage && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Active Package Strip */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-emerald-500/5 p-4 rounded-[1rem] border-2 border-emerald-500/20">
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <span className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest block mb-1">Group:</span>
                <div className="flex items-center gap-2">
                   {groupRecord && (
                      <div className="h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: getGroupColor(groupRecord.id!, groupRecord.color) }} />
                   )}
                   <span className="text-base md:text-lg text-slate-300">{groupName}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest block mb-1">Type:</span>
                <span className="text-base md:text-lg text-slate-300 uppercase">{packageTypes.find(t => t.code === activePackage?.packageTypeCode)?.name}</span>
              </div>
              <div>
                <span className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest block mb-1">Players/Session:</span>
                <span className="text-base md:text-lg text-slate-300 uppercase">2</span>
              </div>
            </div>
            {currentUserRole?.role !== 'visitor' && ((derivedTotalDue - realPaidAmount) > 0.01 ? (
              <button 
                onClick={() => setRecordingPaymentModal(activePackage)}
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-black uppercase shadow-bento hover:bg-orange-400 transition"
              >
                 <CreditCard size={14} />
                 Pay / Record Remittance
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-sm font-black uppercase border border-emerald-500/30">
                 <Check size={14} />
                 Fully Paid
              </div>
            ))}
          </div>

          {/* Table Header Section */}
          {selectedSessionIds.size > 0 && (
            <div className="bg-slate-900/80 p-4 border-b-2 border-slate-800 flex items-center justify-between gap-4">
              <span className="text-sm font-black uppercase text-blue-400 tracking-widest">{selectedSessionIds.size} Sessions Selected</span>
              <div className="flex flex-wrap gap-2">
                 <button 
                   onClick={() => setShowBulkModifyModal(true)}
                   className="text-xs font-bold text-white uppercase tracking-widest px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
                 >
                   bulk edit
                 </button>
                {confirmDeleteSelected ? (
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={async (e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         const idsToDelete = Array.from(selectedSessionIds);
                         if (idsToDelete.length === 0) return;
                         
                         try {
                           let baseReduction = 0;
                           const getPricingFallback = (code: string, pkg: any) => {
                             const monthToUse = pkg?.effectiveMonth || new Date().toISOString().slice(0, 7);
                             const nSessions = pkg?.numSessions || 8;
                             const scheme = pricingSchemes.find(s => 
                               s.packageTypeCode === code && 
                               s.numSessions === nSessions &&
                               s.effectiveMonth === monthToUse
                             ) || pricingSchemes.filter(s => 
                               s.packageTypeCode === code && 
                               s.numSessions === nSessions
                             ).sort((a,b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]
                             || pricingSchemes.filter(s => 
                               s.packageTypeCode === code
                             ).sort((a,b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
                             return scheme?.sessionValue || 0;
                           };

                           for (const id of idsToDelete) {
                             const s = sessions.find(sess => String(sess.id) === String(id));
                             if (s) {
                               if (s.value !== undefined && s.value !== null && s.value !== 0) {
                                 baseReduction += Number(s.value);
                               } else if (activePackage) {
                                 const sCode = s.sessionIndex?.split('-')[0] || activePackage.packageTypeCode;
                                 baseReduction += getPricingFallback(sCode, activePackage);
                               }
                             }
                             await deleteMasterData('sessions', id);
                           }
                           
                           if (activePackage) {
                             const newBase = Math.max(0, (activePackage.baseAmount || 0) - baseReduction);
                             await updateMasterData('packages', activePackage.id!, {
                               baseAmount: newBase,
                               totalDue: newBase - (activePackage.discountAmount || 0)
                             });
                           }

                           setSelectedSessionIds(new Set());
                           setConfirmDeleteSelected(false);
                         } catch (err) {
                           console.error("DEBUG: Deletion error", err);
                         }
                      }}
                      className="text-xs font-bold text-white uppercase tracking-widest px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button 
                      type="button"
                      onClick={() => setConfirmDeleteSelected(false)} 
                      className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-2 hover:bg-slate-800 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button 
                      type="button"
                      onClick={() => setConfirmDeleteSelected(true)}
                      className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-2 hover:bg-red-600 hover:text-white rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                    <button 
                      onClick={() => setSelectedSessionIds(new Set())} 
                      className="text-xs font-bold text-slate-500 uppercase tracking-widest px-4 py-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-bento">
            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SESSION SUMMARY BY GROUP TYPE</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">VISUAL:</span>
                  <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                    <button 
                      onClick={() => setShowGauges(true)}
                      className={cn(
                        "px-2 py-1 rounded text-[9px] font-black uppercase transition-all",
                        showGauges ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Gauge
                    </button>
                    <button 
                      onClick={() => setShowGauges(false)}
                      className={cn(
                        "px-2 py-1 rounded text-[9px] font-black uppercase transition-all",
                        !showGauges ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      Classic
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12px] uppercase font-bold">
                 {currentUserRole?.role !== 'visitor' && (
                   <button 
                     onClick={handleAddManualSession}
                     className="bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg border border-blue-600/30 transition flex justify-center items-center gap-2 text-[10px]"
                   >
                     <Plus size={10} strokeWidth={3} />
                     ADD SESSION
                   </button>
                 )}
                 {Object.entries(sessionGroupStats).map(([prefix, count], idx) => {
                   let label = prefix;
                    if (prefix === 'P' || prefix === 'PVT') label = 'PVT';
                    else if (prefix.includes('GROUP OF 2') || prefix === 'G2') label = 'G2';
                    else if (prefix.includes('GROUP OF 3') || prefix === 'G3') label = 'G3';
                    else if (prefix.match(/GROUP OF \d+/i)) {
                      const match = prefix.match(/GROUP OF (\d+)/i);
                      label = 'G' + (match ? match[1] : prefix);
                    }
                   
                   return (
                     <React.Fragment key={prefix}>
                       {idx > 0 && <span className="text-slate-600 font-normal">-</span>}
                       <span className="text-slate-100 uppercase tracking-widest">
                         {label}: <span className="text-emerald-500">[{count}]</span>
                       </span>
                     </React.Fragment>
                   )
                 })}
                 <span className="text-slate-600 font-normal">-</span>
                 <div className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 text-[12px]">
                    Total Sessions: <span className="text-white">[{consumedSessionsCount}/{contractTotalSessions || packageTarget}]</span>
                 </div>
              </div>
            </div>

            {/* Status Grid */}
            <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800", stats.length === 6 ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
               {stats.map((stat, i) => (
                 <div 
                    key={`stat-${i}`} 
                    className={cn(
                      "p-4 flex flex-col items-start bg-slate-900 group transition-colors", 
                      i === 0 && "!bg-emerald-500/5",
                      stat.label === 'TO SCHEDULE' ? "cursor-pointer hover:bg-red-500/20" : "cursor-default"
                    )}
                    onClick={() => {
                        if (stat.label === 'TO SCHEDULE') {
                            handleAutoScheduleClick(stat.count);
                        }
                    }}
                 >
                    {i === 0 ? (
                      <div className="flex flex-row items-start gap-6 w-full">
                        <div className="flex flex-col">
                           <div className="flex items-center gap-2">
                             <span className={cn("text-[10px] md:text-xs font-black tracking-widest uppercase", stat.color.split(' ')[1])}>{stat.label}</span>
                           </div>
                           <span className={cn("text-xl md:text-3xl font-black mt-1", stat.color.split(' ')[1])}>{stat.count}</span>
                        </div>
                        {stat.subLabel && (
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className={cn("text-[10px] md:text-xs font-black tracking-widest text-blue-500 uppercase")}>Comp</span>
                                </div>
                                <span className={cn("text-xl md:text-3xl font-black mt-1 text-blue-500")}>{stat.subLabel.split(': ')[1]}</span>
                            </div>
                        )}
                        {stat.percentage && (
                           showGauges ? (
                             <div className="flex flex-col items-start justify-start">
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-widest">Attnd%</span>
                                 <span className="text-[10px] md:text-xs font-normal tracking-title" style={{ color: attendancePercentage >= 80 ? '#10b981' : attendancePercentage >= 50 ? '#3b82f6' : '#ef4444' }}>{stat.percentage}</span>
                               </div>
                               <div className="mt-1 w-full flex items-center justify-center">
                                 <Speedometer value={attendancePercentage} size={50} />
                               </div>
                             </div>
                           ) : (
                             <span className={cn("text-[10px] font-bold border-2 rounded-full w-10 h-10 flex items-center justify-center shadow-lg mt-4", attendancePercentage > 50 ? "text-emerald-500 border-emerald-500 bg-emerald-500/5" : "text-red-500 border-red-500 bg-red-500/5")}>{stat.percentage}</span>
                           )
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                           {stat.label === 'TO SCHEDULE' && (
                              <div className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                              </div>
                           )}
                           <span className={cn("text-[10px] md:text-xs font-black tracking-widest", stat.color.split(' ')[1])}>{stat.label}</span>
                        </div>
                        <span className={cn("text-xl md:text-3xl font-black mt-1", stat.color.split(' ')[1])}>{stat.count}</span>
                        {stat.subLabel && <span className="text-[10px] md:text-xs text-blue-400 font-bold ">{stat.subLabel}</span>}
                      </>
                    )}
                 </div>
               ))}
            </div>

            {/* Session List */}
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse min-w-[800px]">
                 <thead>
                    <tr className="bg-slate-950/50 border-y border-slate-800">
                       <th className="px-6 py-4 w-10"><input type="checkbox" className="rounded border-slate-700 bg-slate-900" 
                                checked={selectedSessionIds.size > 0 && selectedSessionIds.size === currentPackageSessions.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSessionIds(new Set(currentPackageSessions.map(s => s.id!)));
                                  } else {
                                    setSelectedSessionIds(new Set());
                                  }
                                }}
                              />
                       </th>
                       <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-32 cursor-pointer hover:text-white" onClick={() => handleSort('group')}>GROUP {sortConfig?.key === 'group' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}</th>
                       <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-24 cursor-pointer hover:text-white" onClick={() => handleSort('package')}>PACKAGE {sortConfig?.key === 'package' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}</th>
                       <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-24 cursor-pointer hover:text-white" onClick={() => handleSort('session')}>Session# {sortConfig?.key === 'session' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}</th>
                       <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => handleSort('date')}>DATE {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}</th>
                       <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => handleSort('time')}>TIME {sortConfig?.key === 'time' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}</th>
                       <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => handleSort('location')}>LOCATION {sortConfig?.key === 'location' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}</th>
                       <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => handleSort('status')}>STATUS {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}</th>
                       <th className="px-2 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">COMMENT</th>
                       <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">PRICE</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800">
                    {sortedSessions.map((session, i) => (
                      <tr key={session.id} className="hover:bg-white/5 transition-colors group/row">
                        <td className="px-6 py-4">
                          {currentUserRole?.role !== 'visitor' && (
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-700 bg-slate-900" 
                              checked={selectedSessionIds.has(session.id!)}
                              onChange={(e) => {
                                const next = new Set(selectedSessionIds);
                                if (e.target.checked) next.add(session.id!);
                                else next.delete(session.id!);
                                setSelectedSessionIds(next);
                              }}
                            />
                          )}
                        </td>
                        <td className="px-2 py-4">
                          <SessionGroupSelector
                            session={session}
                            player={player}
                            groups={groups}
                            packageGroupId={playerPackages.find(pkg => pkg.id === session.packageId)?.groupId || ''}
                            updateMasterData={updateMasterData}
                            disabled={currentUserRole?.role === 'visitor'}
                          />
                        </td>
                        <td className="px-2 py-4">
                          <select
                            disabled={currentUserRole?.role === 'visitor'}
                            value={session.sessionIndex?.split('-')[0] || playerPackages.find(p => p.id === session.packageId)?.packageTypeCode || ''}
                            onChange={async (e) => {
                              const newCode = e.target.value;
                              const oldIndex = session.sessionIndex || 'SES-1';
                              const numPart = oldIndex.split('-').pop() || String(i + 1);
                              const newIndex = `${newCode}-${numPart}`;
                              
                              // Find new pricing for this session
                              const pkg = playerPackages.find(p => p.id === session.packageId);
                              if (!pkg) return;

                              const monthToUse = pkg.effectiveMonth || pkg.createdAt?.slice(0, 7) || new Date().toISOString().slice(0, 7);
                              const nSessions = pkg?.numSessions || 8;
                              const anchorDate = pkg.startDate;
                              
                              const scheme = findBestPricingScheme(pricingSchemes, newCode, Number(nSessions), monthToUse, anchorDate);
                              const sessionValue = scheme?.sessionValue || 0;
                              const sessionCost = scheme?.sessionCost || 0;

                              // 1. Update the session itself
                              await updateMasterData('sessions', session.id!, { 
                                sessionIndex: newIndex,
                                value: sessionValue,
                                cost: sessionCost
                              });

                              // 2. Recalculate package totalDue
                              const pkgSessions = sessions.filter(s => String(s.packageId) === String(pkg.id));
                              const updatedSessionsValue = pkgSessions.reduce((acc, s) => {
                                if (String(s.id) === String(session.id)) return acc + sessionValue;
                                
                                // If s.value is missing (old data), look it up based on its own index prefix
                                if (s.value === undefined || s.value === null) {
                                  const sCode = s.sessionIndex?.split('-')[0] || pkg.packageTypeCode;
                                  const matchingPricing = findBestPricingScheme(pricingSchemes, sCode, Number(pkg?.numSessions), pkg.effectiveMonth || 'current', pkg.startDate);
                                  return acc + (matchingPricing?.sessionValue || 0);
                                }
                                return acc + Number(s.value || 0);
                              }, 0);

                              const currentDiscount = (pkg.discountAmount || 0);
                              const newBase = updatedSessionsValue;
                              
                              await updateMasterData('packages', pkg.id!, { 
                                totalDue: newBase - currentDiscount,
                                baseAmount: newBase
                              });
                            }}
                            className={cn("bg-transparent border border-transparent hover:border-slate-800 focus:border-slate-700 focus:bg-slate-900 rounded text-base text-white p-1.5 w-20 uppercase appearance-none", currentUserRole?.role !== 'visitor' && "cursor-pointer")}
                          >
                            {packageTypes.map(pt => (
                              <option key={pt.code} value={pt.code} className="bg-slate-900">{pt.code}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-4">
                           {(() => {
                              const p = playerPackages.find(pkg => pkg.id === session.packageId);
                              const pkgCode = session.sessionIndex?.split('-')[0] || p?.packageTypeCode || 'SES';
                              const sessionNum = i + 1;
                              return <span className="text-base text-white">{pkgCode}-{sessionNum}</span>;
                           })()}
                        </td>
                        <td className="px-2 py-2">
                           <div className="flex items-center gap-3 h-[40px]">
                             <input 
                              type="date"
                              disabled={currentUserRole?.role === 'visitor'}
                              defaultValue={session.date || ''}
                              onBlur={(e) => updateMasterData('sessions', session.id!, { date: e.target.value })}
                              className="bg-transparent border border-transparent hover:border-slate-800 focus:border-slate-700 focus:bg-slate-900 rounded text-base text-white p-1 max-w-[150px] custom-date-input"
                            />
                            {session.date && (
                              <span className="text-base text-white flex items-center">
                                {format(parseISO(session.date), 'EEE')}
                              </span>
                            )}
                           </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1 h-[40px]">
                            <select
                              value={session.startTime || ''}
                              onChange={(e) => updateMasterData('sessions', session.id!, { startTime: e.target.value })}
                              className="bg-transparent border border-transparent hover:border-slate-800 focus:border-slate-700 focus:bg-slate-900 rounded text-base text-white p-1 w-32 appearance-none text-center outline-none"
                            >
                              {TIME_SLOTS.map(slot => (
                                <option key={slot.value} value={slot.value} className="bg-slate-900 text-white font-sans">{slot.label}</option>
                              ))}
                            </select>
                            <div className="flex flex-col items-center justify-center -space-y-1">
                              <button
                                  className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    const currentHour = parseInt(session.startTime?.split(':')[0] || '17');
                                    const newHour = (currentHour + 1) % 24;
                                    await updateMasterData('sessions', session.id!, { startTime: `${newHour.toString().padStart(2, '0')}:00` });
                                  }}
                              >
                                  <ChevronUp size={12} />
                              </button>
                              <button
                                  className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    const currentHour = parseInt(session.startTime?.split(':')[0] || '17');
                                    const newHour = (currentHour - 1 + 24) % 24;
                                    await updateMasterData('sessions', session.id!, { startTime: `${newHour.toString().padStart(2, '0')}:00` });
                                  }}
                              >
                                  <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={session.locationId || ''}
                            onChange={(e) => updateMasterData('sessions', session.id!, { locationId: e.target.value })}
                            className="bg-transparent border border-transparent hover:border-slate-800 focus:border-slate-700 focus:bg-slate-900 rounded text-base text-slate-300 uppercase p-1.5 w-[160px] cursor-pointer"
                          >
                            <option value="">NO BASE</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-4">
                        <select
                           value={session.status}
                           onChange={(e) => {
                               const newStatus = e.target.value as SessionStatus;
                               let newStatusToSet = newStatus;
                               if (newStatus === 'Attended') {
                                   const regretCount = currentPackageSessions.filter(s => ['Regret', 'Exceptional Regret'].includes(s.status)).length;
                                   const compensatedCount = currentPackageSessions.filter(s => s.status === 'Compensated' && s.id !== session.id).length;
                                   if (regretCount > compensatedCount) {
                                       newStatusToSet = 'Compensated';
                                   }
                               }

                               let newComment = session.comment || '';
                               if (['Attended', 'Hold', 'Absent', 'Scheduled', 'Cancelled'].includes(newStatusToSet)) newComment = '';
                               else if (newStatusToSet === 'Regret' || newStatusToSet === 'Exceptional Regret') newComment = 'to be compensated';
                               else if (newStatusToSet === 'Compensated') newComment = 'attended compensated session';
                               
                               updateMasterData('sessions', session.id!, { status: newStatusToSet, comment: newComment });
                           }}
                           className={cn(
                            "px-2 py-1 rounded-lg text-base uppercase cursor-pointer outline-none appearance-none text-center border focus:ring-1 border-opacity-30",
                            ['Attended', 'Compensated'].includes(session.status) ? "text-emerald-400 border-emerald-500 bg-emerald-950/20 focus:ring-emerald-500/50" :
                            ['Absent', 'Cancelled'].includes(session.status) ? "text-red-400 border-red-500 bg-red-950/20 focus:ring-red-500/50" :
                            ['Regret', 'Exceptional Regret'].includes(session.status) ? "text-orange-400 border-orange-500 bg-orange-950/20 focus:ring-orange-500/50" :
                            session.status === 'Hold' ? "text-gray-400 border-gray-500 bg-gray-950/20 focus:ring-gray-500/50" :
                            "text-blue-400 border-blue-500 bg-blue-950/20 focus:ring-blue-500/50"
                        )}
                         >
                           {['Scheduled', 'Attended', 'Absent', 'Exceptional Regret', 'Regret', 'Cancelled', 'Compensated', 'Hold'].map(s => (
                             <option key={s} value={s} className="bg-slate-900">{s}</option>
                           ))}
                         </select>
                        </td>
                        <td className="px-2 py-4">
                           <input 
                             key={`comment-${session.id}-${session.comment}`}
                             type="text" 
                             placeholder="Custom comment..." 
                             defaultValue={session.comment || ''}
                             onBlur={(e) => updateMasterData('sessions', session.id!, { comment: e.target.value })}
                             className="bg-transparent border border-transparent hover:border-slate-800 focus:border-slate-700 focus:bg-slate-900 rounded-lg text-base w-full p-1.5 text-slate-400 outline-none transition"
                           />
                        </td>
                         <td className="px-4 py-4 text-right">
                            <span className="text-base text-white">
                              {(() => {
                                if (activePackage) {
                                  const rawPrefix = (session.sessionIndex && session.sessionIndex.includes('-')) 
                                    ? session.sessionIndex.split('-')[0].toUpperCase().trim() 
                                    : '';
                                  const normalizedActiveCode = (activePackage?.packageTypeCode || '').toUpperCase().trim();
                                  const isPrefixValid = pricingSchemes.some(ps => (ps.packageTypeCode || '').toUpperCase().trim() === rawPrefix);
                                  const sCode = (isPrefixValid && rawPrefix) ? rawPrefix : normalizedActiveCode;

                                  const nSessions = sCode === normalizedActiveCode ? Number(activePackage?.numSessions || 8) : 1;
                                  const effectiveMonth = activePackage?.effectiveMonth || activePackage?.createdAt?.slice(0, 7) || new Date().toISOString().slice(0, 7);
                                  const anchorDate = activePackage?.startDate;
                                  
                                  const pricing = findBestPricingScheme(pricingSchemes, sCode, nSessions, effectiveMonth, anchorDate);
                                  const dbVal = Number(session.value || 0);
                                  const price = (activePackage?.forceSystemPricing || dbVal === 0) ? (pricing?.sessionValue || 0) : dbVal;
                                  
                                  return formatCurrency(price);
                                }
                                return formatCurrency(Number(session.value || 0));
                              })()}
                            </span>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
            </div>
          </div>

          {/* Payment History Section */}
          <div id="financials" className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-bento mt-6">
            <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={14} className="text-emerald-500" />
                <span className="text-xs font-black text-white uppercase tracking-widest">Financial Matrix / Payment History</span>
              </div>
            </div>
            <div className="p-0">
               <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-950/50 border-b border-slate-800">
                       <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-widest w-32">DATE</th>
                       <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-widest w-32">AMOUNT</th>
                       <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-widest w-32">METHOD</th>
                       <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-widest">RECORDED BY</th>
                       <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-widest">INTERNAL NOTE</th>
                       <th className="px-6 py-4 w-24"></th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800">
                    {payments.filter((p: any) => p.packageId === activePackage.id).sort((a: any, b: any) => (a.date || '').localeCompare(b.date || '')).map((payment: any, index: number) => (
                      <tr key={`${payment.id}-${index}`} className="hover:bg-white/5 transition-colors group/row">
                        <td className="px-6 py-4 text-xl text-white">{payment.date ? format(parseISO(payment.date), 'dd/MM/yyyy') : '-'}</td>
                        <td className="px-6 py-4 text-xl text-emerald-500">{formatCurrency(payment.amount)}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded text-base uppercase",
                            payment.method === 'Bank' ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "bg-amber-600/10 text-amber-400 border border-amber-500/20"
                          )}>
                            {payment.method || 'Bank'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-base text-slate-500 uppercase tracking-widest">{payment.addedBy || '—'}</td>
                        <td className="px-6 py-4 text-base text-slate-500">{payment.note || '—'}</td>
                        <td className="px-6 py-4">
                           {currentUserRole?.role !== 'visitor' && (
                             confirmDeleteId === payment.id ? (
                               <div className="flex items-center gap-1">
                                 <button
                                   onClick={async () => {
                                     const newPaid = (activePackage.paidAmount || 0) - payment.amount;
                                     let newStatus = 'Not Paid';
                                     if (newPaid >= activePackage.totalDue) newStatus = 'Paid';
                                     else if (newPaid > 0) newStatus = 'Partially Paid';
                                     
                                     await updateMasterData('packages', activePackage.id!, { paidAmount: newPaid, status: newStatus });
                                     await deleteMasterData('payments', payment.id!);
                                     setConfirmDeleteId(null);
                                   }}
                                   className="h-8 px-2 flex items-center justify-center rounded-lg bg-red-600 text-white border border-red-500 hover:bg-red-500 transition text-[10px] font-bold uppercase italic"
                                 >
                                   Confirm Delete
                                 </button>
                                 <button
                                   onClick={() => setConfirmDeleteId(null)}
                                   className="h-8 px-2 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition text-[10px] font-bold uppercase"
                                 >
                                   X
                                 </button>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                 <button 
                                   onClick={(e) => handleSendPaymentEmail(payment, e)}
                                   className="p-1 hover:text-emerald-500 transition-colors"
                                   title="Send Payment Confirmation Email"
                                 >
                                   <Mail size={14} />
                                 </button>
                                 <button 
                                   onClick={() => setEditingPaymentModal(payment)}
                                   className="p-1 hover:text-blue-500 transition-colors"
                                 >
                                   <Edit2 size={14} />
                                 </button>
                                 <button 
                                   onClick={() => setConfirmDeleteId(payment.id!)}
                                   className="p-1 hover:text-red-500 transition-colors"
                                 >
                                   <Trash2 size={14} />
                                 </button>
                               </div>
                             )
                           )}
                        </td>
                      </tr>
                    ))}
                    {payments.filter((p: any) => p.packageId === activePackage.id).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 uppercase text-sm tracking-widest bg-slate-950/20">
                          Zero financial entries detected for this operational cycle
                        </td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
            <div className="p-6 bg-slate-950/50 flex justify-between items-center border-t border-slate-800">
               <div className="flex gap-8">
                  <div className="relative group/val">
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest block mb-1">Base Amount</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-white">
                        {formatCurrency(derivedBaseAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="relative group/val">
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest block mb-1">Package Discount</span>
                    <span className="text-2xl font-black text-red-400">{formatCurrency(derivedTotalDiscount)}</span>
                  </div>
                  <div className="relative group/val">
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest block mb-1">Total package due</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-2xl font-black", isContractOutOfSync ? "text-amber-500" : "text-emerald-500")}>
                        {formatCurrency(derivedTotalDue)}
                      </span>
                      {isContractOutOfSync && currentUserRole?.role !== 'visitor' && (
                        <button 
                          onClick={async () => {
                            await updateMasterData('packages', activePackage.id!, {
                              baseAmount: derivedBaseAmount,
                              totalDue: derivedTotalDue,
                              discountAmount: derivedTotalDiscount
                            });
                          }}
                          className="text-[8px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black uppercase shadow-sm hover:bg-amber-400 transition"
                        >
                          FIX DB
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest block mb-1">Remaining Liability</span>
                    <span className="text-2xl font-black text-red-500">{formatCurrency(Math.max(0, derivedTotalDue - realPaidAmount))}</span>
                  </div>
                  <div>
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest block mb-1">Status</span>
                    {(() => {
                      if (realPaidAmount >= derivedTotalDue && derivedTotalDue > 0) {
                        return <span className="text-2xl font-black text-emerald-500">PAID</span>;
                      } else if (realPaidAmount > 0) {
                        return <span className="text-2xl font-black text-slate-400">PARTIALLY PAID</span>;
                      } else {
                        return <span className="text-2xl font-black text-red-500">NOT PAID</span>;
                      }
                    })()}
                  </div>
               </div>
               <div className="flex gap-4">
                 {currentUserRole?.role !== 'visitor' && (
                   <>
                     <button 
                       onClick={() => setRecordingPaymentModal(activePackage)}
                       className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-black uppercase shadow-bento hover:bg-emerald-500 transition"
                     >
                       <Plus size={14} /> Pay
                     </button>
                   </>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals placeholders - I should keep existing implementation but wrap in the new UI style */}
      {showEmailModal && <EmailScheduleModal player={player} activePackage={activePackage} currentPackageSessions={currentPackageSessions} derivedTotalDue={derivedTotalDue} realPaidAmount={realPaidAmount} activePkgLabel={activePackage ? `M${(pkgIndexMap.get(String(activePackage.id)) ?? -1) + 1}` : undefined} payments={activePackagePayments} sessionIndexMap={sessionIndexMap} oldDue={
         (() => {
           let old = 0;
           playerPackages.forEach(pkg => {
              if (activePackage && String(pkg.id) === String(activePackage.id)) return;
              const pkgPayments = payments.filter(p => String(p.packageId) === String(pkg.id));
              const pPaid = pkgPayments.length > 0 ? pkgPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0) : Number(pkg.paidAmount || 0);
              const pDue = Number(pkg.totalDue || 0);
              const pending = Math.max(0, pDue - pPaid);
              if (pkg.status !== 'Paid' && pkg.status !== 'Free' && pending > 0.01) old += pending;
           });
           return old;
         })()
      } onClose={() => setShowEmailModal(false)} />}
      {showGenerateModal && <GeneratePackageModal player={player} lastPackage={playerPackages[playerPackages.length - 1]} onClose={() => setShowGenerateModal(false)} />}
      {showInactiveWarning && <InactiveWarningModal player={player} onClose={() => setShowInactiveWarning(false)} />}
      {editingPackageModal && <EditPackageModal pkg={editingPackageModal} onClose={() => setEditingPackageModal(null)} />}
      {showAddSessionModal && <AddSessionModal player={player} activePackage={activePackage} currentPackageSessions={currentPackageSessions} onClose={() => setShowAddSessionModal(false)} />}
      {showBulkModifyModal && (
        <BulkModifyModal
          selectedSessionIds={selectedSessionIds}
          currentPackageSessions={currentPackageSessions}
          pricingSchemes={pricingSchemes}
          locations={locations}
          packageTypes={packageTypes}
          playerPackages={playerPackages}
          groups={groups}
          player={player}
          onClose={() => {
            setShowBulkModifyModal(false);
            setSelectedSessionIds(new Set());
          }}
          updateMasterData={updateMasterData}
        />
      )}
      {showScheduleReport && (
        <ScheduleReportModal 
          player={player} 
          activePackage={activePackage} 
          sessions={sessions} 
          visibleSessions={playerVisibleSessions} 
          playerPackages={playerPackages} 
          derivedTotalDue={derivedTotalDue} 
          realPaidAmount={realPaidAmount} 
          derivedBaseAmount={derivedBaseAmount}
          derivedTotalDiscount={derivedTotalDiscount}
          payments={payments} 
          onClose={() => setShowScheduleReport(false)} 
        />
      )}
      {showEvaluationModal && <EvaluationModal player={player} evaluation={selectedEvaluation} onClose={() => { setShowEvaluationModal(false); setSelectedEvaluation(null); setIsRedoMode(false); }} defaultRedo={isRedoMode} />}
      {recordingPaymentModal && (
        <PaymentModal 
          pkg={recordingPaymentModal} 
          initialAmount={Math.max(0, derivedTotalDue - realPaidAmount)}
          onClose={() => setRecordingPaymentModal(null)} 
        />
      )}
      {editingPaymentModal && <EditPaymentModal payment={editingPaymentModal} pkg={activePackage} onClose={() => setEditingPaymentModal(null)} />}
      
      {showEmailReviewModal && selectedPaymentForEmail && (
        <PaymentEmailReviewModal 
          player={player!} 
          payment={selectedPaymentForEmail} 
          activePackage={activePackage} 
          pkgLabel={activePackage ? `M${(pkgIndexMap.get(String(activePackage.id)) ?? -1) + 1}` : (selectedPaymentForEmail.packageTypeCode || 'Package')}
          onClose={() => {
            setShowEmailReviewModal(false);
            setSelectedPaymentForEmail(null);
          }}
        />
      )}
      
      {/* Player Edit Modal */}
      <AnimatePresence>
        {editingPlayerModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => setEditingPlayerModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.95 }} className="relative w-full max-w-2xl bg-slate-900 rounded-[2rem] border-2 border-slate-800 p-8 shadow-bento overflow-hidden">
               <h2 className="text-2xl font-black text-white uppercase mb-8 border-b-2 border-slate-800 pb-4">Modify Player Card</h2>
               <div className="max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
                <PlayerForm 
                   initialData={player}
                   onCancel={() => setEditingPlayerModal(false)}
                   onSubmit={(data: any) => {
                     updateMasterData('players', player.id!, data);
                     setEditingPlayerModal(false);
                   }}
                   isSaving={false}
                />
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="mt-12 space-y-8">
        <div className="flex items-center justify-between">
           <div>
             <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Performance Matrix</h3>
             <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Skill Evolution & Mastery tracking</p>
           </div>
           <div className="flex items-center gap-2">
             {playerEvaluations.length > 0 && playerEvaluations[0].percentage < 80 && (
                <button 
                  onClick={() => { setSelectedEvaluation(null); setIsRedoMode(true); setShowEvaluationModal(true); }}
                  className="bg-purple-600 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest shadow-bento hover:bg-purple-500 transition flex items-center gap-2"
                >
                  <RotateCcw size={16} strokeWidth={3} /> Re-do Test
                </button>
             )}
             <button 
               onClick={() => { setSelectedEvaluation(null); setIsRedoMode(false); setShowEvaluationModal(true); }}
               className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest shadow-bento hover:bg-blue-500 transition flex items-center gap-2"
             >
               <Plus size={16} strokeWidth={3} /> Record Evaluation
             </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Current Level & Progress */}
           <div className="lg:col-span-2 bento-card-subtle bg-slate-900 border-slate-800 p-8 flex flex-col justify-between overflow-hidden relative">
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
              <div className="relative z-10">
                <span className="text-sm font-black text-blue-400 uppercase tracking-[0.25em] block mb-4">Current Operational Focus</span>
                <div className="flex items-baseline gap-4 mb-2">
                  <h4 className="text-3xl font-black text-white uppercase tracking-tighter">{currentLevel}</h4>
                  <span className="text-blue-500 font-black text-2xl">{masteryProgress}% Mastery</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden mb-8">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${masteryProgress}%` }}
                     className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                   />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                   <div className="space-y-1">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Evaluations</span>
                      <p className="text-2xl font-black text-white">{playerEvaluations.length}</p>
                   </div>
                   <div className="space-y-1">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Badges Earned</span>
                      <p className="text-2xl font-black text-white">{badgeData.filter(b => b.isAchieved).length}</p>
                   </div>
                   <div className="space-y-1">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Peak Mastery</span>
                      <p className="text-2xl font-black text-emerald-500">
                        {playerEvaluations.length > 0 ? Math.max(...playerEvaluations.map(e => e.percentage)) : 0}%
                      </p>
                   </div>
                   <div className="space-y-1">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Last Test</span>
                      <p className="text-2xl font-black text-white">
                        {playerEvaluations.length > 0 ? format(parseISO(playerEvaluations[0].date), 'dd/MM/yyyy') : 'N/A'}
                      </p>
                   </div>
                </div>
              </div>
           </div>

           {/* Badge Cabinet */}
           <div className="bento-card-subtle bg-slate-900 border-slate-800 p-8">
              <span className="text-sm font-black text-amber-400 uppercase tracking-[0.25em] block mb-6">Honorary Cabinet</span>
              <div className="flex flex-wrap gap-x-8 gap-y-12">
                  {badgeData.length > 0 ? badgeData.map((badge, idx) => (
                   <motion.div 
                     key={badge.id || badge.level} 
                     initial={{ scale: 0, rotate: -20 }}
                     animate={{ scale: 1, rotate: 0 }}
                     transition={{ delay: idx * 0.1 }}
                     className="group relative flex flex-col items-center gap-3"
                   >
                     <div className={cn(
                       "h-16 w-16 rounded-2xl flex items-center justify-center border-2 shadow-bento transition-transform hover:scale-110 cursor-help",
                       badge.isAchieved && badge.type.includes('Bronze') ? "bg-amber-900/20 border-amber-600/50 text-amber-500" :
                       badge.isAchieved && badge.type.includes('Silver') ? "bg-slate-200/10 border-slate-400/50 text-slate-300" :
                       badge.isAchieved && badge.type.includes('Gold') ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-500" :
                       badge.isAchieved && badge.type.includes('Platinum') ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400" :
                       badge.isAchieved ? "bg-purple-600/10 border-purple-500/50 text-purple-400" :
                       "bg-slate-900/50 border-slate-800 text-slate-600"
                     )}>
                        <Award size={32} strokeWidth={2.5} className={cn(!badge.isAchieved && "opacity-50")} />
                      </div>
                      
                      <div className="text-center">
                         <p className={cn(
                           "text-[10px] font-bold uppercase tracking-tighter transition-colors max-w-[64px] leading-tight",
                           badge.isAchieved ? "text-white" : "text-slate-600"
                         )}>
                           {badge.level}
                         </p>
                      </div>
                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                        <p className="text-sm font-black text-white uppercase">{badge.level}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                           {badge.isAchieved ? `${badge.type} Badge · ${badge.date ? format(parseISO(badge.date), 'dd/MM/yyyy') : 'N/A'}` : 'Next Target Level'}
                        </p>
                     </div>
                   </motion.div>
                 )) : (
                   <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-800 rounded-3xl text-slate-600">
                      <Award size={32} className="mb-2 opacity-20" />
                      <p className="text-sm font-black uppercase tracking-widest">No badges earned yet</p>
                   </div>
                 )}
              </div>
           </div>
        </div>

        {/* History Table */}
        <div className="bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] overflow-hidden shadow-bento">
           <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Historical Registry of Evaluations</h4>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-950 text-slate-500 uppercase text-sm font-black tracking-widest border-b border-slate-800">
                       <th className="px-8 py-5">Date</th>
                       <th className="px-8 py-5">Coach</th>
                       <th className="px-8 py-5">Level</th>
                       <th className="px-8 py-5">Mastery</th>
                       <th className="px-8 py-5">Skills</th>
                       <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800">
                    {playerEvaluations.map(evalItem => (
                      <tr key={evalItem.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-8 py-6">
                           <p className="text-xl text-white">{format(parseISO(evalItem.date), 'dd/MM/yyyy')}</p>
                        </td>
                        <td className="px-8 py-6">
                           <p className="text-lg text-slate-400 uppercase tracking-widest">{evalItem.coachName}</p>
                        </td>
                        <td className="px-8 py-6">
                           <span className="px-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold uppercase text-white">
                              {evalItem.level}
                           </span>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                              <span className={cn(
                                "text-3xl font-black",
                                evalItem.percentage >= 90 ? "text-emerald-500" : 
                                evalItem.percentage >= 50 ? "text-blue-500" : "text-amber-500"
                              )}>
                                 {evalItem.percentage}%
                              </span>
                              {evalItem.percentage >= 90 && (
                                <Award size={16} className="text-yellow-500" />
                              )}
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <p className="text-xl text-slate-400">
                             <span className="text-white">{evalItem.passedSkillsCount}</span> / {evalItem.totalSkillsCount} Criteria Met
                           </p>
                        </td>
                        <td className="px-8 py-6 text-right">
                           <div className="flex items-center justify-end gap-4">
                              <button 
                                onClick={() => { setSelectedEvaluation(evalItem); setShowEvaluationModal(true); }}
                                className="text-blue-500 hover:text-blue-400 transition flex items-center gap-1 group/btn"
                              >
                                <Edit2 size={18} className="group-hover/btn:scale-110 transition-transform" />
                                <span className="text-sm font-black uppercase hidden sm:inline">Modify</span>
                              </button>
                              
                              {confirmDeleteEvalId === evalItem.id ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                   <button 
                                     onClick={async () => {
                                       await deleteMasterData('evaluations', evalItem.id!);
                                       setConfirmDeleteEvalId(null);
                                     }}
                                     className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-black uppercase border-2 border-red-500 shadow-sm"
                                   >
                                     Confirm Delete
                                   </button>
                                   <button 
                                     onClick={() => setConfirmDeleteEvalId(null)}
                                     className="text-slate-500 h-8 w-8 flex items-center justify-center bg-slate-800 rounded-lg hover:text-white transition"
                                   >
                                     <X size={14} />
                                   </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setConfirmDeleteEvalId(evalItem.id!)}
                                  className="text-red-500/50 hover:text-red-500 transition group/del"
                                >
                                  <Trash2 size={18} className="group-hover/del:rotate-12 transition-transform" />
                                </button>
                              )}
                           </div>
                        </td>
                      </tr>
                    ))}
                    {playerEvaluations.length === 0 && (
                      <tr>
                         <td colSpan={5} className="px-8 py-16 text-center">
                            <p className="text-sm font-black text-slate-600 uppercase tracking-[0.2em] mb-4">No academic data points recorded</p>
                            <button 
                              onClick={() => setShowEvaluationModal(true)}
                              className="text-sm font-black text-blue-500 uppercase tracking-widest hover:underline"
                            >
                               Initiate first evaluation cycle
                            </button>
                         </td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </section>
    </div>
  );
}

function PackageCard({ pkg, sessions, payments, onAddPayment, onDeletePackage, isConfirmingDelete }: any) {
  const attendedCount = sessions.filter((s: any) => s.status === 'Attended' || s.status === 'Compensated' || s.status === 'Attended Comp. Session').length;
  const remainingCount = Math.max(0, (pkg?.numSessions || 0) - attendedCount);
  const totalPaid = payments.reduce((acc: number, p: any) => acc + p.amount, 0);
  const pendingAmount = pkg.totalDue - totalPaid;

  return (
    <div className="bg-white rounded-[2.5rem] border-4 border-slate-900 shadow-bento overflow-hidden group">
      <div className="bg-slate-900 p-8 text-white flex justify-between items-center border-b-4 border-slate-900">
        <div>
          <span className="text-lg font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">Operational Card</span>
          <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">{pkg?.packageTypeCode} / {pkg?.numSessions} SESSIONS</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className={cn(
              "inline-block px-4 py-1.5 rounded-xl text-sm font-black uppercase border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
              pkg.status === 'Paid' ? "bg-emerald-500 text-white border-white" : "bg-red-500 text-white border-white"
            )}>
              {pkg.status}
            </span>
            <p className="mt-3 text-sm font-black uppercase text-slate-400 tracking-widest">Entry: {pkg.startDate}</p>
          </div>
          <button 
            onClick={onDeletePackage}
            className={cn(
              "h-12 px-4 rounded-xl border-2 flex items-center justify-center transition-all shadow-bento active:translate-y-0.5",
              isConfirmingDelete ? "bg-red-600 border-white text-white animate-pulse" : "bg-slate-800 border-slate-700 text-slate-500 hover:text-red-500"
            )}
          >
            <Trash2 size={20} />
            {isConfirmingDelete && <span className="ml-2 text-sm font-black uppercase">Confirm?</span>}
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bento-card-subtle p-5 bg-slate-50 border-slate-200">
            <span className="text-xs font-black text-slate-400 uppercase block mb-2 tracking-widest underline decoration-slate-200 underline-offset-4">Success</span>
            <p className="text-5xl font-black text-slate-900 tracking-tighter">{attendedCount}</p>
          </div>
          <div className="bento-card-subtle p-5 bg-blue-50 border-blue-100">
            <span className="text-xs font-black text-blue-400 uppercase block mb-2 tracking-widest underline decoration-blue-100 underline-offset-4">Residue</span>
            <p className="text-5xl font-black text-blue-600 tracking-tighter">{remainingCount}</p>
          </div>
          <div className="bento-card-subtle p-5 bg-emerald-50 border-emerald-100">
            <span className="text-xs font-black text-emerald-400 uppercase block mb-2 tracking-widest underline decoration-emerald-100 underline-offset-4">Verified</span>
            <p className="text-5xl font-black text-emerald-600 tracking-tighter">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bento-card-subtle p-5 bg-red-50 border-red-100">
            <span className="text-xs font-black text-red-100 uppercase block bg-red-400 w-fit px-2 py-0.5 rounded mb-2 tracking-widest">Deficit</span>
            <p className="text-5xl font-black text-red-600 tracking-tighter">{formatCurrency(pendingAmount)}</p>
          </div>
        </div>

        <div className="flex gap-4 mb-10">
          <button 
            onClick={onAddPayment}
            className="flex-1 flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition border-2 border-slate-900 shadow-bento active:translate-y-0.5 italic"
          >
            <CreditCard size={20} strokeWidth={3} />
            PROCESS PAYMENT
          </button>
        </div>

        <div>
          <h4 className="text-sm font-black text-slate-400 uppercase mb-6 flex items-center gap-3 tracking-[0.2em]">
            <Calendar size={18} strokeWidth={3} className="text-slate-900" />
            Temporal Registry / Sequential Matrix
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-4 custom-scrollbar">
            {sessions.sort((a: any, b: any) => a.date.localeCompare(b.date)).map((session: any, index: number) => (
              <div key={`${session.id}-${index}`} className="flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-slate-900 hover:shadow-bento-subtle transition-all group/item">
                <div className="flex items-center gap-4">
                  <span className="h-8 w-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-black border border-transparent group-hover/item:border-slate-900 group-hover/item:bg-white group-hover/item:text-slate-900 transition-all">{session.sessionIndex.split('-').pop()}</span>
                  <div>
                    <p className="text-base font-black text-slate-900 uppercase tracking-tighter">{format(parseISO(session.date), 'EEE, dd/MM/yyyy')}</p>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{formatTimeAMPM(session.startTime)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "text-xs font-black px-2.5 py-1 rounded-lg uppercase border-2 flex items-center justify-center text-center",
                    session.status === 'Attended' || session.status === 'Compensated' ? "bg-emerald-500 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]" : 
                    session.status === 'Absent' ? "bg-red-500 text-white border-slate-900" :
                    session.status === 'Scheduled' ? "bg-blue-500 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]" : "bg-slate-50 text-slate-400 border-slate-200"
                  )}>
                    {session.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneratePackageModal({ player, onClose, lastPackage }: any) {
  const { packageTypes, addMasterData, updateMasterData, pricingSchemes, locations, groups, sessions } = useData();
  
  const [formData, setFormData] = useState(() => {
    let lastGroupId = '';
    let lastLocationId = '';
    let lastCode = lastPackage?.packageTypeCode || player?.packageTypeCode || '';
    let lastNumSessions = lastPackage?.numSessions || player?.numSessions || 8;
    let startDate = new Date().toISOString().slice(0, 10);

    if (lastPackage) {
      // Prioritize the explicit groupId on the package object if it exists
      if (lastPackage.groupId) lastGroupId = lastPackage.groupId;
      if (lastPackage.locationId) lastLocationId = lastPackage.locationId;

      const pkgSessions = sessions.filter((s: any) => s.packageId === lastPackage.id);
      if (pkgSessions.length > 0) {
         pkgSessions.sort((a: any, b: any) => b.date.localeCompare(a.date));
         const recentSession = pkgSessions[0];
         // If recent session has a specific group/location different from package, use that as it's more specific
         if (recentSession.groupId) lastGroupId = recentSession.groupId;
         if (recentSession.locationId) lastLocationId = recentSession.locationId;
         
         // Set start date based on last session + 1 day
         startDate = format(addDays(parseISO(recentSession.date), 1), 'yyyy-MM-dd');
      }
    }

    if (!lastGroupId && player?.groupId) lastGroupId = player.groupId;
    if (!lastLocationId && player?.locationId) lastLocationId = player.locationId;

    return {
      packageTypeCode: lastCode,
      groupId: lastGroupId,
      locationId: lastLocationId,
      numSessions: lastNumSessions,
      nbScheduledSessions: undefined,
      startDate: startDate,
      discountType: lastPackage?.discountType || 'value',
      discountValue: Number(lastPackage?.discountValue || 0),
      specialMonth: new Date().toISOString().slice(0, 7),
      effectiveMonth: 'current'
    };
  });

  const [daySlots, setDaySlots] = useState<{dayOfWeek: string, time: string}[]>(() => {
    if (lastPackage) {
       const pkgSessions = sessions.filter((s: any) => s.packageId === lastPackage.id);
       if (pkgSessions.length > 0) {
           // Extract unique day-time patterns from previous package
           const patterns: Record<string, string> = {};
           pkgSessions.forEach((s: any) => {
               const day = format(parseISO(s.date), 'EEEE');
               patterns[day] = s.startTime;
           });
           return Object.entries(patterns).map(([dayOfWeek, time]) => ({ dayOfWeek, time }));
       }
    }
    return [{ dayOfWeek: 'Saturday', time: '17:00' }];
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [conflicts, setConflicts] = useState<{date: string, startTime: string}[] | null>(null);
  
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [groupFormData, setGroupFormData] = useState({ code: '', name: '' });
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const handleQuickAddGroup = async () => {
    if (!groupFormData.code || !groupFormData.name) return;
    setIsSavingGroup(true);
    try {
      const usedColors = new Set(groups.map((g: any) => g.color));
      const color = DISTINCT_COLORS.find(c => !usedColors.has(c)) || DISTINCT_COLORS[groups.length % DISTINCT_COLORS.length];
      const newGroup = await addMasterData('groups', { ...groupFormData, color });
      setFormData({ ...formData, groupId: (newGroup as any).id });
      setIsAddingGroup(false);
      setGroupFormData({ code: '', name: '' });
    } catch (error) {
      console.error("Failed to add group", error);
    } finally {
      setIsSavingGroup(false);
    }
  };

  const monthToUse = formData.effectiveMonth === 'specific' ? formData.specialMonth : 'current';
  const scheme = findBestPricingScheme(pricingSchemes, formData.packageTypeCode, Number(formData.numSessions), monthToUse, formData.startDate);

  const sessionValue = scheme ? scheme.sessionValue : 0;
  const sessionCost = scheme ? (scheme.sessionCost || 0) : 0;
  const baseAmount = (sessionValue * Number(formData.numSessions));
  const discountAmount = formData.discountType === 'percent' 
    ? (baseAmount * (formData.discountValue || 0)) / 100 
    : (formData.discountValue || 0);
  const totalDue = Math.max(0, baseAmount - discountAmount);

  const handleGenerate = async () => {
    if (!formData.packageTypeCode) return alert("WARNING: Field 'Package Type' should have a value.");
    if (!formData.numSessions || Number(formData.numSessions) <= 0) return alert("WARNING: Field 'Sessions Package' should have a value.");
    if (!formData.groupId) return alert("WARNING: Field 'Group' should have a value.");
    if (!formData.locationId) return alert("WARNING: Field 'Location' should have a value.");
    if (daySlots.length === 0) return alert("WARNING: Field 'Day Slots' should have at least one slot.");
    
    setIsGenerating(true);

    // 1. Simulate & Check for Conflicts
    const playerSessions = sessions.filter((s: any) => s.playerId === player.id);
    const simulated: {date: string, startTime: string}[] = [];
    
    const daysOfWeekSim: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };

    const sessionsToGenerate = formData.nbScheduledSessions !== undefined ? Number(formData.nbScheduledSessions) : Number(formData.numSessions);

    let simCount = 0;
    let simDate = parseISO(formData.startDate);
    let simGuard = 0;
    while (simCount < sessionsToGenerate && simGuard < 365) {
      const currentDayNum = getDay(simDate);
      const currentDayStr = Object.keys(daysOfWeekSim).find(k => daysOfWeekSim[k] === currentDayNum);
      const slots = daySlots.filter(s => s.dayOfWeek === currentDayStr);
      
      for (const slot of slots) {
        if (simCount >= sessionsToGenerate) break;
        simulated.push({ date: format(simDate, 'yyyy-MM-dd'), startTime: slot.time });
        simCount++;
      }
      simDate = addDays(simDate, 1);
      simGuard++;
    }

    const foundConflicts = simulated.filter(sim => 
      playerSessions.some((existing: any) => existing.date === sim.date)
    );

    if (foundConflicts.length > 0) {
       setConflicts(foundConflicts);
       setIsGenerating(false);
       return;
    }

    // 2. Create Package
    const packageRef = await addMasterData('packages', {
      playerId: player.id,
      packageTypeCode: formData.packageTypeCode,
      numSessions: Number(formData.numSessions),
      nbScheduledSessions: formData.nbScheduledSessions !== undefined ? Number(formData.nbScheduledSessions) : null,
      startDate: formData.startDate,
      baseAmount: baseAmount,
      baseAmountOverride: formData.baseAmount > 0 ? formData.baseAmount : null,
      discountType: formData.discountType,
      discountValue: formData.discountValue,
      discountAmount: discountAmount,
      totalDue: totalDue,
      paidAmount: 0,
      status: 'Not Paid',
      effectiveMonth: monthToUse,
      note: '',
      groupId: formData.groupId,
      locationId: formData.locationId
    });

    // 2.5 Update Player's primary group and location
    await updateMasterData('players', player.id, {
      ...player,
      groupId: formData.groupId,
      locationId: formData.locationId
    });

    // 2. Generate Sessions
    const daysOfWeekMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };

    let generatedCount = 0;
    // Start directly from startDate
    let currentDate = parseISO(formData.startDate);
    
    let infiniteLoopGuard = 0;
    
    while (generatedCount < sessionsToGenerate && infiniteLoopGuard < 365) {
      const currentDayNum = getDay(currentDate);
      const currentDayStr = Object.keys(daysOfWeekMap).find(k => daysOfWeekMap[k] === currentDayNum);
      
      const slotsForDay = daySlots.filter(s => s.dayOfWeek === currentDayStr);
      
      const prefix = formData.packageTypeCode || 'SES';

      for (const slot of slotsForDay) {
        if (generatedCount >= sessionsToGenerate) break;
        
        await addMasterData('sessions', {
          packageId: (packageRef as any).id,
          playerId: player.id,
          groupId: formData.groupId || player.groupId || '',
          date: format(currentDate, 'yyyy-MM-dd'), 
          startTime: slot.time || '17:00',
          status: 'Scheduled', // CRITICAL: Always default to Scheduled
          locationId: formData.locationId || '',
          sessionIndex: `${prefix}-${generatedCount + 1}`,
          value: sessionValue,
          cost: sessionCost,
          discount: 0
        });
        generatedCount++;
      }
      
      currentDate = addDays(currentDate, 1);
      infiniteLoopGuard++;
    }

    setIsGenerating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-slate-900 w-full max-w-lg overflow-y-auto max-h-[90vh] custom-scrollbar rounded-[2.5rem] p-8 border-2 border-slate-800 shadow-bento">
        
        <AnimatePresence>
          {conflicts && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-0 z-[110] bg-slate-950 p-8 flex flex-col overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center gap-4 text-orange-500 mb-6">
                 <AlertCircle size={32} strokeWidth={3} />
                 <h3 className="text-2xl font-black uppercase italic tracking-tighter">Scheduling Conflict</h3>
              </div>
              
              <p className="text-slate-400 text-sm font-bold uppercase italic mb-6">
                The selected start date generates sessions that overlap with existing appointments for this athlete. 
              </p>

              <div className="flex-1 overflow-y-auto pr-2 mb-6 min-h-[150px] custom-scrollbar">
                <div className="space-y-2">
                  {conflicts.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                      <span className="text-white font-black italic text-sm uppercase">{format(parseISO(c.date), 'EEE, dd/MM/yyyy')}</span>
                      <span className="text-orange-500 font-black text-xs">{formatTimeAMPM(c.startTime)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 mt-auto">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-widest block mb-2">Adjust Starting Date</label>
                  <input 
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => {
                      setFormData({ ...formData, startDate: e.target.value });
                      setConflicts(null);
                    }}
                    className="w-full bg-slate-900 border-2 border-slate-800 p-4 rounded-2xl text-white text-lg focus:border-blue-500 transition outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setConflicts(null)}
                    className="w-full py-4 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase italic text-xs hover:bg-slate-700 transition"
                  >
                    BACK TO FORM
                  </button>
                  <button 
                    onClick={handleGenerate}
                    className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black uppercase italic text-xs hover:bg-orange-400 transition shadow-lg shadow-orange-500/20"
                  >
                    PROCEED ANYWAY
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-0 right-0 p-6">
           <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-950 border border-slate-800 text-slate-500 hover:text-white transition"><X size={16} /></button>
        </div>
        
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white mb-4 border-2 border-slate-900 shadow-bento rotate-3">
          <PackageIcon size={24} strokeWidth={3} />
        </div>
        
        <h2 className="text-4xl font-black text-white uppercase tracking-tight leading-none mb-1">New Package</h2>
        <p className="text-blue-400 text-sm font-black uppercase tracking-widest mb-6">{player.name}</p>
        
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 grid grid-cols-2 gap-4">
          <div>
             <span className="text-xs text-slate-500 font-bold uppercase tracking-widest block mb-1">Base Amount</span>
             <span className="text-lg text-white font-black">{formatCurrency(baseAmount)}</span>
          </div>
          <div className="text-right">
             <span className="text-xs text-slate-500 font-bold uppercase tracking-widest block mb-1">Total package due</span>
             <span className="text-lg text-emerald-400 font-black">{formatCurrency(totalDue)}</span>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-base text-blue-400 text-[10px]">Package Type</label>
              <select 
                value={formData.packageTypeCode}
                onChange={e => setFormData({...formData, packageTypeCode: e.target.value})}
                className="input-base   cursor-pointer  "
              >
                <option value="">Select Type</option>
                {packageTypes.map((t: any) => <option key={t.id} value={t.code}>{t.name} ({t.code})</option>)}
              </select>
            </div>
            <div>
              <label className="label-base text-blue-400 text-[10px]">Sessions Package</label>
              <input 
                type="number"
                min="1"
                max="99"
                value={formData.numSessions}
                onChange={e => setFormData({...formData, numSessions: Number(e.target.value)})}
                className="input-base    "
              />
            </div>
            <div>
              <label className="label-base text-blue-400 text-[10px] truncate" title="Number of sessions to actually generate">NB Sched. Ses.</label>
              <input 
                type="number"
                min="0"
                max="99"
                value={formData.nbScheduledSessions === undefined ? formData.numSessions : formData.nbScheduledSessions}
                onChange={e => setFormData({...formData, nbScheduledSessions: e.target.value === '' ? undefined : Number(e.target.value)})}
                className="input-base    "
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="label-base text-blue-400">Group</label>
              <div className="flex gap-2">
                <select 
                  value={formData.groupId}
                  onChange={e => setFormData({...formData, groupId: e.target.value})}
                  className="input-base   cursor-pointer   flex-1"
                >
                  <option value="">Select Group</option>
                  {groups.filter(g => {
                     const isGroupActive = g.isActive !== false;
                     const pl = player;
                     const isAssigned = (pl?.groupAssignments && pl.groupAssignments.some((a: any) => String(a.groupId) === String(g.id) && a.isActive === true)) || (pl?.groupId && String(pl.groupId) === String(g.id));
                     return isGroupActive || isAssigned;
                  }).map(g => <option key={g.id} value={g.id}>{g.code} - {g.name}</option>)}
                </select>
                <button 
                  onClick={() => setIsAddingGroup(!isAddingGroup)}
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center border-2 transition-all shadow-sm shrink-0",
                    isAddingGroup ? "bg-red-500 border-red-400 text-white" : "bg-slate-950 border-slate-800 text-blue-400 hover:border-blue-500"
                  )}
                >
                  {isAddingGroup ? <X size={20} /> : <Plus size={20} />}
                </button>
              </div>

              <AnimatePresence>
                {isAddingGroup && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-950 border-2 border-blue-500/30 rounded-2xl p-4 mt-2 space-y-3 shadow-xl"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        placeholder="CODE"
                        value={groupFormData.code}
                        onChange={e => setGroupFormData({...groupFormData, code: e.target.value})}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-black text-white uppercase placeholder:text-slate-700 outline-none focus:border-blue-500"
                      />
                      <input 
                        placeholder="NAME"
                        value={groupFormData.name}
                        onChange={e => setGroupFormData({...groupFormData, name: e.target.value})}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-black text-white uppercase placeholder:text-slate-700 outline-none focus:border-blue-500"
                      />
                    </div>
                    <button 
                      onClick={handleQuickAddGroup}
                      disabled={isSavingGroup || !groupFormData.code || !groupFormData.name}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {isSavingGroup ? "CREATING..." : "CONFIRM NEW GROUP"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div>
              <label className="label-base text-blue-400">Location</label>
              <select 
                value={formData.locationId}
                onChange={e => setFormData({...formData, locationId: e.target.value})}
                className="input-base   cursor-pointer  "
              >
                <option value="">Select Location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="label-base text-blue-400">Package Activate Date</label>
              <input 
                type="date" 
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
                onClick={(e) => (e.target as any).showPicker?.()}
                className="input-base    custom-date-input"
              />
            </div>
            <div className="grid grid-cols-1 gap-1">
              <label className="label-base text-blue-400">Package Timeline</label>
              <div className="grid grid-cols-2 gap-1">
                <button 
                  onClick={() => setFormData({...formData, effectiveMonth: 'current'})}
                  className={cn("h-11 rounded-lg border text-[10px] font-black uppercase transition-all tracking-widest", formData.effectiveMonth === 'current' ? "bg-white text-slate-950 border-white" : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300")}
                >
                  Last
                </button>
                <button 
                  onClick={() => setFormData({...formData, effectiveMonth: 'specific'})}
                  className={cn("h-11 rounded-lg border text-[10px] font-black uppercase transition-all tracking-widest", formData.effectiveMonth === 'specific' ? "bg-white text-slate-950 border-white" : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300")}
                >
                  Spec
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="label-base text-blue-400">Discount Type</label>
              <select 
                value={formData.discountType}
                onChange={e => setFormData({...formData, discountType: e.target.value as any})}
                className="input-base   cursor-pointer  "
              >
                <option value="value">Fixed Value</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className="label-base text-blue-400">Discount Value</label>
              <input 
                type="number"
                value={formData.discountValue}
                onChange={e => setFormData({...formData, discountValue: Number(e.target.value)})}
                className="input-base    "
              />
            </div>
          </div>
          
          {formData.effectiveMonth === 'specific' && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={formData.specialMonth.split('-')[1]}
                onChange={e => {
                  const year = formData.specialMonth.split('-')[0];
                  setFormData({...formData, specialMonth: `${year}-${e.target.value}`});
                }}
                className="input-base     cursor-pointer"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>{m.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={formData.specialMonth.split('-')[0]}
                onChange={e => {
                  const month = formData.specialMonth.split('-')[1];
                  setFormData({...formData, specialMonth: `${e.target.value}-${month}`});
                }}
                className="input-base     cursor-pointer"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t border-slate-800 pt-4 mt-6">
            <label className="label-base text-blue-400 text-xs">Day Slots (Select Days & Times)</label>
            <div className="space-y-3 mt-3">
              {daySlots.map((slot, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <select 
                    value={slot.dayOfWeek}
                    onChange={(e) => {
                      const newSlots = [...daySlots];
                      newSlots[index].dayOfWeek = e.target.value;
                      setDaySlots(newSlots);
                    }}
                    className="input-base   flex-1  !h-12 !min-h-[3rem] cursor-pointer"
                  >
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                  </select>
                  <select
                    value={slot.time}
                    onChange={(e) => {
                      const newSlots = [...daySlots];
                      newSlots[index].time = e.target.value;
                      setDaySlots(newSlots);
                    }}
                    className="input-base   w-32 !h-12 !min-h-[3rem]  cursor-pointer"
                  >
                    {TIME_SLOTS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => setDaySlots(daySlots.filter((_, i) => i !== index))}
                    className="h-12 w-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center border-red-500/30 border hover:bg-red-500 hover:text-white transition"
                  >
                    <X size={16} strokeWidth={3} />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => setDaySlots([...daySlots, { dayOfWeek: 'Saturday', time: '17:00'}])}
                className="text-xs font-bold text-blue-400 bg-blue-600/10 px-4 py-2 mt-2 rounded-lg flex items-center justify-center gap-2 border border-blue-600/30 hover:bg-blue-600 hover:text-white transition w-full italic"
              >
                <Plus size={14} strokeWidth={3} /> ADD DAY SLOT
              </button>
            </div>
          </div>

          <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl text-sm font-bold mt-4 border border-emerald-500/30 uppercase tracking-widest leading-relaxed">
            Will generate <span className="text-white">{formData.numSessions}</span> sessions starting from <span className="text-white">{formData.startDate}</span> on selected days, continuing week by week.
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button onClick={onClose} className="flex-1 px-5 py-3 text-sm font-black text-slate-500 uppercase tracking-widest hover:text-white transition">Cancel</button>
          <button 
            disabled={isGenerating}
            onClick={handleGenerate}
            className="flex-[2] flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-sm tracking-widest shadow-bento hover:bg-blue-500 transition disabled:opacity-50"
          >
            <PackageIcon size={16} />
            {isGenerating ? "Executing..." : "Generate Schedule"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EditPackageModal({ pkg, onClose }: any) {
  const { packageTypes, updateMasterData, pricingSchemes, sessions, groups, addMasterData, players } = useData();
  const [formData, setFormData] = useState({
    packageTypeCode: pkg?.packageTypeCode || '',
    numSessions: pkg?.numSessions || 8,
    nbScheduledSessions: pkg?.nbScheduledSessions !== undefined && pkg?.nbScheduledSessions !== null ? pkg.nbScheduledSessions : undefined,
    startDate: pkg?.startDate || '',
    effectiveMonth: pkg?.effectiveMonth === 'current' || !pkg?.effectiveMonth?.includes('-') ? 'current' : 'specific',
    specialMonth: (pkg?.effectiveMonth && pkg?.effectiveMonth.includes('-')) ? pkg.effectiveMonth : new Date().toISOString().slice(0, 7),
    note: pkg?.note || '',
    discountType: pkg?.discountType || 'value',
    discountValue: pkg?.discountValue || 0,
    groupId: pkg?.groupId || players.find((p: any) => String(p.id) === String(pkg?.playerId))?.groupId || '',
    baseAmount: pkg?.baseAmountOverride || 0 // Initialize from override if it was explicitly set
  });

  const [isUpdating, setIsUpdating] = useState(false);
  
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [groupFormData, setGroupFormData] = useState({ code: '', name: '' });
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const handleQuickAddGroup = async () => {
    if (!groupFormData.code || !groupFormData.name) return;
    setIsSavingGroup(true);
    try {
      const usedColors = new Set(groups.map((g: any) => g.color));
      const color = DISTINCT_COLORS.find(c => !usedColors.has(c)) || DISTINCT_COLORS[groups.length % DISTINCT_COLORS.length];
      const newGroup = await addMasterData('groups', { ...groupFormData, color });
      setFormData({ ...formData, groupId: (newGroup as any).id });
      setIsAddingGroup(false);
      setGroupFormData({ code: '', name: '' });
    } catch (error) {
      console.error("Failed to add group", error);
    } finally {
      setIsSavingGroup(false);
    }
  };

  const monthToUse = formData.effectiveMonth === 'specific' ? formData.specialMonth : 'current';
  const pkgSessions = sessions.filter((s: any) => String(s.packageId) === String(pkg.id));

  const { derivedBaseAmount: derivedBase } = useMemo(() => {
    // We pass a temporary package object to verify what the values would be
    const tempPkg = { ...pkg, packageTypeCode: formData.packageTypeCode, numSessions: formData.numSessions, effectiveMonth: monthToUse, startDate: formData.startDate, forceSystemPricing: true };
    return calculatePackageValues(tempPkg, pkgSessions, pricingSchemes);
  }, [pkgSessions, formData.packageTypeCode, formData.numSessions, monthToUse, formData.startDate, pricingSchemes, pkg]);

  const scheme = findBestPricingScheme(pricingSchemes, formData.packageTypeCode, Number(formData.numSessions), monthToUse, formData.startDate);
  const sessionValue = scheme ? scheme.sessionValue : 0;

  const isDirty = formData.packageTypeCode !== (pkg?.packageTypeCode || '') || 
                  formData.numSessions !== Number(pkg?.numSessions || 8) ||
                  (formData.effectiveMonth === 'specific' ? formData.specialMonth : 'current') !== (pkg?.effectiveMonth || '');
  
  // If we have sessions, we ALWAYS prefer the derived base (which now uses the selected timeline's pricing)
  // If no sessions, we fall back to sessionValue * numSessions
  const baseAmount = useMemo(() => {
    let raw = 0;
    if (formData.baseAmount > 0) raw = formData.baseAmount;
    else if (pkgSessions.length > 0) raw = derivedBase;
    else raw = sessionValue * Number(formData.numSessions);
    return raw;
  }, [formData.baseAmount, pkgSessions.length, derivedBase, sessionValue, formData.numSessions]);
  
  const discountAmount = useMemo(() => {
    if (formData.discountType === 'percent') {
      return (baseAmount * formData.discountValue) / 100;
    }
    return formData.discountValue;
  }, [baseAmount, formData.discountType, formData.discountValue]);
  
  const totalDue = baseAmount - discountAmount;

  const handleUpdate = async () => {
    setIsUpdating(true);
    await updateMasterData('packages', pkg.id, {
      ...pkg,
      packageTypeCode: formData.packageTypeCode,
      numSessions: Number(formData.numSessions),
      nbScheduledSessions: formData.nbScheduledSessions !== undefined ? Number(formData.nbScheduledSessions) : null,
      startDate: formData.startDate,
      effectiveMonth: monthToUse,
      baseAmount,
      baseAmountOverride: formData.baseAmount > 0 ? formData.baseAmount : null,
      discountType: formData.discountType,
      discountValue: formData.discountValue,
      discountAmount,
      totalDue,
      note: formData.note,
      groupId: formData.groupId
    });

    // Update Player's primary group if changed at package level
    const playerRecord = players.find((p: any) => p.id === pkg.playerId);
    if (playerRecord) {
      await updateMasterData('players', playerRecord.id, {
        ...playerRecord,
        groupId: formData.groupId
      });
    }

    setIsUpdating(false);
    onClose();

    // Trigger background sync of session prices and labels if the type or timeline changed
    const isPackageTypeChanged = formData.packageTypeCode !== (pkg?.packageTypeCode || '');
    const isTimelineChanged = monthToUse !== (pkg?.effectiveMonth || '');
    
    if (pkgSessions.length > 0 && (isPackageTypeChanged || isTimelineChanged)) {
      for (const [idx, s] of pkgSessions.entries()) {
        const newPrefix = formData.packageTypeCode || 'SES';
        const newIndex = `${newPrefix}-${idx + 1}`;
        
        const finalScheme = findBestPricingScheme(pricingSchemes, newPrefix, Number(formData.numSessions), monthToUse, formData.startDate);
        
        const updateData: any = { sessionIndex: newIndex };
        if (finalScheme) {
          updateData.value = finalScheme.sessionValue;
          updateData.cost = finalScheme.sessionCost || 0;
        }
        
        await updateMasterData('sessions', s.id, updateData);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-slate-900 w-full max-w-lg overflow-y-auto max-h-[90vh] custom-scrollbar rounded-[2.5rem] p-8 border-2 border-slate-800 shadow-bento">
        <div className="absolute top-0 right-0 p-6">
           <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-950 border border-slate-800 text-slate-500 hover:text-white transition"><X size={16} /></button>
        </div>
        
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-white mb-4 border-2 border-slate-900 shadow-bento rotate-3">
          <Edit2 size={24} strokeWidth={3} />
        </div>
        
        <h2 className="text-4xl font-black text-white uppercase tracking-tight leading-none mb-6">Edit Package</h2>
        
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 grid grid-cols-2 gap-4 relative group/stats">
          <div>
             <div className="flex items-center gap-2 mb-1">
               <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Base Amount</span>
               {pkgSessions.length > 0 && (
                 <button 
                   onClick={() => setFormData(prev => ({ ...prev, packageTypeCode: pkg?.packageTypeCode || '', numSessions: pkg?.numSessions || 8 }))}
                   className="opacity-0 group-hover/stats:opacity-100 transition-opacity text-[8px] bg-slate-800 hover:bg-slate-700 text-blue-400 px-1.5 py-0.5 rounded uppercase font-black"
                   title="Reset to derived session sum"
                 >
                   Sync
                 </button>
               )}
             </div>
             <span className="text-lg text-white font-black">{formatCurrency(baseAmount)}</span>
          </div>
          <div className="text-right">
             <span className="text-xs text-slate-500 font-bold uppercase tracking-widest block mb-1">Total package due</span>
             <span className="text-xl text-emerald-400 font-black">{formatCurrency(totalDue)}</span>
          </div>
          <div className="col-span-2 pt-2 border-t border-slate-900 flex justify-between items-center">
             <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Discount applied:</span>
             <span className="text-xs text-red-400 font-black">-{formatCurrency(discountAmount || 0)}</span>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="mb-4">
            <label className="label-base text-blue-400">Base Amount Override (Leave 0 to use system calculated: {formatCurrency(derivedBase)})</label>
            <input 
              type="number"
              value={formData.baseAmount}
              onChange={e => setFormData({...formData, baseAmount: Number(e.target.value)})}
              className="input-base    "
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label-base text-red-400">Discount Type</label>
              <select 
                value={formData.discountType}
                onChange={e => setFormData({...formData, discountType: e.target.value as any})}
                className="input-base   cursor-pointer  "
              >
                <option value="value">Fixed Value</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className="label-base text-red-400">Discount Value</label>
              <input 
                type="number"
                value={formData.discountValue}
                onChange={e => setFormData({...formData, discountValue: Number(e.target.value)})}
                className="input-base    "
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-base text-orange-400 text-[10px]">Package Type</label>
              <select 
                value={formData.packageTypeCode}
                onChange={e => setFormData({...formData, packageTypeCode: e.target.value})}
                className="input-base   cursor-pointer  "
              >
                <option value="">Select Type</option>
                {packageTypes.map(t => <option key={t.id} value={t.code}>{t.name} ({t.code})</option>)}
              </select>
            </div>
            <div>
              <label className="label-base text-orange-400 text-[10px]">Sessions Package</label>
              <input 
                type="number"
                min="1"
                max="99"
                value={formData.numSessions}
                onChange={e => setFormData({...formData, numSessions: Number(e.target.value)})}
                className="input-base    "
              />
            </div>
            <div>
              <label className="label-base text-orange-400 text-[10px] truncate" title="Number of sessions actually scheduled/generated">NB Sched. Ses.</label>
              <input 
                type="number"
                min="0"
                max="99"
                value={formData.nbScheduledSessions === undefined ? formData.numSessions : formData.nbScheduledSessions}
                onChange={e => setFormData({...formData, nbScheduledSessions: e.target.value === '' ? undefined : Number(e.target.value)})}
                className="input-base    "
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="label-base text-orange-400">Group</label>
              <div className="flex gap-2">
                <select 
                  value={formData.groupId}
                  onChange={e => setFormData({...formData, groupId: e.target.value})}
                  className="input-base   cursor-pointer   flex-1"
                >
                  <option value="">Select Group</option>
                  {groups.filter(g => {
                     const isGroupActive = g.isActive !== false;
                     const pl = players.find((p: any) => String(p.id) === String(pkg?.playerId));
                     const isAssigned = (pl?.groupAssignments && pl.groupAssignments.some((a: any) => String(a.groupId) === String(g.id) && a.isActive === true)) || (pl?.groupId && String(pl.groupId) === String(g.id)) || String(pkg?.groupId) === String(g.id) || String(formData.groupId) === String(g.id);
                     return isGroupActive || isAssigned;
                  }).map(g => <option key={g.id} value={g.id}>{g.code} - {g.name}</option>)}
                </select>
                <button 
                  onClick={() => setIsAddingGroup(!isAddingGroup)}
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center border-2 transition-all shadow-sm shrink-0",
                    isAddingGroup ? "bg-red-500 border-red-400 text-white" : "bg-slate-950 border-slate-800 text-orange-400 hover:border-orange-500"
                  )}
                >
                  {isAddingGroup ? <X size={20} /> : <Plus size={20} />}
                </button>
              </div>

              <AnimatePresence>
                {isAddingGroup && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-950 border-2 border-orange-500/30 rounded-2xl p-4 mt-2 space-y-3 shadow-xl"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        placeholder="CODE"
                        value={groupFormData.code}
                        onChange={e => setGroupFormData({...groupFormData, code: e.target.value})}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-black text-white uppercase placeholder:text-slate-700 outline-none focus:border-orange-500"
                      />
                      <input 
                        placeholder="NAME"
                        value={groupFormData.name}
                        onChange={e => setGroupFormData({...groupFormData, name: e.target.value})}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-black text-white uppercase placeholder:text-slate-700 outline-none focus:border-orange-500"
                      />
                    </div>
                    <button 
                      onClick={handleQuickAddGroup}
                      disabled={isSavingGroup || !groupFormData.code || !groupFormData.name}
                      className="w-full bg-orange-600 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {isSavingGroup ? "CREATING..." : "CONFIRM NEW GROUP"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div>
              <label className="label-base text-orange-400">Package Activate Date</label>
              <input 
                type="date" 
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
                onClick={(e) => (e.target as any).showPicker?.()}
                className="input-base    custom-date-input"
              />
            </div>
          </div>

          <div>
            <label className="label-base text-orange-400">Package Timeline</label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              <button 
                onClick={() => setFormData({...formData, effectiveMonth: 'current'})}
                className={cn("h-11 rounded-lg border text-[10px] font-black uppercase transition-all tracking-widest", formData.effectiveMonth === 'current' ? "bg-white text-slate-950 border-white" : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300")}
              >
                Last
              </button>
              <button 
                onClick={() => setFormData({...formData, effectiveMonth: 'specific'})}
                className={cn("h-11 rounded-lg border text-[10px] font-black uppercase transition-all tracking-widest", formData.effectiveMonth === 'specific' ? "bg-white text-slate-950 border-white" : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300")}
              >
                Spec
              </button>
            </div>
          </div>
          {formData.effectiveMonth === 'specific' && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <select
                value={formData.specialMonth.split('-')[1]}
                onChange={e => {
                  const year = formData.specialMonth.split('-')[0];
                  setFormData({...formData, specialMonth: `${year}-${e.target.value}`});
                }}
                className="input-base     cursor-pointer"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>{m.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={formData.specialMonth.split('-')[0]}
                onChange={e => {
                  const month = formData.specialMonth.split('-')[1];
                  setFormData({...formData, specialMonth: `${e.target.value}-${month}`});
                }}
                className="input-base     cursor-pointer"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          <div>
             <label className="label-base text-orange-400">Note</label>
             <input 
               type="text"
               value={formData.note}
               onChange={e => setFormData({...formData, note: e.target.value})}
               placeholder="Optional note"
               className="input-base   "
             />
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button onClick={onClose} className="flex-1 px-5 py-3 text-sm font-black text-slate-500 uppercase tracking-widest hover:text-white transition">Cancel</button>
          <button 
            disabled={isUpdating}
            onClick={handleUpdate}
            className="flex-[2] flex items-center justify-center gap-2 bg-orange-600 text-white font-black py-4 rounded-2xl uppercase text-sm tracking-widest shadow-bento hover:bg-orange-500 transition disabled:opacity-50"
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AddSessionModal({ player, activePackage, currentPackageSessions, onClose }: any) {
  const { addMasterData, updateMasterData, pricingSchemes, locations, groups } = useData();
  
  const activeGroups = useMemo(() => {
    return (groups || []).filter((g: any) => {
      if (player?.groupAssignments && player.groupAssignments.length > 0) {
        const assignment = player.groupAssignments.find((a: any) => String(a.groupId) === String(g.id));
        return assignment?.isActive === true;
      }
      return player?.groupId && String(g.id) === String(player.groupId);
    });
  }, [groups, player]);
  
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  const [sessionsToCreate, setSessionsToCreate] = useState(() => {
    if (activePackage) {
      const consumedAndScheduled = currentPackageSessions.filter((s:any) => ['Attended', 'Compensated', 'Attended Comp. Session', 'Scheduled', 'Absent'].includes(s.status)).length;
      const count = Math.max(0, (activePackage?.numSessions || 0) - consumedAndScheduled);
      return count > 0 ? count : 8;
    }
    return 8;
  });
  const [startDate, setStartDate] = useState(() => {
    if (currentPackageSessions && currentPackageSessions.length > 0) {
        const sorted = [...currentPackageSessions].sort((a:any, b:any) => a.date.localeCompare(b.date));
        const lastDateStr = sorted[sorted.length - 1].date;
        if (lastDateStr) {
           const d = new Date(`${lastDateStr}T12:00:00`);
           d.setDate(d.getDate() + 1);
           return d.toISOString().slice(0, 10);
        }
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [weeklySlots, setWeeklySlots] = useState(() => {
     const patterns = new Set<string>();
     currentPackageSessions.forEach((s: any) => {
         if (s.date && s.startTime) {
             const d = new Date(`${s.date}T12:00:00`);
             patterns.add(`${d.getDay()}|${s.startTime}`);
         }
     });
     let slots = Array.from(patterns).map(p => {
         const [day, time] = p.split('|');
         return { day: Number(day), time };
     });
     if (slots.length === 0) slots = [{ day: 6, time: '17:00' }];
     return slots;
  });

  const lastSessionLocationId = useMemo(() => {
    if (currentPackageSessions && currentPackageSessions.length > 0) {
      const sorted = [...currentPackageSessions].sort((a,b) => b.date.localeCompare(a.date));
      return sorted[0].locationId;
    }
    return player?.locationId || '';
  }, [currentPackageSessions, player]);

  const [sessionsToAdd, setSessionsToAdd] = useState([{
    date: new Date().toISOString().slice(0, 10),
    time: '17:00'
  }]);

  const [commonData, setCommonData] = useState({
    locationId: lastSessionLocationId,
    status: 'Scheduled',
    groupId: player?.groupId || ''
  });

  const addSessionRow = () => setSessionsToAdd([...sessionsToAdd, { date: new Date().toISOString().slice(0, 10), time: '17:00' }]);
  const removeSessionRow = (index: number) => setSessionsToAdd(sessionsToAdd.filter((_, i) => i !== index));
  const updateSessionRow = (index: number, field: string, value: string) => {
    const newSessions = [...sessionsToAdd];
    newSessions[index] = { ...newSessions[index], [field]: value };
    setSessionsToAdd(newSessions);
  };

  const handleAdd = async () => {
    try {
      const nSessions = Number(activePackage?.numSessions || 8);
      const effectiveMonth = activePackage?.effectiveMonth || 'current';
      
      const scheme = findBestPricingScheme(pricingSchemes, activePackage?.packageTypeCode || 'G2', nSessions, effectiveMonth, activePackage?.startDate || new Date().toISOString().slice(0, 10));
      const sessionValue = scheme ? scheme.sessionValue : 0;
      const sessionCost = scheme ? (scheme.sessionCost || 0) : 0;
      
      let totalAddedValue = 0;
      let finalSessions: any[] = [];

      if (mode === 'manual') {
        finalSessions = sessionsToAdd;
      } else {
        // Auto logic
        const start = parseISO(startDate);
        let current = new Date(start);
        
        // Find next scheduled days
        while (finalSessions.length < sessionsToCreate) {
           const dayOfWeek = current.getDay(); // 0 is Sunday
           const slot = weeklySlots.find(s => Number(s.day) === dayOfWeek);
           if (slot) {
             finalSessions.push({
               date: format(current, 'yyyy-MM-dd'),
               time: slot.time
             });
           }
           current = addDays(current, 1);
           if (finalSessions.length > 100) break; // safety
        }
      }

      for (let i = 0; i < finalSessions.length; i++) {
        const session = finalSessions[i];
        
        await addMasterData('sessions', {
         packageId: activePackage.id!,
         playerId: player!.id!,
         groupId: commonData.groupId || '',
         date: session.date, 
         startTime: session.time || '17:00',
         status: commonData.status as any,
         locationId: commonData.locationId,
         sessionIndex: `${activePackage.packageTypeCode}-${currentPackageSessions.length + 1 + i}`,
         value: sessionValue,
         cost: sessionCost,
         discount: 0
       });
       totalAddedValue += sessionValue;
      }

       // Update package totalDue
       const newBase = (activePackage.baseAmount || 0) + totalAddedValue;
       await updateMasterData('packages', activePackage.id!, {
         baseAmount: newBase,
         totalDue: newBase - (activePackage.discountAmount || 0)
       });

       onClose();
    } catch (error) {
      console.error("Failed to add sessions", error);
      alert("Failed to add sessions");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border-2 border-slate-800 shadow-bento overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
            <Calendar size={20} className="text-blue-500" />
            Add Session
          </h2>
          <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800/50">
            <button 
              onClick={() => setMode('manual')}
              className={cn("px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", mode === 'manual' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}
            >
              Manual
            </button>
            <button 
              onClick={() => setMode('auto')}
              className={cn("px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", mode === 'auto' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300")}
            >
              Auto
            </button>
          </div>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
           {mode === 'manual' ? (
             <div className="space-y-4">
                {sessionsToAdd.map((session, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="label-base text-[10px] opacity-50">Session Date</label>
                      <input 
                        type="date" 
                        value={session.date}
                        onChange={e => updateSessionRow(index, 'date', e.target.value)}
                        className="input-base   "
                      />
                    </div>
                    <div className="flex-1">
                      <label className="label-base text-[10px] opacity-50">Time</label>
                      <select
                        value={session.time}
                        onChange={e => updateSessionRow(index, 'time', e.target.value)}
                        className="input-base   cursor-pointer  "
                      >
                        {TIME_SLOTS.map(t => (
                          <option key={t.value} value={t.value} className="bg-slate-900">{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <button onClick={() => removeSessionRow(index)} className="p-3 bg-red-900/20 text-red-500 rounded-2xl hover:bg-red-900/40 transition"><X size={18}/></button>
                  </div>
                ))}
                <button onClick={addSessionRow} className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 hover:text-slate-300 hover:border-slate-600 uppercase text-xs font-bold tracking-widest transition-all"><Plus size={16}/> Add another date</button>
             </div>
           ) : (
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-base text-[10px] opacity-50">Count</label>
                    <input 
                      type="number" 
                      value={sessionsToCreate}
                      onChange={e => setSessionsToCreate(Number(e.target.value))}
                      className="input-base  text-white "
                    />
                  </div>
                  <div>
                    <label className="label-base text-[10px] opacity-50">Start From</label>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="input-base  text-white "
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-800/50">
                  <label className="label-base text-[10px] opacity-50">Weekly Schedule</label>
                  {weeklySlots.map((slot, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <select 
                        value={slot.day}
                        onChange={e => {
                          const newSlots = [...weeklySlots];
                          newSlots[index].day = Number(e.target.value);
                          setWeeklySlots(newSlots);
                        }}
                        className="flex-1 input-base     h-12"
                      >
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, d) => (
                          <option key={d} value={d} className="bg-slate-900">{day}</option>
                        ))}
                      </select>
                      <select 
                        value={slot.time}
                        onChange={e => {
                          const newSlots = [...weeklySlots];
                          newSlots[index].time = e.target.value;
                          setWeeklySlots(newSlots);
                        }}
                        className="flex-1 input-base     h-12"
                      >
                        {TIME_SLOTS.map(t => (
                          <option key={t.value} value={t.value} className="bg-slate-900">{t.label}</option>
                        ))}
                      </select>
                      <button onClick={() => setWeeklySlots(weeklySlots.filter((_, i) => i !== index))} className="p-3 bg-red-900/20 text-red-500 rounded-2xl hover:bg-red-900/40 transition"><X size={18}/></button>
                    </div>
                  ))}
                  <button onClick={() => setWeeklySlots([...weeklySlots, { day: 1, time: '17:00' }])} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 hover:text-slate-300 uppercase text-[10px] font-black tracking-[0.2em] transition-all"><Plus size={14}/> Add Day</button>
                </div>
             </div>
           )}
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t-2 border-slate-800">
             <div>
               <label className="label-base text-[10px] opacity-50">Location (All)</label>
               <select
                 value={commonData.locationId}
                 onChange={e => setCommonData({...commonData, locationId: e.target.value})}
                 className="input-base   cursor-pointer  "
               >
                 <option value="">Select Location</option>
                 {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
               </select>
             </div>
             <div>
               <label className="label-base text-[10px] opacity-50">Status (All)</label>
               <select
                 value={commonData.status}
                 onChange={e => setCommonData({...commonData, status: e.target.value})}
                 className="input-base   cursor-pointer  "
               >
                 <option value="Scheduled">Scheduled</option>
                 <option value="Hold">Hold</option>
                 <option value="Absent">Absent</option>
                 <option value="Attended">Attended</option>
                 <option value="Compensated">Compensated</option>
               </select>
             </div>
             <div>
               <label className="label-base text-[10px] opacity-50">Group (All)</label>
               <select
                 value={commonData.groupId}
                 onChange={(e) => {
                   const newGroupId = e.target.value;
                   let isActive = false;
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
                   setCommonData({...commonData, groupId: newGroupId});
                 }}
                 className="input-base cursor-pointer"
               >
                 <option value="">NO GROUP</option>
                 {activeGroups.map((g: any) => <option key={g.id} value={g.id}>{g.code} - {g.name}</option>)}
               </select>
             </div>
           </div>
        </div>

        <div className="flex gap-4 mt-10">
           <button onClick={onClose} className="flex-1 px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-white transition">Cancel</button>
           <button 
             onClick={handleAdd}
             className="flex-1 bg-blue-600 text-white font-black py-4 rounded-[1.5rem] uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all transform hover:-translate-y-1 active:scale-95"
           >
             Confirm
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatusStyles(status: string) {
  if (['Attended', 'Compensated'].includes(status)) return "text-emerald-400 border-emerald-500 bg-emerald-950/20 focus:ring-emerald-500/50";
  if (['Absent', 'Cancelled'].includes(status)) return "text-red-400 border-red-500 bg-red-950/20 focus:ring-red-500/50";
  if (['Regret', 'Exceptional Regret'].includes(status)) return "text-orange-400 border-orange-500 bg-orange-950/20 focus:ring-orange-500/50";
  if (status === 'Hold') return "text-gray-400 border-gray-500 bg-gray-950/20 focus:ring-gray-500/50";
  return "text-blue-400 border-blue-500 bg-blue-950/20 focus:ring-blue-500/50";
}

function StatusCombobox({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    const validStatuses = ['Scheduled', 'Absent', 'Attended', 'Compensated', 'Exceptional Regret', 'Regret', 'Cancelled', 'Hold'];
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => { setInputValue(value); }, [value]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                const match = validStatuses.find(s => s.toLowerCase().startsWith(inputValue.toLowerCase()));
                if (match && inputValue.length > 0) {
                    onChange(match);
                } else {
                    setInputValue(value);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [inputValue, value, onChange]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        setIsOpen(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const match = validStatuses.find(s => s.toLowerCase().startsWith(inputValue.toLowerCase()));
            if (match) {
                setInputValue(match);
                onChange(match);
                setIsOpen(false);
            }
        }
    };

    const filtered = validStatuses.filter(s => s.toLowerCase().includes(inputValue.toLowerCase()));
    const optionsToShow = filtered.length > 0 ? filtered : validStatuses;

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center relative">
                <input
                   type="text"
                   value={inputValue}
                   onChange={handleInputChange}
                   onFocus={() => setIsOpen(true)}
                   onKeyDown={handleKeyDown}
                   className={cn(
                        "w-40 px-3 py-1.5 border rounded-lg text-xs font-bold uppercase italic outline-none transition peer",
                        StatusStyles(value)
                   )}
                />
                <button 
                  onClick={() => setIsOpen(!isOpen)}
                  className="absolute right-2 text-slate-500 hover:text-white"
                >
                  <ChevronDown size={14} />
                </button>
            </div>
            {isOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    {optionsToShow.map(s => (
                        <div 
                           key={s} 
                           className="px-3 py-2 text-xs text-white hover:bg-slate-800 cursor-pointer text-left font-semibold uppercase italic"
                           onClick={() => {
                               setInputValue(s);
                               onChange(s);
                               setIsOpen(false);
                           }}
                        >
                           {s}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const SummaryBox = ({ label, value, color, bg }: { label: string, value: string | number, color: string, bg: string }) => (
  <div className={cn("border border-slate-100 px-3 py-2 rounded-xl min-w-[80px] text-center shadow-sm", bg)}>
    <p className={cn("text-xl font-black leading-none mb-1 tracking-tighter", color)}>{value}</p>
    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
  </div>
);

const StatBox = ({ label, value, color, bg, border }: { label: string, value: string | number, color: string, bg: string, border: string }) => (
  <div className={cn("py-2 px-1 rounded-lg border flex flex-col items-center justify-center gap-2 shadow-sm", bg, border)}>
    <span className={cn("text-xl font-black tracking-tighter leading-none", color)}>{value}</span>
    <span className={cn("text-[9px] font-black uppercase tracking-widest leading-none opacity-60 text-center", color)}>{label}</span>
  </div>
);

function ScheduleReportModal({ player, activePackage, sessions, visibleSessions, playerPackages, derivedTotalDue, realPaidAmount, derivedBaseAmount, derivedTotalDiscount, payments, onClose }: any) {
  const { groups, locations, pricingSchemes } = useData();
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);

  const activePackagePayments = useMemo(() => 
    payments.filter((p: any) => String(p.packageId) === String(activePackage?.id)).sort((a: any, b: any) => (a.date || '').localeCompare(b.date || '')),
    [payments, activePackage?.id]
  );

  const isExcludedInner = (status: string | undefined | null) => {
    if (!status) return true;
    const EXCLUDED = ['Cancelled', 'Hold', 'Regret', 'Exceptional Regret'];
    return EXCLUDED.includes(status);
  };

  const currentPackageSessionsInner = useMemo(() => 
    (sessions || []).filter((s: any) => String(s.packageId) === String(activePackage?.id))
    .sort((a,b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || '').localeCompare(b.startTime || '')),
    [sessions, activePackage?.id]
  );

  const activeValidSessions = currentPackageSessionsInner.filter(s => !isExcludedInner(s.status));
  const packageTargetInner = activeValidSessions.length || 1;

  const statsInner = {
    attended: currentPackageSessionsInner.filter(s => s.status === 'Attended' || s.status === 'Compensated' || s.status === 'Attended Comp. Session').length,
    comp: currentPackageSessionsInner.filter(s => s.status === 'Compensated' || s.status === 'Attended Comp. Session').length,
    regrets: currentPackageSessionsInner.filter(s => s.status === 'Regret' || s.status === 'Exceptional Regret').length,
    absent: currentPackageSessionsInner.filter(s => s.status === 'Absent').length,
    cancelled: currentPackageSessionsInner.filter(s => s.status === 'Cancelled').length,
    hold: currentPackageSessionsInner.filter(s => s.status === 'Hold').length,
    pending: currentPackageSessionsInner.filter(s => s.status === 'Scheduled').length,
    total: packageTargetInner
  };

  const attendanceRateInner = Math.round((statsInner.attended / statsInner.total) * 100);

  const groupRecordInner = groups.find(g => g.id === player.groupId);
  const groupNameInner = groupRecordInner ? (groupRecordInner.code ? `${groupRecordInner.code} . ${groupRecordInner.name}` : groupRecordInner.name) : 'Captain';
  
  const activePkgIndex = playerPackages.findIndex((p: any) => p.id === activePackage?.id);
  const activePkgLabel = activePkgIndex !== -1 ? `M${activePkgIndex + 1}` : (activePackage?.packageTypeCode || '');

  const filteredPlayerPackagesForStats = useMemo(() => {
    if (activePkgIndex === -1) return playerPackages;
    return playerPackages.slice(0, activePkgIndex + 1);
  }, [playerPackages, activePkgIndex]);

  const pkgIdsInner = useMemo(() => new Set(filteredPlayerPackagesForStats.map(p => p.id)), [filteredPlayerPackagesForStats]);
  const playerLifetimeSessions = useMemo(() => 
    (sessions || []).filter(s => String(s.playerId) === String(player.id) && pkgIdsInner.has(s.packageId)),
    [sessions, player.id, pkgIdsInner]
  );

  const overallAttended = useMemo(() => 
    playerLifetimeSessions.filter((s: any) => (s.status === 'Attended' || s.status === 'Compensated' || s.status === 'Attended Comp. Session')).length,
    [playerLifetimeSessions]
  );

  const overallSessionsBasis = useMemo(() => {
    const validCount = playerLifetimeSessions.filter(s => !isExcludedInner(s.status)).length;
    return validCount;
  }, [playerLifetimeSessions]);

  const overallRate = overallSessionsBasis > 0 ? Math.round((overallAttended / overallSessionsBasis) * 100) : 0;

  const [emailDetails, setEmailDetails] = useState({
    subject: `Attendance Report - C. ${toTitleCase(player.name || '')} - ${activePkgLabel}`,
    body: ''
  });

  useEffect(() => {
    const dueAmount = derivedTotalDue !== undefined ? derivedTotalDue : (activePackage?.totalDue || 0);
    const paidAmount = realPaidAmount !== undefined ? realPaidAmount : (activePackage?.paidAmount || 0);
    const pendingBalanceValue = Math.max(0, dueAmount - paidAmount);

    setEmailDetails({
      subject: `Attendance Report - C. ${toTitleCase(player.name || '')} - ${activePkgLabel}`,
      body: `Hello C. ${toTitleCase(player.name || '')},

Here is your attendance report concerning your Package (${activePkgLabel}):

SUMMARY:
Attended previous sessions: ${statsInner.attended}/${Number(activePackage?.numSessions || 0)}
Remaining session(s): ${statsInner.pending} sessions
Absent: ${statsInner.absent} sessions
Package performance: ${Number(activePackage?.numSessions || 0) > 0 ? Math.round((statsInner.attended / Number(activePackage?.numSessions || 0)) * 100) : 0}%

Payments:
----------------------------------------
Pending Balance: ${Math.round(pendingBalanceValue)} EGP
${pendingBalanceValue > 0 ? 'Payment to be kindly settled in cash or via InstaPay (01222200548 bank acc)\n' : ''}${activePackagePayments.length > 0 
  ? activePackagePayments.map(p => `${p.date ? format(parseISO(p.date), 'dd/MM/yyyy') : '-'}, ${p.amount} EGP, ${p.method || 'Bank'}.`).join('\n') 
  : ''}

To secure your spots and continue training seamlessly, please confirm your earliest renewal interest.

Kind Regards,
Vas-y Padel Academy`
    });
  }, [player.name, activePkgLabel, statsInner.attended, statsInner.pending, statsInner.absent, activePackage?.numSessions, activePackagePayments, derivedTotalDue, realPaidAmount, activePackage?.totalDue, activePackage?.paidAmount]);

  const dueFromPrev = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < activePkgIndex; i++) {
        const pkg = playerPackages[i];
        sum += Math.max(0, (pkg.totalDue || 0) - (pkg.paidAmount || 0));
    }
    return sum;
  }, [playerPackages, activePkgIndex]);

  const handlePrint = () => {
    const reportContent = document.getElementById('report-content');
    if (!reportContent) return;

    // Use derived total if available, else fallback to activePackage.totalDue
    const dueAmount = derivedTotalDue !== undefined ? derivedTotalDue : (activePackage?.totalDue || 0);
    const paidAmount = realPaidAmount !== undefined ? realPaidAmount : (activePackage?.paidAmount || 0);
    const pendingBalance = Math.max(0, dueAmount - paidAmount);

    // Open a new window for professional system report
    const printWindow = window.open('', '_blank', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no');
    
    if (!printWindow) {
      alert("Please allow popups to save/print the system report.");
      return;
    }

    const pkgLabel = activePkgLabel;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Attendance Report - ${player.name} - PKG ${pkgLabel}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            
            @media print {
              @page {
                size: A4 landscape;
                margin: 10mm;
              }
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
                background-color: #f8fafc !important;
                color: #0f172a !important;
              }
              .no-print { display: none !important; }
              .page-break { page-break-after: always; }
              .report-container { box-shadow: none !important; border: none !important; }
              table td, table th {
                white-space: nowrap !important;
                padding: 2px 4px !important;
                font-size: 7pt !important;
                line-height: 1 !important;
              }
              table td:last-child {
                white-space: normal !important;
                min-width: 80px !important;
              }
            }

            body { 
              font-family: 'Inter', sans-serif; 
              background-color: #f1f5f9; 
              color: #0f172a;
              padding: 40px 20px;
              margin: 0;
            }
            
            * { box-sizing: border-box; }
            
            .report-container {
              background-color: white;
              padding: 40px;
              border-radius: 0;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
              width: 100%;
              max-width: 1200px;
              margin: 0 auto;
              position: relative;
            }

    // Enhanced print styles to ensure professional look
    .bg-slate-900 { background-color: #0f172a !important; color: white !important; }
    .bg-slate-800 { background-color: #1e293b !important; color: white !important; }
    .bg-emerald-500 { background-color: #10b981 !important; color: white !important; }
    .bg-emerald-600 { background-color: #059669 !important; color: white !important; }
    .bg-slate-50 { background-color: #f8fafc !important; }
    .bg-slate-100 { background-color: #f1f5f9 !important; }
    .bg-emerald-50 { background-color: #ecfdf5 !important; }
    .bg-blue-50 { background-color: #eff6ff !important; }
    .bg-amber-50 { background-color: #fffbeb !important; }
    .bg-red-50 { background-color: #fef2f2 !important; }
    .bg-purple-50 { background-color: #faf5ff !important; }
    .bg-orange-50 { background-color: #fff7ed !important; }
    
    .text-emerald-500 { color: #10b981 !important; }
    .text-emerald-400 { color: #34d399 !important; }
    .text-emerald-600 { color: #059669 !important; }
    .text-slate-900 { color: #0f172a !important; }
    .text-slate-500 { color: #64748b !important; }
    .text-slate-400 { color: #94a3b8 !important; }
    .text-slate-300 { color: #cbd5e1 !important; }
    .text-white { color: white !important; }
    
    .border-slate-100 { border-color: #f1f5f9 !important; }
    .border-slate-200 { border-color: #e2e8f0 !important; }
    .border-slate-800 { border-color: #1e293b !important; }
    .border-emerald-100 { border-color: #d1fae5 !important; }
    
    .shadow-bento { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important; }
    
    /* Forced background for table headers when printing */
    thead tr { background-color: #f8fafc !important; }
    
    .header-dark { background-color: #0f172a !important; color: white !important; padding: 40px !important; margin: -40px -40px 40px -40px !important; }
    .stat-box-dark { background-color: rgba(30, 41, 59, 0.5) !important; border: 1px solid rgba(51, 65, 85, 0.5) !important; padding: 12px 20px !important; border-radius: 12px !important; display: flex !important; flex-direction: column !important; align-items: center !important; min-width: 100px !important; }
            
            .logo-header { height: 40px; width: auto; object-contain; }
            .logo-footer { height: 32px; width: auto; object-contain; }
          </style>
      </head>
      <body>
          <div class="report-container">
            ${reportContent.innerHTML}
          </div>
          <script>
            // Wait for tailwind and content to load
            window.onload = () => {
              setTimeout(() => {
                window.focus();
                window.print();
                // Close window after printing starts
                window.onafterprint = () => window.close();
              }, 1200);
            };
          </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleEmailReport = async () => {
    if (!player.email) {
      alert("This athlete doesn't have an email address set in their profile.");
      return;
    }
    setShowEmailCompose(true);
  };

  const confirmSendEmail = async (method: 'backend' | 'gmail') => {
    setIsSendingEmail(true);
    try {
      const element = document.getElementById('report-content');
      const filename = `Academy_Report_${player.name}_${activePkgLabel}.pdf`;
      
      const opt = {
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          windowWidth: 1200,
          onclone: (doc: Document) => {
            const container = doc.getElementById('report-content');
            if (container) {
              container.style.width = '1200px';
              container.style.maxWidth = '1200px';
              container.style.padding = '20px';
              container.style.overflow = 'visible';
              container.style.height = 'auto';
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      if (method === 'gmail') {
        // Download the PDF
        // @ts-ignore
        await html2pdf().from(element).set(opt).save();
        
        // Open Gmail
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(player.email)}&su=${encodeURIComponent(emailDetails.subject)}&body=${encodeURIComponent(emailDetails.body)}`;
        window.open(gmailUrl, '_blank');
        
        alert("PDF downloaded! Please attach it manually in the Gmail window that just opened (browsers cannot auto-attach local files).");
        setShowEmailCompose(false);
        return;
      }

      // Backend send
      // @ts-ignore
      const pdfBase64 = await html2pdf().from(element).set(opt).outputPdf('datauristring');
      const base64Data = pdfBase64.split(',')[1];

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: player.email,
          subject: emailDetails.subject,
          body: emailDetails.body,
          attachmentData: base64Data,
          attachmentName: filename,
          isPdf: true
        })
      });

      const result = await response.json();
      if (result.success) {
        alert("Email sent successfully to " + player.email);
        setShowEmailCompose(false);
      } else {
        alert("Failed to send email: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error generating/sending report:", error);
      alert("An error occurred. Check browser console.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const getPkgTypes = (pkgSessions: any[]) => {
    const types = new Set<string>();
    pkgSessions.forEach(s => {
      const type = (s.sessionIndex || '').split('-')[0];
      if (type && isNaN(Number(type))) {
        types.add(type);
      }
    });
    const sortedTypes = Array.from(types).sort();
    return sortedTypes.join(' / ') || 'Mixed';
  };

  const sortedSessions = [...(visibleSessions || [])].sort((a, b) => {
    if (!a?.date && !b?.date) return 0;
    if (!a?.date) return 1;
    if (!b?.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col overflow-hidden font-sans">
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 no-print">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xs italic">V</span>
          </div>
          <h2 className="text-white font-black italic uppercase text-xs tracking-widest">VAS-Y PADEL ACADEMY</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-5 py-2 bg-slate-800 text-white rounded-xl uppercase text-[10px] font-black tracking-widest hover:bg-slate-700 transition">Close</button>
          <button 
            onClick={handleEmailReport} 
            disabled={isSendingEmail}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl uppercase text-[10px] font-black tracking-widest hover:bg-blue-500 transition shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Mail className="inline-block mr-2" size={14} />
            {isSendingEmail ? 'Preparing...' : 'Email Report'}
          </button>
          <button onClick={handlePrint} className="px-5 py-2 bg-emerald-600 text-white rounded-xl uppercase text-[10px] font-black tracking-widest hover:bg-emerald-500 transition shadow-lg">
            <FileDown className="inline-block mr-2" size={14} /> Save PDF
          </button>
        </div>
      </div>

      {showEmailCompose && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 bg-slate-800/50 border-b-2 border-slate-800 flex items-center justify-between">
               <h3 className="text-white font-black uppercase italic tracking-tighter">Compose Email</h3>
               <button onClick={() => setShowEmailCompose(false)} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">To</label>
                  <input type="text" value={player.email} readOnly className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-slate-300  text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
                  <input 
                    type="text" 
                    value={emailDetails.subject} 
                    onChange={e => setEmailDetails(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-white font-bold text-xs focus:border-blue-500 transition outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Message</label>
                  <textarea 
                    rows={6}
                    value={emailDetails.body} 
                    onChange={e => setEmailDetails(prev => ({ ...prev, body: e.target.value }))}
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl px-4 py-2.5 text-white font-bold text-xs focus:border-blue-500 transition outline-none resize-none" 
                  />
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                  <div className="h-8 w-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                    <FileDown size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-tight">Attachment</p>
                    <p className="text-[9px] font-bold text-slate-500 lowercase tracking-widest">Academy_Report_{player.name}_{activePkgLabel}.pdf</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                   onClick={() => confirmSendEmail('gmail')} 
                   disabled={isSendingEmail}
                   className="flex items-center justify-center gap-2 bg-slate-800 text-slate-300 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-750 transition disabled:opacity-30"
                >
                  <Mail size={14} /> Draft in Gmail
                </button>
                <button 
                   onClick={() => confirmSendEmail('backend')}
                   disabled={isSendingEmail}
                   className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition shadow-lg shadow-blue-900/20 disabled:opacity-30"
                >
                  {isSendingEmail ? (
                    <><RefreshCw size={14} className="animate-spin" /> Sending...</>
                  ) : (
                    <><Send size={14} /> Send Now</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div id="report-content" className="flex-1 overflow-y-auto p-4 bg-white text-slate-900">
        <div className="max-w-[1240px] mx-auto space-y-4">
          <div className="flex flex-row items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex gap-6 items-center">
              <div className="w-16 h-16 flex items-center justify-center shrink-0 text-slate-900">
                <VpLogoSvg className="w-full h-full" />
              </div>
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter leading-none whitespace-nowrap">
                    VAS-Y PADEL ACADEMY
                  </h1>
                  <p className="text-lg font-black text-slate-500 italic uppercase tracking-tight whitespace-nowrap">
                    Attendance Report
                  </p>
                  <p className="text-2xl font-black text-emerald-500 italic uppercase tracking-tight whitespace-nowrap">
                    C. {player.name}
                  </p>
                </div>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                  ID {player.id?.slice(-8).toUpperCase()} · GROUP {groupNameInner} · {activePkgLabel}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-4 text-right">
              <div className="flex items-center gap-3">
                <SummaryBox label="PACKAGES" value={filteredPlayerPackagesForStats.length} color="text-slate-900" bg="bg-slate-50" />
                <SummaryBox label="SESSIONS" value={overallSessionsBasis} color="text-slate-900" bg="bg-slate-50" />
                <SummaryBox label="ATTENDED" value={overallAttended} color="text-slate-900" bg="bg-slate-50" />
                <SummaryBox label="RATE" value={`${overallRate}%`} color="text-emerald-600" bg="bg-emerald-50" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-8 gap-1">
            <StatBox label="ATTENDED" value={statsInner.attended} color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100" />
            <StatBox label="COMP." value={statsInner.comp} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
            <StatBox label="REGRETS" value={statsInner.regrets} color="text-amber-600" bg="bg-amber-50" border="border-amber-100" />
            <StatBox label="ABSENT" value={statsInner.absent} color="text-red-600" bg="bg-red-50" border="border-red-100" />
            <StatBox label="CANCELLED" value={statsInner.cancelled} color="text-slate-600" bg="bg-slate-100" border="border-slate-200" />
            <StatBox label="HOLD" value={statsInner.hold} color="text-purple-600" bg="bg-purple-50" border="border-purple-100" />
            <StatBox label="PENDING" value={statsInner.pending} color="text-slate-500" bg="bg-slate-100" border="border-slate-200" />
            <div className="relative group">
              <StatBox label="PKG RATE" value={`${attendanceRateInner}%`} color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5 pb-0.5 border-b-2 border-slate-200">
             <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">{activePkgLabel} — ATTENDANCE SCHEDULE</h3>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <h4 className="text-xs font-black text-slate-900 italic uppercase tracking-tight">{activePkgLabel}</h4>
                 <div className="flex gap-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>Mixed</span>
                    <span>{statsInner.total} sessions</span>
                    <span>2 player(s)/session</span>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 text-[9px] font-black uppercase italic">
                   <span className="text-emerald-600">{statsInner.attended} attended</span>
                   <span className="text-amber-500">{statsInner.total - statsInner.attended - statsInner.pending} remaining</span>
                 </div>
                 <div className="w-24 h-1.5 bg-white border border-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${attendanceRateInner}%` }} />
                 </div>
                 <span className="text-xs font-black text-slate-900 italic">{attendanceRateInner}%</span>
              </div>
            </div>

            <table className="w-auto min-w-full text-[10px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest border-b border-slate-200">
                  <th className="px-4 py-2 w-10 whitespace-nowrap">#</th>
                  <th className="px-4 py-2 whitespace-nowrap">GROUP</th>
                  <th className="px-4 py-2 whitespace-nowrap">SESSION</th>
                  <th className="px-4 py-2 whitespace-nowrap">DATE</th>
                  <th className="px-4 py-2 whitespace-nowrap">DAY</th>
                  <th className="px-4 py-2 whitespace-nowrap">TIME</th>
                  <th className="px-4 py-2 whitespace-nowrap">LOCATION</th>
                  <th className="px-4 py-2 whitespace-nowrap">STATUS</th>
                  <th className="px-4 py-2 whitespace-nowrap">COMMENT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSessions.map((s: any, i: number) => {
                  const sessionGroup = groups.find((g: any) => g.id === (s.groupId || player.groupId));
                  const groupCode = sessionGroup ? (sessionGroup.code || sessionGroup.name) : '—';
                  return (
                    <tr key={`${s.id}-${i}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-1.5 text-slate-400 italic font-medium whitespace-nowrap">{i+1}</td>
                      <td className="px-4 py-1.5 font-normal text-slate-700 whitespace-nowrap">{groupCode}</td>
                      <td className="px-4 py-1.5 font-black text-slate-900 italic uppercase tracking-tight whitespace-nowrap">{(s.sessionIndex?.split('-')[0] || activePackage?.packageTypeCode || 'SES')}-{i + 1}</td>
                      <td className="px-4 py-1.5 font-bold text-slate-600 whitespace-nowrap">{s.date ? format(parseISO(s.date), 'dd/MM/yyyy') : '-'}</td>
                      <td className="px-4 py-1.5 text-slate-500 uppercase font-medium whitespace-nowrap">{s.date ? format(parseISO(s.date), 'EEEE') : '-'}</td>
                      <td className="px-4 py-1.5 font-black text-slate-800 italic whitespace-nowrap">{formatTimeAMPM(s.startTime)}</td>
                      <td className="px-4 py-1.5 text-slate-600 font-medium whitespace-nowrap">{locations.find((l: any) => l.id === s.locationId)?.name || 'Al-Nakhil'}</td>
                      <td className="px-4 py-1.5 whitespace-nowrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter italic",
                          s.status === 'Attended' ? "bg-emerald-100 text-emerald-700" :
                          s.status === 'Compensated' ? "bg-blue-100 text-blue-700" :
                          s.status === 'Regret' || s.status === 'Exceptional Regret' ? "bg-amber-100 text-amber-700" :
                          s.status === 'Absent' ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-600"
                        )}>{s.status || 'Pending'}</span>
                      </td>
                      <td className="px-4 py-1.5 text-[9px] text-slate-400 italic font-medium">{s.comment || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="bg-slate-50 p-4 flex flex-wrap items-start gap-6 border-t border-slate-200">
               <div className="flex items-center gap-3">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">PAYMENT:</span>
                 <span className={cn(
                   "px-3 py-1 rounded-lg text-[9px] font-black uppercase italic tracking-widest shadow-sm",
                   activePackage?.status === 'Paid' ? "bg-emerald-500 text-white" : 
                   activePackage?.status === 'Partially Paid' ? "bg-amber-500 text-slate-950" : 
                   activePackage?.status === 'Free' ? "bg-slate-500 text-white" : "bg-red-500 text-white"
                 )}>{activePackage?.status || 'Not Paid'}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">BASE AMOUNT</span>
                 <span className="text-xs font-black text-slate-900 italic text-center">{formatCurrency(derivedBaseAmount || activePackage?.baseAmount || 0)}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[8px] font-black text-red-500 uppercase tracking-widest text-center">DISCOUNT</span>
                 <span className="text-xs font-black text-red-500 italic text-center">{formatCurrency(derivedTotalDiscount || activePackage?.discountAmount || 0)}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">TOTAL DUE</span>
                 <span className="text-xs font-black text-slate-900 italic text-center">{formatCurrency(derivedTotalDue !== undefined ? derivedTotalDue : (activePackage?.totalDue || 0))}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest text-center">PAID AMOUNT</span>
                 <span className="text-xs font-black text-emerald-600 italic text-center">{formatCurrency(realPaidAmount !== undefined ? realPaidAmount : (activePackage?.paidAmount || 0))}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest text-center">PENDING BALANCE</span>
                 <div className="flex flex-col items-center">
                   <span className="text-xs font-black text-amber-600 italic text-center">
                     {formatCurrency(Math.max(0, Math.max(derivedTotalDue || 0, activePackage?.totalDue || 0) - (realPaidAmount !== undefined ? realPaidAmount : (activePackage?.paidAmount || 0))))}
                   </span>
                   {Math.max(0, Math.max(derivedTotalDue || 0, activePackage?.totalDue || 0) - (realPaidAmount !== undefined ? realPaidAmount : (activePackage?.paidAmount || 0))) > 0 && (
                     <span className="text-[7px] font-normal text-slate-400 uppercase tracking-tighter leading-none mt-1">Settled via Instapay: 01222200548</span>
                   )}
                 </div>
               </div>
               {activePackage?.note && (
                 <div className="flex flex-col ml-auto">
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">OFFICIAL NOTE</span>
                   <span className="text-[11px] font-black text-slate-600 italic leading-tight">{activePackage?.note}</span>
                 </div>
               )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2">
             <div className="space-y-3">
               <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">FINANCIAL REPORT</h3>
               <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                 <table className="w-full text-[10px] text-left border-collapse">
                   <thead>
                     <tr className="text-slate-500 uppercase font-black tracking-widest border-b border-slate-200 bg-slate-50">
                       <th className="px-4 py-2">PKG</th>
                       <th className="px-4 py-2">PAYMENT DATE</th>
                       <th className="px-4 py-2">AMOUNT</th>
                       <th className="px-4 py-2">METHOD</th>
                       <th className="px-4 py-2">DUE FROM PREV</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {activePackagePayments.length > 0 ? (
                       activePackagePayments.map((payment: any, idx: number) => (
                         <tr key={`${payment.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-1.5 font-black text-slate-900 italic">{activePkgLabel}</td>
                           <td className="px-4 py-1.5 text-slate-600 font-bold">{payment.date ? format(parseISO(payment.date), 'dd/MM/yyyy') : '-'}</td>
                           <td className="px-4 py-1.5 font-black text-emerald-600">{formatCurrency(payment.amount || 0)}</td>
                           <td className="px-4 py-1.5 font-bold text-slate-900">{payment.method || '—'}</td>
                           <td className="px-4 py-1.5 font-bold text-slate-900">{idx === 0 ? formatCurrency(dueFromPrev) : '—'}</td>
                         </tr>
                       ))
                     ) : (
                       <tr className="hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-1.5 font-black text-slate-900 italic">{activePkgLabel}</td>
                           <td className="px-4 py-1.5 text-slate-500 italic">No payments recorded</td>
                           <td className="px-4 py-1.5 text-slate-500 font-bold">—</td>
                           <td className="px-4 py-1.5 text-slate-500 font-bold">—</td>
                           <td className="px-4 py-1.5 font-bold text-slate-900">{formatCurrency(dueFromPrev)}</td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>

          <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
             <div className="flex flex-col gap-2">
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Vas-y Padel Academy · Official Attendance Record</p>
               <p className="text-[9px] text-slate-300 font-medium">This is an automated system report generated for academic performance tracking.</p>
             </div>
             <div className="text-right space-y-1">
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Report Generation Date & Time</p>
               <p className="text-slate-900 font-black italic text-base uppercase tracking-tighter">
                 {format(new Date(), 'dd MMMM yyyy · HH:mm:ss')}
               </p>
             </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 right-10 z-[110] no-print flex gap-4">
        <button 
          onClick={handleEmailReport}
          disabled={isSendingEmail}
          className="group relative flex items-center gap-4 bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] hover:bg-blue-500 transition-all duration-300 transform hover:-translate-y-2 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Mail size={22} className="group-hover:translate-y-1 transition-transform" />
          {isSendingEmail ? 'Sending...' : 'Email Report'}
        </button>
        <button 
          onClick={handlePrint}
          className="group relative flex items-center gap-4 bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:bg-emerald-600 transition-all duration-300 transform hover:-translate-y-2 active:scale-95"
        >
          <FileDown size={22} className="group-hover:translate-y-1 transition-transform" />
          Save PDF
        </button>
      </div>
    </div>
  );
}

function EvaluationModal({ player, evaluation, onClose, defaultRedo = false }: { player: Player, evaluation: Evaluation | null, onClose: () => void, defaultRedo?: boolean }) {
  const { addMasterData, updateMasterData, currentUser, evaluations, levels, currentUserRole } = useData();
  const [isRedo, setIsRedo] = useState(defaultRedo);
  
  const lastEval = useMemo(() => {
    return (evaluations || [])
      .filter((e: Evaluation) => e.playerId === player.id)
      .sort((a: Evaluation, b: Evaluation) => b.date.localeCompare(a.date))[0];
  }, [evaluations, player.id]);

  const defaultLevel = useMemo(() => {
    let rawLevel = '';
    if (evaluation) {
      rawLevel = evaluation.level;
    } else if (!lastEval) {
      rawLevel = levels.find(l => l.id === player.levelId)?.name || LEVELS[0];
    } else {
      const currentIndex = LEVELS.findIndex(l => l.toLowerCase() === lastEval.level.toLowerCase());
      if (lastEval.percentage >= 80 && currentIndex !== -1 && currentIndex < LEVELS.length - 1) {
        rawLevel = LEVELS[currentIndex + 1];
      } else {
        rawLevel = lastEval.level;
      }
    }
    
    // Normalize to exact LEVELS string if possible
    return LEVELS.find(l => l.toLowerCase() === rawLevel.toLowerCase()) || LEVELS[0];
  }, [evaluation, lastEval, player.levelId, levels]);

  const [formData, setFormData] = useState({
    date: evaluation?.date || new Date().toISOString().slice(0, 10),
    level: defaultLevel,
    skillScores: evaluation?.skillScores || [] as SkillScore[]
  });

  useEffect(() => {
    if (evaluation) {
      setFormData({
        date: evaluation.date,
        level: evaluation.level,
        skillScores: evaluation.skillScores
      });
    } else {
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        level: defaultLevel,
        skillScores: []
      });
    }
  }, [evaluation]);

  const levelSkills = useMemo(() => 
    SKILL_MATRIX.filter(s => s.level.trim().toLowerCase() === formData.level.trim().toLowerCase()),
    [formData.level]
  );

  useEffect(() => {
    // Cumulative scores: Ensure all skills for the current level exist in skillScores list.
    // This prevents losing scores when switching levels back and forth.
    if (levelSkills.length === 0) return;

    const missingSkills = levelSkills.filter(ls => !formData.skillScores.some(ss => ss.skillId === ls.id));
    
    if (missingSkills.length > 0) {
      setFormData(prev => ({
        ...prev,
        skillScores: [
          ...prev.skillScores,
          ...missingSkills.map(ls => ({ skillId: ls.id, passed: false }))
        ]
      }));
    }
  }, [levelSkills]);

  const stats = useMemo(() => {
    const total = levelSkills.length;
    // Only count passed skills that belong to the current level
    const passed = levelSkills.filter(ls => 
      formData.skillScores.find(ss => ss.skillId === ls.id)?.passed
    ).length;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { total, passed, percentage };
  }, [formData.skillScores, levelSkills]);

  const toggleSkill = (skillId: string) => {
    setFormData(prev => {
      const existing = prev.skillScores.find(ss => ss.skillId === skillId);
      if (existing) {
        return {
          ...prev,
          skillScores: prev.skillScores.map(ss => 
            ss.skillId === skillId ? { ...ss, passed: !ss.passed } : ss
          )
        };
      }
      return {
        ...prev,
        skillScores: [...prev.skillScores, { skillId, passed: true }]
      };
    });
  };

  const handleSave = async () => {
    const evalData: Omit<Evaluation, 'id'> = {
      playerId: player.id!,
      locationId: player.locationId,
      date: formData.date,
      level: formData.level,
      skillScores: formData.skillScores,
      totalSkillsCount: stats.total,
      passedSkillsCount: stats.passed,
      percentage: stats.percentage,
      coachId: evaluation?.coachId || currentUserRole?.id || currentUser?.uid || '',
      coachName: evaluation?.coachName || currentUserRole?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'System Coach',
      ownerId: player.ownerId
    };

    if (evaluation && !isRedo) {
      await updateMasterData('evaluations', evaluation.id!, evalData);
    } else {
      await addMasterData('evaluations', evalData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        className="relative bg-slate-900 w-full max-w-2xl overflow-hidden rounded-[2.5rem] border-2 border-slate-800 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
           <div>
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">
                {evaluation ? 'Evaluation Registry' : 'Academic Assessment'}
              </h2>
              <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest italic">{player.name}</p>
           </div>
           <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-800 text-slate-500 hover:text-white transition group">
              <X size={20} className="group-hover:rotate-90 transition-transform" />
           </button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar space-y-8">
           <div className="grid grid-cols-2 gap-6">
              <div>
                 <label className="label-base text-blue-400">Registry Date</label>
                 <input 
                   type="date" 
                   value={formData.date}
                   onChange={e => setFormData({ ...formData, date: e.target.value })}
                   className="input-base    text-white h-14"
                 />
              </div>
              <div>
                 <label className="label-base text-blue-400">Target Level</label>
                 <select 
                   value={formData.level}
                   onChange={e => setFormData({ ...formData, level: e.target.value })}
                   className="input-base    text-white h-14 cursor-pointer"
                 >
                    {LEVELS.map(l => (
                      <option key={l} value={l} className="bg-slate-900">
                        {l} {l === defaultLevel && !evaluation ? ' (Recommended)' : ''}
                      </option>
                    ))}
                 </select>
              </div>
           </div>

           <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 flex items-center justify-between">
              <div className="flex gap-10">
                 <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Mastery Score</span>
                    <p className={cn(
                      "text-4xl font-black italic",
                      stats.percentage >= 90 ? "text-emerald-500" : "text-blue-500"
                    )}>{stats.percentage}%</p>
                 </div>
                 <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Criteria Met</span>
                    <p className="text-4xl font-black text-white italic tracking-tighter">
                      {stats.passed} <span className="text-slate-700 text-2xl">/ {stats.total}</span>
                    </p>
                 </div>
              </div>
              {stats.percentage >= 90 && (
                <div className="bg-emerald-500/10 border-2 border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                   <div className="bg-emerald-500 h-10 w-10 rounded-full flex items-center justify-center text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                      <Check size={20} strokeWidth={4} />
                   </div>
                   <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic leading-tight">Mastery Achieved<br/>Next Level Unlocked</span>
                </div>
              )}
           </div>

           <div className="space-y-3">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic mb-4">Competency Matrix</h4>
              {levelSkills.map(skill => {
                const isPassed = formData.skillScores.find(ss => ss.skillId === skill.id)?.passed;
                return (
                  <button 
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    className={cn(
                      "w-full p-4 rounded-[1.5rem] border-2 transition-all flex items-center justify-between group",
                      isPassed 
                        ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50" 
                        : "bg-slate-950/30 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-4">
                       <div className={cn(
                         "h-10 w-10 rounded-xl flex items-center justify-center border-2 transition-all",
                         isPassed 
                           ? "bg-emerald-500 border-white/20 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                           : "bg-slate-800 border-slate-700 text-slate-600 group-hover:text-slate-400"
                       )}>
                          {isPassed ? <Check size={20} strokeWidth={3} /> : <Circle size={16} strokeWidth={3}/>}
                       </div>
                       <div className="text-left">
                          <p className={cn("text-xs font-black uppercase italic tracking-tight", isPassed ? "text-white" : "text-slate-400")}>
                            {skill.description}
                          </p>
                          <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Skill ID: {skill.id}</p>
                       </div>
                    </div>
                    {isPassed ? (
                      <span className="text-[11px] font-black text-emerald-500 italic uppercase">Validated</span>
                    ) : (
                      <span className="text-[11px] font-black text-slate-700 italic uppercase">Pending</span>
                    )}
                  </button>
                )
              })}
           </div>
        </div>

        <div className="p-8 border-t border-slate-800 bg-slate-950/50 flex gap-4">
           <button onClick={onClose} className="flex-1 px-5 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition italic">Cancel</button>
            {stats.percentage < 80 && evaluation && (
              <button 
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    date: new Date().toISOString().slice(0, 10),
                    skillScores: levelSkills.map(ls => ({ skillId: ls.id, passed: false }))
                  }));
                  setIsRedo(true);
                }}
                className="flex-[2] bg-slate-800 text-white font-black py-4 rounded-2xl uppercase text-[11px] tracking-[0.2em] shadow-bento hover:bg-slate-700 transition italic flex items-center justify-center gap-3"
              >
                <RotateCcw size={18} />
                Redo test
              </button>
            )}
           <button 
             onClick={handleSave}
             className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl uppercase text-[11px] tracking-[0.2em] shadow-bento hover:bg-blue-500 transition italic flex items-center justify-center gap-3"
           >
             <Save size={18} />
             {evaluation ? 'Commit Changes' : 'Verify & Record Evaluation'}
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function InactiveWarningModal({ player, onClose }: { player: Player, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        className="relative bg-slate-900 w-full max-w-sm overflow-hidden rounded-[2.5rem] border-2 border-red-500/50 shadow-2xl p-8 text-center"
      >
        <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border-2 border-red-500/20 shadow-bento">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Profile Inactive</h2>
        <p className="text-slate-400 mb-8 uppercase text-xs tracking-widest leading-loose">
          {player.name} is currently inactive. Please set the player as active before creating a new package.
        </p>
        <button 
          onClick={onClose}
          className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-[0.2em] shadow-bento hover:bg-red-500 transition italic"
        >
          Got it
        </button>
      </motion.div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className={cn("px-4 py-6 rounded-[2rem] flex flex-col items-center justify-center gap-2 border transition-all shadow-sm", color)}>
       <p className="text-3xl font-black italic leading-none tracking-tighter">{value}</p>
       <p className="text-[9px] font-black uppercase tracking-widest opacity-60 font-bold">{label}</p>
    </div>
  )
}

function BulkModifyModal({ selectedSessionIds, currentPackageSessions, pricingSchemes, locations, packageTypes, playerPackages, groups, player, onClose, updateMasterData }: any) {
  const { sessions } = useData();
  const [targetLocationId, setTargetLocationId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetDayOfWeek, setTargetDayOfWeek] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [targetPackageType, setTargetPackageType] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [targetStatus, setTargetStatus] = useState('');
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApply = async () => {
    if (selectedSessionIds.size === 0) {
      alert("No sessions selected.");
      return;
    }

    setIsProcessing(true);
    try {
      const selectedSessions = sessions.filter((s: any) => selectedSessionIds.has(String(s.id)));
      
      const updatePromises = selectedSessions.map(async (session: any) => {
        const updates: any = {};
        
        if (targetLocationId) updates.locationId = targetLocationId === 'NO BASE' ? '' : targetLocationId;
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
            updates.status = targetStatus;
            if (['Attended', 'Hold', 'Absent', 'Scheduled', 'Cancelled'].includes(targetStatus)) updates.comment = '';
            else if (targetStatus === 'Regret' || targetStatus === 'Exceptional Regret') updates.comment = 'to be compensated';
            else if (targetStatus === 'Compensated') updates.comment = 'attended compensated session';
        }
        
        if (targetPackageType) {
            const newCode = targetPackageType.toUpperCase().trim();
            const oldIndex = session.sessionIndex || 'SES-1';
            const numPart = oldIndex.split('-').pop() || '1';
            const newIndex = `${newCode}-${numPart}`;
            
            const pkg = playerPackages.find((p: any) => String(p.id) === String(session.packageId));
            if (pkg) {
                const monthToUse = pkg.effectiveMonth || 'current';
                const nSessions = pkg?.numSessions || 8;
                
                const pricing = findBestPricingScheme(pricingSchemes, newCode, nSessions, monthToUse, pkg.startDate);
                
                updates.sessionIndex = newIndex;
                updates.value = pricing?.sessionValue || 0;
                updates.cost = pricing?.sessionCost || 0;
            }
        }

        if (targetGroupId) {
            updates.groupId = targetGroupId === 'NO GROUP' ? '' : targetGroupId;
        }

        if (Object.keys(updates).length > 0) {
            await updateMasterData('sessions', session.id!, updates);
        }
      });

      await Promise.all(updatePromises);

      // Re-calculate package totals and update package type if changed
      if (targetPackageType) {
          const packagesToUpdate = Array.from(new Set(selectedSessions.map((s: any) => s.packageId)));
          for (const pkgId of packagesToUpdate) {
              const pkg = playerPackages.find((p: any) => String(p.id) === String(pkgId));
              if (!pkg) continue;

              // Re-calculate based on ALL sessions of this package
              const pkgSessionsAll = sessions.filter((s: any) => String(s.packageId) === String(pkgId));
              
              // Map sessions to their new values to calculate total due correctly
              const updatedSessionsForCalcu = pkgSessionsAll.map(s => {
                  if (selectedSessionIds.has(String(s.id))) {
                      let sCode = targetPackageType.toUpperCase().trim();
                      const pricing = findBestPricingScheme(pricingSchemes, sCode, Number(pkg?.numSessions), pkg.effectiveMonth || 'current', pkg.startDate);
                      const numPart = s.sessionIndex?.split('-').pop() || '1';
                      return { ...s, value: pricing?.sessionValue || 0, sessionIndex: `${sCode}-${numPart}` };
                  }
                  return s;
              });

              const { derivedBaseAmount: newBase } = calculatePackageValues({ ...pkg, packageTypeCode: targetPackageType.toUpperCase().trim() }, updatedSessionsForCalcu, pricingSchemes, true);

              await updateMasterData('packages', String(pkg.id), {
                packageTypeCode: targetPackageType.toUpperCase().trim(),
                baseAmount: newBase,
                totalDue: newBase - (pkg.discountAmount || 0)
              });
          }
      }

      onClose();
    } catch (error) {
      console.error("Bulk update failed", error);
      alert("Failed to apply changes. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter to active groups only
  const activeGroups = (groups || []).filter((g: any) => {
    if (player?.groupAssignments && player.groupAssignments.length > 0) {
      const assignment = player.groupAssignments.find((a: any) => String(a.groupId) === String(g.id));
      return assignment?.isActive === true;
    }
    return player?.groupId && String(g.id) === String(player.groupId);
  });

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
              <div>
                <label className="label-base text-[10px] opacity-50">New Group</label>
                <select
                  value={targetGroupId}
                  onChange={e => setTargetGroupId(e.target.value)}
                  className="input-base    "
                >
                  <option value="">Keep Existing</option>
                  <option value="NO GROUP">NO GROUP</option>
                  {activeGroups.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.code} - {g.name}</option>
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
                  onChange={e => setTargetStatus(e.target.value)}
                  className="input-base    "
                >
                  <option value="">Keep Existing</option>
                  {['Scheduled', 'Attended', 'Absent', 'Exceptional Regret', 'Regret', 'Cancelled', 'Compensated', 'Hold'].map(s => (
                    <option key={s} value={s}>{s}</option>
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

// Custom select component showing only active groups, code-only for current, and full name on edit/open.
function SessionGroupSelector({ 
  session, 
  player, 
  groups, 
  packageGroupId, 
  updateMasterData, 
  disabled 
}: { 
  session: any; 
  player: any; 
  groups: any[]; 
  packageGroupId: string; 
  updateMasterData: any; 
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  let gId = session.groupId;
  if (!gId && packageGroupId) gId = packageGroupId;
  if (!gId) gId = player.groupId;

  const currentGroup = groups.find(g => String(g.id) === String(gId));

  // Filter to active groups only
  const activeGroups = groups.filter(g => {
    if (player.groupAssignments && player.groupAssignments.length > 0) {
      const assignment = player.groupAssignments.find((a: any) => String(a.groupId) === String(g.id));
      return assignment?.isActive === true;
    }
    return player.groupId && String(g.id) === String(player.groupId);
  });

  const handleSelect = async (groupId: string) => {
    await updateMasterData('sessions', session.id!, { groupId });
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-transparent border border-transparent hover:border-slate-800 focus:border-slate-700 focus:bg-slate-900 rounded text-[10px] md:text-sm text-slate-300 font-bold uppercase p-1 w-[120px] cursor-pointer text-left flex items-center justify-between gap-1 outline-none transition-all"
      >
        <span>{currentGroup ? currentGroup.code : 'NO GRP'}</span>
        <span className="text-slate-500 text-[8px]">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 z-50 w-60 rounded-xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden py-1">
          {activeGroups.length === 0 ? (
            <div className="px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">No Active Groups</div>
          ) : (
            activeGroups.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleSelect(g.id)}
                className={`w-full text-left px-4 py-2.5 text-xs md:text-sm font-semibold uppercase hover:bg-slate-800 transition-colors flex items-center gap-2 ${String(g.id) === String(gId) ? 'text-blue-400 bg-slate-800/40' : 'text-slate-300'}`}
              >
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color || '#3b82f6' }} />
                <span>{g.code} - {g.name}</span>
              </button>
            ))
          )}
          <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full text-left px-4 py-2.5 text-xs border-t border-slate-800/50 md:text-sm font-semibold uppercase hover:bg-slate-800 transition-colors flex items-center gap-2 ${!gId ? 'text-blue-400 bg-slate-800/40' : 'text-slate-500'}`}
          >
            <div className="h-2.5 w-2.5 rounded-full bg-slate-700 shrink-0" />
            <span>NO GROUP</span>
          </button>
        </div>
      )}
    </div>
  );
}



