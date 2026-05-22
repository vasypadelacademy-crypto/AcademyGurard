import React, { useMemo, useEffect, useState } from 'react';

const parseISO = (val: any) => {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  return _parseISO(val);
};
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext';
import { format, parseISO as _parseISO } from 'date-fns';
import { Printer, ArrowLeft, Download, Mail } from 'lucide-react';
import { formatCurrency, cn, formatTimeAMPM, toTitleCase } from '../lib/utils';
import { VpLogoSvg } from '../components/VpLogoSvg';
import html2pdf from 'html2pdf.js';

export default function PlayerReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { players, packages, sessions, locations } = useData();

  const player = players.find(p => String(p.id) === String(id));
  const playerPackages = useMemo(() => {
    if (!id) return [];
    return packages
      .filter(pk => pk.playerId && String(pk.playerId) === String(id))
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }, [packages, id]);

  const pkg = playerPackages[0];
  const pkgLabel = `M${playerPackages.length}`;

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    if (player && pkg) {
      const originalTitle = document.title;
      // Chronological index (asc) to match M1, M2 pattern
      // playerPackages is sorted desc, so idx 0 is M{length}
      const pkgLabel = `M${playerPackages.length}`;
      document.title = `Academy Report - ${player.name} - ${pkgLabel}`;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [player, pkg, playerPackages.length]);

  const handleEmailReport = async () => {
    if (!player.email) {
      alert("This player doesn't have an email address set in their profile.");
      return;
    }

    setIsSendingEmail(true);
    try {
      const element = document.querySelector('.print-container');
      const opt = {
        margin: 10,
        filename: `Academy_Report_${player.name}_${pkgLabel}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 1.5, 
          useCORS: true,
          windowWidth: 1200,
          onclone: (doc: Document) => {
            const container = doc.querySelector('.print-container') as HTMLElement;
            if (container) {
              container.classList.remove('border-4', 'p-12', 'shadow-bento', 'border-slate-900', 'bg-white');
              container.classList.add('p-0', 'border-0');
              container.style.width = '1200px';
              container.style.maxWidth = '1200px';
              container.style.overflow = 'visible';
              container.style.height = 'auto';
              
              const hidden = container.querySelectorAll('.print\\:hidden');
              for (let i = 0; i < hidden.length; i++) {
                hidden[i].remove();
              }
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      // Generate PDF as base64
      // @ts-ignore
      const pdfBase64 = await html2pdf().from(element).set(opt).outputPdf('datauristring');
      const base64Data = pdfBase64.split(',')[1];

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: player.email,
          subject: `Attendance Report - C. ${toTitleCase(player.name)} - ${pkgLabel}`,
          body: `Hello C. ${toTitleCase(player.name)},\n\nPlease find attached your Attendance Report from Vas-y Padel Academy.\n\nBest regards,\nVas-y Padel Academy`,
          attachmentData: base64Data,
          attachmentName: `Academy_Report_${toTitleCase(player.name)}_${pkgLabel}.pdf`,
          isPdf: true
        })
      });

      const result = await response.json();
      if (result.success) {
        alert("Email sent successfully to " + player.email);
      } else {
        alert("Failed to send email: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error generating/sending report:", error);
      alert("An error occurred while trying to send the email. Please check console for details.");
    } finally {
      setIsSendingEmail(false);
    }
  };
  
  const isExcluded = (status: string | undefined | null) => {
    if (!status || status === 'Scheduled') return true;
    const EXCLUDED = ['Cancelled', 'Hold', 'Regret', 'Exceptional Regret'];
    return EXCLUDED.includes(status);
  };

  // Strictly filter sessions to ONLY this player AND ONLY their owned packages
  const allPlayerSessions = useMemo(() => {
    if (!id || playerPackages.length === 0) return [];
    const pkgIds = new Set(playerPackages.map(p => String(p.id)));
    return sessions.filter(s => 
      String(s.playerId) === String(id) && 
      pkgIds.has(String(s.packageId))
    );
  }, [sessions, playerPackages, id]);

  const pkgSessions = useMemo(() => {
    if (!pkg) return [];
    return sessions
      .filter(s => String(s.packageId) === String(pkg.id) && String(s.playerId) === String(id))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [sessions, pkg, id]);

  const stats = useMemo(() => {
    const validPkgSessions = pkgSessions.filter(s => !isExcluded(s.status));
    const attendedSessions = validPkgSessions.filter(s => 
      ['Attended', 'Compensated', 'Attended Comp. Session'].includes(s.status)
    );
    const attendedCount = attendedSessions.length;
    
    // Basis is now ONLY the non-excluded recorded sessions to ensure rate reflects progress
    const totalPossible = validPkgSessions.length || (attendedCount > 0 ? attendedCount : 0);
    
    const pkgRate = totalPossible > 0 ? Math.round((attendedCount / totalPossible) * 100) : 100;

    return {
      attended: attendedCount,
      compensated: pkgSessions.filter(s => s.status === 'Compensated' || s.status === 'Attended Comp. Session').length,
      regrets: pkgSessions.filter(s => ['Regret', 'Exceptional Regret'].includes(s.status)).length,
      absent: pkgSessions.filter(s => s.status === 'Absent').length,
      cancelled: pkgSessions.filter(s => s.status === 'Cancelled').length,
      hold: pkgSessions.filter(s => s.status === 'Hold').length,
      total: totalPossible,
      pkgRate
    };
  }, [pkgSessions]);

  const pkgTypes = useMemo(() => {
    const types = new Set<string>();
    pkgSessions.forEach(s => {
      const type = (s.sessionIndex || '').split('-')[0];
      if (type && isNaN(Number(type))) {
        types.add(type);
      } else if (type && !isNaN(Number(type))) {
        // Handle cases where might be just a number, though usually it's G2, Pvt etc.
        types.add('Mixed');
      }
    });
    const sortedTypes = Array.from(types).sort();
    return sortedTypes.join(' / ') || 'Mixed';
  }, [pkgSessions]);

  if (!player || !pkg) return <div className="p-8 text-center font-bold text-gray-500">No active package found for this player.</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-12 print:p-0 print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
            font-size: 8pt !important;
          }
          /* Ensure everything stays on one page */
          .print-scale {
            transform: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            border: none !important;
          }
          .print-no-break {
            break-inside: avoid;
          }
          .print-compact-gap {
            gap: 8px !important;
          }
          .print-table th, .print-table td {
             padding: 2px 4px !important;
             font-size: 7.5pt !important;
             white-space: normal !important;
             line-height: 1.2 !important;
             border: 1px solid #0f172a !important;
          }
          .print-table th {
             background-color: #0f172a !important;
             color: white !important;
             -webkit-print-color-adjust: exact;
          }
          .print-table td:last-child {
             min-width: 120px !important;
             max-width: none !important;
          }
          .print-hide {
            display: none !important;
          }
          /* Prevent horizontal squashing */
          .print-container {
            width: 100% !important;
            max-width: none !important;
            transform: none !important;
            display: block !important;
          }
        }
      `}} />
      <div className="print-container max-w-5xl mx-auto border-4 border-slate-900 p-12 bg-white shadow-bento print:shadow-none print:border-0 print:p-0 print:max-w-none print:w-full">
        {/* Navigation for web view */}
        <div className="flex justify-between items-center mb-10 print:hidden">
          <Link to={`/players/${id}`} className="flex items-center gap-3 bg-white text-slate-900 px-5 py-2.5 rounded-xl border-2 border-slate-900 shadow-bento-subtle font-black uppercase text-sm tracking-widest hover:bg-slate-50 transition active:translate-y-0.5">
            <ArrowLeft size={16} strokeWidth={3} />
            Back to Profile
          </Link>
          <div className="flex gap-3">
            <button 
              onClick={handleEmailReport} 
              disabled={isSendingEmail}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl border-2 border-blue-600 shadow-bento-subtle font-black uppercase text-sm tracking-widest transition active:translate-y-0.5 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Mail size={18} strokeWidth={3} />
              {isSendingEmail ? 'Sending...' : 'Email Report'}
            </button>
            <button 
              onClick={() => window.print()} 
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl border-2 border-slate-900 shadow-bento-subtle font-black uppercase text-sm tracking-widest transition active:translate-y-0.5 hover:bg-slate-800"
            >
              <Printer size={18} strokeWidth={3} />
              Print Report
            </button>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-12 print:mb-8">
          <div className="flex flex-col items-start gap-0">
            <div className="flex items-center gap-3 print:gap-2 mb-2 print:mb-1">
              <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shrink-0 print:w-6 print:h-6 text-slate-900">
                 <VpLogoSvg className="w-full h-full" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-slate-900 leading-none italic print:text-2xl print:whitespace-nowrap print:leading-none">VAS-Y PADEL ACADEMY</h1>
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-base md:text-lg font-black text-slate-500 uppercase tracking-[0.3em] print:text-[10px] whitespace-nowrap leading-none">ATTENDANCE REPORT</h2>
              <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-widest">{pkgLabel}</span>
            </div>
            <p className="text-3xl md:text-4xl font-black text-emerald-500 uppercase tracking-tight italic mt-4 print:mt-2 print:text-xl whitespace-nowrap leading-none">C. {toTitleCase(player.name)}</p>
          </div>
          
          <div className="grid grid-cols-4 gap-2 mt-8 md:mt-0 print:gap-1.5">
            <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center min-w-[100px] print:p-2 print:min-w-[80px]">
              <span className="text-2xl font-black text-slate-900 leading-none mb-1 print:text-lg">{formatCurrency(pkg.totalDue)}</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest print:text-[6px]">Package Value</span>
            </div>
            <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center min-w-[100px] print:p-2 print:min-w-[80px]">
              <span className="text-2xl font-black text-emerald-600 leading-none mb-1 print:text-lg">{formatCurrency(pkg.paidAmount || 0)}</span>
              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest print:text-[6px]">Amount Paid</span>
            </div>
            <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 flex flex-col items-center justify-center min-w-[100px] print:p-2 print:min-w-[80px]">
              <span className="text-2xl font-black text-amber-600 leading-none mb-1 print:text-lg">{formatCurrency(pkg.totalDue - (pkg.paidAmount || 0))}</span>
              <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest print:text-[6px]">Pending Bal.</span>
              {(pkg.totalDue - (pkg.paidAmount || 0)) > 0 && (
                <span className="text-[6px] font-normal text-slate-500 uppercase tracking-tighter leading-none mt-1 print:text-[5px]">Settled via Instapay: 01222200548</span>
              )}
            </div>
            <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-3 flex flex-col items-center justify-center min-w-[100px] print:p-2 print:min-w-[80px]">
              <span className="text-2xl font-black text-emerald-600 leading-none mb-1 print:text-lg">{stats.pkgRate}%</span>
              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest print:text-[6px]">Pkg Rate</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] font-black text-slate-400 mb-10 border-b-2 border-slate-100 pb-4 uppercase tracking-widest space-x-4 print:mb-2 print:pb-1 print:text-[8px]">
           <span>ID {player.id.slice(0, 8).toUpperCase()}</span>
           <span>·</span>
           <span>GROUP {player.groupIndex || 'N/A'}</span>
           <span>·</span>
           <span>{player.groupName || 'N/A'}</span>
           <span>·</span>
           <span>PACKAGE {pkgLabel}</span>
        </div>

        {/* Current Package Stats Grid */}
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mb-10 print:mb-2 print-compact-gap">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center print:p-1.5">
            <span className="text-xl font-black text-emerald-600 block mb-1 print:text-sm">{stats.attended}</span>
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest print:text-[7px]">Attended</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center print:p-1.5">
            <span className="text-xl font-black text-blue-600 block mb-1 print:text-sm">{stats.compensated}</span>
            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest print:text-[7px]">Comp.</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center print:p-1.5">
            <span className="text-xl font-black text-amber-600 block mb-1 print:text-sm">{stats.regrets}</span>
            <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest print:text-[7px]">Regrets</span>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center print:p-1.5">
            <span className="text-xl font-black text-red-600 block mb-1 print:text-sm">{stats.absent}</span>
            <span className="text-[8px] font-black text-red-400 uppercase tracking-widest print:text-[7px]">Absent</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center opacity-50 print:p-1.5">
            <span className="text-xl font-black text-slate-400 block mb-1 print:text-sm">{stats.cancelled}</span>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest print:text-[7px]">Cancelled</span>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center print:p-1.5">
            <span className="text-xl font-black text-indigo-600 block mb-1 print:text-sm">{stats.hold}</span>
            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest print:text-[7px]">Hold</span>
          </div>
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3 text-center print:p-1.5">
            <span className="text-xl font-black text-emerald-600 block mb-1 print:text-sm">{stats.pkgRate}%</span>
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest print:text-[7px]">Pkg Rate</span>
          </div>
        </div>

        {/* Financial Report Section */}
        <div className="flex items-center justify-between pt-6 pb-2 border-b-2 border-slate-200 mb-6 print:pt-2 print:mb-2">
           <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] print:text-[9px]">FINANCIAL REPORT — PACKAGE {pkgLabel}</h3>
        </div>

        <div className="bg-white border-2 border-slate-900 rounded-[2rem] overflow-hidden mb-10 shadow-bento-subtle print:mb-4">
          <table className="w-full text-xs text-left border-collapse print-table">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-black tracking-widest border-b-2 border-slate-900">
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">PKG</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">TYPE</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">DISCOUNT</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">PKG VALUE</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">AMOUNT PAID</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">STATUS</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-5 font-black text-slate-900 italic print:px-2 print:py-1">{pkgLabel}</td>
                <td className="px-6 py-5 font-bold text-slate-600 print:px-2 print:py-1">{pkgTypes}</td>
                <td className="px-6 py-5 font-bold text-slate-600 print:px-2 print:py-1">{pkg.discountAmount ? formatCurrency(pkg.discountAmount) : '—'}</td>
                <td className="px-6 py-5 font-black text-slate-900 print:px-2 print:py-1">{formatCurrency(pkg.totalDue)}</td>
                <td className="px-6 py-5 font-black text-emerald-600 print:px-2 print:py-1">{formatCurrency(pkg.paidAmount || 0)}</td>
                <td className="px-6 py-5 print:px-2 print:py-1">
                  <span className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest italic print:px-1.5 print:py-0.5 print:text-[8px]",
                    pkg.status === 'Paid' ? "bg-emerald-100 text-emerald-700" :
                    pkg.status === 'Partially Paid' ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  )}>{pkg.status || 'Not Paid'}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Attendance Table */}
        <div className="flex items-center justify-between pt-6 pb-2 border-b-2 border-slate-200 mb-6 print:pt-2 print:mb-2">
           <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] print:text-[9px]">PACKAGE {pkgLabel} — ATTENDANCE SCHEDULE</h3>
        </div>

        <div className="bg-white border-2 border-slate-900 rounded-[2rem] overflow-hidden mb-10 shadow-bento-subtle print:mb-4">
          <div className="bg-slate-50 p-6 border-b-2 border-slate-900 flex items-center justify-between print:p-3">
            <div className="flex items-center gap-5 cursor-pointer hover:bg-slate-100 p-2 -m-2 rounded-xl transition-colors print:gap-2" onClick={() => navigate(`/players/${id}?pkgId=${pkg.id}`)}>
               <h4 className="text-sm font-black text-slate-900 italic uppercase tracking-tight print:text-xs">Package {pkgLabel}</h4>
               <div className="flex gap-5 text-[10px] font-bold text-slate-500 uppercase tracking-widest print:gap-2 print:text-[8px]">
                  <span>{pkgTypes}</span>
                  <span>{stats.total} sessions</span>
               </div>
            </div>
            <div className="flex items-center gap-6 print:gap-2">
               <div className="flex items-center gap-4 text-[10px] font-black uppercase italic print:text-[8px] print:gap-2">
                 <span className="text-emerald-600">{stats.attended} att.</span>
                 <span className="text-amber-500">{stats.total - stats.attended} rem.</span>
               </div>
               <div className="w-32 h-2 bg-white border-2 border-slate-900 rounded-full overflow-hidden print:w-16 print:h-1.5">
                  <div className="h-full bg-emerald-500" style={{ width: `${stats.pkgRate}%` }} />
               </div>
               <span className="text-sm font-black text-slate-900 italic print:text-xs">{stats.pkgRate}%</span>
            </div>
          </div>

          <table className="w-full text-xs text-left border-collapse print-table">
            <thead>
              <tr className="bg-slate-900 text-white font-black tracking-widest print:bg-slate-900">
                <th className="px-6 py-4 w-10 uppercase text-[9px] print:px-2 print:py-1">#</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">SESSION</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">DATE</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">DAY</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">TIME</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">LOCATION</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">STATUS</th>
                <th className="px-6 py-4 uppercase text-[9px] print:px-2 print:py-1">COMMENT</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {pkgSessions.map((s, i) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-400 italic font-medium print:px-2 print:py-0.5">{i+1}</td>
                  <td className="px-6 py-4 font-black text-slate-900 italic uppercase tracking-tight print:px-2 print:py-0.5">{(pkg?.packageTypeCode || 'SES')}-{i+1}</td>
                  <td className="px-6 py-4 font-bold text-slate-600 print:px-2 print:py-0.5">{s.date ? format(parseISO(s.date), 'dd/MM/yyyy') : '-'}</td>
                  <td className="px-6 py-4 text-slate-500 uppercase font-medium print:px-2 print:py-0.5">{s.date ? format(parseISO(s.date), 'EEEE') : '-'}</td>
                  <td className="px-6 py-4 font-black text-slate-800 italic print:px-2 print:py-0.5">{formatTimeAMPM(s.startTime)}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium print:px-2 print:py-0.5">{locations.find(l => l.id === s.locationId)?.name || '-'}</td>
                  <td className="px-6 py-4 print:px-2 print:py-0.5">
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter italic print:px-1.5 print:py-0.1 print:text-[7px]",
                      s.status === 'Attended' || s.status === 'Attended Comp. Session' ? "bg-emerald-100 text-emerald-700" :
                      s.status === 'Compensated' ? "bg-blue-100 text-blue-700" :
                      ['Regret', 'Exceptional Regret'].includes(s.status) ? "bg-amber-100 text-amber-700" :
                      s.status === 'Absent' ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-600"
                    )}>{s.status || 'Scheduled'}</span>
                  </td>
                  <td className="px-6 py-4 text-[11px] text-slate-400 italic font-medium print:px-2 print:py-0.5">{s.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Audit Section */}
        <div className="grid grid-cols-2 gap-12 pt-12 border-t-2 border-slate-100 mt-16 print:mt-4 print:pt-4 print:gap-12">
          <div className="border-b-2 border-slate-900 pb-2 print:pb-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-8 print:mb-2 print:text-[7px]">Coach/Admin Verification</span>
            <p className="text-sm font-black text-slate-900 uppercase tracking-tighter print:text-[9px]">C. {pkg.coachName || 'Omar Wael'}</p>
          </div>
          <div className="border-b-2 border-slate-900 pb-2 print:pb-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-8 print:mb-2 print:text-[7px]">Guardian/Athlete Acknowledgement</span>
          </div>
        </div>

        <div className="mt-16 flex items-center justify-center gap-4 text-[10px] text-slate-300 font-black uppercase tracking-[0.4em] opacity-50 print:mt-4 print:text-[8px] print:gap-2">
            <div className="h-6 w-6 flex items-center justify-center shrink-0 print:h-4 print:w-4 text-slate-300 print:text-slate-900">
               <VpLogoSvg className="w-full h-full" />
            </div>
            Operational Document Generated via Vas-y Padel Academy Intelligence System
        </div>
      </div>
    </div>
  );
}
